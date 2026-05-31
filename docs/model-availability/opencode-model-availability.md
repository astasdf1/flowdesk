# OpenCode model availability snapshot

Observed at: 2026-05-31T08:45:51.251Z
Source: opencode models
Probe: opencode run --format json --model <model> 'Reply with exactly OK.'
Timeout: 15000ms
Catalog count: 62
Available: 36
Unavailable: 24

## Available models (36)
- `anthropic/claude-haiku-4-5` (2546ms)
- `anthropic/claude-haiku-4-5-20251001` (2594ms)
- `anthropic/claude-opus-4-0` (5204ms)
- `anthropic/claude-opus-4-1` (4843ms)
- `anthropic/claude-opus-4-1-20250805` (9582ms)
- `anthropic/claude-opus-4-20250514` (9723ms)
- `anthropic/claude-opus-4-5` (2924ms)
- `anthropic/claude-opus-4-5-20251101` (3183ms)
- `anthropic/claude-opus-4-6` (3309ms)
- `anthropic/claude-opus-4-7` (3172ms)
- `anthropic/claude-opus-4-8` (4697ms)
- `anthropic/claude-sonnet-4-0` (11534ms)
- `anthropic/claude-sonnet-4-20250514` (3298ms)
- `anthropic/claude-sonnet-4-5` (3524ms)
- `anthropic/claude-sonnet-4-5-20250929` (3641ms)
- `anthropic/claude-sonnet-4-6` (3840ms)
- `google/gemini-2.5-flash` (4425ms)
- `google/gemini-2.5-flash-lite` (4340ms)
- `google/gemini-2.5-pro` (4060ms)
- `google/gemini-3-pro-preview` (6837ms)
- `google/gemini-3.1-flash-lite` (5252ms)
- `google/gemini-3.1-flash-lite-preview` (4141ms)
- `google/gemini-3.1-pro-preview` (6450ms)
- `openai/gpt-5.2` (2845ms)
- `openai/gpt-5.3-codex` (4336ms)
- `openai/gpt-5.3-codex-spark` (6324ms)
- `openai/gpt-5.4` (6307ms)
- `openai/gpt-5.4-fast` (3994ms)
- `openai/gpt-5.4-mini` (6302ms)
- `openai/gpt-5.4-mini-fast` (3712ms)
- `openai/gpt-5.5` (4701ms)
- `openai/gpt-5.5-fast` (8064ms)
- `opencode/big-pickle` (3694ms)
- `opencode/deepseek-v4-flash-free` (4383ms)
- `opencode/mimo-v2.5-free` (4498ms)
- `opencode/nemotron-3-super-free` (10350ms)

