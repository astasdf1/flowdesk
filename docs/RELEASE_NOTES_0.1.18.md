# FlowDesk 0.1.18 Release Notes

FlowDesk `0.1.18` fixes Gemini usage collection under the Bun-compiled OpenCode runtime.

## Fixed

- **Gemini usage under the Bun OpenCode runtime.** The provider usage collector read the OpenCode `google` OAuth record (refresh token) correctly under both Node and the Bun-compiled OpenCode standalone runtime, but inferring the `opencode-gemini-auth` OAuth client by reading the large cached package bundle returned empty under Bun, so an expired-token refresh failed with "oauth client evidence is missing" inside OpenCode while the same installed code succeeded under Node. The collector now falls back to the well-known PUBLIC `opencode-gemini-auth` installed-app OAuth client (the same id/secret shipped in plaintext in that public package) as the LAST option after explicit config, explicit env, and live package inference. This is not a user secret; it only lets FlowDesk refresh a token the user already obtained via `opencode-gemini-auth`, and it keeps the refresh working under Bun, Node, and cache-env drift. The collector still fails closed when the refresh call itself returns no token, and the public client can be overridden by `FLOWDESK_GEMINI_OAUTH_CLIENT_ID`/`SECRET` or inline config.

## Authority boundary

This release does not promote default dispatch, provider-call, runtime, fallback, write, or hard chat-control authority. Release 1 remains command-backed and non-dispatch by default. Production managed-dispatch promotion remains later-gated behind human Guard approval, the plugin-verifiable dispatch bundle, and OpenCode-dependent runtime/telemetry/lane attestation that FlowDesk must not self-attest.
