# FlowDesk Natural-Language Usage

FlowDesk exposes description-driven LLM tools that fire automatically when the assistant detects matching natural-language patterns in the OpenCode chat. No portable command typing required. Release 1 also exposes local preview/status helpers that are not provider callers and do not execute workflow steps.

This document covers:

1. What each natural-language tool or local preview helper does.
2. Which natural-language phrases trigger each tool.
3. The minimum plugin config + environment variables required for live data.
4. How to verify the active OpenCode profile.

Default FlowDesk natural-language routing keeps `realOpenCodeDispatch`, `fallbackAuthority`, and `hardCancelOrNoReplyAuthority` false and does not promote default production dispatch or automatic provider switching. Diagnostic/planning/local-preview tools such as `flowdesk_provider_usage_live`, `flowdesk_status_live`, `flowdesk_quick_fallback_run`, `flowdesk_lane_heartbeat_record`, `flowdesk_workflow_synthesis_preview`, and `flowdesk_auto_continue_preview` keep provider/runtime/lane-launch authority false. Provider-calling helpers such as `flowdesk_agent_task_run` are explicit developer-mode tools and remain outside default Release 1 dispatch authority. `flowdesk_quick_reviewer_run` is an opt-in helper in the product surface, but the current coordinator operating policy quarantines it until explicitly revalidated; use explicit `flowdesk_agent_task_run` reviewer lanes instead when reviewer work is needed.

## Plan-Backed Continuous Work Steering

FlowDesk also recognizes continuous-work chat phrases such as Korean `계획 전체 진행`, `막히기전까지 진행`, `계속 진행`, `전체 설계문서 기반으로 진행` and English `continue until blocked`, `keep going`, `work through the whole plan`, `proceed with the entire design`.

This route is deliberately gated. FlowDesk may suggest `/flowdesk-resume` only when existing plan/design evidence is already available for the workflow or session, such as a FlowDesk planning lane record or an equivalent design/plan document reference. If no such evidence exists, FlowDesk asks for clarification and points to `/flowdesk-status`; it must not auto-create a plan, auto-run, infer requirements from the latest chat alone, or bypass the Release 1 confirmation requirements for dry-run/fake-runtime execution.

Continuous work always stops at the next blocker, ambiguous requirement, missing verification, Guard denial, stale or absent required evidence, unsupported later-gate capability, or user-facing clarification need. It does not enable real dispatch, provider calls, actual lane launch, automatic fallback, or hard chat cancellation.

When durable `workflow_dispatch_plan` evidence exists, `flowdesk_auto_continue_preview` can show the next pending planned task without executing it. It reads only durable plan evidence plus existing `task_result` ids, reports the next task title/summary and pending/completed counts, and sets `autoContinuationExecuted=false` and `previewOnly=true`. It does not read transient chat/todowrite state, call a provider, launch a lane, invoke `/flowdesk-run`, fallback/reselect, mutate TUI/chat, or write workspace files. Treat it as “what would be next?” evidence; actual continuation still requires a later gated/confirmed execution path.

When every expected task result is already durable, `flowdesk_workflow_synthesis_preview` can summarize existing `task_result` evidence locally and persist `flowdesk.workflow_synthesis_result.v1`. It is provider-free and idempotent: repeated calls return existing synthesis evidence rather than duplicating it. It does not launch a synthesis lane or grant execution authority.

When `durableStateRoot` is configured, FlowDesk also remembers recently shown non-confirmation steering cards in a short-lived redacted preference cache. This prevents the same plan/status/usage suggestion from reappearing immediately after the plugin process restarts. The cache stores only schema-safe session/action labels and expiry timestamps; it does not store the chat text, prompts, transcripts, file paths, command payloads, tool results, provider payloads, or credentials. If the cache cannot be read or written, FlowDesk falls back to in-memory de-duplication.

If the plugin profile opts into `projectConfig.enabled=true`, natural-language routing also depends on `.flowdesk/config.json` loading and validating successfully from the configured root. Missing, malformed, invalid, or chat-disabled config fails closed: the `chat.message` steering hook is not registered, and `flowdesk_pre_spike_doctor` reports the redacted config status.

Debug-export requests route to `/flowdesk-export-debug`. With a durable state root, the local non-dispatch adapter materializes a redacted debug manifest containing only section summaries, opaque refs, retention/deletion state, and counts. It is not a raw log export.

## Tool 1: `flowdesk_quick_reviewer_run` / explicit reviewer lanes

