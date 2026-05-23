# Exact-Model Provider Acquisition Active Smoke

Date: 2026-05-23

## Scope

This note records a bounded active-environment smoke of the explicit opt-in exact-model provider acquisition path. The smoke used `opencode serve` plus the OpenCode SDK, not `opencode run`.

The smoke exercised the prompt-backed provider acquisition client added behind `exactModelProviderAcquisitionLiveTest.promptBackedCheck`. It did not enable default Release 1 dispatch, reviewer lane launch, fallback/reselection, hard-chat authority, remote writes, or verdict acceptance.

## Preconditions

The smoke used a temporary harness outside the repository and a temporary `.flowdesk` evidence root. It selected the first exact model that passed metadata preflight from a bounded candidate list without printing raw provider, auth, SDK, or model payloads.

Required gates exercised by the harness:

1. OpenCode SDK client from `opencode serve`.
2. Metadata preflight through `config.providers`, `provider.list`, and `provider.auth`.
3. `allowProviderCall: true` under the nested prompt-backed opt-in.
4. Exact provider-qualified model allowlist.
5. Fixed sentinel prompt only; no user/task prompt text.
6. Durable acquisition evidence write and reload.
7. Redacted output containing only statuses, refs, booleans, and blocked-label arrays.

## Result

The successful run selected `claude/claude-opus-4-5`, mapped it to OpenCode runtime `anthropic/claude-opus-4-5`, issued one fixed sentinel SDK prompt, and returned:

```json
{
  "status": "provider_acquisition_recorded",
  "selectedProviderQualifiedModelId": "claude/claude-opus-4-5",
  "providerCallAttempted": true,
  "writeAttempted": true,
  "evidenceReloaded": true,
  "resultState": "availability_acquired",
  "available": true,
  "providerCall": true,
  "blockedLabels": [],
  "sanitizedProviderResultRef": "provider-result-anthropic-claude-opus-4-5-sdk-sentinel",
  "availabilityRef": "availability-anthropic-claude-opus-4-5-sdk-sentinel"
}
```

No raw model response, token material, raw auth object, provider response body, prompt transcript, or provider payload was printed or persisted by FlowDesk evidence.

## Failed Attempts

The first harness attempt failed before any provider call because the OpenCode SDK server helper passed lowercase `--log-level=error`, while the local CLI accepts uppercase log-level values. The harness was corrected to use `ERROR`.

A later cleanup retry used a fixed port that had not fully released after a timed-out process and failed at `opencode serve` startup before any provider call. The final passing run used port `0` so OpenCode selected a free port.

## Interpretation

This closes a narrow active provider acquisition smoke for `claude/claude-opus-4-5` through the explicit prompt-backed live-test path. The resulting provider acquisition evidence proves only that a bounded provider availability check completed and reloaded for this active environment.

It does not authorize default dispatch, reviewer fan-out, cache refresh execution, automatic fallback, managed provider/model switching, remote writes, hard chat suppression, or typed verdict acceptance. The next safe product step is converting this redacted acquisition result into same-day exact-model cache evidence through a separate fail-closed cache materialization path.
