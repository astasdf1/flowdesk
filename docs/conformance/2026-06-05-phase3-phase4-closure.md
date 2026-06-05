# Phase 3 and Phase 4 Closure Evidence — 2026-06-05

This note records plugin-verifiable closure evidence for FlowDesk Phase 3 and Phase 4. It is diagnostic and conformance evidence only; it does not approve default managed dispatch, automatic fallback/reselection, hard chat cancellation/noReply/stop, controlled writes, or production provider/runtime execution authority.

## Scope

- **Phase 3 OpenCode plugin command path:** package-root plugin load, command-backed Release 1 tool registration, bootstrap/doctor/status/usage/debug/recovery surfaces, conservative chat steering, provider-free previews, passive TUI/sidebar formatting, completion wake/status display, and split test commands.
- **Phase 4 OpenCode Plugin/SDK compatibility:** plugin/SDK-observable behavior, including plugin load, tool schema registration, command-backed execution, SDK adapter shapes, session/message/lifecycle observation, fail-closed modes, redaction, durable reload, dependency compatibility, packaging dry-runs, and OpenCode 1.x compatibility evidence.

Out of scope and still later-gated: production/default managed dispatch, automatic provider/model fallback or reselection, hard chat cancellation/noReply/stop authority, remote connector execution, and platform-internal runtime truth or telemetry authority.

## Verification commands and evidence

Fresh verification came from FlowDesk workflows `workflow-phase34-verification-20260605`, `workflow-tui-test-ffi-fix-20260605`, `workflow-package-lock-version-sync-20260605`, `workflow-release-package-verifier-agent-20260605`, and `workflow-release-package-verifier-packdiff-after-restart-20260605`, plus bounded main-session verification after lane permission limitations were resolved.

| Command / evidence | Result |
|---|---|
| `npm run build --workspace @flowdesk/opencode-plugin` | PASS |
| `node scripts/run-tests.mjs --mode functional --package opencode-plugin` | PASS: 155 pass / 0 fail / 0 cancelled / 0 skipped |
| `node scripts/run-tests.mjs --mode integration --package opencode-plugin` | PASS: 178 pass / 0 fail / 0 cancelled / 0 skipped |
| `node --test packages/opencode-plugin/dist/tui.test.js packages/opencode-plugin/dist/tui-subtask-activity.test.js packages/opencode-plugin/dist/tui-usage-snapshot.test.js` | PASS after extracting `formatFlowDeskTuiSidebarCompactLines` into the FFI-free `tui-sidebar-format` module |
| `opencode --version` | Observed `1.15.13` |
| `npm ls @opencode-ai/plugin @opentui/core @flowdesk/core --workspace @flowdesk/opencode-plugin` | PASS: reports `@flowdesk/opencode-plugin@0.2.0`, `@flowdesk/core@0.2.0`, `@opencode-ai/plugin@1.15.6`, `@opentui/core@0.2.16` |
| `npm pack --dry-run --json --workspace @flowdesk/opencode-plugin` | PASS: package id `@flowdesk/opencode-plugin@0.2.0`, filename `flowdesk-opencode-plugin-0.2.0.tgz` |
| `npm pack --dry-run --json --workspace @flowdesk/core` | PASS: package id `@flowdesk/core@0.2.0`, filename `flowdesk-core-0.2.0.tgz` |
| Local plugin registration smoke | PASS: plugin id `flowdesk`, server function present, default command-backed tools registered |
| Local `flowdesk_pre_spike_doctor` / `flowdesk_doctor` smoke | PASS: Release 1 non-dispatch registration ready; disabled modes confirmed for real dispatch, managed fallback, lane launch, and hard chat blocking |
| `git diff --check` | PASS |

After restart, the dedicated `flowdesk-release-package-verifier` lane also completed package/diff verification as terminal `task_result` evidence. It reported `git diff --check` PASS, `opencode --version` PASS with `1.15.13`, package dry-runs PASS for both `@flowdesk/core@0.2.0` and `@flowdesk/opencode-plugin@0.2.0`, and observed `@opencode-ai/plugin@1.15.6` plus `@opentui/core@0.2.16` through workspace dependency inspection. `git status --short` was intentionally not clean because this work session has pending source and documentation changes; that is a pending-review/commit state, not a whitespace or package artifact failure. The first post-restart verifier run exposed an overly narrow `npm ls` exact-command allowlist, which was then patched in the project profile and installer template; focused profile/materialization tests and `git diff --check` passed after the permission fix.

Initial Phase 3/4 verification found three blockers: Node 24 OpenTUI FFI import through `tui.test.js`, lane permission denials for package dry-runs and `opencode --version`, and package-lock workspace version drift. The FFI blocker was fixed by extracting the pure sidebar formatter into `packages/opencode-plugin/src/tui-sidebar-format.ts`; the bounded main-session verification supplied the denied command evidence; and package metadata was synchronized to `0.2.0`.

## Closure judgement

### Phase 3

Phase 3 is marked complete for the current plugin-verifiable command-backed OpenCode plugin path. Build, functional tests, integration tests, plugin registration, command-backed doctor smoke, TUI/sidebar helper coverage, status/usage/result excerpt behavior, bootstrap materialization, and package dry-runs all pass for the Release 1 non-dispatch scope.

### Phase 4

Phase 4 is marked complete for the current plugin/SDK-observable compatibility scope. OpenCode CLI version `1.15.13` was observed, package dependency evidence is aligned with OpenCode plugin 1.x (`@opencode-ai/plugin@1.15.6`, peer range `>=1.14.40 <2`), OpenTUI-dependent runtime code no longer blocks Node-based pure helper tests, SDK/adapter integration tests pass, and package metadata/dry-run evidence is consistent at `0.2.0`.

## Authority boundary

This closure does not enable or approve:

- default/production OpenCode dispatch;
- automatic provider/model fallback or reselection;
- hard chat cancellation/noReply/stop;
- remote connector execution;
- production managed-dispatch promotion;
- default workspace writes.

Those capabilities remain later-gated and require their own Guard/user approval, durable evidence, policy checks, and compatibility proofs.
