# Release 3 Remote Write Connector Gate Contracts

Date: 2026-05-22

## Scope

This slice adds local core contracts for remote write connector gating. It does not perform a remote write, install a connector tool, call GitHub, call an HTTP endpoint, write to storage/database, or enable arbitrary shell/API writes. The product direction after this slice is a `ConnectorProfile`/recipe/playbook driven generic gateway, not one hard-coded adapter per remote service.

## Added Contracts

`@flowdesk/core` now exposes:

1. `flowdesk.remote_write_connector_capability.v1`
   - Records connector kind, active profile, required/installed/missing tool refs, auth scope, discovery time, capability state, and optional install-plan ref.
   - Represents environment capability discovery only.

2. `flowdesk.remote_write_connector_install_plan.v1`
   - Records requested tool refs, package/source/version refs, rollback ref, and explicit approval requirement.
   - Does not pre-approve installation.

3. `flowdesk.remote_write_plan.v1`
   - Records connector kind/ref, target ref, content hash, redaction policy, auth scope, capability ref, pre-write audit, idempotency key, and expected remote-ref shape.
   - Forbids raw URLs, raw paths, repo locators, database paths, token/secret markers, and write attempts.

4. `flowdesk.remote_write_connector_execution_readiness.v1`
    - Evaluates whether a connector capability, write plan, and consumed `external_write` approval are ready for a later generic connector gateway.
   - Keeps `remote_write_attempted=false`, `external_write_authority_enabled=false`, and all dispatch/provider/lane/runtime authority disabled.

## Safety Boundary

Remote writes are now planned as connector-gated behavior rather than permanently blocked behavior. The required execution order is:

1. Discover connector capability.
2. If tools are missing, create an install/activation plan.
3. Obtain explicit approval before installation or connector activation.
4. Create a dry-run remote write plan.
5. Bind redaction policy, content hash, auth scope, pre-write audit, and idempotency key.
6. Consume scoped `external_write` approval.
7. Only then may a future generic connector gateway execute a profile/recipe-bound operation.
8. Persist only redacted remote refs and verification summaries.

## Verification

Targeted verification passed:

```text
npm test --workspace @flowdesk/core -- --test-name-pattern "remote write connector"
npm run typecheck --workspace @flowdesk/core
```

The targeted test run passed 279/279 selected core tests after build, including the new remote connector tests.

Post-implementation review lanes were attempted and retried with verdict-only prompts, but returned no deliverable output. They were not counted as approval evidence. Direct verification then checked the new core files, schema registry/artifact integration, and authority-boundary shape; the readiness artifact was tightened to explicitly expose `external_write_authority_enabled=false`.

## Remaining Gaps

1. Fake connector simulation is covered separately in `2026-05-22-release3-fake-remote-connector-adapter.md`.
2. No `ConnectorProfile` or connector recipe-ref schema yet.
3. No skill/command/agent playbook binding yet.
4. No generic connector gateway execution boundary yet.
5. No connector installation/activation executor yet.
6. No live remote write smoke.
7. No durable session-evidence class for remote connector readiness or remote write result yet.
8. No doctor/status surface for remote connector capability discovery yet.
