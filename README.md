# FlowDesk for opencode

FlowDesk is an OpenCode plugin and safety harness for turning natural-language work into guarded, recoverable AI workflows.

The long-term goal is practical orchestration: use the AI subscriptions you already pay for as effectively as possible by checking provider/account usage, preserving remaining quota, and choosing or routing work to the right model only when FlowDesk can prove the binding, usage state, provider health, audit trail, and runtime behavior are safe enough.

FlowDesk is influenced by Sakana AI's paper [Learning to Orchestrate Agents in Natural Language with the Conductor](https://arxiv.org/abs/2512.04388), which frames a learned conductor as a coordinator over pools of specialized LLM workers. FlowDesk is not an implementation of that paper. It borrows the product intuition: keep the main agent small, make orchestration explicit, and let bounded worker/reviewer lanes do the heavy work when the runtime can prove what happened.

## What Exists Today

Version `0.1.19` is the current Release 1 candidate in this repository:

```bash
npm install @flowdesk/core@^0.1.19 @flowdesk/opencode-plugin@^0.1.19
```

Add the plugin to your OpenCode config. Use the package root as the plugin
entry; OpenCode resolves npm plugin packages at the package root:

```json
{
  "plugin": ["@flowdesk/opencode-plugin"]
}
```

You can also pass plugin options inline using the tuple form. The minimum
opt-in set for the description-driven natural-language tools is:

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "providerUsageLive": {
          "enabled": true,
          "providers": ["claude", "openai", "gemini"]
        },
        "statusLive": { "enabled": true },
        "laneHeartbeatWriter": { "enabled": true },
        "chatMessageStallAlert": { "enabled": true },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ]
}
```

Release 1 is intentionally conservative. It provides a default-on, non-dispatch command-backed plugin path: planning records, guarded dry-run, deterministic fake-runtime output, status, recovery, usage/provider diagnostics, redacted debug export, bootstrap installation, visible chat steering, and provider-free local previews such as synthesis preview and durable-plan auto-continue preview. It does **not** perform real provider dispatch by default. Evidence-only guarded auto-abort, guarded auto-retry, and watchdog trigger are diagnostic/recovery aids, not default authority. The opt-in developer-mode tools are separate: `flowdesk_agent_task_run` can launch real provider-backed task lanes only after the relevant plugin option is enabled and each tool call carries `developerModeAcknowledged=true` plus `allowProviderCall=true`; `flowdesk_quick_reviewer_run` is an opt-in product helper but is currently quarantined by coordinator policy until revalidated.

The current public package is best understood as the base harness: contracts, validators, command tools, status surfaces, evidence persistence scaffolding, and safety gates needed before real usage-based model selection can become production behavior.

## Why FlowDesk Exists

Modern coding users often have access to several capable AI systems: Claude, GPT, Gemini, Codex/OpenAI, OpenCode-managed providers, and local or organization-specific subscriptions. The hard part is not only calling them. It is knowing:

- which account or provider still has usable quota,
- whether the usage signal is fresh and trustworthy,
- whether the selected model is actually the one that ran,
- whether OpenCode exposed enough runtime echo and telemetry,
- whether a workflow was audited before dispatch,
- whether a reviewer lane was separate from the authoring lane,
- and whether a fallback or retry would be safe rather than wasteful.

FlowDesk treats those as product requirements, not nice-to-have logs. Usage readiness and provider health are separate signals. Unknown, stale, shared-limit, refused, or untrusted usage does not authorize real model selection. Later releases can use remaining-usage evidence to route work, but only after performance and suitability have already selected an eligible candidate set; usage is a reserve/tie-break signal, not a replacement for fit.

## Current Commands

Release 1 exposes portable command-backed controls:

```text
/flowdesk-doctor
/flowdesk-plan
/flowdesk-run
/flowdesk-status
/flowdesk-resume
/flowdesk-retry
/flowdesk-abort
/flowdesk-usage
/flowdesk-export-debug
```

Natural-language chat is the preferred UX when OpenCode can safely steer it. Commands remain the fallback for setup, status, diagnostics, recovery, and explicit confirmation.

Bootstrap installation is available through the package bin:

```bash
flowdesk-install-release1 --profile-root <opencode-profile-dir> \
  --durable-root <flowdesk-state-dir> \
  --target-profile <profile-ref> \
  --confirmation <confirmation-ref> \
  --expires-at <iso-time>
