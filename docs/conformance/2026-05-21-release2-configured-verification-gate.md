# Release 2 Configured Verification Gate

Date: 2026-05-21

## Scope

This note records the configured-verification result artifact and production enablement integration added for the Release 2 managed-dispatch beta gate. It is a fail-closed diagnostic and eligibility input only. It does not enable real dispatch, provider calls, runtime execution, actual lane launch, fallback/reselection, hard chat cancellation/no-reply authority, or release approval.

## Implemented Artifact

`@flowdesk/core` now exports `flowdesk.configured_verification_result.v1` through `production-verification.ts`.

Validated artifact fields include:

- `verification_ref` and `workflow_id` bound to the expected production enablement input.
- `result` limited to `passed` or `failed`.
- `produced_at`, `source_ref`, bounded `check_labels`, and bounded `evidence_refs`.
- `raw_output_redacted: true`.
- `provider_call_made: false`.
- `runtime_execution_made: false`.
- `actual_lane_launch_made: false`.
- `dispatch_authority_enabled: false`.
- safe next actions limited to FlowDesk portable commands.

The validator rejects unknown properties, malformed refs, mismatched workflow or verification refs, forbidden raw payload markers, non-redacted output, and any attempted authority claim.

## Production Enablement Integration

`evaluateFlowDeskProductionEnablementV1` now requires a validated configured-verification result whenever `configuredVerificationRef` is present.

New fail-closed blocker labels:

- `configured_verification_result_missing`
- `configured_verification_invalid`
- `configured_verification_failed`

When a result is valid and matched to an explicit configured-verification ref, its evidence refs are folded into production enablement `evidence_refs`, and the non-authorizing evaluation records `configured_verification_result` plus `configured_verification_ref` for doctor/status diagnostics. Missing, failed, mismatched, malformed, or untrusted configured-verification results keep production enablement blocked and are not echoed into doctor-visible result/ref fields.

## Doctor and Server Wiring

The OpenCode plugin local adapter and server options now accept `configuredVerificationResult` as part of explicit opt-in production enablement configuration. `/flowdesk-doctor` diagnostic refs can surface:

- `production_configured_verification_result=<passed|failed>`
- `production_configured_verification_ref=<ref>`

Default Release 1 behavior remains unchanged. Without explicit production enablement options, the server continues to expose only safe local command-backed non-dispatch behavior.

## Verification

Commands run from the repository root:

```text
npm test -- --test-name-pattern "configured verification|production enablement|doctor diagnostic handler can surface evaluated production enablement|server option wires production enablement"
npm run typecheck
npm test
```

Results:

- Targeted configured-verification/production-enablement paths passed, including malformed option input, authority-smuggling, raw-path rejection, and result-without-ref regressions.
- `npm run typecheck` passed.
- Full repository test suite passed: 262/262.
- LSP diagnostics were clean for all touched TypeScript source and test files.

## Critical Review Follow-up

Claude Opus review found that the first evaluator version validated configured-verification results but could still fold or surface fields from invalid artifacts. The implementation was updated so configured-verification artifacts are validated whenever present, malformed artifacts block without echoing result/ref fields, and evidence refs are folded only after successful validation and explicit configured-verification ref matching. Regression coverage now includes invalid option input, authority-smuggling flags, raw-path rejection, and result-present/ref-missing behavior.

## Remaining Uncertainties

- This gate proves configured verification artifact validation and doctor-visible wiring only.
- Actual OpenCode runtime lane lifecycle proof remains unproven.
- Trusted runtime echo, sufficient production telemetry, sanitizer-backed external auth/provider policy, release approval, and hard chat cancel/no-reply authority remain separate blockers.
- Managed dispatch/model selection must remain disabled until all required gates pass.
