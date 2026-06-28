# FlowDesk Installation

FlowDesk currently has two supported install surfaces:

- **OpenCode plugin**: `@flowdesk/opencode-plugin`, installed through npm and OpenCode config.
- **Omnigent selection tool**: `flowdesk-omnigent-tool`, installed into an Omnigent Python environment.

They are independent. Install only the surface you need.

## Requirements

- Node.js compatible with the package engines. This repo currently uses Node `>=24.14.1` for development.
- npm compatible with the workspace scripts.
- For Omnigent: `uv`, Python 3.12, and an Omnigent checkout or Python environment.

## OpenCode Plugin

### Package Install

Published-package path:

```bash
npm install @flowdesk/core@^0.2.1 @flowdesk/opencode-plugin@^0.2.1
```

Local development path from this repository:

```bash
npm install
npm run build --workspace @flowdesk/core
npm run build --workspace @flowdesk/opencode-plugin
```

Packaging check:

```bash
npm pack --workspace @flowdesk/core --dry-run
npm pack --workspace @flowdesk/opencode-plugin --dry-run
```

The OpenCode plugin package exposes this bin after build/package install:

```bash
flowdesk-install-release1 --help
```

Local equivalent:

```bash
node packages/opencode-plugin/dist/bootstrap-cli.js --help
```

### OpenCode Config

Add the plugin package to OpenCode config:

```json
{
  "plugin": ["@flowdesk/opencode-plugin"]
}
```

Minimal local/dev opt-in example:

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "providerUsageLive": {
          "enabled": true,
          "providers": ["claude", "openai", "gemini"]
        },
        "statusLive": { "enabled": true },
        "laneHeartbeatWriter": { "enabled": true },
        "chatMessageStallAlert": { "enabled": true },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ]
}
```

### Bootstrap Portable Commands

Preview first. This writes nothing and prints the exact approval phrase:

```bash
flowdesk-install-release1 \
  --profile-root <opencode-profile-dir> \
  --durable-root <flowdesk-state-dir> \
  --target-profile profile-release1 \
  --confirmation confirmation-release1
```

Apply by rerunning with the exact phrase:

```bash
flowdesk-install-release1 \
  --profile-root <opencode-profile-dir> \
  --durable-root <flowdesk-state-dir> \
  --target-profile profile-release1 \
  --confirmation confirmation-release1 \
  --approve "<exact phrase printed by preview>"
```

The bootstrap installer writes portable `/flowdesk-*` command files and redacted bootstrap artifacts only. It does not enable provider dispatch, fallback, write/apply, or hard-chat authority.

## Omnigent Tool

### Install Into Omnigent venv

Published-package path after PyPI release:

```bash
uv pip install --python /path/to/omnigent/.venv/bin/python flowdesk-omnigent-tool
```

From the FlowDesk repository:

```bash
node scripts/install-omnigent-tool.mjs --omnigent-root /path/to/omnigent
```

If you know the exact Python executable:

```bash
node scripts/install-omnigent-tool.mjs --python /path/to/omnigent/.venv/bin/python
```

The script runs:

- `uv pip install --python <python> -e packages/omnigent-tool`
- import smoke for `flowdesk_omnigent.selection`
- MCP tool-list smoke for `flowdesk_omnigent.mcp_server`

Build check for distribution artifacts:

```bash
uv build --sdist --wheel --out-dir /tmp/flowdesk-omnigent-dist packages/omnigent-tool
```

Fresh venv wheel smoke and release preflight:

```bash
npm run release:omnigent-tool
```

Publish is opt-in and requires PyPI/TestPyPI credentials or trusted publishing:

```bash
# TestPyPI
npm run release:omnigent-tool -- --test-pypi

# Production PyPI
npm run release:omnigent-tool -- --publish
```

For token-based local publishing, configure credentials outside the repo, for example `UV_PUBLISH_TOKEN`. Do not store PyPI tokens in this repository.

GitHub Actions Trusted Publishing is configured through `.github/workflows/publish-omnigent-tool.yml`:

- Manual TestPyPI publish: run workflow `Publish Omnigent Tool` with `publish_target=testpypi`.
- Manual PyPI publish: run workflow `Publish Omnigent Tool` with `publish_target=pypi`.
- Tag-based PyPI publish: push a tag matching `omnigent-tool-v*`.

PyPI Trusted Publisher settings must match:

- workflow filename: `publish-omnigent-tool.yml`
- PyPI environment: `pypi`

TestPyPI Trusted Publisher settings, if used, must match:

- workflow filename: `publish-omnigent-tool.yml`
- TestPyPI environment: `testpypi`

### Omnigent Fixture Smoke

Function-tool fixture:

```bash
omnigent run examples/omnigent-flowdesk -p "Call flowdesk_select_agent_model for task_id task-smoke with task_role architecture and allowed_provider_families [openai], then dispatch the selected architecture-agent and return the child result."
```

MCP fixture:

```bash
omnigent run examples/omnigent-flowdesk-mcp -p "Call the FlowDesk MCP selection tool for architecture and report the selected agent."
```

## Verification Commands

OpenCode/core:

```bash
npm run typecheck --workspace @flowdesk/core
npm run typecheck --workspace @flowdesk/opencode-plugin
npm run build --workspace @flowdesk/opencode-plugin
```

Omnigent Python tool:

```bash
PYTHONDONTWRITEBYTECODE=1 PYTHONPATH=packages/omnigent-tool/src \
  /path/to/omnigent/.venv/bin/python -m unittest discover -s packages/omnigent-tool/tests
```

## Current Gaps

- OpenCode package installation is established through npm package metadata and `flowdesk-install-release1`, but user config still needs manual plugin entry.
- Omnigent package installation is prepared for PyPI (`flowdesk-omnigent-tool`) and established for local/dev use through `scripts/install-omnigent-tool.mjs`; no public PyPI package is claimed until release credentials/trusted publishing are configured.
- The Omnigent guard is fixture-level policy enforcement, not an upstream Omnigent core hook.
