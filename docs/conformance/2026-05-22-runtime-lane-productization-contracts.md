# Runtime Lane Productization Contracts

Date: 2026-05-22

## Scope

This conformance note records the non-authorizing runtime lane lifecycle productization slice. It follows the default managed-dispatch `/flowdesk-run` route and prepares the next reviewer fan-out work without enabling default lane launch or provider execution.

## Planning Review State

Candidate next slices were:

1. Remote connector gateway execution.
2. Runtime lane lifecycle productization.
3. Reviewer availability cache and assignment-time revalidation.
4. Local operational-intelligence advisory schemas.

The selected next slice was runtime lane lifecycle productization because deterministic reviewer fan-out depends on typed launch/lifecycle evidence. Connector gateway execution remains later because it carries higher external-write risk and is not required for reviewer fan-out.

Claude Opus, GPT frontier, and Gemini Pro reviewer lanes were attempted, verdict-only retried, and freshly rerun. All attempts produced no final deliverable or no text output, so none were counted as approval evidence. The plan was confirmed by direct document/code review and fail-closed verification only, and the sub-agent instability is explicitly recorded.

## Added Contracts

`@flowdesk/core` now exports:

1. `flowdesk.runtime_lane_launch_request.v1`
2. `flowdesk.runtime_lane_launch_plan.v1`
3. `flowdesk.runtime_lane_lifecycle_projection.v1`

`planFlowDeskRuntimeLaneLaunchV1` reports `launch_ready` only after a valid request has:

1. Concrete provider-qualified model id.
2. Exact agent ref and parent session ref kind separation.
3. Pre-launch audit ref.
4. Lane-launch approval ref.
5. Injected SDK client availability signal.
6. Durable evidence-root ref.

Even when `launch_ready`, the plan records `launch_attempted=false`, `actualLaneLaunch=false`, `providerCall=false`, `runtimeExecution=false`, and `dispatch_authority_enabled=false`.

`projectFlowDeskRuntimeLaneLifecycleV1` classifies lifecycle records into `launch_ready`, `in_progress`, `complete_with_verdict`, `terminal_non_approval`, or `blocked`. It never infers approval from child output, missing verdicts, no-output states, tool-call-only states, timeouts, aborted lanes, orphaned lanes, late output, or invocation failures.

## Files

Changed files for this slice:

1. `packages/core/src/runtime-lane-productization.ts`
2. `packages/core/src/runtime-lane-productization.test.ts`
3. `packages/core/src/index.ts`
4. `packages/core/src/schema-registry.ts`
5. `docs/CORE_COMPLETION_EXECUTION_PLAN.md`
6. `docs/PROGRESS_SNAPSHOT.md`
7. `docs/RELEASE_3_BLOCKER_CLEARANCE_PLAN.md`

## Verification

Verification performed:

1. Touched-file LSP diagnostics: no errors; organize-import informational hints only on new/export files.
2. `npm run typecheck`: passed.
3. `npm test -- --test-name-pattern "runtime lane"`: passed within the full harness, 404/404 selected tests.
4. `npm test`: passed, 404/404.
5. `GIT_MASTER=1 git diff --check`: passed.

## Remaining Gaps

This slice does not launch lanes, call providers, register a default reviewer fan-out route, execute connector tools, perform remote writes, enable automatic fallback, or promote hard chat authority.

Next safe work is assignment-time reviewer availability cache revalidation and deterministic fan-out planning on top of these lane contracts, still without default lane launch or silent lower-tier substitution.