3-perspective FlowDesk reviewer fan-out (`policy_security`, `architecture`, `verification_implementation`) against an injected OpenCode SDK reviewer agent/model. This is an explicit opt-in provider-calling helper, not part of default non-dispatch command routing. Current coordinator policy quarantines this helper until revalidated, so review intent should be satisfied through explicit `flowdesk_agent_task_run` reviewer lanes with concrete agent/model bindings and `nudgeQuietPeriodMs: 10000`.

### Trigger phrases

Korean: `다관점 리뷰`, `다관점리뷰`, `다관점 비판적리뷰`, `다관점 비판적 리뷰`, `다각도 리뷰`, `다각도 검토`, `여러 관점 리뷰`, `여러 관점에서 검토`, `복수 관점 리뷰`, `비판적 리뷰`, `비판적 검토`, `심층 리뷰`, `아키텍처 리뷰`, `보안 리뷰`, `품질 리뷰`, `검토`, `점검`.

English: `multi-perspective review`, `multi-angle review`, `critical review`, `audit`, `critique`, `assess`, `evaluate`, `inspect`.

The user does not need to attach a code snippet. If no snippet is supplied, the assistant passes a concise summary of the current conversation context as the review target.

### Required plugin config

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "quickReviewerRun": {
          "enabled": true,
          "providerQualifiedModelId": "openai/gpt-5.4-mini-fast",
          "runtimeAgent": "reviewer-gpt-frontier"
        }
      }
    ]
  ]
}
```

`providerQualifiedModelId` must be the concrete provider/model id for the reviewer agent; `runtimeAgent` must be a configured OpenCode `agent` entry. The assistant may call this tool directly for explicit review intent after config opt-in; the tool itself still blocks unless both `developerModeAcknowledged=true` and `allowProviderCall=true` are present.

### Result shape

`status: "quick_reviewer_run_completed"` and `acceptanceStatus: "verdicts_accepted"` and `durableLinkageStatus: "durable_verdicts_accepted"` on full success. Per-lane diagnostic detail with `redactedBlockReason` is returned for partial failures.

## Tool 2: `flowdesk_provider_usage_live`

Live per-provider remaining quota for Claude OAuth, OpenAI/Codex, and Gemini Code Assist. When a durable state root is configured, FlowDesk first tries to reuse fresh `flowdesk.usage_snapshot.v1` evidence within its `freshness_ttl`; otherwise it reads OAuth credentials and provider rate-limit/quota APIs directly.

### Trigger phrases

Korean: `사용량`, `잔량`, `남은 사용량`, `남은 토큰`, `남은거 얼마야`, `얼마 남았어`, `쿼터`, `한도`, `리셋`, `사용 가능량`, `크레딧`, `예산 남은`.

English: `usage`, `quota`, `remaining`, `how much left`, `rate limit`, `reset`, `budget left`, `tokens left`.

### Proactive auto-trigger

The tool description also instructs the assistant to call this tool BEFORE starting a large multi-step task (extensive refactor, long agentic loop, multi-perspective review) so the user can be warned if `worstAlertLevel` is `critical` or `exhausted` before quota runs out mid-task.

### Required plugin config

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "providerUsageLive": {
          "enabled": true,
          "providers": ["claude", "openai", "gemini"],
          "claudeOAuthUsage": true,
          "codexLiveUsage": true,
          "geminiQuota": true,
          "persistSnapshots": true
        },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ]
}
```

### Required local auth for each provider

| Provider | Auth source | Notes |
|---|---|---|
| `claude` | `~/.claude/.credentials.json` or macOS keychain `Claude Code-credentials` | Same path Claude Code uses; if missing, `alertLevel=unknown`. |
| `openai` | `~/.codex/auth.json` | Same path Codex CLI uses. |
| `gemini` | OpenCode `google` OAuth auth or `~/.gemini/oauth_creds.json` | FlowDesk first reuses the same OpenCode auth written by `opencode-gemini-auth` when the user logs into Gemini/Google in OpenCode, then falls back to Gemini CLI credentials. If an access token is expired, it can refresh with explicitly configured `FLOWDESK_GEMINI_OAUTH_CLIENT_ID`/`SECRET` or by reading the locally cached `opencode-gemini-auth` package OAuth client metadata; no manual FlowDesk config is needed when the user is already logged in and the auth package is cached. |

### Alert levels

| Level | Remaining | Recommendation framing |
|---|---|---|
| `ok` | >30% | safe to proceed |
| `warning` | 10-30% | keep tasks short, watch reset |
| `critical` | 0-10% | avoid large work, consider switching providers |
| `exhausted` | 0 | wait for reset or switch |
| `stale` | data stale | refresh auth |
| `unknown` | data missing | refresh auth |

### Result shape

