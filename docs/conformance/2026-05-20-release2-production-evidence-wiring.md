# Release 2 Production Evidence Wiring Smoke

Date: 2026-05-20

## Scope

This note records the production-evidence persistence and doctor-surfacing work added after the isolated current-tarball smoke. It does not prove npm registry installation or OpenCode `subtask: true` lane lifecycle conformance.

## Implemented Evidence Path

`@flowdesk/core` now has a durable session evidence applier for prepared `flowdesk.managed_dispatch_beta.*` session evidence write intents.

Validated behavior:

- Writes use temp-then-rename under the caller-provided root.
- Target paths must match `.flowdesk/sessions/<workflowId>/evidence/<class>/<evidenceId>.json`.
- Temp paths must stay beside the target and bind the schema id.
- Usage authority, runtime echo, and telemetry correlation records reload through `reloadFlowDeskSessionEvidenceV1`.
- Forged path/class/schema/authority shapes fail closed without enabling provider calls, runtime execution, real dispatch, or actual lane launch.

## Doctor Wiring

The OpenCode plugin local adapter now accepts explicit opt-in production enablement options together with a durable root. When enabled, doctor diagnostics reload session evidence and pass it through `evaluateFlowDeskProductionEnablementV1`.

Doctor refs can now include:

- `production_enablement_state=<state>`
- `production_enablement_doctor_ref=<ref>`
- `production_managed_dispatch_ready=<boolean>`
- `production_dispatch_authority_enabled=false`
- `production_blocker=<label>`
- `production_uncertainty=<label>`

Default Release 1 behavior remains unchanged. Without explicit production enablement options, doctor keeps reporting disabled production enablement and command-backed non-dispatch readiness only.

## Verification

- Targeted production evidence tests passed:
  - `session-evidence.test.js`
  - `command-handlers.test.js`
  - `server.test.js`
- Full repository test suite passed: 251/251.
- `npm run typecheck` passed.

## npm Publish Attempt

The user-provided npm token file authenticated as `astasdf`, but `npm publish --workspace @flowdesk/core --access public` was still rejected by npm:

```text
403 Forbidden - Two-factor authentication or granular access token with bypass 2fa enabled is required to publish packages.
```

Interpretation: the token is valid for login/whoami but is not a granular publish token with the required publish permission and 2FA bypass/automation setting for `@flowdesk/*`, or the account/org policy still requires an OTP for publish.

## Remaining Uncertainties

- npm registry publication remains blocked until an OTP is supplied with publish or a correct granular publish token with bypass-2FA/automation rights is configured.
- Fresh registry-installed sandbox smoke cannot run until the packages are published.
- OpenCode prompt/promptAsync subtask and session child metadata surfaces were later confirmed at the SDK typing level, but `session.command` subtask parts, actual runtime lifecycle metadata, parent/subtask ids, authoritative runtime echo fields, and telemetry pass-through remain unproven; they must remain uncertainty labels rather than dispatch-ready proof.
