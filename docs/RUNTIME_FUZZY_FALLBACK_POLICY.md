# Runtime Fuzzy Fallback Policy

**Status:** Active (implemented, see PROGRESS_SNAPSHOT.md entries dated 2026-06-08 for "Runtime fuzzy model binding for direct agent tasks", "Runtime task-model-selection alias evidence persistence fix", and "Runtime task-model-selection model-group boundary fix").

**Scope:** This document describes how FlowDesk resolves an unsupported or version-mismatched `providerQualifiedModelId` to a supported sibling within the same provider family and same model group at task selection time. It explains the safety boundary that prevents this resolver from being mistaken for managed provider fallback or runtime retry.

**Audience:** Operators configuring FlowDesk, developers wiring new lane launchers, and reviewers auditing model-selection evidence.

---

## 1. What "fuzzy fallback" means here

Fuzzy fallback is a **selection-phase, same-family, same-group downgrade**. When a caller requests a `providerQualifiedModelId` that the OpenCode runtime does not currently support (for example, a newer point release that has not yet been added to the supported set), FlowDesk attempts to resolve the request to a sibling model that:

1. Belongs to the same provider family (Claude / OpenAI / Gemini), and
2. Belongs to the same model group within that family (e.g. `haiku`, `sonnet`, `opus`, `mini`, `flash`, `pro`), and
3. Is present in the durable working-model snapshot (`<durableStateRoot>/model-availability/working-models.json`), and
4. Is in FlowDesk's OpenCode-supported exact-model set.

If no candidate satisfies all four conditions, the task **fails closed before any SDK call**. Fuzzy fallback never crosses model groups (no `haiku → sonnet` silent upgrades) and never crosses provider families (no `claude → openai` silent switches).

### Why it exists

Without fuzzy fallback, every published-but-not-yet-supported point release would have to be added to the OpenCode-supported set before any agent could request it. A concrete example:

- Caller requests `anthropic/claude-haiku-5.0` (hypothetical newer Haiku version, not yet in the supported set).
- Working-model snapshot contains `anthropic/claude-haiku-4-5` (supported).
- Fuzzy resolver returns `anthropic/claude-haiku-4-5` as the effective model.
- The downgrade stays inside the **haiku** group, so the caller still gets a Haiku-class model — not a silently larger or smaller model.

### Where it runs

Fuzzy fallback is applied in two selection-phase callsites only:

| Callsite | File | When |
|---|---|---|
| Direct runtime task launch | `packages/opencode-plugin/src/agent-task-runner.ts` (`executeFlowDeskAgentTaskV1()`) | Before `agentTaskLaunchPlan()` is constructed and before any SDK session is created. |
| Managed dispatch pre-SDK working-model gate | `packages/opencode-plugin/src/managed-dispatch-adapter.ts` | Before idempotency reservation or runtime dispatch. |

The same selection-phase resolver (`resolveSameFamilyOpenCodeSupportedModelFallback()` / `resolveOpenCodeRuntimeLaunchModelBindingV1()` in `packages/opencode-plugin/src/model-selection-engine.ts`) is used in both places. The managed dispatch path does **not** receive any additional fallback authority on top of selection-phase resolution.

---

## 2. Same-family, same-group guarantee

### Fallback chains

The chains are declared in `packages/core/src/task-model-selection.ts` as `SAME_FAMILY_MODEL_FALLBACK_CHAINS` and used by both the selection engine and the `flowdesk.task_model_selection.v1` validator:

| Family | Group order (no cross-group fallback) |
|---|---|
| Claude (`anthropic/` or `claude/`) | `opus` → `sonnet` → `haiku` |
| OpenAI (`openai/`) | `normal` → `mini` → `fast` → `spark` |
| Gemini (`google/` or `gemini/`) | `pro` → `flash` → `flash-lite` |

These chain values describe **which groups exist** in each family. They do **not** describe an allowed downgrade path between groups; cross-group fallback is forbidden (see Group boundary rule below).

### Group boundary rule

