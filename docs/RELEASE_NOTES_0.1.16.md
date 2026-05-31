# FlowDesk 0.1.16 Release Notes

FlowDesk `0.1.16` is a patch release for the OpenCode plugin npm entrypoint.

## Fixed

- The `@flowdesk/opencode-plugin` package root now exports the default OpenCode server plugin object, so OpenCode can load the plugin with:

  ```json
  { "plugin": ["@flowdesk/opencode-plugin"] }
  ```

- Documentation no longer instructs users to configure the `/server` subpath as the OpenCode plugin entry. OpenCode's npm plugin resolver expects a package root and can fail when given `@flowdesk/opencode-plugin/server`.

## Authority boundary

This release does not promote default dispatch, provider-call, runtime, fallback, write, or hard chat-control authority. Release 1 remains command-backed and non-dispatch by default; provider-calling developer tools still require explicit opt-in and per-call approval flags.
