# Release 2 Sanitized Auth Capture Gate

Date: 2026-05-21

## Scope

This note records a durable sanitized-auth capture evidence gate for the opt-in Release 2 production enablement path. It is a token-free, raw-object-free diagnostic and gating slice only. It does not create provider calls, real OpenCode dispatch, runtime execution, actual lane launch, automatic fallback/reselection, hard chat cancellation/no-reply authority, or production approval issuance/source authority.

## Implemented Behavior

`@flowdesk/core` now exports `flowdesk.sanitized_auth_capture_result.v1` through `sanitized-auth-capture.ts`. The artifact validates redacted metadata only:

- workflow/ref alignment through `workflow_id` and `sanitized_auth_capture_ref`
- concrete provider/model binding through `provider_family` and `provider_qualified_model_id`
- auth/profile/scope/account refs through opaque refs
- durable capture and sanitizer refs through opaque refs
- bounded metadata labels and evidence refs
- explicit `false` flags for raw auth object persistence, raw plugin object persistence, token material persistence, provider calls, runtime execution, actual lane launch, and dispatch authority

The validator rejects mismatches, malformed refs, provider/model mismatch, alias model ids such as `latest`/`default`/`auto`, raw/token-shaped fields, raw plugin object persistence, and authority smuggling.

## Production Enablement and Doctor Wiring

`evaluateFlowDeskProductionEnablementV1` now requires a validated sanitized-auth capture result when `sanitizedAuthCaptureRef` is present. Missing, failed, mismatched, malformed, token-shaped, or raw-plugin-object-shaped capture artifacts block production enablement with:

- `sanitized_auth_capture_result_missing`
- `sanitized_auth_capture_invalid`
- `sanitized_auth_capture_failed`

Only a valid, matched capture result folds its evidence refs into non-authorizing production evaluation and projects doctor-visible diagnostics:

- `production_sanitized_auth_capture_result=<passed|failed>`
- `production_sanitized_auth_capture_ref=<sanitized_auth_capture_ref>`

The OpenCode plugin server option parser accepts `sanitizedAuthCaptureRef` and `sanitizedAuthCaptureResult` under explicit opt-in `productionEnablement`; core validation remains the only authority boundary. `/flowdesk-doctor` surfaces sanitized-auth capture refs only from evaluated production enablement output, not from raw plugin options.

## Verification

Commands run from the repository root:

```text
npm test -- --test-name-pattern "sanitized auth capture|production enablement|doctor diagnostic handler can surface evaluated production enablement|server option wires production enablement|invalid configured verification"
```

Results:

- Targeted sanitized-auth capture, production enablement, doctor diagnostics, and server option tests passed: 277/277 in the targeted command run.
- LSP diagnostics were clean on touched TypeScript files except one import-order information hint in `server.ts`, which was addressed before final verification.

## Remaining Uncertainties

- This validates a sanitized capture artifact and doctor wiring; it does not prove live external auth plugin introspection depth or provider-native credential behavior.
- This does not persist or print raw plugin auth objects, raw credentials, tokens, prompts, provider payloads, or raw file paths.
- Production approval issuance/source authority, actual runtime lane lifecycle proof, durable production-path echo/telemetry persistence, trusted runtime conformance, and hard chat cancel/no-reply authority remain separate blockers.
- Managed dispatch/model selection must remain disabled until all required gates pass.
