# OpenCode Plugin and Reference Pack Research

> **FlowDesk supersession note:** This document is research/background material. It is not normative for FlowDesk implementation identity, package names, project data paths, Release 1 scope, command naming, or safety gates. Legacy references such as DEX Conductor, `@dex-conductor/*`, `.conductor/`, command examples using `/flowdesk:*`, and command-first or developer-preview Release 1 wording are background unless they explicitly match the FlowDesk spec. Current Release 1 is a chat-primary General-Use MVP with command-backed routing and fallback.

## 1. Scope

This document records research used to revise `OPENCODE_FIRST_PLUGIN_DESIGN.md`. It is not an implementation report and does not provide legal, patent, medical, clinical, or regulatory advice.

Research questions:

1. How should DEX become a first-class OpenCode plugin instead of a CLI/subprocess companion?
2. Which DEX-2 harness concepts are reusable without leaking project-specific assumptions?
3. How should patent and medical-device software regulatory agents access law/regulatory data safely?
4. How should real performance/category-fit evaluation be accumulated and used without weakening Guard authority?

## 2. OpenCode Plugin Findings

OpenCode plugins are JavaScript/TypeScript modules loaded from OpenCode plugin paths or npm packages declared in OpenCode config. A plugin receives context such as project, client, shell helper, directory, and worktree, then returns hooks and tools.

Relevant official surfaces found in OpenCode docs/source:

1. `tool` for custom tools.
2. `event` for session, command, shell, permission, file, tool, and TUI observations.
3. `config` for safe config mutation/diagnostics.
4. `chat.message`, `chat.params`, `chat.headers` for chat lifecycle integration. Source review indicates `chat.message` can run before assistant processing and mutate message/parts, but the reviewed surface should not be treated as a stable documented cancel/handled/prevent-default contract unless conformance tests prove that behavior for the pinned OpenCode version.
5. `command.execute.before` for command pre-processing.
6. `tool.execute.before` and `tool.execute.after` for tool containment and audit correlation.
7. `permission.ask`, `shell.env`, `tool.definition`, and experimental transform/compaction hooks.

Plugin package/loading notes from the source pass:

1. OpenCode resolves npm and local plugin specs from OpenCode config.
2. Server entrypoints may come from package `exports["./server"]`, package `exports["."]`, or `main` depending on package shape.
3. Current source supports a newer default export module shape such as `{ id, server }`, while legacy named plugin function exports are still detected.
4. Local path plugins using the newer object shape need an explicit `id`.
5. `engines.opencode` can be used for compatibility checks.

Important constraint: public docs and source indicate command configuration and command hooks/events, but do not clearly establish a dynamic plugin API that registers slash commands at runtime. Therefore desired aliases such as `/flowdesk:plan`, `/flowdesk:run`, `/flowdesk:usage`, and similar UX should be validated against the pinned OpenCode command parser and implemented through configured OpenCode commands or command markdown files that call FlowDesk plugin tools. If colon aliases are not supported, use portable command names such as `/flowdesk-plan`, `/flowdesk-run`, and `/flowdesk-usage`.

Additional command/TUI finding: a TUI plugin API has keymap and legacy command/slash concepts. That is separate from server plugin hooks/tools. DEX should use command markdown/config for prompt workflows, and consider a TUI plugin only if it needs palette entries, panels, status UI, or interactive slash-like TUI actions.

Design implication: `packages/opencode-plugin` should expose tools such as `flowdesk_chat_intake`, `flowdesk_plan`, `flowdesk_run`, `flowdesk_explain_route`, `flowdesk_doctor`, `flowdesk_status`, `flowdesk_resume`, `flowdesk_retry`, `flowdesk_abort`, `flowdesk_usage`, `flowdesk_audit`, `flowdesk_export_debug`, and `flowdesk_reference_search`. The plugin should use the active OpenCode plugin context and client rather than starting a nested `opencode run` process.

Public examples and patterns found:

