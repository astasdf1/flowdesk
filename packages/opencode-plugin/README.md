# @flowdesk/opencode-plugin

FlowDesk for opencode plugin with Release 1 non-dispatch command-backed
registration plus opt-in description-driven natural-language tools.

## Install

```bash
npm install @flowdesk/opencode-plugin@^0.1.16
```

## Configure

Use the package root as the OpenCode plugin entry. OpenCode resolves npm
plugin packages at the package root, and the package root exports the default
FlowDesk plugin object plus helper APIs:

```json
{
  "plugin": ["@flowdesk/opencode-plugin"]
}
```

The minimum opt-in set for the natural-language tools is:

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

## Natural-Language Tools

Once loaded, the assistant LLM picks up five description-driven FlowDesk
tools without you typing portable commands:

1. `flowdesk_quick_reviewer_run` for explicit multi-perspective code review
   (Korean `다관점 리뷰 해줘`, English `multi-perspective review`).
2. `flowdesk_provider_usage_live` for usage, quota, remaining, reset, or
   rate-limit questions (Korean `사용량 보여줘`, English `how much usage
   do I have left`).
3. `flowdesk_status_live` for workflow status, lane heartbeat, or "is it
   stuck" questions (Korean `상태`, `어디까지`, `멈췄어`, `하트비트 알려줘`;
   English `status`, `where are we`, `is it stuck`,
   `lane heartbeat status`).
4. `flowdesk_quick_fallback_run` for explicit provider fallback intent
   (Korean `Claude 막혔어 OpenAI 로 다시`, English `fallback to`,
   `switch to`, `retry with`). Plans only; actual provider switching stays
   behind managed-dispatch promotion.
5. `flowdesk_lane_heartbeat_record` for explicit heartbeat requests
   (Korean `하트비트 남겨줘`, English `record heartbeat`, `mark progress`).

See the workspace
[QUICKSTART](https://github.com/astasdf1/flowdesk/blob/main/docs/QUICKSTART.md),
[USAGE_NATURAL_LANGUAGE](https://github.com/astasdf1/flowdesk/blob/main/docs/USAGE_NATURAL_LANGUAGE.md),
and [USER_MANUAL](https://github.com/astasdf1/flowdesk/blob/main/docs/USER_MANUAL.md)
for the full Korean and English trigger lists, opt-in config, and safety
boundaries.

## Authority Boundary

Default command-backed tools keep `realOpenCodeDispatch`, `providerCall`,
`runtimeExecution`, `actualLaneLaunch`, `fallbackAuthority`,
`hardCancelOrNoReplyAuthority`, and `toolAuthority` false. The explicit
`flowdesk_quick_reviewer_run` helper can make real provider calls only when
`quickReviewerRun.enabled=true` and the tool call includes both opt-in flags;
it still cannot approve dispatch, switch providers, or bypass Guard. Diagnostic
flags such as `providerUsageAcquired`, `statusEvidenceObserved`,
`exactModelProviderAcquisitionRecorded`, `regatePlanPrepared`,
`laneHeartbeatPersisted`, and `expectedNextHeartbeatOverdue` do not authorize
dispatch.

## License

MIT. See the workspace-level [LICENSE](https://github.com/astasdf1/flowdesk/blob/main/LICENSE).