Per-provider row: `providerFamily`, `remainingPercent`, `resetBucket`, `resetTime`, `alertLevel`, `recommendation`, `dispatchability`, `freshness`, `uncertaintyFlags`.

Top-level: `worstAlertLevel`, `overallRecommendation`, optional `snapshotReuse` (`reusedEvidenceIds`, `skippedReasons`), optional `snapshotPersistence`, and `authority.providerUsageAcquired`.

`persistSnapshots=true` is still opt-in. Snapshot reuse can read existing durable usage snapshots when `durableStateRoot`/`providerUsageLive.durableStateRootDir` is configured, but new provider-native results are only saved when persistence is enabled.

## Tool 3: `flowdesk_status_live`

Live durable evidence summary across persisted FlowDesk workflows (reviewer verdicts, reviewer fan-out plans, runtime lane lifecycle records, fallback regate plans, exact-model availability cache entries, provider acquisition results).

### Trigger phrases

Korean: `상태`, `어디까지`, `진행 상황`, `진행됐`, `오늘 작업`, `오늘 뭐했`, `최근 활동`, `최근 리뷰`, `지금 어디`, `상태 요약`, `워크플로우 상태`.

English: `status`, `what happened`, `recent activity`, `progress`, `where are we`, `how is it going`, `recent reviews`, `recent runs`.

### Required plugin config

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "statusLive": {
          "enabled": true,
          "maxWorkflows": 5,
          "maxRecentEvidencePerClass": 3
        },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ]
}
```

`durableStateRoot` may also be set explicitly as `statusLive.rootDir`. When omitted, the shared `durableStateRoot` plugin option is used.

### Behavior with empty root

The tool returns `status: "blocked_before_status_live"` with a sanitized `redactedBlockReason` when:

- The durable root directory does not exist or is empty.
- The requested `workflowId` has no evidence under the root.

This is fail-closed by design.

### Result shape

Per-workflow row: `workflowId`, `reloadOk`, `blockedCount`, `evidenceCounts` by class, `recentEvidenceRefs` by class (last N), `latestReviewerVerdictLabels`, `latestLaneLifecycleStates`, `latestRegatePlanState`, `latestProviderAcquisitionStatus`.

Top-level: `resolvedWorkflowIds`, `authority.statusEvidenceObserved`.

## Tool 4: `flowdesk_quick_fallback_run`

Plan a FlowDesk fallback regate from one provider to another by auto-building a developer-mode synthetic fallback decision and consumed `fallback_reselection` approval, then running the FlowDesk fallback regate orchestrator to produce a redacted regate plan. Plans only; does not switch providers or dispatch real lanes.

### Trigger phrases

Korean: `막혔어`, `다른 걸로 다시`, `다른 provider 로`, `다른 모델로 재시도`, `재시도 해줘`, `바꿔서 다시`, `fallback 해줘`, `다른 곳으로 돌려`, `OpenAI 로 다시`, `Claude 로 다시`, `Gemini 로 다시`.

English: `fallback to`, `switch to`, `retry with`, `try with another provider`, `use a different provider`, `this provider is blocked`.

### Required plugin config

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "quickFallbackRun": {
          "enabled": true,
          "defaultFromProvider": "claude/sonnet-4",
          "defaultToProvider": "openai/gpt-5.5"
        },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ]
}
```

`defaultFromProvider` and `defaultToProvider` are optional fallbacks when the assistant cannot infer them from the user message. `durableStateRoot` enables optional persistence of the regate plan as `fallback_regate_plan` session evidence (visible from `flowdesk_status_live`).

### Result shape

`status: "quick_fallback_run_completed"` and `regatePlanState: "full_regate_required"` on full success. The result also returns `workflowId`, `parentAttemptId`, `newAttemptId`, `regatePlanRequiredEvidenceCount`, and optional `regatePlanEvidence` block when `persistRegatePlanEvidence=true`.

`status: "blocked_before_quick_fallback_run"` with a sanitized `redactedBlockReason` when:

- `developerModeAcknowledged` is not `true`.
- `fromProvider` / `toProvider` are missing or equal.
- `reason` is not one of `provider_unhealthy`, `quota_exhausted`, `runtime_incompatible`, `policy_ineligible`, `manual_reselection_requested`.

### Authority

`fallbackAuthority`, `automaticFallbackAuthorized`, `providerCall`, `runtimeExecution`, `actualLaneLaunch`, `realOpenCodeDispatch`, `toolAuthority`, and `hardCancelOrNoReplyAuthority` all remain `false`. Only the new diagnostic `regatePlanPrepared` flag turns true. Actual provider switching remains blocked behind managed-dispatch promotion.