1. Official plugin examples: simple custom tool, GitHub integration, event handling, chat parameter changes, and command pre-context injection.
2. `frap129/opencode-rules`: discovers markdown rule files, filters them by globs/keywords/tools/model/agent/session context, and injects rules through system-transform hooks.
3. `hung319/opencode-codeindex`: exposes a `tree_indexer` OpenCode tool and demonstrates a plugin package with a programmatic API.
4. `francisco-m001/opencode-mcp-tool-search`: uses plugin tools to search and call MCP tools, showing a pattern for optional MCP integration behind a search layer.
5. `angristan/opencode-wakatime`: event-driven plugin with telemetry dedupe and idle/session handling.
6. `H2Shami/opencode-helicone-session`: auth/provider/session metadata integration with header sanitation.
7. `mohak34/opencode-notifier`: event fan-out, session/subagent tracking, and permission/tool hooks.
8. `tickernelz/opencode-mem`: newer `{ id, server }` plugin module shape, custom tools, chat context injection, session lifecycle handling, and compaction persistence.
9. OpenCode repository internal plugins/tools: provider/auth hooks and custom tool definitions using `@opencode-ai/plugin`.

Reference URLs from the search pass:

1. Official plugins docs: `https://opencode.ai/docs/plugins/`.
2. Official custom tools docs: `https://opencode.ai/docs/custom-tools`.
3. Plugin type/source surface: `https://github.com/anomalyco/opencode/blob/dev/packages/plugin/src/index.ts`.
4. OpenCode plugin runtime loading: `https://github.com/anomalyco/opencode/blob/dev/packages/opencode/src/plugin/index.ts`.
5. `opencode-rules`: `https://github.com/frap129/opencode-rules`.
6. `opencode-codeindex`: `https://github.com/hung319/opencode-codeindex`.
7. `opencode-mcp-tool-search`: `https://github.com/francisco-m001/opencode-mcp-tool-search`.
8. `opencode-wakatime`: `https://github.com/angristan/opencode-wakatime`.
9. `opencode-helicone-session`: `https://github.com/H2Shami/opencode-helicone-session`.
10. `opencode-notifier`: `https://github.com/mohak34/opencode-notifier`.
11. `opencode-mem`: `https://github.com/tickernelz/opencode-mem`.
12. OpenCode own custom tools: `https://github.com/anomalyco/opencode/tree/dev/.opencode/tool`.

Research basis: these findings were captured on 2026-05-15 from public OpenCode docs and the OpenCode `dev` branch URLs above. Implementation should pin the exact OpenCode release or source commit used for compatibility verification before treating hook names or package-loading behavior as stable.

These examples support a DEX structure where the OpenCode plugin owns UX, tools, hooks, and event observation, while DEX core owns planning, routing, Guard, evaluation, and policy contracts.

Recommended DEX package shape:

```ts
import type { Plugin, PluginModule } from "@opencode-ai/plugin"
import { tool } from "@opencode-ai/plugin"

export const DexConductorPlugin: Plugin = async (ctx, options) => ({
  tool: {
    flowdesk_chat_intake: tool({ /* typed schema and execution */ }),
    flowdesk_plan: tool({ /* typed schema and execution */ }),
    flowdesk_run: tool({ /* typed schema and execution */ }),
    flowdesk_explain_route: tool({ /* typed schema and execution */ }),
    flowdesk_doctor: tool({ /* typed schema and execution */ }),
    flowdesk_status: tool({ /* typed schema and execution */ }),
    flowdesk_resume: tool({ /* typed schema and execution */ }),
    flowdesk_retry: tool({ /* typed schema and execution */ }),
    flowdesk_abort: tool({ /* typed schema and execution */ }),
    flowdesk_usage: tool({ /* typed schema and execution */ }),
    flowdesk_audit: tool({ /* typed schema and execution */ }),
    flowdesk_export_debug: tool({ /* typed schema and execution */ }),
    flowdesk_reference_search: tool({ /* typed schema and execution */ })
  },
  event: async ({ event }) => {
    // observe lifecycle, cleanup state, append audit/evaluation observations
  },
  "experimental.session.compacting": async (_input, output) => {
    // preserve DEX state across compaction when needed
  }
})

export default {
  id: "dex-conductor",
  server: DexConductorPlugin
} satisfies PluginModule
```

Use `ctx.client`, tool context `sessionID`/`messageID`/`agent`/`directory`/`worktree`, and abort signals. Do not start nested `opencode run` for normal managed workflows. Treat `chat.params` and `chat.headers` as provider-call customization hooks, not as model/agent routing authority.

Feasibility caveat from focused review: automatic chat intake is feasible only as a `blocking` mode when the installed OpenCode version proves that DEX can suppress, replace, or fully handle the normal assistant turn before unguarded execution. `observe_only` chat integration may record diagnostics or return a safe command fallback, but it is not sufficient for managed dispatch from natural-language chat.

## 3. DEX-2 Harness Commonality

DEX-2 is a reference integration and dogfooding harness. Its project-specific files must not become core/plugin behavior.

Reusable concepts:

