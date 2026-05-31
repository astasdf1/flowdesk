# OpenCode model availability snapshots

Run `npm run models:refresh` to refresh the latest OpenCode model availability snapshot.

The refresh script:
- reads the current `opencode models` catalog,
- sends a very short probe prompt to each listed model,
- excludes image-only catalog entries by default,
- skips models that the previous snapshot already marked as unsupported/not found,
- keeps temporary/account-specific failures in rotation for the next refresh,
- writes the working-model list to the internal db at `~/.flowdesk/model-availability/working-models.json`,
- writes the latest machine-readable snapshot to `opencode-model-availability.json`, and
- writes a human-readable summary to `opencode-model-availability.md`.

Typical periodic schedule:

```bash
0 3 * * * cd /path/to/flowdesk && npm run models:refresh
```

Use `--limit N` for a quick smoke run and `--timeout-ms N` to tune the per-model probe window.
Use `--include-family anthropic,google` or `--exclude-family openai` when a provider quota bucket is critical and the refresh should avoid probing that provider while still keeping a redacted partial snapshot.