## Tool 5: `flowdesk_lane_heartbeat_record`

Record a durable FlowDesk lane heartbeat for a FlowDesk-owned lane (reviewer lane, runtime lane launch, provider acquisition lane, managed-dispatch attempt, fallback regate plan). Each call writes exactly one validated `flowdesk.lane_heartbeat.v1` record with a monotonically increasing `heartbeat_seq` per lane id. Heartbeats are diagnostic evidence only; they never approve dispatch, widen scope, or replace Guard.

### Trigger phrases

Korean: `하트비트 남겨줘`, `하트비트 기록해줘`, `심박 남겨줘`, `심장박동 기록`, `레인 살아 있다고 표시`, `진행 신호 남겨줘`, `진행 표시 해줘`, `아직 살아 있다고 알려줘`.

English: `heartbeat`, `record heartbeat`, `emit heartbeat`, `mark progress`, `I'm still alive`, `lane is still progressing`, `heartbeat for the lane`.

The assistant should also call this tool autonomously, without per-call confirmation, when it is coordinating a FlowDesk-owned lane and the previous heartbeat or lifecycle update is older than about 2 minutes.

### Required plugin config

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "laneHeartbeatWriter": {
          "enabled": true
        },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ]
}
```

`laneHeartbeatWriter.rootDir` overrides the durable state root for heartbeat writes; otherwise the top-level `durableStateRoot` is used. Either form must resolve to a writable directory or the tool will not register.

### Result shape

On success: `status: "lane_heartbeat_recorded"` with `heartbeatId`, `heartbeatSeq`, `observedAt`, and `expectedNextHeartbeatAt` set. The `authority.laneHeartbeatPersisted` diagnostic flag becomes `true`. All other authority flags stay `false`.

On failure: `status: "blocked_before_lane_heartbeat"` with a sanitized `redactedBlockReason` such as `lane heartbeat evidence id already exists; pick a fresh sequence` or `session evidence reload failed before heartbeat write`.

### Stall projection consumption

`flowdesk_status_live` already reads `lane_heartbeat` records as the latest signal per lane id, ahead of any older `lane_lifecycle` record for that lane. The projection classifies each lane as `progressing_normal` (<=2 minutes since last signal), `progressing_late` (2-5 minutes), `stalled` (>5 minutes while still in `created`/`running`/`awaiting_dependency`/`cooldown`), `terminal`, or `unknown`. Stalled lanes get a bounded safe action allowlist limited to `/flowdesk-status`, `/flowdesk-retry`, `/flowdesk-resume`, `/flowdesk-abort`, `/flowdesk-doctor`, `/flowdesk-export-debug`.

Each lane entry also carries an optional `expectedNextHeartbeatOverdue: boolean` and `secondsPastExpectedNextHeartbeat: number` hint. These hints reflect the heartbeat record's own declared `expected_next_heartbeat_at` interval, independent of the configurable stall threshold. They are diagnostic only: the classification still comes from the policy thresholds, so a heartbeat with a 30-second expected interval that is only 90 seconds old still classifies as `progressing_normal` while the hint flags the heartbeat's self-declared cadence as overdue.

## chat.message stall alert card

When `statusLive.enabled=true` and `chatMessageStallAlert.enabled=true` are both set (with a resolvable `durableStateRoot`), FlowDesk also adds a passive `chat.message` card that appears whenever durable evidence shows a stalled FlowDesk-owned lane. The card never auto-retries, auto-aborts, auto-fallbacks, or claims hard chat cancellation; it shows:

1. The total stalled and progressing-late lane counts.
2. Up to three top stalled workflow ids with the last signal age in minutes and a failure hint when available.
3. The explicit line `FlowDesk does not auto-retry, auto-abort, or auto-fallback on stall.`
4. The safe next action allowlist (`/flowdesk-status`, `/flowdesk-retry`, `/flowdesk-resume`, `/flowdesk-abort`, `/flowdesk-doctor`, `/flowdesk-export-debug`).

The same in-memory duplicate suppression that keeps natural-language steering cards from spamming the user also suppresses repeated stall cards with identical per-workflow counts inside a single session. The dedup key includes per-workflow stalled count, per-workflow last-signal age bucketed by minute, and the projection's worst classification, so longer stalls re-alert the user as the age climbs.

Set `chatMessageStallAlert.includeProgressingLate=true` if you also want a softer card titled `Late-progressing lanes detected:` to appear once a FlowDesk-owned lane crosses the 2-minute soft threshold but has not yet reached the 5-minute stall threshold. The default is false, so out of the box only fully stalled lanes trigger a card.

### Required plugin config

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "statusLive": { "enabled": true },
        "chatMessageStallAlert": { "enabled": true },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ]
}
```