## Unavailable models (24)
- `anthropic/claude-3-5-haiku-20241022` — opencode-claude-auth: API 404 for claude-3-5-haiku-20241022: model: claude-3-5-haiku-20241022
- `anthropic/claude-3-5-haiku-latest` — opencode-claude-auth: API 404 for claude-3-5-haiku-latest: model: claude-3-5-haiku-latest
- `anthropic/claude-3-5-sonnet-20240620` — opencode-claude-auth: API 404 for claude-3-5-sonnet-20240620: model: claude-3-5-sonnet-20240620
- `anthropic/claude-3-5-sonnet-20241022` — opencode-claude-auth: API 404 for claude-3-5-sonnet-20241022: model: claude-3-5-sonnet-20241022
- `anthropic/claude-3-7-sonnet-20250219` — opencode-claude-auth: API 404 for claude-3-7-sonnet-20250219: model: claude-3-7-sonnet-20250219
- `anthropic/claude-3-haiku-20240307` — opencode-claude-auth: API 404 for claude-3-haiku-20240307: model: claude-3-haiku-20240307
- `anthropic/claude-3-opus-20240229` — opencode-claude-auth: API 404 for claude-3-opus-20240229: model: claude-3-opus-20240229
- `anthropic/claude-3-sonnet-20240229` — opencode-claude-auth: API 404 for claude-3-sonnet-20240229: model: claude-3-sonnet-20240229
- `anthropic/claude-opus-4-6-fast` — opencode-claude-auth: API 400 for claude-opus-4-6: Fast mode is not enabled for your organization. An organization admin must enable this feature.
- `anthropic/claude-opus-4-7-fast` — opencode-claude-auth: API 400 for claude-opus-4-7: Fast mode is not enabled for your organization. An organization admin must enable this feature.
- `anthropic/claude-opus-4-8-fast` — opencode-claude-auth: API 400 for claude-opus-4-8: Fast mode is not enabled for your organization. An organization admin must enable this feature.
- `google/gemini-2.0-flash` — {"type":"error","timestamp":1780217004419,"sessionID":"ses_182cc452effecPcDAZnGRk5hQM","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-2.0-flash-lite` — {"type":"error","timestamp":1780217007015,"sessionID":"ses_182cc393fffeb0ktHyomvIkMTb","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-2.5-flash-preview-tts` — {"type":"error","timestamp":1780217018344,"sessionID":"ses_182cc0cfcffesQCnHnhgp6V1YJ","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-2.5-pro-preview-tts` — {"type":"error","timestamp":1780217024911,"sessionID":"ses_182cbf301ffetX2TZOSByUHd4J","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-3-flash-preview` — {"type":"step_start","timestamp":1780217031250,"sessionID":"ses_182cbe935ffeT3PUE1ubL2HQfr","part":{"id":"prt_e7d342a4f001P1NiqyLpCAZ8li","messageID":"msg_e7d341735001j0XaVs47pu1Ndn","sessionID":"ses_182cbe935ffeT3PUE1ubL2HQfr","snapshot":…
- `google/gemini-3.1-pro-preview-customtools` — {"type":"error","timestamp":1780217064961,"sessionID":"ses_182cb55d6ffeUZigt8g1kAFXMf","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-3.5-flash` — {"type":"error","timestamp":1780217067594,"sessionID":"ses_182cb4ccaffe3n9HIUrRdp2bOc","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-embedding-001` — {"type":"error","timestamp":1780217070114,"sessionID":"ses_182cb42b8ffewi6PdxzBcM5zNI","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-flash-latest` — {"type":"error","timestamp":1780217072614,"sessionID":"ses_182cb387affes4zbOii5zqWGca","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-flash-lite-latest` — {"type":"error","timestamp":1780217074983,"sessionID":"ses_182cb2f0dffehcIHDZuOFoT7XO","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemma-4-26b-a4b-it` — {"type":"error","timestamp":1780217077479,"sessionID":"ses_182cb258cffeS1yV1Oj8QdQBXx","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemma-4-31b-it` — {"type":"error","timestamp":1780217079787,"sessionID":"ses_182cb1c03ffeh5iop62f1bCtQM","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `openai/gpt-5.5-pro` — {"type":"error","timestamp":1780217128238,"sessionID":"ses_182ca5ceaffej0lFLKehj2ZIkx","error":{"name":"APIError","data":{"message":"Bad Request: {\"detail\":\"The 'gpt-5.5-pro' model is not supported when using Codex with a ChatGPT accoun…

## Excluded models (2)
- `google/gemini-2.5-flash-image` — excluded by script filter
- `google/gemini-3.1-flash-image-preview` — excluded by script filter

## Canonical available provider models
- `anthropic/claude-haiku-4-5`
- `anthropic/claude-haiku-4-5-20251001`
- `anthropic/claude-opus-4-0`
- `anthropic/claude-opus-4-1`
- `anthropic/claude-opus-4-1-20250805`
- `anthropic/claude-opus-4-20250514`
- `anthropic/claude-opus-4-5`
- `anthropic/claude-opus-4-5-20251101`
- `anthropic/claude-opus-4-6`
- `anthropic/claude-opus-4-7`
- `anthropic/claude-opus-4-8`
- `anthropic/claude-sonnet-4-0`
- `anthropic/claude-sonnet-4-20250514`
- `anthropic/claude-sonnet-4-5`
- `anthropic/claude-sonnet-4-5-20250929`
- `anthropic/claude-sonnet-4-6`
- `google/gemini-2.5-flash`
- `google/gemini-2.5-flash-lite`
- `google/gemini-2.5-pro`
- `google/gemini-3-pro-preview`
- `google/gemini-3.1-flash-lite`
- `google/gemini-3.1-flash-lite-preview`
- `google/gemini-3.1-pro-preview`
- `openai/gpt-5.2`
- `openai/gpt-5.3-codex`
- `openai/gpt-5.3-codex-spark`
- `openai/gpt-5.4`
- `openai/gpt-5.4-fast`
- `openai/gpt-5.4-mini`
- `openai/gpt-5.4-mini-fast`
- `openai/gpt-5.5`
- `openai/gpt-5.5-fast`

