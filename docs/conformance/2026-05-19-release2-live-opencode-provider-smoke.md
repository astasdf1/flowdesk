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

The same Anthropic Sonnet and Opus aliases returned `UnknownError` through the headless server plus SDK `client.session.prompt` path when the headless server was started with `--pure`. Follow-up log inspection showed that `--pure` skipped external plugins and provider initialization found `openai`, `opencode`, and `ollama`, but not `anthropic`. Direct Anthropic CLI runs loaded `opencode-claude-auth@latest`.

Follow-up headless SDK smoke without `--pure` succeeded for Anthropic Sonnet:

```json
{
  "pure": false,
  "provider": "anthropic",
  "model": "claude-sonnet-4-5",
  "responseStatus": 200,
  "textContainsExpected": true
}
```

The Anthropic discrepancy is therefore classified as a conformance-mode issue: pure headless mode disables the external auth/provider plugin required by this local Anthropic setup. Anthropic can be reached through the SDK boundary in non-pure mode, but production Release 2 still needs an explicit profile decision about whether external auth plugins are allowed and how doctor reports that dependency.

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

Follow-up provider usage research found official machine-readable surfaces, but no required credentials were present in this local shell environment:

1. OpenAI documents project/model rate limit APIs, organization usage/cost APIs, and response rate-limit headers such as `x-ratelimit-remaining-*` and `x-ratelimit-reset-*`.
2. Anthropic documents Admin API usage/cost reports, Admin API rate-limit lookup by model group, and response headers such as `anthropic-ratelimit-*-remaining` and `anthropic-ratelimit-*-reset`.
3. Google Gemini API key docs expose rate-limit policy and reset timing, while Google Cloud environments can use Cloud Quotas and Cloud Monitoring APIs where the configured service/project exposes the needed quota metrics.
4. The local shell had no `OPENAI_ADMIN_KEY`, `OPENAI_API_KEY`, `ANTHROPIC_ADMIN_KEY`, `ANTHROPIC_API_KEY`, `GOOGLE_APPLICATION_CREDENTIALS`, `GEMINI_API_KEY`, or `GOOGLE_API_KEY` values.
5. OpenCode SDK `session.prompt` responses did not forward provider rate-limit or reset headers for successful OpenAI/Anthropic calls.

The remaining usage gate is therefore not blocked by schema design, but by missing provider-native collector credentials or missing provider-header propagation at the OpenCode boundary.

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

Follow-up live-call ordering smoke wrote durable FlowDesk audit evidence before a live SDK prompt and confirmed invalid pre-dispatch audit preparation prevents the prompt path from being attempted:

```json
{
  "auditPrepareOk": true,
  "auditApplyOk": true,
  "writtenPaths": [".flowdesk/sessions/session-live-order-123/audit.jsonl"],
  "auditExistsBeforePrompt": true,
  "auditLineCountBeforePrompt": 1,
  "dispatchAttemptedAfterInvalidAudit": false,
  "sequence": ["audit_written", "sdk_prompt_called"],
  "sdkPromptStatus": 200,
  "assistantProviderID": "openai",
  "assistantModelID": "gpt-5.4-mini-fast",
  "textContainsExpected": true
}
```

The durable audit write itself preserves the state-store authority flags as disabled until the later SDK call starts.

## Runtime Echo and Telemetry Smoke

Follow-up SDK smoke confirmed that the successful `session.prompt` response and `session.messages` list expose enough redacted correlation inputs to satisfy the current runtime echo and telemetry schemas when represented through opaque refs:

```json
{
  "sdkPromptStatus": 200,
  "sessionIdPresent": true,
  "assistantMessageIdPresent": true,
  "assistantSessionIdMatches": true,
  "providerQualifiedModelId": "openai/gpt-5.4-mini-fast",
  "finish": "stop",
  "partTypes": ["step-start", "reasoning", "text", "step-finish"],
  "sessionMessageCount": 2,
  "echoValidationOk": true,
  "telemetryValidationOk": true
}
```

The first attempt used descriptive mode field labels containing `prompt` and was correctly rejected by redaction validation as prompt-shaped metadata. The passing smoke used schema-safe labels such as `sdk-response-provider-id`, `sdk-response-model-id`, and `sdk-session-message-correlation`.

## R2 Gate Assessment

Evidence now available:

1. A live OpenCode runtime can start a headless server and create sessions.
2. The official SDK `client.session.prompt` path can reach a live provider and return a model response.
3. The SDK response exposes provider/model identity for the successful OpenAI call.
4. Basic event/part lifecycle observations are available for the successful call.
5. Anthropic provider/model availability failure is observable and classifiable without treating it as fallback approval.
6. Direct OpenCode diagnostic dispatch can reach tested Anthropic Sonnet and Opus models, and non-pure headless SDK dispatch can reach Anthropic Sonnet. Pure headless mode fails because it does not load the local external Anthropic auth/provider plugin.
7. OpenCode model catalog metadata is available but does not include provider-native quota/reset authority.
8. FlowDesk durable audit write intent and gate evaluation remain fail-closed when usage evidence is missing.
9. Durable pre-dispatch audit ordering before a live OpenAI SDK call is proven in smoke form.
10. Runtime echo and telemetry evidence schemas validate against redacted SDK response/session correlation evidence.

Evidence still missing for production Release 2 enablement:

1. Fresh provider-native usage/quota/reset evidence for the exact provider/model family.
2. Provider-native collector credentials or provider-header propagation at the OpenCode SDK boundary.
3. FlowDesk-managed trusted runtime echo artifact persisted as a durable artifact in the production path.
4. Sufficient correlated telemetry persisted as a durable artifact in the production path.
5. Configured verification evidence after dispatch.
6. Doctor/profile policy for external auth/provider plugin dependencies such as local Anthropic non-pure mode.
7. Default server opt-in wiring and doctor-visible production enablement remain intentionally absent.

## Conclusion

The environment can perform live OpenCode provider dispatch through OpenAI and the official SDK surface, non-pure headless SDK dispatch can reach Anthropic Sonnet, durable audit ordering before a live SDK call is proven, and runtime echo/telemetry schemas validate against redacted SDK response/session correlation evidence. Release 2 production dispatch remains gated because provider-native usage/quota/reset evidence, durable production-path echo/telemetry persistence, configured verification, external plugin policy, and production opt-in wiring are not yet complete.