## Complete example: full active OpenCode profile

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": [
    [
      "@flowdesk/opencode-plugin",
      {
        "quickReviewerRun": {
          "enabled": true,
          "providerQualifiedModelId": "openai/gpt-5.4-mini-fast",
          "runtimeAgent": "reviewer-gpt-frontier"
        },
        "providerUsageLive": {
          "enabled": true,
          "providers": ["claude", "openai", "gemini"],
          "claudeOAuthUsage": true,
          "codexLiveUsage": true,
          "geminiQuota": true
        },
        "statusLive": {
          "enabled": true,
          "maxWorkflows": 5,
          "maxRecentEvidencePerClass": 3
        },
        "quickFallbackRun": {
          "enabled": true
        },
        "laneHeartbeatWriter": {
          "enabled": true
        },
        "chatMessageStallAlert": {
          "enabled": true,
          "includeProgressingLate": false
        },
        "durableStateRoot": "/Users/<you>/.flowdesk"
      }
    ]
  ],
  "agent": {
    "reviewer-gpt-frontier": {
      "model": "openai/gpt-5.5",
      "variant": "high",
      "mode": "all",
      "description": "Critical review lane pinned to GPT frontier for multi-model review synthesis.",
      "prompt": "You are the GPT reviewer lane. Provide independent critical review only. Do not edit files or claim approval authority."
    }
  }
}
```

## Verifying the active profile

```bash
node --input-type=module -e "
import plugin from '@flowdesk/opencode-plugin';
const hooks = await plugin.server(undefined, {
  quickReviewerRun: { enabled: true, providerQualifiedModelId: 'openai/gpt-5.4-mini-fast', runtimeAgent: 'reviewer-gpt-frontier' },
  providerUsageLive: { enabled: true, providers: ['claude', 'openai', 'gemini'], claudeOAuthUsage: true, codexLiveUsage: true, geminiQuota: true },
  statusLive: { enabled: true },
  quickFallbackRun: { enabled: true },
  laneHeartbeatWriter: { enabled: true },
  chatMessageStallAlert: { enabled: true },
  durableStateRoot: process.env.HOME + '/.flowdesk',
  localNonDispatchAdapter: false,
  naturalLanguageRouting: true
});
const names = Object.keys(hooks.tool ?? {});
console.log({ names, hasChatMessage: typeof hooks['chat.message'] === 'function' });
"
```

Expected tools:

- `flowdesk_pre_spike_doctor`
- `flowdesk_quick_reviewer_run`
- `flowdesk_provider_usage_live`
- `flowdesk_status_live`
- `flowdesk_quick_fallback_run`
- `flowdesk_lane_heartbeat_record`
- `flowdesk_workflow_synthesis_preview` when status/durable-root support is enabled
- `flowdesk_auto_continue_preview` when status/durable-root support is enabled

`hasChatMessage` must be `true` once `naturalLanguageRouting` is enabled. The `chat.message` hook is also the surface that emits the passive stall alert card when `chatMessageStallAlert.enabled=true` and stalled lanes are present.

## Chat-routing fallback (when LLM tool discovery is unavailable)

If `localNonDispatchAdapter` and `naturalLanguageRouting` are enabled, FlowDesk also runs a regex-based chat-routing layer that suggests portable commands (`/flowdesk-usage`, `/flowdesk-status`, `/flowdesk-doctor`, ...) when the natural-language pattern matches Korean or English usage/status/recovery cues. This complements LLM tool discovery: the assistant may pick the live tool directly from the description, or the user may explicitly trigger the suggested portable command.

## Privacy and safety

- No raw OAuth tokens are echoed in tool responses; only redacted refs and bucket-level data.
- No default managed dispatch, automatic fallback, or hard-chat authority is enabled by these tools.
- `flowdesk_quick_reviewer_run` and `flowdesk_agent_task_run` may set provider/runtime/lane-launch diagnostic authority fields true only for explicit developer-mode provider-calling helper calls. Local preview tools such as synthesis preview and auto-continue preview keep those flags false.
- Only diagnostic flags (`providerUsageAcquired`, `statusEvidenceObserved`, `exactModelProviderAcquisitionRecorded`, `regatePlanPrepared`, `laneHeartbeatPersisted`) become `true` to indicate that real data was read or written; they do not authorize dispatch.
- The stall alert card and the lane heartbeat writer never contain raw prompts, transcripts, provider payloads, runtime echoes, tool args/results, stack traces, file contents, or absolute filesystem paths; only redacted opaque refs and bounded labels are stored.
