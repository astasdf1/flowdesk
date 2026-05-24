# FlowDesk for opencode

FlowDesk is an OpenCode plugin and safety harness for turning natural-language work into guarded, recoverable AI workflows.

The long-term goal is practical orchestration: use the AI subscriptions you already pay for as effectively as possible by checking provider/account usage, preserving remaining quota, and choosing or routing work to the right model only when FlowDesk can prove the binding, usage state, provider health, audit trail, and runtime behavior are safe enough.

FlowDesk is influenced by Sakana AI's paper [Learning to Orchestrate Agents in Natural Language with the Conductor](https://arxiv.org/abs/2512.04388), which frames a learned conductor as a coordinator over pools of specialized LLM workers. FlowDesk is not an implementation of that paper. It borrows the product intuition: keep the main agent small, make orchestration explicit, and let bounded worker/reviewer lanes do the heavy work when the runtime can prove what happened.

## What Exists Today

Version `0.1.2` is the latest published release on npm:

```bash
npm install @flowdesk/core@^0.1.2 @flowdesk/opencode-plugin@^0.1.2
```

Add the plugin to your OpenCode config. The plugin entry must point at the
`/server` subpath; the package root only exports helper types:

```json
{
  "plugin": ["@flowdesk/opencode-plugin/server"]
}
```

You can also pass plugin options inline using the tuple form. The minimum
opt-in set for the description-driven natural-language tools is:

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin/server",
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

Release 1 is intentionally conservative. It provides a default-on, non-dispatch command-backed plugin path: planning records, guarded dry-run, deterministic fake-runtime output, status, recovery, usage/provider diagnostics, redacted debug export, bootstrap installation, and visible chat steering. It does **not** perform real provider dispatch.

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

FlowDesk treats those as product requirements, not nice-to-have logs. Usage readiness and provider health are separate signals. Unknown, stale, shared-limit, refused, or untrusted usage does not authorize real model selection. Later releases can use remaining-usage evidence to route work, but only behind explicit gates.

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

Release 1 does not claim:

- real OpenCode provider dispatch,
- automatic provider/model fallback,
- actual OpenCode subtask/model/provider lane launch,
- hard chat cancellation or hard no-reply control,
- hidden prompt-prefix takeover,
- score-based approval,
- or community telemetry upload.

`opencode run` is not a FlowDesk production orchestration path. It is allowed only for smoke tests, diagnostics, compatibility probes, or fake-runtime harnesses.

## Roadmap Checklist

This checklist mirrors the implementation roadmap and `docs/PROGRESS_SNAPSHOT.md`. Percentages are approximate readiness, not marketing claims.

- [x] **Phase 0: Bootstrap workspace (100%)**
  - Workspace, packages, build/test scripts, docs, and no-OMO/no-production-dispatch scaffolding exist.

- [x] **Phase 1: Core contracts (about 90%)**
  - Release 1 contracts, validators, schema artifacts, fixtures, Guard/fake-runtime/status/retry/audit/state tests, lane observability contracts, and inert later-release reviewer-lane scaffolding exist.
  - Remaining: product hardening for persisted lane/delegation contracts beyond the current Release 1 state path.

- [x] **Phase 2: Policy, usage, and audit (about 74%)**
  - Policy/effective-policy contracts, non-dispatch permissions, provider health and usage fail-closed helpers, redacted audit/debug write intents, durable session evidence, and provider-native collector logic for Claude, Codex/OpenAI, and Gemini Code Assist exist.
  - Remaining: broader production config loading, live collector integration, provider-health expansion, and debug bundle completion.

- [x] **Phase 3: OpenCode plugin command path (about 90%)**
  - `@flowdesk/opencode-plugin`, command-backed handlers, `/flowdesk-*` command files, bootstrap installer, safe local tools, chat intake/steering, pending confirmation behavior, status/recovery/diagnostics, and Release 1 production-eligible non-dispatch registration exist.
  - Packages are published as `@flowdesk/core@0.1.0` and `@flowdesk/opencode-plugin@0.1.0`.
  - Remaining: user-facing hardening and continued proof that default behavior stays non-dispatch.

- [ ] **Phase 4: OpenCode conformance (about 54%)**
  - Evidence exists for OpenCode 1.14.x plugin loading, schema conversion, command/chat smoke tests, SDK source surfaces, `prompt`/`promptAsync` subtask inputs, session children metadata, and auth-plugin sanitizer requirements.
  - Remaining: actual runtime lane lifecycle proof, command alias proof, blocking/no-reply proof, trusted runtime echo and telemetry proof, and broader pinned-version conformance.

- [ ] **Phase 5: Managed dispatch beta (about 46%)**
  - Core fail-closed managed-dispatch gate evaluator, evidence contracts, durable session-evidence persistence, doctor-visible production enablement diagnostics, usage-authority validation, provider-native collector logic, and an opt-in injected SDK adapter boundary exist.
  - Remaining: configured verification production integration, sanitizer-backed external auth/provider policy, release approval, and actual runtime lane conformance before dispatch-capable behavior can be claimed.

- [ ] **Phase 6: Managed chat and recovery (about 50%)**
  - Conservative chat routing, visible FlowDesk suggestions, confirmation-before-run behavior, pending approval state, retry/abort/resume/usage/export-debug diagnostics, and duplicate steering suppression exist.
  - Remaining: intent detector split, durable suggestion preferences, broader abnormal-use recovery UX, and blocking chat conformance.

- [ ] **Phase 7: Operational intelligence (0%)**
  - Planned only. This is where advisory proposal optimization, multi-perspective reviewer fan-out, score ledgers, and richer orchestration policies belong.

- [ ] **Phase 8: Federated score registry (0%)**
  - Planned only. Any shared score/telemetry system must be explicit opt-in, revocable, redacted, and advisory-only.

## Planned Usage-Based Model Selection

FlowDesk's model-selection target is deliberately stricter than “pick the cheapest or strongest model.” A future dispatch-capable release must prove all of the following before routing work based on remaining usage:

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