The validator in `task-model-selection.ts` (`extractModelGroupKeyword()` and the loop guarded by `attempted_provider_qualified_model_ids`) enforces:

> Every entry in `attempted_provider_qualified_model_ids` must share the same model-group keyword as the finally selected `provider_qualified_model_id`. Entries with no recognizable group keyword are rejected as ungrouped.

This means a fuzzy resolution chain may walk multiple exact ids inside one group, but it may never cross into a different group.

### Worked examples

**Accept — same group (haiku → haiku):**

- Requested: `anthropic/claude-haiku-5.0`
- Available in snapshot: `anthropic/claude-haiku-4-5`
- Selected: `anthropic/claude-haiku-4-5`
- Group keyword on every attempted entry: `haiku`
- Result: accepted, evidence persists.

**Accept — alias-prefix equivalence (anthropic ↔ claude):**

- Requested: `anthropic/claude-haiku-5.0` (family `claude`)
- Selected: `anthropic/claude-haiku-4-5`
- `provider_family=claude` plus `provider_qualified_model_id=anthropic/…` is accepted because `claude` and `anthropic` are alias-prefix equivalent.
- See `PROVIDER_FAMILY_PREFIX_ALIASES` in `packages/core/src/task-model-selection.ts`.

**Reject — cross-group (haiku → sonnet):**

- Requested: `anthropic/claude-haiku-5.0`
- Only available in snapshot: `anthropic/claude-sonnet-4-6`
- Resolver returns no selection (sonnet stage is not searched on behalf of a haiku request).
- Task fails closed with a redacted reason before any SDK call.

**Reject — cross-family (claude → openai):**

- Requested: `anthropic/claude-haiku-5.0`
- Only available in snapshot: `openai/gpt-5.4-mini-fast`
- Resolver returns no selection. There is no cross-family fallback authority anywhere in the runtime path.

---

## 3. Safety semantics

The fuzzy resolver is bounded by four invariants. Each one is enforced both in code and in the persisted evidence record.

### 3.1 Selection-phase only

Fuzzy resolution runs **before** `agentTaskLaunchPlan()` is constructed. By the time the OpenCode SDK (`session.create`, `session.prompt*`) is called, the effective model id is already fixed. The SDK is never asked to "try another model" mid-call.

### 3.2 No runtime retry authority

If the selected effective model fails at runtime — for example, the SDK returns an error mid-stream, or the provider rejects the request — FlowDesk does **not** automatically pick another model and retry. The lane records the failure and stops. Re-running the task is a separate, user-initiated action.

### 3.3 Fail-closed before SDK

The runtime binding resolver (`resolveOpenCodeRuntimeLaunchModelBindingV1()`) returns `{ ok: false, redactedReason }` in every situation where it cannot prove a safe binding, including:

- `durableStateRootDir` is empty.
- The computed `working-models.json` path escapes the durable state root (path-traversal guard).
- `working-models.json` does not exist or is unreadable.
- The requested model is not cached as available and no same-family supported fallback exists.
- The cached working-model snapshot contains the requested id but no same-family OpenCode-supported entry.
- The resolved selection is somehow not in the OpenCode-supported set.

When `ok: false` is returned, `executeFlowDeskAgentTaskV1()` does not call `session.create` or `session.promptAsync`. The lane terminates before any provider call.

### 3.4 Non-authorizing evidence

The persisted selection-phase evidence has three flags hard-coded to `false`:

```ts
{
  selectionPhaseOnly: true,
  runtimeRetryAttempted: false,
  fallbackAuthorityEnabled: false,
}
```

(See `FlowDeskSelectionPhaseModelFallbackEvidenceV1` in `model-selection-engine.ts`.) The corresponding `flowdesk.task_model_selection.v1` evidence also requires `fallback_allowed: false` and `reselection_allowed: false` (see `validateFlowDeskTaskModelSelectionV1` in `task-model-selection.ts`). These flags are part of the schema contract: any attempt to flip them is rejected by the validator, so downstream consumers cannot mistake selection-phase resolution for managed dispatch fallback authority.

