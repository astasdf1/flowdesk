# Release 2 Live OpenCode Provider Smoke

Date: 2026-05-19

## Scope

This smoke collected live environment evidence for Release 2 managed-dispatch readiness. It used OpenCode diagnostic/runtime surfaces only. It did not wire the FlowDesk Release 2 adapter into the default server tools and did not promote production real dispatch.

## Environment Evidence

1. OpenCode CLI is installed at `/opt/homebrew/bin/opencode`.
2. OpenCode version: `1.14.50`.
3. OpenCode provider credentials are present for OpenAI, Google, and Anthropic through OpenCode OAuth storage.
4. Common provider API key environment variables were not present in the shell environment checked by the smoke.
5. Workspace build passed before smoke: `npm run build`.

## Live Provider Results

### Anthropic

OpenCode listed Anthropic models, but live diagnostic dispatch to `anthropic/claude-3-5-haiku-latest` and `anthropic/claude-3-5-haiku-20241022` reached the Anthropic API and failed with provider `404` model-not-found responses. This is classified as provider/model availability evidence for those model ids, not an auth-missing failure.

Direct OpenCode diagnostic runs succeeded for the tested Sonnet and Opus ids:

```json
{
  "provider": "anthropic",
  "successfulDiagnosticModels": [
    "claude-sonnet-4-5-20250929",
    "claude-sonnet-4-5",
    "claude-opus-4-5-20251101",
    "claude-opus-4-5"
  ],
  "toolUseObserved": false,
  "textContainsExpected": true
}
```

The same Anthropic Sonnet and Opus aliases returned `UnknownError` through the headless server plus SDK `client.session.prompt` path. This creates a Release 2 adapter blocker: direct CLI provider reachability is proven for those ids, but the SDK dispatch boundary used by FlowDesk still needs a successful Anthropic headless-session smoke or a pinned root-cause explanation before Anthropic can be treated as managed-dispatch-ready.

### OpenAI

Direct OpenCode diagnostic run succeeded with `openai/gpt-5.4-mini-fast` and returned the expected sentinel text:

```json
{
  "provider": "openai",
  "model": "gpt-5.4-mini-fast",
  "result": "success",
  "textContainsExpected": true,
  "finish": "stop",
  "toolUseObserved": false
}
```

Headless OpenCode server plus SDK client smoke also succeeded through `client.session.prompt`:

```json
{
  "serverReady": true,
  "sessionCreated": true,
  "promptOk": true,
  "assistantProviderID": "openai",
  "assistantModelID": "gpt-5.4-mini-fast",
  "finish": "stop",
  "partTypes": ["step-start", "reasoning", "text", "step-finish"],
  "textContainsExpected": true
}
```

## OpenCode Model Metadata

`opencode models --verbose` exposed model catalog metadata such as context, pricing, and capability fields. It did not expose account-level quota, remaining usage, reset bucket, or provider-native usage authority for the tested provider/model families. For Release 2 gates, this metadata is useful provider/model catalog evidence only; it does not satisfy fresh usage/quota/reset evidence.

## FlowDesk-Bound Audit and Gate Smoke

A FlowDesk-bound durable audit smoke wrote a redacted audit record under a test `.flowdesk` session path and preserved the Release 2 authority flags as disabled:

```json
{
  "auditWritten": true,
  "realOpenCodeDispatch": false,
  "providerCall": false,
  "runtimeExecution": false,
  "actualLaneLaunch": false
}
```

The same smoke evaluated the Release 2 managed-dispatch beta gate with usage evidence intentionally missing. The gate remained fail-closed:

```json
{
  "gateStatusWithUsageMissing": "blocked",
  "gateReasonWithUsageMissing": "usage"
}
```

This proves the current FlowDesk gate does not treat diagnostic provider reachability, model catalog metadata, or audit record existence as sufficient for real dispatch. It does not yet prove durable pre-dispatch audit ordering around a live SDK provider call.

## R2 Gate Assessment

Evidence now available:

1. A live OpenCode runtime can start a headless server and create sessions.
2. The official SDK `client.session.prompt` path can reach a live provider and return a model response.
3. The SDK response exposes provider/model identity for the successful OpenAI call.
4. Basic event/part lifecycle observations are available for the successful call.
5. Anthropic provider/model availability failure is observable and classifiable without treating it as fallback approval.
6. Direct OpenCode diagnostic dispatch can reach tested Anthropic Sonnet and Opus models, while the SDK path still fails with `UnknownError` for those ids.
7. OpenCode model catalog metadata is available but does not include provider-native quota/reset authority.
8. FlowDesk durable audit write intent and gate evaluation remain fail-closed when usage evidence is missing.

Evidence still missing for production Release 2 enablement:

1. Fresh provider-native usage/quota/reset evidence for the exact provider/model family.
2. Durable FlowDesk pre-dispatch audit application proven before a live SDK call.
3. FlowDesk-managed trusted runtime echo artifact bound to workflow id, step id, attempt id, Guard decision, runtime capability ref, and audit ref.
4. Sufficient correlated telemetry bound to FlowDesk workflow, attempt, session, message, provider/model, audit, and verification refs.
5. Configured verification evidence after dispatch.
6. Headless SDK success or a pinned root-cause explanation for Anthropic Sonnet/Opus before treating Anthropic as managed-dispatch-ready.
7. Default server opt-in wiring and doctor-visible production enablement remain intentionally absent.

## Conclusion

The environment can perform live OpenCode provider dispatch through OpenAI and the official SDK surface, and direct CLI diagnostics can reach tested Anthropic Sonnet/Opus models. Release 2 production dispatch remains gated because usage/quota/reset evidence, live-call audit ordering, FlowDesk-bound trusted echo, telemetry correlation, configured verification, and the Anthropic SDK discrepancy are not yet resolved as FlowDesk artifacts.
