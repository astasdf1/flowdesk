# Connector Gateway Invocation Plan

Date: 2026-05-22

## Scope

This slice adds the first generic connector gateway contract in `@flowdesk/core`. It plans a gateway invocation only when a `ConnectorProfile`, connector recipe ref, dry-run remote write plan, and remote write connector readiness artifact align.

This is a non-authorizing plan layer only. It does not execute connector tools, call CLIs, call MCP/API surfaces, install packages, write remotely, persist remote refs, or enable external write authority.

## Added Contract

`flowdesk.connector_gateway_invocation_plan.v1` records:

1. workflow and attempt refs from the dry-run remote write plan.
2. connector profile and recipe refs.
3. connector kind, target ref, content hash ref, pre-write audit ref, and idempotency key ref.
4. `state: "gateway_ready" | "blocked"` with fail-closed blocked labels.
5. `gateway_execution_attempted=false`, `remote_write_attempted=false`, `connector_write_attempted=false`, and all external-write/dispatch/provider/lane/runtime authority disabled.

## Safety Boundary

`planFlowDeskConnectorGatewayInvocationV1` blocks when:

1. connector profile, recipe, write plan, or readiness validation fails.
2. remote write readiness is not `ready`.
3. profile and recipe refs mismatch.
4. connector kinds drift between profile, recipe, write plan, or readiness.
5. recipe target kind is not allowed by the profile.
6. workflow, attempt, or readiness connector refs drift.
7. any gateway execution or remote-write authority is smuggled into the plan.

## Verification

Targeted verification passed:

```text
npm run typecheck --workspace @flowdesk/core
npm test --workspace @flowdesk/core -- --test-name-pattern "connector gateway"
```

The targeted test run passed 290/290 selected core tests after build.

## Remaining Gaps

1. No actual gateway executor exists yet.
2. No durable session-evidence class for gateway plans or remote-write results yet.
3. No doctor/status surface for connector profile, recipe, or gateway readiness yet.
4. No connector install/activation executor yet.
5. No live connector smoke.
