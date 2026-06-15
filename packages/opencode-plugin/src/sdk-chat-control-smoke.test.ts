import assert from "node:assert/strict";
import test from "node:test";
import type {
	FlowDeskPermissionAskDecisionV1,
	FlowDeskPromptNoReplyDecisionV1,
	FlowDeskSessionAbortDecisionV1,
} from "@flowdesk/core";
import {
	abortFlowDeskSessionWithDecisionV1,
	applyFlowDeskPermissionAskControlV1,
	dispatchFlowDeskPromptNoReplyWithDecisionV1,
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	type FlowDeskPermissionAskControlAdapterResultV1,
	type FlowDeskPromptNoReplyControlAdapterResultV1,
	type FlowDeskSessionAbortControlAdapterResultV1,
} from "./managed-dispatch-adapter.js";

const now = "2026-05-17T00:00:00.000Z";

type ChatControlOutcome =
	| FlowDeskPermissionAskControlAdapterResultV1
	| FlowDeskSessionAbortControlAdapterResultV1
	| FlowDeskPromptNoReplyControlAdapterResultV1;

function permissionAskDecision(
	overrides: Partial<FlowDeskPermissionAskDecisionV1> = {},
): FlowDeskPermissionAskDecisionV1 {
	return {
		schema_version: "flowdesk.permission_ask_decision.v1",
		decision_id: "permission-decision-smoke-1",
		workflow_id: "workflow-sdk-chat-control-smoke",
		attempt_id: "attempt-sdk-chat-control-smoke",
		session_ref: "ses-sdk-chat-control-smoke",
		requested_permission_kind_ref: "permission-tool-write-smoke",
		policy_pack_ref: "policy-pack-smoke",
		status: "ask",
		observed_at: now,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		hardCancelOrNoReplyAuthority: false,
		...overrides,
	};
}

function sessionAbortDecision(
	overrides: Partial<FlowDeskSessionAbortDecisionV1> = {},
): FlowDeskSessionAbortDecisionV1 {
	return {
		schema_version: "flowdesk.session_abort_decision.v1",
		decision_id: "session-abort-decision-smoke-1",
		workflow_id: "workflow-sdk-chat-control-smoke",
		attempt_id: "attempt-sdk-chat-control-smoke",
		session_ref: "ses-sdk-chat-control-smoke",
		abort_reason: "user_requested_abort",
		policy_pack_ref: "policy-pack-smoke",
		guard_decision_ref: "guard-decision-smoke",
		pre_abort_audit_ref: "pre-abort-audit-smoke",
		created_at: now,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		hardCancelOrNoReplyAuthority: false,
		session_abort_authorized: true,
		...overrides,
	};
}

function promptNoReplyDecision(
	overrides: Partial<FlowDeskPromptNoReplyDecisionV1> = {},
): FlowDeskPromptNoReplyDecisionV1 {
	return {
		schema_version: "flowdesk.prompt_no_reply_decision.v1",
		decision_id: "prompt-no-reply-decision-smoke-1",
		workflow_id: "workflow-sdk-chat-control-smoke",
		attempt_id: "attempt-sdk-chat-control-smoke",
		session_ref: "ses-sdk-chat-control-smoke",
		agent_ref: "agent-build",
		provider_qualified_model_id: "claude/sonnet-4",
		no_reply_reason: "context_commit_only",
		policy_pack_ref: "policy-pack-smoke",
		guard_decision_ref: "guard-decision-smoke",
		pre_call_audit_ref: "pre-call-audit-smoke",
		created_at: now,
		dispatch_authority_enabled: false,
		providerCall: true,
		actualLaneLaunch: false,
		runtimeExecution: true,
		hardCancelOrNoReplyAuthority: false,
		prompt_no_reply_authorized: true,
		...overrides,
	};
}

function assertNoOutcomeAuthorityEscalation(outcomes: ChatControlOutcome[]): void {
	for (const outcome of outcomes) {
		const record = outcome as unknown as Record<string, unknown>;
		assert.notEqual(record.hard_chat_authority_enabled, true, `${outcome.status} hard_chat_authority_enabled`);
		assert.notEqual(record.dispatch_authority_enabled, true, `${outcome.status} dispatch_authority_enabled`);
		assert.notEqual(record.providerCall, true, `${outcome.status} providerCall`);
		assert.equal(outcome.authority.realOpenCodeDispatch, false, `${outcome.status} realOpenCodeDispatch`);
		assert.equal(outcome.authority.hardCancelOrNoReplyAuthority, false, `${outcome.status} hardCancelOrNoReplyAuthority`);
		assert.equal(outcome.authority.fallbackAuthority, false, `${outcome.status} fallbackAuthority`);
		assert.equal(outcome.authority.toolAuthority, false, `${outcome.status} toolAuthority`);
	}
}

