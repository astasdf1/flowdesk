# ADR 0001: OpenCode Plugin-First FlowDesk

## Status

Accepted for initial implementation.

## Context

FlowDesk is intended to replace an OMO-based OpenCode environment with a smaller, policy-first orchestration plugin. The user should stay inside normal OpenCode workflows while FlowDesk adds planning, routing, Guard approval, usage checks, runtime telemetry, audit, and recovery.

The previous DEX Conductor work proved several useful contracts: Workflow Plans, Guard requests, provider-native usage snapshots, runtime capability artifacts, execution echo validation, audit lineage, checkpoints, and Policy Pack boundaries. It also showed that a CLI/subprocess adapter can be useful for tests and migration, but it should not be the primary user experience.

OpenCode's plugin APIs expose hooks, tools, events, configured commands, command routing fields, and package loading. Some surfaces are not strong enough to treat as authority without conformance tests. In particular, automatic chat blocking, command alias parsing, real model/agent binding, runtime echo evidence, and harness event telemetry must be verified against a pinned OpenCode version before production dispatch. OpenCode 1.14.40 PoC evidence supports Release 1 chat-routed command-backed flows and hook-harness containment, but not hard chat no-reply/cancel authority.

## Decision

FlowDesk will be implemented as an OpenCode plugin-first project.

Primary identity:

1. Project name: FlowDesk.
2. Public name: FlowDesk for opencode.
3. Repository slug: `flowdesk`.
4. OpenCode plugin id: `flowdesk`.
5. Primary package: `@flowdesk/opencode-plugin`.
6. Project data root: `.flowdesk/`.

Release 1 will be a General-Use MVP with chat-routed command-backed workflows, not the final hard chat-first or real-dispatch product:

1. Natural-language chat is the primary UX for ordinary work and routes accepted requests into guarded command-backed FlowDesk workflows.
2. Desired `/flowdesk:*` aliases are enabled only after command parser conformance proves they work on the pinned OpenCode version.
3. Portable commands such as `/flowdesk-doctor`, `/flowdesk-plan`, `/flowdesk-run`, `/flowdesk-status`, `/flowdesk-resume`, `/flowdesk-retry`, `/flowdesk-abort`, `/flowdesk-usage`, and `/flowdesk-export-debug` remain setup, status, recovery, diagnostics, and fallback controls.
4. Release 1 supports installer bootstrap, doctor checks, chat-routed plan/status/recovery, hook harness `enforce`/`observe`/`off` modes, guarded dry-run, fake-runtime dispatch, redacted audit, abnormal-use manual guidance, and conformance reporting.
5. Real OpenCode dispatch, hard chat-first managed execution, evaluation scoring, and specialist reference-pack workflows remain disabled until later gates pass.

FlowDesk Guard is the sole dispatch authority. Plugin hooks, OpenCode permission prompts, event telemetry, TUI surfaces, runtime echoes, model text, and command handlers may observe, constrain, or report state, but they must not approve execution or widen scope.

The plugin must not use nested `opencode run` for normal plugin-managed workflows. Subprocess adapters may exist only in compatibility or fake-runtime test harnesses. `opencode run` may also be used as a manual provider smoke test or diagnostic probe, but it is not a delegated-lane, subagent, or parallel multi-model orchestration primitive. Each invocation is a single non-interactive OpenCode session with its own startup, plugin, provider, and auth behavior; launching several processes does not prove coordinated parallel fan-out or safe in-session lane observability.

## Consequences

Benefits:

1. The implementation can start without betting the product on unverified chat blocking semantics.
2. OpenCode API uncertainty is isolated into conformance tests and release gates.
3. OMO removal and supply-chain hardening become explicit installer and doctor responsibilities.
4. CLI/subprocess code can be reused safely as a test harness instead of becoming hidden production architecture.
5. Event hooks can be treated as harness telemetry prerequisites without becoming authority.

Trade-offs:

1. Release 1 can satisfy ordinary user workflow goals through chat routing while keeping privileged work inside command-backed guarded flows.
2. Hard chat-first natural-language managed dispatch requires a later conformance-proven release, even though Release 1 uses chat as the normal entry point.
3. Real OpenCode dispatch requires more evidence: trusted model/agent binding, runtime echo, and event telemetry correlation.
4. Specialist workflows and evaluation scoring are delayed to avoid expanding the first safety boundary.

## Non-Goals

FlowDesk will not implement:

1. OMO compatibility.
2. OMO prompts, agents, skills, task files, or team runtime.
3. A CLI-first product path.
4. A model gateway that hides provider identity.
5. Runtime policy decisions that happen only in OpenCode hooks.
6. Legal, patent, clinical, regulatory, or compliance signoff.
7. Project-specific DEX-2 paths or harness assumptions in core/plugin behavior.

## Follow-Up Decisions

Future ADRs should cover:

1. The pinned OpenCode release or commit selected for production conformance.
2. Whether OpenCode 1.14.40 chat routing and hook harness behavior remain the pinned Release 1 target or are replaced by newer conformance evidence.
3. The final package scope if `@flowdesk/*` is not used.
4. The first real-dispatch runtime binding strategy.
5. The reference-pack distribution model.
6. The first enabled specialist workflow and its jurisdiction scope.
