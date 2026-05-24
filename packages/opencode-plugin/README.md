# @flowdesk/opencode-plugin

FlowDesk for opencode plugin with Release 1 non-dispatch command-backed
registration plus opt-in description-driven natural-language tools.

## Install

```bash
npm install @flowdesk/opencode-plugin@^0.1.2
```

## Configure

The OpenCode plugin entry must point at the `/server` subpath. The package
root only exports helper types and an id; the actual default plugin object
is exposed under `/server`:

```json
{
  "plugin": ["@flowdesk/opencode-plugin/server"]
}
```

The minimum opt-in set for the natural-language tools is:

```json
{
  "plugin": [
    [
      "@flowdesk/opencode-plugin/server",
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

`realOpenCodeDispatch`, `providerCall`, `runtimeExecution`,
`actualLaneLaunch`, `fallbackAuthority`,
`hardCancelOrNoReplyAuthority`, and `toolAuthority` always remain `false`.
Only diagnostic flags (`providerUsageAcquired`, `statusEvidenceObserved`,
`exactModelProviderAcquisitionRecorded`, `regatePlanPrepared`,
`laneHeartbeatPersisted`, `expectedNextHeartbeatOverdue`) can become
`true` to indicate that real diagnostic data was read or written.

## License

MIT. See the workspace-level [LICENSE](https://github.com/astasdf1/flowdesk/blob/main/LICENSE).
