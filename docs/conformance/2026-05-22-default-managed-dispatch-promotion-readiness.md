# Default Managed Dispatch Promotion Readiness

Date: 2026-05-22

## Scope

This note records the first default managed-dispatch promotion slices. The first slice is non-authorizing promotion readiness. The second slice is a separate default authorization contract and server registration gate. The third slice promotes user-facing `/flowdesk-run` into the same managed-dispatch adapter path when, and only when, default authorization plus per-attempt evidence are present. None of these slices bypass per-attempt managed-dispatch gates: every actual SDK call must still pass the existing Guard, manifest, durable pre-call, reservation, promotion, and injected SDK adapter checks.

## Implemented

`@flowdesk/core` now exposes `flowdesk.default_managed_dispatch_promotion_readiness.v1` through `evaluateFlowDeskDefaultManagedDispatchPromotionReadinessV1` and `validateFlowDeskDefaultManagedDispatchPromotionReadinessV1`.

The readiness contract requires:

1. production enablement to already be `dispatch_capable` and `managed_dispatch_ready`;
2. durable pre-call proof ref;
3. adapter profile ref;
4. SDK client availability ref;
5. separate default release enablement ref;
6. no unresolved production uncertainty unless explicitly allowed.

Missing items produce typed blockers such as `durable_precall_missing`, `adapter_unavailable`, `sdk_client_unavailable`, and `default_release_enablement_missing`.

`@flowdesk/core` also exposes `flowdesk.default_managed_dispatch_authorization.v1` through `authorizeFlowDeskDefaultManagedDispatchV1` and `validateFlowDeskDefaultManagedDispatchAuthorizationV1`.

The authorization contract requires candidate readiness plus:

1. actor/profile/release-gate/rollback refs;
2. parseable created/expires timestamps;
3. explicit `default_enablement_requested`;
4. inactive kill switch.

It reports `state: "authorized"` only when all blockers are absent. Active kill switch, expired authorization, disabled default enablement, invalid refs, or non-candidate readiness all block.

## Authority Boundary

The new readiness result is diagnostic only. Even when it reaches `state: "default_candidate"`, it keeps:

1. `dispatch_authority_enabled: false`;
2. `providerCall: false`;
3. `actualLaneLaunch: false`;
4. `runtimeExecution: false`.

This means `dispatch_capable` plus `default_candidate` is still not a provider-call permission. A later default authorization contract and server registration gate are still required before default execution can be exposed.

The authorization contract can set `default_managed_dispatch_authority_enabled: true` only for server registration. It still keeps generic `dispatch_authority_enabled: false`, `providerCall: false`, `actualLaneLaunch: false`, and `runtimeExecution: false`. Provider calls occur only inside the existing managed-dispatch adapter after its per-attempt gates pass.

## Doctor And Status Surface

`/flowdesk-doctor` can now include redacted default-dispatch promotion refs, including candidate state and remaining blockers. `/flowdesk-status` can surface a promotion readiness blocker summary for an active workflow when diagnostic input is provided.

Both surfaces preserve Release 1 disabled authority flags and continue to report default non-dispatch behavior unless a later release gate explicitly changes server registration.

## Server Registration Gate

`@flowdesk/opencode-plugin` now accepts a `defaultManagedDispatchAuthorization` option. When this option validates as authorized and an injected SDK client is present, the server can register the existing managed-dispatch SDK tool without requiring the explicit beta option. Invalid, blocked, or forged authorization keeps the tool unregistered.

The registered tool is still the same fail-closed adapter surface. It requires the caller to provide the managed-dispatch evidence bundle, dispatch request, manifest, durable evidence or state-root reload, and reservation proof before any SDK prompt call.

## `/flowdesk-run` Default Route

`flowdesk.run.request.v1` now accepts `run_mode: "managed-dispatch"` with these managed-dispatch records:

1. `managed_dispatch_boundary_input`;
2. `managed_dispatch_request`;
3. `managed_dispatch_manifest`;
4. optional `managed_dispatch_reloaded_evidence`.

The ordinary command-backed handler and local adapter fail closed for `managed-dispatch` unless the server-level route receives a valid `flowdesk.run.request.v1` envelope and injects a valid `defaultManagedDispatchAuthorization`, OpenCode SDK client, reservation store or durable state root, and the per-attempt evidence bundle. When authorized, the route calls `dispatchManagedDispatchBetaPromptV1` and returns the existing redacted managed-dispatch result shape with route and authorization refs. When the run envelope, authorization, or required evidence is missing or invalid, it returns `blocked_before_dispatch` before reservation or SDK calls.

Existing `guarded-dry-run` and `fake-runtime` `/flowdesk-run` modes remain command-backed non-dispatch paths.

## Verification

Local verification performed:

1. `npm run typecheck` passed.
2. `npm test -- --test-name-pattern "production enablement|doctor and status surface|doctor diagnostic handler"` passed and reported 394 passing tests.
3. `npm test -- --test-name-pattern "default managed dispatch|default managed-dispatch|managed dispatch beta server tool"` passed and reported 398 passing tests.
4. Full `npm test` passed and reported 398 passing tests after the authorization slice.
5. `npm test -- --test-name-pattern "/flowdesk-run managed-dispatch|default managed-dispatch"` passed after the route slice and reported 401 passing tests.
6. Full `npm test` passed after the route slice and reported 401 passing tests.

The verification did not use provider credentials, `opencode run`, or live provider calls.

## Remaining Gap

Default provider execution is now opened to authorized default server registration and authorized `/flowdesk-run` managed-dispatch requests that provide the same per-attempt evidence bundle required by the existing adapter. Remaining gaps are broader production conformance, productized runtime lane/reviewer orchestration, automatic fallback/provider switching, connector-backed remote writes, and live/default-profile rollout proof.
