# FlowDesk Release 1 Packaging and Bootstrap Smoke

Date: 2026-05-19

Scope: local workspace package smoke only. No npm publish, provider call, real OpenCode dispatch, actual lane launch, automatic fallback/reselection, or hard chat cancellation/no-reply path was exercised.

## Verdict

The Release 1 package shape is a **local packaging smoke pass** for the private workspace packages and bootstrap CLI surface.

This evidence supports Release 1 local/development installation through the `flowdesk-install-release1` package bin and the non-dispatch command-backed registration boundary. It is not public npm release approval and does not promote real dispatch or any later-gated authority.

## Commands Run

```text
npm pack --dry-run --json -w @flowdesk/core
npm pack --dry-run --json -w @flowdesk/opencode-plugin
```

## What Passed

1. `@flowdesk/core@0.0.0` dry-run pack completed with filename `flowdesk-core-0.0.0.tgz`.
2. `@flowdesk/opencode-plugin@0.0.0` dry-run pack completed with filename `flowdesk-opencode-plugin-0.0.0.tgz`.
3. The plugin package includes the `flowdesk-install-release1` bin through package metadata.
4. Both package manifests now include only runtime declaration/source-map and JavaScript artifacts from `dist`, excluding `dist/**/*.test.*` and `dist/.tsbuildinfo` from the packed file list.
5. The plugin package description reflects Release 1 non-dispatch command-backed registration instead of the older no-registration scaffold wording.
6. Bootstrap CLI tests cover preview-without-write, exact typed approval, command file writes, durable bootstrap confirmation ledger consumption, and package bin exposure without dispatch authority.

## Smoke Summary

| Package | Dry-run filename | Entry count | Packed size | Notable boundary |
|---|---|---:|---:|---|
| `@flowdesk/core` | `flowdesk-core-0.0.0.tgz` | 97 | 132876 bytes | runtime core artifacts only; test outputs excluded |
| `@flowdesk/opencode-plugin` | `flowdesk-opencode-plugin-0.0.0.tgz` | 33 | 50642 bytes | server exports and `flowdesk-install-release1` bin; test outputs excluded |

## Safety Interpretation

This smoke evidence does not authorize public publishing or runtime dispatch. Release 1 remains bounded to command-backed non-dispatch behavior:

1. Bootstrap writes portable `/flowdesk-*` command files and redacted `.flowdesk/bootstrap` artifacts only after exact typed approval.
2. Bootstrap preview writes no files.
3. Production registration is limited to Release 1 non-dispatch command-backed handlers.
4. Provider calls, real OpenCode dispatch, runtime execution, actual lane launch, automatic fallback/reselection, and hard chat cancellation/no-reply authority remain disabled.
5. Packages remain `private: true` until public publishing is explicitly approved.

## Next Workflow

1. Keep using dry-run package inspection before public release approval.
2. Re-run this smoke after package manifest, export, bin, installer, or build-output changes.
3. Do not treat package smoke as proof of trusted runtime echo, sufficient telemetry, actual delegated lane launch, provider availability, managed fallback, or hard chat control.
