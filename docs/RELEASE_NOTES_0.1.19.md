# FlowDesk 0.1.19 Release Notes

FlowDesk `0.1.19` reverts the `0.1.18` hardcoded Gemini fallback OAuth client.

## Changed

- **Removed the hardcoded public Gemini fallback OAuth client.** `0.1.18` added the public `opencode-gemini-auth` installed-app OAuth client as a built-in last-resort fallback so Gemini usage refresh would work under the Bun-compiled OpenCode runtime. Even though those values are public (shipped in plaintext in the public `opencode-gemini-auth` package), storing them in the source — including base64-encoded — is rejected by GitHub secret-scanning push protection (the scanner decodes base64). The constant has been removed. The collector is back to inferring the OAuth client only from explicit config, explicit env (`FLOWDESK_GEMINI_OAUTH_CLIENT_ID`/`SECRET`), and the locally cached `opencode-gemini-auth` package, and fails closed when none is available.

## Known limitation

- Under the Bun-compiled OpenCode standalone runtime, inferring the OAuth client from the cached `opencode-gemini-auth` package bundle has been observed to return empty (so an expired-token refresh fails), even though the same installed code succeeds under Node. The exact Bun-runtime cause is not yet confirmed because there is no in-runtime diagnostic path to inspect it (no eval surface, no standalone Bun). Until that is diagnosed with real in-runtime evidence, set `FLOWDESK_GEMINI_OAUTH_CLIENT_ID`/`FLOWDESK_GEMINI_OAUTH_CLIENT_SECRET` to make Gemini usage refresh work under OpenCode, or cross-check Gemini with the native `gemini_quota` tool. This does not block production work that uses Claude/OpenAI.

## Authority boundary

This release does not promote default dispatch, provider-call, runtime, fallback, write, or hard chat-control authority. Release 1 remains command-backed and non-dispatch by default. Production managed-dispatch promotion remains later-gated behind human Guard approval, the plugin-verifiable dispatch bundle, and OpenCode-dependent runtime/telemetry/lane attestation that FlowDesk must not self-attest.