```

The preview path writes nothing. Installation requires re-running with the exact approval phrase printed by the preview.

## Safety Boundary

FlowDesk Guard is the only dispatch authority. Status, audit, runtime echo, provider health, usage snapshots, hook observations, reviewer outputs, lane summaries, and scores are evidence or diagnostics; they are not approval.

Release 1 default behavior does not claim:

- real OpenCode provider dispatch by default,
- automatic provider/model fallback,
- actual OpenCode subtask/model/provider lane launch by default,
- hard chat cancellation or hard no-reply control,
- hidden prompt-prefix takeover,
- score-based approval,
- or community telemetry upload.

Provider-free local preview helpers such as `flowdesk_workflow_synthesis_preview` and `flowdesk_auto_continue_preview` read existing durable FlowDesk evidence and keep provider/runtime/lane/fallback/hard-chat/tool authority false. Explicit opt-in helpers such as `flowdesk_agent_task_run`, dev/beta `flowdesk_workflow_dispatch`, and dev/beta `flowdesk_controlled_write_apply` are outside default Release 1 behavior and require separate enable flags plus per-call acknowledgement/approval. They are not default Release 1 dispatch or write authority, and their evidence cannot by itself approve production dispatch.

`opencode run` is not a FlowDesk production orchestration path. It is allowed only for smoke tests, diagnostics, compatibility probes, or fake-runtime harnesses.

## Roadmap Checklist

This checklist mirrors the implementation roadmap and `docs/PROGRESS_SNAPSHOT.md`. Percentages are approximate readiness, not marketing claims.

- [x] **Phase 0: Bootstrap workspace (100%)**
  - Workspace, packages, build/test scripts, docs, and no-OMO/no-production-dispatch scaffolding exist.

- [x] **Phase 1: Core contracts (about 97%)**
  - Release 1 contracts, validators, schema artifacts, fixtures, Guard/fake-runtime/status/retry/audit/state tests, durable evidence, lane lifecycle/heartbeat/stall contracts, retry/abort/task-result evidence, and later-release reviewer-lane scaffolding exist.
  - Remaining: final product hardening around persisted lane/delegation contracts and broader live conformance evidence.

- [x] **Phase 2: Policy, usage, and audit (about 86%)**
  - Policy/effective-policy contracts, non-dispatch permissions, provider health and usage fail-closed helpers, redacted audit/debug write intents, durable session evidence, provider-native collector logic, and live usage collection for Claude, OpenAI/Codex, and Gemini Code Assist exist.
  - Remaining: provider-health expansion, richer debug bundles, and production-path evidence polish.

- [x] **Phase 3: OpenCode plugin command path (about 95%)**
  - `@flowdesk/opencode-plugin`, command-backed handlers, `/flowdesk-*` command files, bootstrap installer, safe local tools, chat intake/steering, pending confirmation behavior, status/recovery/diagnostics, and Release 1 production-eligible non-dispatch registration exist.
  - Packages are prepared as `@flowdesk/core@0.1.19` and `@flowdesk/opencode-plugin@0.1.19` for the next Release 1 package publication.
  - Remaining: user-facing hardening and continued proof that default behavior stays non-dispatch.

- [ ] **Phase 4: OpenCode conformance (about 58%)**
  - Evidence exists for OpenCode 1.14.x/1.15.x plugin loading, schema conversion, command/chat smoke tests, SDK source surfaces, prompt/promptAsync lane launch, session children metadata, reviewer verdict observation, and auth-plugin sanitizer requirements.
  - Remaining: command alias proof, optional hook-level blocking/no-reply proof if OpenCode exposes it, stronger runtime echo/telemetry proof, and broader pinned-version conformance.

- [ ] **Phase 5: Managed dispatch beta (about 73%)**
  - Core fail-closed managed-dispatch gates, durable pre-call/idempotency evidence, opt-in injected SDK adapter boundaries, runtime lane launch/lifecycle materialization, quick reviewer execution, typed verdict acceptance/linkage, fallback regate planning, controlled external-write adapters, and doctor-visible production enablement diagnostics exist.
  - Remaining: release approval, stronger production conformance, default-dispatch promotion criteria, and broader provider/auth policy proof before dispatch-capable behavior can be claimed.

- [ ] **Phase 6: Managed chat and recovery (about 65%)**
  - Conservative chat routing, visible FlowDesk suggestions, confirmation-before-run behavior, pending approval state, retry/abort/resume/usage/export-debug diagnostics, duplicate steering suppression, heartbeat stall projection, evidence-only guarded auto-abort, guarded auto-retry, watchdog trigger, and SDK-scoped session controls exist.
  - Remaining: intent detector split, broader abnormal-use recovery UX, continuation supervision, and hook-level blocking/no-reply only if OpenCode exposes a supported boundary.

- [ ] **Phase 7: Operational intelligence (about 14%)**
  - Advisory-output firewall contracts, exact-model availability cache planning, selected-cache fan-out planning, prompt-backed provider acquisition, quick reviewer fan-out, and opt-in agent task execution exist.
  - Remaining: advisory evaluation, score ledgers, reference packs, production model-selection policy, and live connector execution.

- [ ] **Phase 8: Federated score registry (0%)**
  - Planned only. Any shared score/telemetry system must be explicit opt-in, revocable, redacted, and advisory-only.

## Planned Performance-First Usage-Aware Model Selection

FlowDesk's model-selection target is deliberately stricter than “pick the cheapest or strongest model.” The primary selector is task fit: capability, policy eligibility, runtime compatibility, expected quality, and verification requirements. Remaining usage only applies inside that already-eligible set to avoid exhausting scarce providers or to break ties. A future dispatch-capable release must prove all of the following before routing work based on remaining usage:

1. fresh provider-native usage or quota evidence,
2. fresh provider health,
3. concrete provider-qualified model id,
4. trusted account/auth binding,
5. trusted runtime echo showing what actually ran,
6. sufficient telemetry correlation,
7. durable pre-dispatch audit,
8. configured verification,
9. explicit Guard approval,
10. no silent fallback or model substitution.

Until those gates pass, FlowDesk reports usage readiness and provider health as diagnostics and stays on safe command-backed, degraded, guarded dry-run, or fake-runtime paths.

## Token Use Compared With OMO/OMC

Pure OpenCode is the baseline at `1.0x` token use. OMO/OMC-style orchestration can cost more on small tasks because planning, routing, and reviewer prompts add overhead, but it can save tokens on large or repeated tasks when reusable context, bounded agents, and better failure handling prevent wasted retries. FlowDesk's current Release 1 value is mostly quota-waste prevention rather than raw token reduction. The target is to beat OMO/OMC on larger workflows by using fast-path routing, redacted durable artifacts, bounded fan-out, neutral reviewer prompts, and performance-first usage-aware model selection.

## Repository Map

- `packages/core` - contracts, validators, schemas, safety gates, usage/provider evidence, state, status, fake runtime, and lane observability.
- `packages/opencode-plugin` - OpenCode plugin registration, local command-backed tools, chat intake, bootstrap installer, and opt-in managed-dispatch adapter boundary.
- `docs/START_HERE.md` - documentation authority map.
- `docs/IMPLEMENTATION_ROADMAP.md` - release tracks and phase plan.
- `docs/PROGRESS_SNAPSHOT.md` - current implementation progress and blockers.
- `docs/OPENCODE_CONFORMANCE_PLAN.md` - OpenCode compatibility and release-gate evidence.

## Development

```bash
npm run build
npm run typecheck
npm test
```

The repository is intentionally test-heavy. A feature is not considered ready just because a type exists; it must also have a release gate, validator behavior, redaction rule, fail-closed behavior, and user-facing promise that matches the docs.

## License

MIT
