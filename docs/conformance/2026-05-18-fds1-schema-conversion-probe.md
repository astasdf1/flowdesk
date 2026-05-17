# FlowDesk FDS-1 Schema Conversion Probe

Date: 2026-05-18

OpenCode version: 1.14.40

Scope: isolated disposable OpenCode sandbox with a sandbox-local home and project-local plugin config. Raw local paths are intentionally omitted from this persisted summary.

## Verdict

The sandbox probe is a **partial pass** for OpenCode plugin registration and direct tool execution, but a **fail-closed blocker** for promoting FDS-1 to production registration as currently specified.

The blocker is provider-facing schema closedness. OpenCode 1.14.40 registers plugin tools from `tool({ args, execute })` by wrapping raw Zod shapes with `z.object(def.args)`. The resulting JSON Schema contains the expected properties and required fields, but does not emit `additionalProperties: false`. FlowDesk's canonical schema artifacts are closed and the handler-level validator rejects unknown properties, but the OpenCode provider-facing schema is not closed.

Production registration remains blocked until either:

1. A narrower FDS profile is specified and proven against the pinned OpenCode conversion path, or
2. The specification explicitly accepts OpenCode provider-facing schemas without `additionalProperties: false` only when FlowDesk runtime validation rejects unknown properties before any privileged behavior.

## What Passed

1. The sandbox-local plugin config can opt into a probe mode without changing the default server surface.
2. Default plugin mode still exposes only the inert `flowdesk_pre_spike_doctor` tool.
3. Probe mode exposes the 9 Release 1 minimum tool names:
   - `flowdesk_doctor`
   - `flowdesk_plan`
   - `flowdesk_run`
   - `flowdesk_status`
   - `flowdesk_resume`
   - `flowdesk_retry`
   - `flowdesk_abort`
   - `flowdesk_usage`
   - `flowdesk_export_debug`
4. `opencode debug agent build --tool <tool> --params <valid fixture>` directly executed every probe tool without provider dispatch.
5. Every probe handler returned blocked JSON with:
   - `accepted: false`
   - `requestSchemaValid: true` for valid fixtures
   - `responseSchemaValid: true`
   - `blockedReason: "missing_passing_fds1_schema_conversion_artifact"`
   - `productionRegistrationEligible: false`
   - `dispatchApprovalEligible: false`
   - `providerCall: false`
   - `runtimeExecution: false`
6. A negative unknown-property probe through `opencode debug agent` returned `requestSchemaValid: false` and did not execute any privileged behavior.
7. The OpenCode experimental tool listing endpoint exposed all 9 probe tools plus the pre-spike doctor and generated JSON Schema properties and required fields for every Release 1 probe tool.

## What Failed

The generated OpenCode JSON Schemas did not include `additionalProperties: false` for any FlowDesk tool schema in the inspected conversion output.

This prevents declaring the current FDS-1 profile production-ready because FlowDesk's canonical schema artifacts are closed and production registration must not weaken the tool argument contract without an explicit conformance decision.

## Safety Interpretation

This failure does not create a runtime dispatch vulnerability in the current implementation because:

1. Probe mode is opt-in only in the sandbox-local plugin configuration.
2. Default mode remains inert.
3. Handlers terminate at `runFlowDeskPreSpikePluginToolStub`.
4. Handler-level validation rejects unknown properties.
5. All returned results remain blocked and non-authorizing.
6. No provider call, real OpenCode dispatch, actual lane launch, fallback/reselection, or hard chat cancellation path was enabled.

## Next Workflow

1. Keep production tool registration blocked.
2. Preserve the sandbox-only probe as conformance tooling.
3. Decide whether to narrow FDS-1 or introduce an explicit compatibility note for OpenCode 1.14.40 raw-shape schemas.
4. If accepting handler-level closed validation as the compatibility boundary, update the specification and conformance plan before flipping any production registration flag.
5. Re-run the sandbox probe and negative unknown-property probes after any FDS profile change.
