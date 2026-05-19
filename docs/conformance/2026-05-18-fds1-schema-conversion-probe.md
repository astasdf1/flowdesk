# FlowDesk FDS-1 Schema Conversion Probe

Date: 2026-05-18

OpenCode version: 1.14.40

Scope: isolated disposable OpenCode sandbox with a sandbox-local home and project-local plugin config. Raw local paths are intentionally omitted from this persisted summary.

## Verdict

The sandbox probe is a **runtime-closed compatibility pass** for the FDS-1 Release 1 minimum tool shape and direct tool execution. By itself, it is **not** production OpenCode registration approval.

The compatibility boundary is FlowDesk runtime-closed validation. OpenCode 1.14.40 registers plugin tools from `tool({ args, execute })` by wrapping raw Zod shapes with `z.object(def.args)`. The resulting provider-facing JSON Schema contains the expected properties and required fields, but does not emit `additionalProperties: false`. FlowDesk's canonical schema artifacts are closed and the handler-level validator rejects unknown properties before any privileged behavior, so provider-facing closedness remains a documented caveat rather than the FDS-1 compatibility blocker.

Production registration has since been promoted only for Release 1 non-dispatch command-backed handlers after production handlers and the wider non-dispatch release gates were implemented and verified. That promotion does not depend on proving provider-facing `additionalProperties: false` emission when FlowDesk runtime validation remains closed.

The caveat to preserve is that provider-facing schema closedness is unproven for this OpenCode conversion path.

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
   - `blockedReason: "production_opencode_registration_disabled"`
   - `productionRegistrationEligible: false`
   - `dispatchApprovalEligible: false`
   - `providerCall: false`
   - `runtimeExecution: false`
6. A negative unknown-property probe through `opencode debug agent` returned `requestSchemaValid: false` and did not execute any privileged behavior.
7. The OpenCode experimental tool listing endpoint exposed all 9 probe tools plus the pre-spike doctor and generated JSON Schema properties and required fields for every Release 1 probe tool.

## Provider-Facing Caveat

The generated OpenCode JSON Schemas did not include `additionalProperties: false` for any FlowDesk tool schema in the inspected conversion output.

This does not prevent declaring FDS-1 compatible through FlowDesk runtime-closed validation, because FlowDesk canonical artifacts are closed and handler-level validation rejects unknown properties before execution. It does prevent claiming that OpenCode provider-facing schemas themselves are closed.

## Safety Interpretation

This failure does not create a runtime dispatch vulnerability in the current implementation because:

1. Probe mode is opt-in only in the sandbox-local plugin configuration.
2. Default mode remains inert.
3. Handlers terminate at `runFlowDeskPreSpikePluginToolStub`.
4. Handler-level validation rejects unknown properties.
5. All returned results remain blocked and non-authorizing.
6. No provider call, real OpenCode dispatch, actual lane launch, fallback/reselection, or hard chat cancellation path was enabled.

## Next Workflow

1. Keep the sandbox probe non-authorizing and separate from the Release 1 non-dispatch production registration surface.
2. Preserve the sandbox-only probe as conformance tooling.
3. Preserve the explicit compatibility note for OpenCode 1.14.40 raw-shape schemas: provider-facing `additionalProperties: false` is missing/null, while FlowDesk runtime validation remains closed.
4. Do not use this probe to enable real dispatch, provider calls, actual lane launch, fallback/reselection, or hard chat cancellation.
5. Re-run the sandbox probe and negative unknown-property probes after any FDS profile or OpenCode conversion-path change.
