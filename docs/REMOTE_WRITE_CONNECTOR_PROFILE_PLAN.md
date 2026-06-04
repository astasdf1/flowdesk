# Remote Write Connector Profile Plan

Date: 2026-05-22

## Purpose

FlowDesk should support remote writes, but not by building one hard-coded adapter per remote service. Environments differ by installed tools, MCP servers, CLIs, APIs, auth scopes, and user policy. The implementation direction is therefore a generic connector gateway that executes only against approved `ConnectorProfile` records and referenced recipes/playbooks.

This plan supersedes any wording that implies FlowDesk should directly implement GitHub, database, storage, HTTP, or MCP-specific write adapters as the default product architecture.

## Architecture

Remote write execution is split into four layers:

1. `ConnectorProfile`: a typed, redacted profile describing connector kind, active profile binding, required tool refs, auth scope refs, safe command/API/MCP capability refs, allowed target kinds, install/activation requirements, rollback refs, and doctor/status labels.
2. `ConnectorRecipe`: an opaque, schema-validated reference to the specific operation shape, such as create issue comment, write object, update record, call MCP tool, or append ledger entry. Recipes must use typed target refs and content-hash refs, never raw URLs, raw repo locators, raw paths, raw payload bodies, or token-bearing values.
3. Skill/command/agent playbook: human-maintained operating guidance for the connector, including discovery commands, approval prompts, failure handling, rollback, and verification steps. Playbooks may describe `gh`, cloud CLIs, HTTP clients, database clients, or MCP connector packages, but they are instructions and constraints, not implicit authority.
4. Generic connector gateway: the only execution boundary. It validates the profile, recipe, plugin-verifiable capability discovery result, install/activation approval, dry-run write plan, pre-write audit, idempotency reservation, consumed `external_write` approval, execution result, and post-write observed remote ref before recording durable evidence. Remote platform proof beyond observable refs remains un-attested/skipped unless the connector exposes a verifiable boundary.

## Required Implementation Sequence

1. Add `flowdesk.connector_profile.v1` and `flowdesk.connector_recipe_ref.v1` contracts in `@flowdesk/core`.
2. Add validators for profile/profile-root binding, connector kind, allowed target kinds, required tool refs, auth scope refs, recipe refs, rollback refs, and forbidden raw locator or secret fields.
3. Extend remote write plans to bind `connector_profile_ref` and `connector_recipe_ref` rather than naming a future service-specific adapter.
4. Add doctor/status discovery surfaces that report missing tools, missing auth scope, invalid profile, install-required, activation-required, dry-run-ready, blocked, or execution-ready without exposing tokens or raw paths.
5. Add install/activation planning only as a privileged setup workflow. Missing tools produce an install plan; FlowDesk must not install, enable, or authenticate anything without explicit approval bound to actor, profile, workflow, attempt, connector kind, tool/package/source, expected version or digest where available, auth scope, and rollback guidance.
6. Add the generic connector gateway. It may execute only against a validated profile and recipe after consumed `external_write` approval, committed pre-write audit, plugin-verifiable connector capability evidence, and idempotency reservation.
7. Add durable session-evidence classes for connector readiness, execution attempt, remote write result, post-write observed remote refs, rollback/cleanup summary, and idempotency replay result. Remote platform proof beyond those observable refs remains un-attested/skipped unless the connector exposes a verifiable boundary.
8. Add fake connector simulation coverage for the gateway without real network, CLI, API, database, GitHub, storage, URL, raw-path, MCP, or provider authority.
9. Add one user-approved live smoke per connector profile kind only after the generic gateway, durable evidence, doctor/status surfaces, rollback guidance, and redaction tests pass.

## Safety Invariants

1. No raw URL, raw repository locator, raw database path, raw filesystem path, token marker, secret marker, or payload body may bypass profile and recipe validation.
2. No playbook instruction is authority. It must be converted into typed profile, recipe, approval, audit, and evidence artifacts before execution.
3. No connector installation or activation is automatic.
4. No remote write runs from arbitrary shell/API text. The gateway executes only typed operations allowed by the validated profile and recipe.
5. Idempotency is mandatory. Duplicate attempts must return the existing verified remote ref or block, not create duplicate writes.
6. Persisted evidence may contain only redacted remote refs, connector refs, hashes, timestamps, bounded labels, and verification summaries.
7. Remote write evidence cannot approve dispatch, reviewer fan-out, managed fallback, hard chat control, or operational-intelligence scoring.

## Current Status

Implemented foundation:

1. Remote write connector gate contracts for capability discovery, install/activation plans, dry-run write plans, and execution-readiness evaluation.
2. Fake remote connector simulation that proves readiness can be rechecked without enabling real remote authority.
3. Controlled local writers for `release_conformance_doc` and `redacted_audit_export`, separate from remote write authority.

Not yet implemented:

1. `ConnectorProfile` and recipe-ref schemas.
2. Skill/command/agent playbook binding.
3. Generic connector gateway execution boundary.
4. Tool discovery and install/activation executor flow.
5. Durable remote-write evidence classes.
6. Doctor/status surfaces for connector readiness.
7. Live smoke for any real connector profile.

## Core Feature Completion Check

The core unfinished product areas are:

1. Default user-facing managed dispatch: explicit opt-in SDK proof exists, but default Release 1 remains non-dispatch and production managed dispatch still needs broader conformance and release approval.
2. Runtime lane lifecycle and reviewer lanes: parent/child observation and typed verdict proof slices exist, but productized lane launch, lifecycle cleanup, no-output handling, top-tier availability cache, binding registry, and durable reviewer-lane orchestration remain incomplete.
3. Managed fallback: re-gate plans exist, but automatic provider/model switching is intentionally not implemented and remains behind full fresh re-gate plus explicit approval.
4. Remote write: local controlled writers and gate contracts exist, but real remote execution must wait for the connector profile/generic gateway plan above.
5. Operational intelligence: advisory schemas/concepts exist, but evaluation, proposal fan-out, score ledgers, reference packs, and any remote score-ledger writes remain later gates.
6. Federated score registry: documentation only; no implementation or remote ledger support yet.
7. Doctor/status/evidence surfaces: several production diagnostics exist, but connector readiness, remote write evidence, top-tier availability cache, and broader operational-intelligence status surfaces remain incomplete.