---

## 4. Evidence chain

The full chain that a reviewer can follow from a single durable workflow:

| Stage | Field | Example value |
|---|---|---|
| Input (what the caller asked for) | `requestedProviderQualifiedModelId` / `provider_qualified_model_id` in the upstream request | `anthropic/claude-haiku-5.0` |
| Resolution evidence (what was tried, in order) | `attempted_provider_qualified_model_ids` | `["anthropic/claude-haiku-5.0", "anthropic/claude-haiku-4-5"]` |
| Output (what actually ran) | `provider_qualified_model_id` in `flowdesk.task_model_selection.v1`, plus `effectiveProviderQualifiedModelId` in the runtime binding record | `anthropic/claude-haiku-4-5` |
| Family label | `provider_family` | `claude` |
| Authority flags | `fallback_allowed`, `reselection_allowed`, `selectionPhaseOnly`, `runtimeRetryAttempted`, `fallbackAuthorityEnabled` | `false`, `false`, `true`, `false`, `false` |

Key validator behaviors to remember when inspecting evidence:

- The `provider_family` field is canonical (`claude`, `openai`, `gemini`). The `provider_qualified_model_id` prefix may be the alias form (`anthropic/`, `google/`) because of `PROVIDER_FAMILY_PREFIX_ALIASES`. This is intentional: stored evidence stays canonical while runtime ids stay exact.
- Every entry in `attempted_provider_qualified_model_ids` must share a group keyword with the selected id. A cross-group attempted entry is a validator-level error, not a warning.

---

## 5. Interaction with other boundaries

### Managed dispatch

Managed dispatch reuses the same selection-phase resolver at its working-model gate (`managed-dispatch-adapter.ts`). It does **not** open any new fallback authority. If the resolver cannot bind a same-family same-group supported model, managed dispatch fails closed before idempotency reservation, before any runtime dispatch path, and before any SDK call.

### Launcher validation

The OpenCode runtime accepts only its exact supported model ids. Without fuzzy resolution, an unsupported requested id would be rejected at the launcher boundary. With fuzzy resolution, the launcher almost always sees a supported id because the resolver has already substituted one selection-phase. When the resolver cannot substitute, the lane fails before the launcher is reached — the launcher never observes an unsupported id from FlowDesk.

### Provider alias equivalence

The validator treats the following prefixes as equivalent for the purpose of "does this model id belong to this provider family":

| Canonical family | Accepted prefixes |
|---|---|
| `claude` / `anthropic` | `claude/`, `anthropic/` |
| `gemini` / `google` | `gemini/`, `google/` |
| `openai` | `openai/` only (no alias) |

This is the source of the accept rule "stored `provider_family=claude` plus runtime `provider_qualified_model_id=anthropic/...` is valid." It is **not** an authorization to perform cross-family fallback.

### Operational Intelligence (OI) scores

OI performance scores (when enabled) act as a **tertiary tie-breaker** inside the existing selection engine after quota and fitness ties. They do not change the family or the group of the selected model and they do not interact with the same-group enforcement above.

---

## 6. Operator guidance

### To enable fuzzy fallback for a task

1. Confirm that `.flowdesk/model-availability/working-models.json` exists under the configured durable state root.
2. Confirm that the snapshot's `available_model_ids` array contains at least one OpenCode-supported model in the same group as the model you intend to request.
3. Submit the task with the desired (possibly version-mismatched) `providerQualifiedModelId`.

If both conditions hold and the resolver succeeds, the lane will run on the resolved sibling and the substitution will be visible in `flowdesk.task_model_selection.v1` evidence and in the runtime binding record.

### To opt out of fuzzy resolution for a specific task

Request a model id that is already an exact, supported, cached entry. The resolver still runs, but it returns the requested id unchanged because that id is the first candidate considered for its own stage.

### To validate that the expected model actually ran

