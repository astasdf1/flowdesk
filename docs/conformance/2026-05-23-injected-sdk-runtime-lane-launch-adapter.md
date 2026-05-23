# Injected SDK Runtime Lane Launch Adapter

Date: 2026-05-23

## Scope

This note records the first explicit adapter slice for launching a runtime reviewer lane from a previously materialized `flowdesk.runtime_lane_launch_plan.v1` record.

The adapter is library-only in `@flowdesk/opencode-plugin`. It is not registered as a default server tool, is not wired into Release 1 command routing, and does not promote default dispatch authority.

## Implemented Adapter

`launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1` now performs the proven active-SDK launch shape:

1. Validate a `launch_ready` `FlowDeskRuntimeLaneLaunchPlanV1`.
2. Require explicit `allowActualLaneLaunch: true`.
3. Require the provided parent session id to match the plan's `parent_session_ref` binding.
4. Derive the reviewer agent from `agent_ref` and map FlowDesk model ids to OpenCode runtime provider ids (`claude` -> `anthropic`, `gemini` -> `google`, `openai` -> `openai`).
5. Require `session.create` and the requested `session.prompt` or `session.promptAsync` method on the injected SDK client.
6. Create a child session with `parentID`, then prompt the child session with exact `agent`, exact runtime `model`, and bounded text parts only.

The adapter omits `noReply`, tool authority, fallback controls, broad dispatch routing, raw provider payload echoing, and raw SDK response echoing.

## Fail-Closed Behavior

The adapter blocks before SDK calls when:

1. The launch plan is invalid or not `launch_ready`.
2. Explicit actual-lane-launch opt-in is missing.
3. Parent session binding drifts from the launch plan.
4. Agent, runtime model, or bounded prompt text is missing.
5. `session.create` or the requested prompt method is unavailable.

Create/prompt failures return sanitized `runtime` or `provider_api` error categories without returning raw errors.

## Verification

Targeted plugin verification is covered by:

```bash
npm test --workspace @flowdesk/opencode-plugin -- --test-name-pattern "runtime lane launch|injected sdk runtime lane"
```

The added fake-client coverage proves:

1. A valid launch-ready plan creates one child session and prompts it with exact reviewer binding.
2. Missing opt-in, parent-session drift, and blocked launch plans make zero SDK calls.
3. Missing SDK surfaces and prompt failures are reported with sanitized failure categories.
4. Default Release 1 server behavior remains unchanged because no server route was registered.

## Interpretation

This closes only the explicit adapter shape for runtime lane launch. The next safe work is to bind launch results to durable lane lifecycle evidence and then run a bounded active-environment smoke. Typed verdict observation, durable verdict linkage, acceptance, fallback/reselection, remote writes, and dispatch promotion remain separate gates.
