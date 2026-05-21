# Release 3 Live Runtime Conformance Batch

Date: 2026-05-21

## Scope

This note records bounded live OpenCode 1.15.5 runtime evidence for the Release 3 blocker contracts. The batch used the active OpenCode profile at `~/.config/opencode` and the FlowDesk workspace at `/Users/bagel_macpro_055/Documents/work/projects/flowdesk`.

No `opencode run` production orchestration was used. No token material, provider payloads, active-profile mutation, GitHub write, or external storage write was performed.

## Runtime Surface

- OpenCode CLI: `1.15.5`.
- Active profile package: `@flowdesk/opencode-plugin@0.1.1` with nested `@opencode-ai/plugin@1.15.6` and `@opencode-ai/sdk@1.15.6`.
- SDK call shape: the default SDK requires `{ path, query, body }` options. Earlier direct v2-style calls produced `UnknownError`; corrected calls succeeded.
- Exact model discovery succeeded for provider families `openai`, `anthropic`, and `google`; `gemini` is not a provider id in this profile.

## Provider And Dispatch Evidence

### OpenAI Provider Smoke

- Model: `openai/gpt-5.4-mini-fast`.
- Session: `ses_1b58382eeffek6FDOGCs3ta3MD`.
- Assistant message: `msg_e4a7c7e4a001V4r49pJEitF84z`.
- Sentinel: `FLOWDESK_LIVE_PROVIDER_OK_20260521_C`.
- Result: provider call completed and the sentinel was present in the session messages.

### Managed Dispatch Adapter

- Initial blocked session: `ses_1b5825fbbffeKmNfPHrow3FEbO`.
- Block reason: Guard model-family mismatch for `openai/gpt-5.4-mini-fast` when `model_family` was incorrectly set to `gpt-5`.
- Corrected success session: `ses_1b580892bffewOBnevRtMNB3bj`.
- Corrected assistant message: `msg_e4a7f782c0012PBXALcuBSh3Fb`.
- Status: `dispatch_completed`.
- Authority summary: `realOpenCodeDispatch=true`, `providerCall=true`, `runtimeExecution=true`, `actualLaneLaunch=false`, `fallbackAuthority=false`, `toolAuthority=false`, `hardCancelOrNoReplyAuthority=false`.

This proves the opt-in adapter can call the injected OpenCode SDK client after the local manifest, approval, and Guard evidence are correctly bound. It does not promote the default Release 1 server to real dispatch.

## Lane And Reviewer Evidence

### Single Child Lane Smoke

- Parent session: `ses_1b57fd199ffeAuD9l6tzilVx02`.
- Child session: `ses_1b57fceb2ffefJ6KOT7tutdKCN`.
- Parent assistant message: `msg_e4a8042e5001KYb7aG3cpUMNKC`.
- Child echo: `agent=build`, `providerID=openai`, `model.id=gpt-5.4-mini-fast`, `variant=default`.
- Sentinels: `FLOWDESK_PARENT_DONE_20260521` and `FLOWDESK_CHILD_LANE_OK_20260521`.

### Parent-Prompted Reviewer Fan-Out Caveat

- Parent session: `ses_1b57ec91effeGgTApVEg7T3hNb`.
- Observed children: 4.
- Issue: the parent model created duplicate GPT children and the Claude child did not echo the expected sentinel even though the Claude child session and model binding existed.

This is recorded as evidence that FlowDesk must not rely on parent-model freeform instructions to decide reviewer fan-out topology.

### Coordinator-Controlled Reviewer Fan-Out

- Parent session: `ses_1b57da6d4ffe3ZNOaZS5jaiFmy`.
- Claude child: `ses_1b57da6c5ffeEocM9tnb8ZTW6N`, agent `reviewer-claude-opus`, model `anthropic/claude-opus-4-5`, assistant message `msg_e4a825a72001EDWzYoMWMX0JDm`, sentinel matched.
- Gemini child: `ses_1b57da6c1ffeBKMvqjLhpGKRF0`, agent `reviewer-gemini-pro`, model `google/gemini-2.5-pro`, assistant message `msg_e4a825a6f001tRounQVE2gh781`, sentinel matched.
- GPT child: `ses_1b57da6bfffeMMDTj4GReZeTRG`, agent `reviewer-gpt-frontier`, model `openai/gpt-5.5`, assistant message `msg_e4a825a6c001c9nXFxanaCrHH9`, sentinel matched.
- Observed children: exactly 3.

