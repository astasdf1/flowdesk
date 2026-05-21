# Release 2 External Auth Provider Policy Gate

Date: 2026-05-21

## Scope

This note records the sanitizer-backed external auth/provider policy artifact and opt-in production enablement diagnostic wiring. It is a fail-closed eligibility input only. It does not enable provider calls, real OpenCode dispatch, runtime execution, actual lane launch, automatic fallback/reselection, hard chat cancellation/no-reply authority, or release approval.

## Plan Review

The blocker-resolution plan was reviewed before implementation. Claude Opus returned `changes_required`: keep every step explicitly non-authorizing, define token-free sanitizer-backed policy artifacts before wiring, call the wiring doctor-visible fail-closed diagnostics rather than readiness, and update progress/conformance evidence. GPT and Gemini review lanes repeatedly returned no verdict and were treated as sub-agent instability rather than approval.

The final accepted plan for this slice was therefore limited to token-free artifact validation plus doctor/production enablement diagnostics.

## Implemented Artifact

`@flowdesk/core` now exports `flowdesk.external_auth_provider_policy_result.v1` through `external-auth-policy.ts`.

Validated artifact fields include:

- `external_auth_policy_ref`, `provider_policy_ref`, and `workflow_id` bound to production enablement input refs.
- concrete `provider_family` and matching `provider_qualified_model_id`.
- token-free `auth_profile_ref`, `auth_evidence_ref`, `credential_scope_ref`, and `account_boundary_ref`.
- `sanitizer_ref`, `source_ref`, `sanitized_at`, bounded `metadata_labels`, and bounded `evidence_refs`.
- `raw_auth_object_persisted: false` and `token_material_persisted: false`.
- `provider_call_made: false`, `runtime_execution_made: false`, `actual_lane_launch_made: false`, and `dispatch_authority_enabled: false`.

The validator rejects unknown properties, raw auth/token-shaped payloads, provider/model mismatches, non-concrete provider families, malformed refs, mismatched expected refs, authority flags, provider calls, runtime execution, lane launch, and dispatch authority claims.

## Production Enablement Integration

`evaluateFlowDeskProductionEnablementV1` now requires a validated external-auth/provider policy result whenever both external-auth and provider policy refs are present.

New fail-closed blocker labels:

- `external_auth_provider_policy_result_missing`
- `external_auth_provider_policy_invalid`
- `external_auth_provider_policy_failed`

When a result is valid and matched to explicit policy refs, its evidence refs are folded into production enablement `evidence_refs`, and the non-authorizing evaluation records result/ref diagnostics. A valid `failed` policy result remains doctor-visible as a failed diagnostic while keeping production enablement blocked. Missing, mismatched, malformed, token-shaped, or untrusted policy results keep production enablement blocked and are not echoed into doctor-visible result/ref fields.

## Doctor and Server Wiring

The OpenCode plugin local adapter and server options now accept `externalAuthProviderPolicyResult` as part of explicit opt-in production enablement configuration. `/flowdesk-doctor` diagnostic refs can surface:

- `production_external_auth_provider_policy_result=<passed|failed>`
- `production_external_auth_policy_ref=<ref>`
- `production_provider_policy_ref=<ref>`

Default Release 1 behavior remains unchanged. Without explicit production enablement options, the server continues to expose only safe local command-backed non-dispatch behavior.

## Verification

Commands run from the repository root:

```text
npm test -- --test-name-pattern "external auth provider policy|production enablement|server option wires production enablement|doctor diagnostic handler can surface evaluated production enablement"
```

Results:

- Targeted external-auth/provider policy and production enablement paths passed: 268/268 in the targeted command run.
- Regression coverage includes token-shaped raw input rejection, provider/model mismatch, non-concrete provider rejection, malformed option input, invalid policy result non-echo behavior, and explicit false authority flags.

## Remaining Uncertainties

- This gate validates already-sanitized, token-free metadata only. It does not read raw Claude/Gemini/OpenCode auth plugin objects.
- Durable production-path capture of sanitized auth/plugin metadata remains future conformance work.
- Release approval, actual runtime lane lifecycle proof, trusted runtime echo, sufficient production telemetry, and hard chat cancel/no-reply authority remain separate blockers.
- Managed dispatch/model selection must remain disabled until all required gates pass.
