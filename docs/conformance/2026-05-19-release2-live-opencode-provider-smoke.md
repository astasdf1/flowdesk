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

OpenCode listed Anthropic models, but live diagnostic dispatch to `anthropic/claude-3-5-haiku-latest` and `anthropic/claude-3-5-haiku-20241022` reached the Anthropic API and failed with provider `404` model-not-found responses. This is classified as provider/model availability evidence, not an auth-missing failure.

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

## R2 Gate Assessment

Evidence now available:

1. A live OpenCode runtime can start a headless server and create sessions.
2. The official SDK `client.session.prompt` path can reach a live provider and return a model response.
3. The SDK response exposes provider/model identity for the successful OpenAI call.
4. Basic event/part lifecycle observations are available for the successful call.
5. Anthropic provider/model availability failure is observable and classifiable without treating it as fallback approval.

Evidence still missing for production Release 2 enablement:

1. Fresh provider-native usage/quota/reset evidence for the exact provider/model family.
2. Durable FlowDesk pre-dispatch audit application before the live SDK call.
3. FlowDesk-managed trusted runtime echo artifact bound to workflow id, step id, attempt id, Guard decision, runtime capability ref, and audit ref.
4. Sufficient correlated telemetry bound to FlowDesk workflow, attempt, session, message, provider/model, audit, and verification refs.
5. Configured verification evidence after dispatch.
6. Default server opt-in wiring and doctor-visible production enablement remain intentionally absent.

## Conclusion

The environment can perform live OpenCode provider dispatch through OpenAI and the official SDK surface. Release 2 production dispatch remains gated because usage/quota evidence, durable audit ordering, FlowDesk-bound trusted echo, telemetry correlation, and configured verification are not yet collected as FlowDesk artifacts.