1. Policy Pack shape: agents, model policy, high-risk review diversity, hard-ban extension, governance command, audit redaction baseline.
2. Governance integrity: project config declares required governance files and optional checksums.
3. Verification command contract: Policy Pack may declare a project verification command, but plugin/core only validate and execute the configured command safely.
4. Provider-qualified usage snapshots for Claude/GPT/Gemini families.
5. Fake runtime and adapter conformance patterns for testing runtime capability, echo, final usage, and failure behavior.

Project-specific material that must remain in `policy-packs/dex2-harness`, `examples/flowdesk-2`, or project artifacts:

1. `./scripts/dex verify`.
2. `plan_docs/canon/00_ENTRYPOINT.md`.
3. `scripts/hooks/`.
4. DEX-2 project name/profile/path choices.
5. Harness-specific toggles and hard-ban extensions.

These examples are not FlowDesk agent-authoring instructions. Generated FlowDesk agents must not require `plan_docs/canon/00_ENTRYPOINT.md` or any other fixed project documentation path as an expertise source or startup step.

Finding: current core hard bans include `HARNESS_SCORING=off` and `HARNESS_FALSIFICATION=off`. These look harness-specific and should move into the DEX-2 Policy Pack hard-ban extension if they are not globally meaningful.

## 4. Korean Law MCP Assessment

Repository: `https://github.com/chrisryugj/korean-law-mcp`.

`korean-law-mcp` is a TypeScript MCP server and CLI wrapping Korean law.go.kr / MOLEG-style legal data APIs. It offers compact tools for law search, article retrieval, annex/form retrieval, unified decisions, tool discovery, citation verification, impact maps, time comparison, and action-oriented chains.

Useful patterns for DEX:

1. Compact MCP surface with meta-discovery for long-tail specialized tools.
2. Explicit citation verification and hallucination markers such as not-found or hallucination-detected states.
3. Live legal source retrieval through API tools instead of prompt-only knowledge.
4. Impact graph and time-travel comparison patterns.
5. Stateless HTTP MCP mode and request-scoped API key handling.

Cautions:

1. It is a live API wrapper, not a durable, versioned legal reference pack.
2. It should not be treated as an authoritative legal database by itself; authority depends on upstream official sources and response provenance.
3. Query-string API keys are convenient but risky for logs, proxies, and browser history.
4. It does not provide sufficient patent-office coverage for patent-specialist agents.
5. MIT license covers the code, not upstream legal data or third-party content.

DEX recommendation: support it as an optional connector or ingestion source for Korean legal references, especially citation verification and law retrieval. Do not bundle it as the sole legal source. DEX must add snapshotting, source URLs, retrieval timestamps, payload hashes, stale-source checks, and Policy Pack opt-in before using it in high-risk workflows.

## 5. Reference Pack Architecture

DEX should implement legal/regulatory knowledge as versioned reference packs, not as copied prompts or project planning documents.

Recommended shape:

```text
reference-packs/
  patent/
    registry/source-register.yaml
    jurisdictions/us/
    jurisdictions/ep/
    jurisdictions/pct/
    jurisdictions/kr/
    concepts/
    workflows/
  medical-device-software/
    registry/source-register.yaml
    global/imdrf/
    jurisdictions/us-fda/
    jurisdictions/eu-mdr-ivdr/
    jurisdictions/kr-mfds/
    standards/
    concepts/
    workflows/
schemas/
  reference-pack.schema.json
  reference-card.schema.json
  source-register.schema.json
```

Every reference card needs:

1. `id`, domain, jurisdiction, authority, source type, status.
2. source URL, official publication URL if different, fetched date, last verified date, next review due.
3. version/effective/publication dates where applicable.
4. license/copyright note and embedding/quote policy.
5. retrieval tags and related references.
6. `do_not_use_for` and professional-review flags.
7. source hash or change hash for reproducibility.

Authoritative source families to track:

1. Patent: USPTO/MPEP and updates, WIPO/PCT, EPO/EPC/guidelines, KIPO/KIPRIS and Korean Patent Act sources where relevant.
2. Medical-device software: FDA digital health and device software guidance, eCFR/CFR, EU MDR/IVDR and MDCG guidance, IMDRF SaMD documents, MFDS/Korean digital medical product sources.
3. Standards: ISO 13485, ISO 14971, IEC 62304, IEC 62366, IEC 81001-5-1, ISO/TR 24971 as metadata and access pointers only unless DEX has licensed rights.

Safety rules:

