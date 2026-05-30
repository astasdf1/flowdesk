# OpenCode model availability snapshot

Observed at: 2026-05-30T21:04:42.950Z
Source: opencode models
Probe: opencode run --format json --model <model> 'Reply with exactly OK.'
Timeout: 15000ms
Catalog count: 62
Available: 37
Unavailable: 23

## Available models (37)
- `anthropic/claude-haiku-4-5` (2966ms)
- `anthropic/claude-haiku-4-5-20251001` (3287ms)
- `anthropic/claude-opus-4-0` (8471ms)
- `anthropic/claude-opus-4-1` (10160ms)
- `anthropic/claude-opus-4-1-20250805` (10817ms)
- `anthropic/claude-opus-4-20250514` (4828ms)
- `anthropic/claude-opus-4-5` (5059ms)
- `anthropic/claude-opus-4-5-20251101` (3238ms)
- `anthropic/claude-opus-4-6` (4353ms)
- `anthropic/claude-opus-4-7` (3361ms)
- `anthropic/claude-opus-4-8` (3469ms)
- `anthropic/claude-sonnet-4-0` (3127ms)
- `anthropic/claude-sonnet-4-20250514` (3170ms)
- `anthropic/claude-sonnet-4-5` (4068ms)
- `anthropic/claude-sonnet-4-5-20250929` (3884ms)
- `anthropic/claude-sonnet-4-6` (4353ms)
- `google/gemini-2.5-flash` (4028ms)
- `google/gemini-2.5-flash-lite` (3629ms)
- `google/gemini-2.5-pro` (4833ms)
- `google/gemini-3-flash-preview` (13480ms)
- `google/gemini-3-pro-preview` (5940ms)
- `google/gemini-3.1-flash-lite` (4720ms)
- `google/gemini-3.1-flash-lite-preview` (4027ms)
- `google/gemini-3.1-pro-preview` (6103ms)
- `openai/gpt-5.2` (3325ms)
- `openai/gpt-5.3-codex` (4101ms)
- `openai/gpt-5.3-codex-spark` (3035ms)
- `openai/gpt-5.4` (4453ms)
- `openai/gpt-5.4-fast` (4105ms)
- `openai/gpt-5.4-mini` (4269ms)
- `openai/gpt-5.4-mini-fast` (4937ms)
- `openai/gpt-5.5` (3724ms)
- `openai/gpt-5.5-fast` (6413ms)
- `opencode/big-pickle` (4869ms)
- `opencode/deepseek-v4-flash-free` (4373ms)
- `opencode/mimo-v2.5-free` (4516ms)
- `opencode/nemotron-3-super-free` (10773ms)

## Unavailable models (23)
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
- `google/gemini-2.0-flash` — {"type":"error","timestamp":1780174943025,"sessionID":"ses_1854e1e22ffewDPthFfff0Wjf7","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-2.0-flash-lite` — {"type":"error","timestamp":1780174946460,"sessionID":"ses_1854e074bffeNu7zHzAKj740lI","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-2.5-flash-preview-tts` — {"type":"error","timestamp":1780174956957,"sessionID":"ses_1854ddc31ffesM6MM5Nzj29fc4","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-2.5-pro-preview-tts` — {"type":"error","timestamp":1780174964568,"sessionID":"ses_1854dbe6fffe3J5DKMXgPMdRgc","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-3.1-pro-preview-customtools` — {"type":"error","timestamp":1780175001316,"sessionID":"ses_1854d2dc3ffeOH2FAYkJM5gh88","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-3.5-flash` — {"type":"error","timestamp":1780175003982,"sessionID":"ses_1854d23d7ffezlS4wOZdTLOlc6","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-embedding-001` — {"type":"error","timestamp":1780175006823,"sessionID":"ses_1854d192affeaPqO0jorlTaZmd","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-flash-latest` — {"type":"error","timestamp":1780175009382,"sessionID":"ses_1854d0e60ffeKqYBUaEI7BPM71","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemini-flash-lite-latest` — {"type":"error","timestamp":1780175012442,"sessionID":"ses_1854d0400ffeX7SQwBGMp4NttR","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemma-4-26b-a4b-it` — {"type":"error","timestamp":1780175015117,"sessionID":"ses_1854cf894ffeMc1Y3ALg4G9A4c","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `google/gemma-4-31b-it` — {"type":"error","timestamp":1780175017841,"sessionID":"ses_1854cedf8ffeMGSBAn2NWSPhrI","error":{"name":"APIError","data":{"message":"Requested entity was not found.","statusCode":404,"isRetryable":false,"responseHeaders":{"alt-svc":"h3=\":…
- `openai/gpt-5.5-pro` — {"type":"error","timestamp":1780175058318,"sessionID":"ses_1854c4da4ffeo8CxJI2EPuN2Ys","error":{"name":"APIError","data":{"message":"Bad Request: {\"detail\":\"The 'gpt-5.5-pro' model is not supported when using Codex with a ChatGPT accoun…

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
- `google/gemini-3-flash-preview`
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

