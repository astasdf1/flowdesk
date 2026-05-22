import assert from "node:assert/strict";
import test from "node:test";
import {
	evaluateFlowDeskPermissionAskDecisionV1,
	validateFlowDeskPermissionAskDecisionV1,
	validateFlowDeskPromptNoReplyDecisionV1,
	validateFlowDeskSessionAbortDecisionV1,
} from "./index.js";

const basePermissionInput = {
	decisionId: "permission-decision-123",
	workflowId: "workflow-123",
	attemptId: "attempt-123",
	sessionRef: "session-ref-123",
	requestedPermissionKindRef: "tool-write-ref-123",
	policyPackRef: "policy-pack-ref-123",
	observedAt: "2026-05-22T00:00:00.000Z",
};

test("permission ask decision denies hard-chat authority escalation", () => {
	const decision = evaluateFlowDeskPermissionAskDecisionV1({
		...basePermissionInput,
		requiresHardChatAuthority: true,
	});

	assert.equal(decision.status, "deny");
	assert.equal(decision.deny_reason, "hard_chat_authority_required");
	assert.equal(decision.providerCall, false);
	assert.equal(decision.runtimeExecution, false);
	assert.equal(decision.hardCancelOrNoReplyAuthority, false);
	assert.equal(validateFlowDeskPermissionAskDecisionV1(decision).ok, true);
});

test("permission ask decision allows only when guard and policy both allow", () => {
	const decision = evaluateFlowDeskPermissionAskDecisionV1({
		...basePermissionInput,
		guardApproved: true,
		policyAllows: true,
	});

	assert.equal(decision.status, "allow");
	assert.equal(decision.deny_reason, undefined);
	assert.equal(validateFlowDeskPermissionAskDecisionV1(decision).ok, true);
});

test("permission ask decision validator rejects forged deny metadata", () => {
	const decision = evaluateFlowDeskPermissionAskDecisionV1({
		...basePermissionInput,
		guardApproved: true,
		policyAllows: true,
	});
	const forged = { ...decision, deny_reason: "guard_unapproved" };

	const result = validateFlowDeskPermissionAskDecisionV1(forged);
	assert.equal(result.ok, false);
	assert.match(result.errors.join("|"), /deny_reason is only valid/);
});

test("session abort decision validator accepts SDK abort authority without dispatch", () => {
	const decision = {
		schema_version: "flowdesk.session_abort_decision.v1",
		decision_id: "session-abort-decision-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		session_ref: "session-ref-123",
		abort_reason: "guard_revoked",
		policy_pack_ref: "policy-pack-ref-123",
		guard_decision_ref: "guard-decision-ref-123",
		pre_abort_audit_ref: "pre-abort-audit-ref-123",
		created_at: "2026-05-22T00:00:00.000Z",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		hardCancelOrNoReplyAuthority: false,
		session_abort_authorized: true,
	};

	assert.equal(validateFlowDeskSessionAbortDecisionV1(decision).ok, true);
});

test("prompt no-reply decision validator scopes SDK noReply to prompt calls", () => {
	const decision = {
		schema_version: "flowdesk.prompt_no_reply_decision.v1",
		decision_id: "noreply-decision-123",
		workflow_id: "workflow-123",
		attempt_id: "attempt-123",
		session_ref: "session-ref-123",
		agent_ref: "agent-build",
		provider_qualified_model_id: "claude/sonnet-4",
		no_reply_reason: "context_commit_only",
		policy_pack_ref: "policy-pack-ref-123",
		guard_decision_ref: "guard-decision-ref-123",
		pre_call_audit_ref: "pre-call-audit-ref-123",
		created_at: "2026-05-22T00:00:00.000Z",
		dispatch_authority_enabled: false,
		providerCall: true,
		actualLaneLaunch: false,
		runtimeExecution: true,
		hardCancelOrNoReplyAuthority: false,
		prompt_no_reply_authorized: true,
	};

	assert.equal(validateFlowDeskPromptNoReplyDecisionV1(decision).ok, true);
	assert.equal(
		validateFlowDeskPromptNoReplyDecisionV1({
			...decision,
			hardCancelOrNoReplyAuthority: true,
		}).ok,
		false,
	);
});