1. No final legal, patentability, freedom-to-operate, compliance, clearance, clinical, or release decisions.
2. Human review is mandatory before filings, submissions, claims, compliance assertions, or product decisions.
3. Guidance must be distinguished from binding law/regulation.
4. Jurisdiction must be explicit; results must not transfer across jurisdictions without caution.
5. Stale, superseded, unknown, or unverified sources must fail closed for high-risk use.

## 6. Evaluation Ledger Findings

Current implementation is not a real evaluation system. It has a transitional `ModelPerformance { model, score, latency_ms? }` input that can influence selection among fixed candidates, but there is no persistent store, event schema, aggregation, decay, thresholding, category scoping, or specialist-agent quality signal.

Required architecture:

```text
packages/evaluation/
  src/types.ts
  src/events.ts
  src/store.ts
  src/aggregate.ts
  src/selectors.ts
  tests/index.test.ts
.conductor/evaluation/events.jsonl
.conductor/evaluation/category-fit.snapshot.json
```

Observation events should include workflow/step/attempt ids, agent, category, difficulty, model/provider/family, runtime variant, verification result, Guard status, runtime echo trust, artifact disposition, review verdict, latency, rework, user override, and exclusion reasons.

Specialist-agent quality signals should include citation fidelity, stale-reference rate, unsafe-advice rate, reviewer disagreement, missing jurisdiction, and missing human-review boundary.

Evaluation is advisory only. It may rank eligible candidates after hard filters, but must never override policy, hard bans, provider-native usage, runtime compatibility, review diversity, human approval, or DEX Model Guard rejection.

## 7. Design Changes Applied

The design document was revised to include:

1. OpenCode plugin-first wording and demotion of CLI/subprocess adapter to compatibility/test path.
2. OpenCode plugin packaging and command/tool/hook surface constraints.
3. Automatic chat-intake UX: every natural-language OpenCode chat turn passes through the DEX workflow gate and is classified as `fast_chat`, `managed_plan`, `clarify`, or `blocked` only when a verified `blocking` chat-intake capability is available; otherwise managed dispatch from natural chat fails closed to configured commands. `/flowdesk:*` remains the desired explicit-control alias family for setup, plan, route explanation, status, recovery, audit, and debug export when the pinned OpenCode command parser supports it.
4. DEX-2 harness integration boundary.
5. Agent Profile Registry and specialist patent/medical-device regulatory profiles.
6. Reference Pack Architecture and optional `korean-law-mcp` connector policy.
7. Evaluation Ledger, trust rules, aggregation, anti-Goodhart controls, and routing order.
8. Config shape expansion and implementation gap matrix.
9. Review-agent migration note for legacy `critic` fields versus canonical `reviewer` profiles.
10. Fresh install script plan for removing OMO, rejecting mutable plugin specs, pinning the FlowDesk plugin, disabling unsafe autoupdate, and separating development-only Marksman/Markdown LSP setup from DEX runtime behavior.

## 8. Remaining Follow-Ups

1. Add a follow-up ADR for OpenCode plugin-first packaging while preserving standalone project-agnostic core.
2. Update README, Architecture, Onboarding, and Roadmap to avoid presenting CLI/subprocess as the target UX.
3. Mark `REVISED_ORCHESTRATION_PLAN.md` OpenCode/OMO language as legacy for this plugin path.
4. Move harness-specific hard bans out of core if they are not globally applicable.
5. Add schemas and package plans for `packages/opencode-plugin`, `packages/evaluation`, and canonical `reference-packs/` plus `.conductor/reference-packs/registry.yaml` project registration.
6. Resolve current `critic` versus `reviewer` agent-id compatibility before plugin dispatch relies on policy `agents.allowed` or runtime capability discovery.
7. Implement the production installer so it backs up OpenCode config, removes OMO plugins/config references, rejects mutable `@latest` plugin specs unless explicitly approved, disables unsafe autoupdate, records DEX package integrity, and runs `/flowdesk:doctor` before first dispatch.
8. Keep current `oh-my-openagent.json` Marksman mapping classified as development-harness tooling only; target DEX installation must not require OMO-owned config for Markdown diagnostics or runtime behavior.
9. Define and test the automatic chat-intake classifier, including when natural-language approval is sufficient, when typed confirmation is required, and how blocked/clarify states appear in the chat response and `/flowdesk:status`.
10. Add OpenCode conformance tests for `chat_intake_mode: "blocking"`, command alias parsing, runtime echo evidence, and event ordering before enabling chat-first managed dispatch in production.