- Run `/flowdesk-status` for the workflow and look at the per-task model rows.
- Inspect the `task_model_selection` evidence directly under the workflow's durable evidence directory. The `provider_qualified_model_id` field is the model that actually ran. The `attempted_provider_qualified_model_ids` field is the audit trail of what was tried.
- If the requested model is missing from `working-models.json`, refresh the working-model snapshot before re-running the task; the resolver fails closed rather than guessing.

### To audit that no cross-group or cross-family substitution occurred

For each `task_model_selection` evidence record:

1. Confirm that the group keyword of `provider_qualified_model_id` matches the group keyword of every entry in `attempted_provider_qualified_model_ids`.
2. Confirm that `fallback_allowed` and `reselection_allowed` are both `false`.
3. Confirm that the runtime binding record carries `selectionPhaseOnly: true`, `runtimeRetryAttempted: false`, and `fallbackAuthorityEnabled: false`.

If any of these checks fails, the validator should already have rejected the record at write time — treat any such record found in durable storage as evidence of a regression and report it.

---

## Source references

- `packages/opencode-plugin/src/model-selection-engine.ts`
  - `resolveSameFamilyOpenCodeSupportedModelFallback()`
  - `resolveOpenCodeRuntimeLaunchModelBindingV1()`
  - `SAME_FAMILY_EXACT_MODEL_FALLBACK_CHAINS`, `SAME_FAMILY_MODEL_STAGE_KEYWORDS`
  - `OPENCODE_SUPPORTED_PROVIDER_QUALIFIED_MODEL_IDS`, `DEPRECATED_PROVIDER_QUALIFIED_MODEL_IDS`
  - `FlowDeskSelectionPhaseModelFallbackEvidenceV1`, `FlowDeskRuntimeLaunchModelBindingV1`
- `packages/core/src/task-model-selection.ts`
  - `SAME_FAMILY_MODEL_FALLBACK_CHAINS`
  - `fuzzyFamilyKeywordForModelId()`
  - `extractModelGroupKeyword()` (internal; enforces the group boundary)
  - `validateFlowDeskTaskModelSelectionV1()`
  - `PROVIDER_FAMILY_PREFIX_ALIASES`
- `packages/opencode-plugin/src/agent-task-runner.ts`
  - `executeFlowDeskAgentTaskV1()` (callsite that fails closed before SDK)
- `packages/opencode-plugin/src/managed-dispatch-adapter.ts` (pre-SDK working-model gate)
- `docs/PROGRESS_SNAPSHOT.md`
  - "Runtime fuzzy model binding for direct agent tasks" (2026-06-08)
  - "Runtime task-model-selection alias evidence persistence fix" (2026-06-08)
  - "Runtime task-model-selection model-group boundary fix" (2026-06-08)
  - "Same-family selection fallback cascade" (2026-06-08)
  - "Exact-model OpenCode-supported intersection gate" (2026-06-08)

## Assumptions

- The `.flowdesk/model-availability/working-models.json` snapshot path is canonical and is the only durable input the resolver consults. (Confirmed in `resolveOpenCodeRuntimeLaunchModelBindingV1()`.)
- The OpenCode-supported set is the literal `OPENCODE_SUPPORTED_PROVIDER_QUALIFIED_MODEL_IDS` set in `model-selection-engine.ts`. Any addition or removal of supported ids is a code change, not a configuration change.
- Group keyword extraction is case-insensitive and checks more-specific keywords (`flash-lite`) before broader ones (`flash`). For OpenAI, a bare `openai/gpt-*` id with no other group keyword falls into the `normal` group.

## Open questions / known gaps

- This document covers selection-phase fuzzy fallback only. Managed provider/model **reselection** (a managed dispatch beta scope item) is out of scope; it requires its own fresh-evidence and Guard-approval gates and is not authorized by anything described here.
- A code-level retention/compaction story for `task_model_selection` evidence files is tracked separately (see PROGRESS_SNAPSHOT.md entry "R3-S6.5: Ledger Retention/Compaction Core" for the broader advisory ledger compaction work).