test("sdk chat control smoke: permission ask valid decision mutates output and invalid decision blocks", () => {
	const output = { status: "deny" as const };
	const applied = applyFlowDeskPermissionAskControlV1({
		decision: permissionAskDecision({ status: "allow" }),
		output,
	});
	assert.equal(applied.status, "permission_status_applied");
	assert.equal(applied.permissionStatusApplied, true);
	assert.equal(output.status, "allow");

	const blocked = applyFlowDeskPermissionAskControlV1({
		decision: permissionAskDecision({
			status: "deny",
			deny_reason: undefined,
		}),
		output,
	});
	assert.equal(blocked.status, "blocked_before_permission_status");
	assert.equal(blocked.permissionStatusApplied, false);
	assertNoOutcomeAuthorityEscalation([applied, blocked]);
});

test("sdk chat control smoke: session abort valid decision calls injected SDK and invalid decision blocks", async () => {
	const abortCalls: unknown[] = [];
	const client = {
		session: {
			abort(options: unknown) {
				abortCalls.push(options);
				return Promise.resolve({ ok: true });
			},
		},
	} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;

	const sent = await abortFlowDeskSessionWithDecisionV1({
		client,
		decision: sessionAbortDecision(),
		directory: "/tmp/flowdesk-sdk-chat-smoke",
	});
	assert.equal(sent.status, "session_abort_sent");
	assert.equal(sent.abortAttempted, true);
	assert.equal(abortCalls.length, 1);

	const blocked = await abortFlowDeskSessionWithDecisionV1({
		client,
		decision: sessionAbortDecision({ session_abort_authorized: false as true }),
	});
	assert.equal(blocked.status, "blocked_before_session_abort");
	assert.equal(blocked.abortAttempted, false);
	assert.equal(abortCalls.length, 1);
	assertNoOutcomeAuthorityEscalation([sent, blocked]);
});

test("sdk chat control smoke: no-reply prompt valid request dispatches and missing binding blocks", async () => {
	const promptCalls: unknown[] = [];
	const client = {
		session: {
			prompt(options: unknown) {
				promptCalls.push(options);
				return Promise.resolve({ ok: true });
			},
		},
	} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;
	const request = {
		sessionId: "ses-sdk-chat-control-smoke",
		agent: "build",
		provider_qualified_model_id: "claude/sonnet-4",
		promptText: "Record a redacted smoke-test breadcrumb.",
	};

	const dispatched = await dispatchFlowDeskPromptNoReplyWithDecisionV1({
		client,
		decision: promptNoReplyDecision(),
		request,
	});
	assert.equal(dispatched.status, "no_reply_prompt_sent");
	assert.equal(dispatched.promptAttempted, true);
	assert.equal(promptCalls.length, 1);
	assert.deepEqual((promptCalls[0] as { body?: { noReply?: boolean } }).body?.noReply, true);

	const missingBindingClient = { session: {} } as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;
	const blocked = await dispatchFlowDeskPromptNoReplyWithDecisionV1({
		client: missingBindingClient,
		decision: promptNoReplyDecision(),
		request,
	});
	assert.equal(blocked.status, "blocked_before_no_reply_prompt");
	assert.equal(blocked.promptAttempted, false);
	assert.equal(promptCalls.length, 1);
	assertNoOutcomeAuthorityEscalation([dispatched, blocked]);
});

test("sdk chat control smoke: blocked no-reply prompt keeps provider authority disabled", async () => {
	const client = {
		session: {
			prompt() {
				throw new Error("prompt should not be called for mismatched binding");
			},
		},
	} as unknown as FlowDeskManagedDispatchBetaOpenCodeClientV1;
	const blocked = await dispatchFlowDeskPromptNoReplyWithDecisionV1({
		client,
		decision: promptNoReplyDecision(),
		request: {
			sessionId: "ses-sdk-chat-control-smoke",
			agent: "other-agent",
			provider_qualified_model_id: "claude/sonnet-4",
			promptText: "Record a redacted smoke-test breadcrumb.",
		},
	});
	assert.equal(blocked.status, "blocked_before_no_reply_prompt");
	assert.equal(blocked.authority.providerCall, false);
	assertNoOutcomeAuthorityEscalation([blocked]);
});
