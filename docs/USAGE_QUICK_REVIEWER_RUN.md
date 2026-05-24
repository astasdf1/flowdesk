# Quick Reviewer Run — Prompt-Driven Usage

This document shows how to use FlowDesk's 3-perspective reviewer fan-out through normal chat instead of constructing tool calls by hand.

## Prerequisites

1. FlowDesk plugin installed in the active OpenCode profile.
2. Plugin configured with `quickReviewerRun.enabled=true` and at least a default provider-qualified model id and a reviewer agent.

Example `~/.config/opencode/opencode.json` snippet:

```json
{
  "plugins": {
    "@flowdesk/opencode-plugin": {
      "quickReviewerRun": {
        "enabled": true,
        "providerQualifiedModelId": "openai/gpt-5.4-mini-fast",
        "runtimeAgent": "reviewer-gpt-frontier"
      }
    }
  }
}
```

The opt-in is at config time so a user who does not want FlowDesk to make paid provider calls simply omits the `quickReviewerRun` block.

## Prompt-Driven Flow

The `flowdesk_quick_reviewer_run` tool description tells the assistant LLM exactly when to use it, what to disclose, and what user confirmation to require.

Typical interaction:

1. User asks for a review in natural language.

   - English: `Please review this snippet for security and architecture: [snippet]`
   - Korean: `이 코드를 보안과 아키텍처 관점에서 검토해줘: [snippet]`
   - Korean multi-perspective trigger: `다관점 리뷰 해줘`
   - Korean critical multi-perspective trigger: `다관점 비판적리뷰 해줘`

2. The assistant recognizes the review intent and calls `flowdesk_quick_reviewer_run` directly with the user's review target as `prompt` and both `developerModeAcknowledged: true` and `allowProviderCall: true`. The target does not have to be pasted code. If the user only says a trigger phrase such as `다관점 리뷰`, the assistant should use the current request plus the relevant conversation context as the review target. The plugin user already opted in by enabling `quickReviewerRun` in the plugin config, so the assistant does not ask for per-call confirmation.

3. FlowDesk returns a redacted summary including:
   - `status: "quick_reviewer_run_completed"` when all three lanes returned matching typed verdicts and durable linkage was accepted.
   - `lanes` array with per-perspective status (`launch_status`, `running_lifecycle`, `observation_status`, `complete_lifecycle`, `verdict_id`).
   - `acceptanceStatus: "verdicts_accepted"` and `durableLinkageStatus: "durable_verdicts_accepted"` on full success.
   - When any lane fails verdict observation, that lane appears with a `redactedBlockReason` and the overall status is `quick_reviewer_run_incomplete`.

4. The assistant summarizes the verdicts back to the user.

## Trigger Phrases

The quick reviewer run is intended to fire for explicit review, critique, audit, assessment, or evaluation requests. Representative Korean trigger phrases include:

- `다관점 리뷰`, `다관점리뷰`
- `다관점 비판적리뷰`, `다관점 비판적 리뷰`
- `다각도 리뷰`, `다각도 검토`
- `여러 관점 리뷰`, `여러 관점에서 검토`
- `복수 관점 리뷰`
- `비판적 리뷰`, `비판적 검토`
- `심층 리뷰`, `아키텍처 리뷰`, `보안 리뷰`, `품질 리뷰`

English equivalents include `multi-perspective review`, `multi-angle review`, `critical review`, `review from multiple perspectives`, `audit`, `critique`, `assess`, and `evaluate`.

## What The Two Flags Mean

`developerModeAcknowledged`
- Acknowledges that the helper auto-creates a synthetic developer-mode reviewer-fanout approval.
- It is not a production-grade approval and does not satisfy release-policy gates.
- Production reviewer fan-out continues to require the explicit nested-pipeline tool plus an externally issued approval.

`allowProviderCall`
- Acknowledges that the helper makes real paid provider API calls.
- Without this flag, the helper blocks before any provider/model is contacted.
- Decoupled from `developerModeAcknowledged` because policy and cost are different boundaries.

## What "Durable Linkage" Means

After each lane returns a typed verdict, FlowDesk writes two durable records under the temporary `.flowdesk` evidence root:

1. A `reviewer_verdict` record containing the validated `flowdesk.top_tier_review_verdict.v1` evidence.
2. A `lane_lifecycle` record with `state="complete"` and a `verdict_ref` pointing at the matching reviewer-verdict evidence id, plus child session ref, output ref, runtime echo ref, and telemetry ref.

The `prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1` adapter then reloads the evidence from disk and checks that every accepted verdict has both records persisted with consistent refs and workflow/attempt ids. If any verdict is missing from durable storage or any lane lifecycle is missing or non-complete, the linkage step returns `blocked_before_durable_acceptance` and the quick reviewer run reports `quick_reviewer_run_incomplete`.

Durable linkage proves three things:

1. The verdicts came from real reviewer lane executions, not in-memory ephemera.
2. Each verdict can be traced back to the specific child session, output ref, and telemetry ref that produced it.
3. The acceptance gate cannot be passed by claiming verdicts without persisting matching lifecycle evidence.

The `durableLinkageStatus: "durable_verdicts_accepted"` field in the tool result signals that all three checks passed.

## Lane Heartbeat Integration

Whenever a reviewer lane reaches `lane_launch_started` inside the runtime reviewer execution bridge, FlowDesk also writes one `lane_heartbeat` evidence record for that lane before observing the typed reviewer verdict. The heartbeat records:

1. `workflow_id`, `attempt_id`, `lane_id`, monotonically increasing `heartbeat_seq` per lane.
2. `state: "running"`, `observed_at`, and `expected_next_heartbeat_at` (default 2-minute soft interval).
3. `parent_session_ref`, `agent_ref`, `provider_qualified_model_id`, plus a bounded `progress_summary_label` such as `reviewer lane policy_security launch heartbeat`.

Heartbeat write failures stay diagnostic: they do not block lane execution or verdict acceptance. The `flowdesk_status_live` stall projection then consumes the heartbeat as the freshest signal for the lane id, ahead of any older `lane_lifecycle` record, so a busy reviewer lane shows up as `progressing_normal` instead of looking stalled while the model is still working. Long reviewer lanes can also be refreshed at any time by calling `flowdesk_lane_heartbeat_record` with the same workflow/attempt/lane ids.

## Privacy and Safety

The tool never echoes raw token material, raw provider payloads, or raw prompts beyond the redacted summary fields the result schema documents. The user's prompt is forwarded once to each reviewer lane as instructed evidence; FlowDesk does not store the raw prompt outside the per-call OpenCode child session, which the user can clean up by removing the temp `.flowdesk` evidence root recorded in the tool result.
