# FlowDesk 0.1.17 Release Notes

FlowDesk `0.1.17` is a reliability and diagnostics patch for the agent-task lane capture path and provider usage collection.

## Fixed

- **Heavy-model first-token grace.** Slow first-token models (Claude Opus, non-fast GPT-5.x main, Codex) could exceed the shortened 10s/20s/30s quiet/nudge window before emitting their first assistant token on large prompts and be mis-classified as `no_response`. Capture now gives heavy models a pre-first-token grace: while no assistant token has appeared yet it does not nudge (a `noReply` nudge only interferes with the in-flight first turn) and waits quietly with heartbeats until a first-token deadline of about 90s, then gives up. Once the first token arrives, the normal 10s/20s/30s policy governs the rest of the stream for all models. Light models (mini/fast/spark/flash/flash-lite/haiku, plus Gemini Pro and Sonnet) keep the unchanged short policy.

- **Gemini OAuth client inference is robust to cache-env drift.** The public `opencode-gemini-auth` OAuth client metadata is now resolved across all plausible cache homes (`OPENCODE_CACHE_DIR`, `XDG_CACHE_HOME`, and the home-relative `~/.cache/opencode` default) and also a config-local `~/.config/opencode/node_modules` install, so a tool host launched without those env vars can still infer the client and refresh an expired access token. No client secret is stored in FlowDesk source.

## Added

- **`provider_dispatch_error` task-failure category.** A launch failure where the runtime created the child session but the provider returned an error before producing output is now surfaced as `provider_dispatch_error` instead of being collapsed into `sdk_create_failed`, improving diagnosis of real provider-side dispatch failures.

## Authority boundary

This release does not promote default dispatch, provider-call, runtime, fallback, write, or hard chat-control authority. Release 1 remains command-backed and non-dispatch by default; provider-calling developer tools still require explicit opt-in and per-call approval flags. Production managed-dispatch promotion remains later-gated behind human Guard approval.
