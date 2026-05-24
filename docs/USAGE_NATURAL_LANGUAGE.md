# FlowDesk Natural-Language Usage

FlowDesk exposes three description-driven LLM tools that fire automatically when the assistant detects matching natural-language patterns in the OpenCode chat. No portable command typing required.

This document covers:

1. What each natural-language tool does.
2. Which natural-language phrases trigger each tool.
3. The minimum plugin config + environment variables required for live data.
4. How to verify the active OpenCode profile.

All three tools keep `realOpenCodeDispatch`, `providerCall`, `runtimeExecution`, `actualLaneLaunch`, `fallbackAuthority`, and `hardCancelOrNoReplyAuthority` flags `false`. They are read-only/observation-only data tools; they do not promote default dispatch authority.

## Tool 1: `flowdesk_quick_reviewer_run`

3-perspective FlowDesk reviewer fan-out (`policy_security`, `architecture`, `verification_implementation`) against an injected OpenCode SDK reviewer agent/model.

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

`providerQualifiedModelId` must be the concrete provider/model id for the reviewer agent; `runtimeAgent` must be a configured OpenCode `agent` entry.

### Result shape

`status: "quick_reviewer_run_completed"` and `acceptanceStatus: "verdicts_accepted"` and `durableLinkageStatus: "durable_verdicts_accepted"` on full success. Per-lane diagnostic detail with `redactedBlockReason` is returned for partial failures.

## Tool 2: `flowdesk_provider_usage_live`

Live per-provider remaining quota for Claude OAuth, OpenAI/Codex, and Gemini Code Assist. Reads OAuth credentials and provider rate-limit/quota APIs directly.

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
          "geminiQuota": true
        }
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
| `gemini` | `~/.gemini/oauth_creds.json` + Gemini OAuth client id/secret | OAuth client id/secret come from the env vars `FLOWDESK_GEMINI_OAUTH_CLIENT_ID` and `FLOWDESK_GEMINI_OAUTH_CLIENT_SECRET`, or from inline `providerUsageLive.geminiOAuthClientId/Secret` config. |

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

Top-level: `worstAlertLevel`, `overallRecommendation`, `authority.providerUsageAcquired`.

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
import plugin from '@flowdesk/opencode-plugin/server';
const hooks = await plugin.server(undefined, {
  quickReviewerRun: { enabled: true, providerQualifiedModelId: 'openai/gpt-5.4-mini-fast', runtimeAgent: 'reviewer-gpt-frontier' },
  providerUsageLive: { enabled: true, providers: ['claude', 'openai', 'gemini'], claudeOAuthUsage: true, codexLiveUsage: true, geminiQuota: true },
  statusLive: { enabled: true },
  durableStateRoot: process.env.HOME + '/.flowdesk',
  localNonDispatchAdapter: false,
  naturalLanguageRouting: false
});
const names = Object.keys(hooks.tool ?? {});
console.log(names);
"
```

Expected tools:

- `flowdesk_pre_spike_doctor`
- `flowdesk_quick_reviewer_run`
- `flowdesk_provider_usage_live`
- `flowdesk_status_live`

## Chat-routing fallback (when LLM tool discovery is unavailable)

If `localNonDispatchAdapter` and `naturalLanguageRouting` are enabled, FlowDesk also runs a regex-based chat-routing layer that suggests portable commands (`/flowdesk-usage`, `/flowdesk-status`, `/flowdesk-doctor`, ...) when the natural-language pattern matches Korean or English usage/status/recovery cues. This complements LLM tool discovery: the assistant may pick the live tool directly from the description, or the user may explicitly trigger the suggested portable command.

## Privacy and safety

- No raw OAuth tokens are echoed in tool responses; only redacted refs and bucket-level data.
- No managed dispatch or model lane launch authority is enabled by these tools.
- All authority flags (`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`, `actualLaneLaunch`, `fallbackAuthority`, `hardCancelOrNoReplyAuthority`) remain `false`.
- Only diagnostic flags (`providerUsageAcquired`, `statusEvidenceObserved`, `exactModelProviderAcquisitionRecorded`) become `true` to indicate that real data was read; they do not authorize dispatch.