This proves coordinator-issued `session.create(parentID, agent, model)` plus direct child prompting can launch one child per reviewer lane with exact agent/model binding. It does not prove typed review verdict quality by itself.

## Blocker #3: FDS-1 Runtime Tool Surface

- SDK tool-list query against the active profile and `openai/gpt-5.4-mini-fast` returned 57 tools including 11 FlowDesk tools.
- FlowDesk tool schemas exposed non-empty parameter sets for the command tools.
- Direct `flowdesk_doctor` FDS-1 fixture execution with a valid minimal request returned `requestSchemaValid=true` and `responseSchemaValid=true` while remaining non-dispatch.
- Direct `flowdesk_doctor` execution with an unknown-property fixture returned `requestSchemaValid=false` and `blockedReason=request_schema_invalid` with `providerCall=false` and `runtimeExecution=false`.
- Contract artifact: `flowdesk.fds1_schema_probe_result.v1`, `probe_id=probe-release3-live-fds1-20260521-corrected`, `outcome=probe_pass`.

The active OpenCode provider-facing tool conversion was checked, and FlowDesk's runtime validator preserved fail-closed unknown-property rejection. The provider-facing schema still should not be treated as the only rejection boundary.

## Blocker #4: Chat Hook Authority

- Direct active plugin `chat.message` invocation appended a visible FlowDesk steering part.
- The serialized hook output did not emit `noReply`, `cancel`, or `stop`.
- Contract artifact: `flowdesk.chat_hook_authority_probe.v1`, `probe_id=probe-release3-live-chat-hook-20260521`, `outcome=steering_only`.
- Remaining failure labels: `throw_blocking_unproven`, `no_reply_unproven`, `cancel_or_stop_unproven`, `timeout_or_null_not_fail_closed`, `malformed_return_not_fail_closed`.

Hard chat cancellation/no-reply authority remains unproven and disabled. Follow-up local hardening on 2026-05-22 classifies timeout/null and malformed-return fail-closed gaps as blocked hard-chat authority, not as sufficient steering-only proof.

## Blocker #10: Fallback/Reselection

- Contract artifact: `flowdesk.fallback_decision.v1`, `decision_id=fallback-release3-live-20260521`.
- State: `blocked_terminal` at `depth=2`, `max_depth=2`.
- Authority flags: `automatic_fallback_authorized=false`, `dispatch_authority_enabled=false`, `providerCall=false`, `actualLaneLaunch=false`, `runtimeExecution=false`.

No automatic fallback or provider/model switching was executed. The gate remains fail-closed unless a later coordinator-issued fallback attempt receives fresh evidence, Guard decision, approval, policy eligibility, runtime compatibility, and pre-dispatch audit.

## Blocker #11: Operational Intelligence

- Contract artifact: `flowdesk.operational_intelligence_score.v1`, `score_id=score-release3-live-20260521`.
- Hard filters blocked the candidate, forcing `advisory_score=0`.
- Contract artifact: `flowdesk.reference_pack.v1`, `pack_id=pack-release3-live-20260521`.
- Authority flags: `advisory_only=true`, `dispatch_authority_enabled=false`, `approval_authority_enabled=false`, `external_write_authority_enabled=false`.
- External write attempted: `false`.

Operational intelligence remains advisory-only and cannot act as approval, dispatch authority, professional signoff, or external-write authority.

## Result

The live batch upgrades Release 3 evidence from local-only contracts to bounded OpenCode runtime proof for provider smoke, managed dispatch, child lane launch, exact reviewer fan-out, active-profile tool discovery, FDS-1 runtime validation, and non-authorizing fallback/operational-intelligence contract behavior.

The following remain blocked or intentionally unclaimed:

1. Default Release 1 real dispatch authority.
2. Hard chat `noReply`/cancel/stop authority.
3. Automatic fallback/reselection execution.
4. External ledger/GitHub/connector writes.
5. Typed reviewer verdict approval from live reviewer content.
