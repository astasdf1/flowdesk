# Release 3 Managed Dispatch Production Integration Narrow Slice

Date: 2026-05-22

## Scope

This note records the D-track managed-dispatch production-integration narrow slice. The change keeps Release 1 default behavior non-dispatch and only affects the explicit opt-in managed-dispatch beta tool.

The integration lets the opt-in server tool reload durable session evidence from the configured FlowDesk durable state root when the caller omits `reloadedEvidence`. It does not introduce default real dispatch, automatic fallback, hard chat control, external writes, or reviewer fan-out authority.

## Implemented Boundary

- `createFlowDeskManagedDispatchBetaOptInTools` now accepts an optional durable state root.
- The opt-in tool still requires `boundaryInput`, `request`, and `dispatchManifest` records.
- If `reloadedEvidence` is omitted and a durable root plus `workflowId` are available, the tool calls `reloadFlowDeskSessionEvidenceV1` for that workflow before invoking the managed-dispatch adapter.
- The server passes the configured durable state root into the opt-in tool.
- The server can still build the durable idempotency reservation store from the same configured state root.

The call order remains fail-closed:

1. Reload durable session evidence.
2. Evaluate the managed-dispatch Guard boundary.
3. Validate exact request model against Guard approval.
4. Validate dispatch manifest and durable pre-call evidence.
5. Materialize and reload idempotency reservation evidence.
6. Evaluate managed-dispatch promotion.
7. Call only the injected OpenCode SDK client method.

## Evidence

Added regression coverage proves the explicit opt-in server tool can reload durable evidence from the durable root before dispatch:

- Test: `managed dispatch beta server reloads durable evidence from state root`.
- The test writes durable session-evidence records for dispatch idempotency, consumed approval source, and pre-dispatch audit.
- The tool call omits `reloadedEvidence`.
- The tool returns `dispatch_accepted` against a fake injected client.
- The fake client receives exactly one prompt call.
- The durable reservation store writes an additional `reserved` idempotency snapshot.

Validation completed in this workspace:

- LSP error diagnostics clean for the touched D-track files.
- `GIT_MASTER=1 git diff --check` passed.
- `npm run typecheck` passed.
- Full `npm test` passed: 359/359.

## OpenCode Runtime Provider Mapping

The managed-dispatch adapter now treats provider binding as a two-layer contract:

1. FlowDesk evidence, Guard approval, usage, health, and manifest records keep the FlowDesk provider-family vocabulary such as `claude/...` and `gemini/...`.
2. The injected OpenCode SDK prompt call receives the runtime provider id expected by OpenCode.

Current runtime mappings in the explicit opt-in adapter are:

- `claude` -> `anthropic`.
- `gemini` -> `google`.
- `openai` -> `openai`.

Regression coverage proves a Guard-approved `claude/sonnet-4` FlowDesk binding is passed to the fake OpenCode SDK client as `{ providerID: "anthropic", modelID: "sonnet-4" }` while preserving the exact `claude/sonnet-4` match across Guard, request, manifest, approval, and durable evidence gates.

## Live Validation Boundary

No new Claude-backed managed-dispatch live provider call was performed in this patch. The mapping blocker is now removed locally, so the next live validation step is a bounded explicit opt-in Claude managed-dispatch proof using an active OpenCode `anthropic/...` runtime binding while keeping FlowDesk evidence bound to the corresponding `claude/...` provider family.

Existing Release 3 live evidence already proves the injected SDK path and managed-dispatch adapter can complete a bounded live OpenAI call, and separately proves coordinator-controlled Claude reviewer lanes through `anthropic/claude-opus-4-5`. This D-track note does not yet extend that evidence to Claude managed-dispatch.

## Authority Result

Default Release 1 remains unchanged:

- `realOpenCodeDispatch`: disabled by default.
- `providerCall`: disabled by default.
- `runtimeExecution`: disabled by default.
- `actualLaneLaunch`: disabled by default.
- `fallbackAuthority`: false.
- `hardCancelOrNoReplyAuthority`: false.

The explicit opt-in managed-dispatch beta path remains the only path that can call the injected SDK client, and only after durable evidence reload, reservation materialization, Guard approval, manifest validation, consumed scoped approval, and promotion gates pass.

## Remaining Gaps

1. Claude managed-dispatch live proof remains to be run through the explicit opt-in adapter path using the new `claude` -> `anthropic` runtime mapping.
2. Default Release 1 real dispatch remains blocked.
3. Automatic fallback/provider switching remains blocked.
4. Hard chat `noReply`, `cancel`, or `stop` authority remains blocked.
5. Remote GitHub/connector/storage/database/URL/raw-path external writes remain blocked.
