# OpenCode model availability snapshot

Observed at: 2026-06-19T02:30:25.669Z
Source: opencode models
Probe: opencode run --format json --model <model> 'Reply with exactly OK.'
Timeout: 15000ms
Catalog count: 54
Available: 23
Unavailable: 18

## Available models (23)
- `anthropic/claude-haiku-4-5` (3557ms)
- `anthropic/claude-haiku-4-5-20251001` (3380ms)
- `anthropic/claude-opus-4-1` (6001ms)
- `anthropic/claude-opus-4-5` (4327ms)
- `anthropic/claude-opus-4-5-20251101` (4297ms)
- `anthropic/claude-opus-4-6` (4589ms)
- `anthropic/claude-opus-4-7` (4537ms)
- `anthropic/claude-opus-4-8` (4528ms)
- `anthropic/claude-sonnet-4-5` (4227ms)
- `anthropic/claude-sonnet-4-5-20250929` (4346ms)
- `anthropic/claude-sonnet-4-6` (4138ms)
- `openai/gpt-5.3-codex-spark` (5047ms)
- `openai/gpt-5.4` (5185ms)
- `openai/gpt-5.4-fast` (5434ms)
- `openai/gpt-5.4-mini` (6457ms)
- `openai/gpt-5.4-mini-fast` (4834ms)
- `openai/gpt-5.5` (5729ms)
- `openai/gpt-5.5-fast` (12893ms)
- `opencode/big-pickle` (5321ms)
- `opencode/deepseek-v4-flash-free` (4562ms)
- `opencode/mimo-v2.5-free` (5605ms)
- `opencode/nemotron-3-ultra-free` (6352ms)
- `opencode/north-mini-code-free` (3793ms)

## Unavailable models (18)
- `anthropic/claude-fable-5` — opencode-claude-auth: API 404 for claude-fable-5: Claude Fable 5 is not available. Please use Opus 4.8. Learn more: https://www.anthropic.com/news/fable-mythos-access
- `anthropic/claude-opus-4-0` — opencode-claude-auth: API 404 for claude-opus-4-0: model: claude-opus-4-0
- `anthropic/claude-opus-4-1-20250805` — {"type":"step_start","timestamp":1781836059450,"sessionID":"ses_1224b82c0ffezCZ1ULNrNYi5sY","part":{"id":"prt_eddb4931d001q1KwYhMAxe4aOo","messageID":"msg_eddb47ffb001WkoNGJ1BqrbRdL","sessionID":"ses_1224b82c0ffezCZ1ULNrNYi5sY","snapshot":…
- `anthropic/claude-opus-4-20250514` — opencode-claude-auth: API 404 for claude-opus-4-20250514: model: claude-opus-4-20250514
- `anthropic/claude-opus-4-6-fast` — opencode-claude-auth: API 400 for claude-opus-4-6: Fast mode is not enabled for your organization. An organization admin must enable this feature.
- `anthropic/claude-opus-4-7-fast` — opencode-claude-auth: API 400 for claude-opus-4-7: Fast mode is not enabled for your organization. An organization admin must enable this feature.
- `anthropic/claude-opus-4-8-fast` — opencode-claude-auth: API 400 for claude-opus-4-8: Fast mode is not enabled for your organization. An organization admin must enable this feature.
- `anthropic/claude-sonnet-4-0` — opencode-claude-auth: API 404 for claude-sonnet-4-0: model: claude-sonnet-4-0
- `anthropic/claude-sonnet-4-20250514` — opencode-claude-auth: API 404 for claude-sonnet-4-20250514: model: claude-sonnet-4-20250514
- `google/gemini-2.5-flash` — {"type":"error","timestamp":1781836128168,"sessionID":"ses_1224a698bffeLiuPXaRe6UFrkq","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `google/gemini-2.5-flash-lite` — {"type":"error","timestamp":1781836131643,"sessionID":"ses_1224a5c09ffe4JDWvPNpZWAIsC","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `google/gemini-2.5-pro` — {"type":"error","timestamp":1781836134995,"sessionID":"ses_1224a4e4dffejZbniytY5yOg7q","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `google/gemini-3-flash-preview` — {"type":"error","timestamp":1781836138616,"sessionID":"ses_1224a4140ffe0sd98D6B1LjLmB","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `google/gemini-3.1-flash-lite` — {"type":"error","timestamp":1781836141949,"sessionID":"ses_1224a32c9ffeU4ifNbtEs0sMX4","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `google/gemini-3.1-pro-preview` — {"type":"error","timestamp":1781836145374,"sessionID":"ses_1224a25c1ffeAV3frnAffXJ0nO","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `google/gemma-4-E2B-it` — {"type":"error","timestamp":1781836148467,"sessionID":"ses_1224a18aaffergsVAzyzlWIozf","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `google/gemma-4-E4B-it` — {"type":"error","timestamp":1781836151603,"sessionID":"ses_1224a0c86ffeATOM7NRdI2OC6U","error":{"name":"APIError","data":{"message":"You do not have a valid license of this product. Please contact your administrator to request a license. I…
- `openai/gpt-5.5-pro` — {"type":"error","timestamp":1781836199914,"sessionID":"ses_122494e00ffeVrpwaGwK7VxZXm","error":{"name":"APIError","data":{"message":"Bad Request: {\"detail\":\"The 'gpt-5.5-pro' model is not supported when using Codex with a ChatGPT accoun…

## Excluded models (3)
- `google/gemini-2.5-flash-image` — excluded by script filter
- `google/gemini-3-pro-image-preview` — excluded by script filter
- `google/gemini-3.1-flash-image-preview` — excluded by script filter

## Canonical available provider models
- `anthropic/claude-haiku-4-5`
- `anthropic/claude-haiku-4-5-20251001`
- `anthropic/claude-opus-4-1`
- `anthropic/claude-opus-4-5`
- `anthropic/claude-opus-4-5-20251101`
- `anthropic/claude-opus-4-6`
- `anthropic/claude-opus-4-7`
- `anthropic/claude-opus-4-8`
- `anthropic/claude-sonnet-4-5`
- `anthropic/claude-sonnet-4-5-20250929`
- `anthropic/claude-sonnet-4-6`
- `openai/gpt-5.3-codex-spark`
- `openai/gpt-5.4`
- `openai/gpt-5.4-fast`
- `openai/gpt-5.4-mini`
- `openai/gpt-5.4-mini-fast`
- `openai/gpt-5.5`
- `openai/gpt-5.5-fast`

