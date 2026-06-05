import assert from "node:assert/strict";
import test from "node:test";
import {
	assertQuarantineClearUnsupported,
	evaluateQuarantineEnforcer,
} from "./quarantine-enforcer.js";

const baseInput = {
	workflowId: "workflow-123",
	attemptId: "attempt-456",
	laneId: "lane-789",
};

test("allows when no quarantine signals are present", () => {
	const decision = evaluateQuarantineEnforcer(baseInput);

	assert.equal(decision.status, "allowed");
	assert.equal(decision.dispatchAllowed, true);
	assert.equal(decision.quarantineRequired, false);
	assert.equal(decision.reason, undefined);
	assert.equal(decision.redactedBlockReason, undefined);
	assert.equal(decision.quarantineId, undefined);
	assert.deepEqual(decision.authority, {
		dispatchAuthorityEnabled: false,
		fallbackAuthority: false,
		quarantineClearAuthority: false,
	});
});

test("terminal evidence conflict blocks and gives stable quarantine id", () => {
	const decision = evaluateQuarantineEnforcer({
		...baseInput,
		terminalEvidenceConflict: true,
	});

	assert.equal(decision.status, "blocked_quarantined");
	assert.equal(decision.dispatchAllowed, false);
	assert.equal(decision.quarantineRequired, true);
	assert.equal(decision.reason, "terminal_evidence_conflict");
	assert.equal(decision.redactedBlockReason, "quarantine_terminal_evidence_conflict");
	assert.equal(decision.quarantineId, "quarantine-workflow-123-attempt-456-lane-789");
});

test("idempotency quarantined blocks", () => {
	const decision = evaluateQuarantineEnforcer({
		...baseInput,
		idempotencyState: "quarantined",
	});

	assert.equal(decision.status, "blocked_quarantined");
	assert.equal(decision.dispatchAllowed, false);
	assert.equal(decision.quarantineRequired, true);
	assert.equal(decision.reason, "idempotency_conflict");
	assert.equal(decision.redactedBlockReason, "quarantine_idempotency_conflict");
});

test("consumed guard approval blocks", () => {
	const decision = evaluateQuarantineEnforcer({
		...baseInput,
		guardApproval: {
			approvalId: "approval-123",
			consumed: true,
		},
	});

	assert.equal(decision.status, "blocked_quarantined");
	assert.equal(decision.dispatchAllowed, false);
	assert.equal(decision.quarantineRequired, true);
	assert.equal(decision.reason, "consumed_guard_approval_replay");
	assert.equal(decision.redactedBlockReason, "quarantine_consumed_guard_approval_replay");
});

test("expired stale guard approval blocks using fixed now", () => {
	const decision = evaluateQuarantineEnforcer({
		...baseInput,
		guardApproval: {
			approvalId: "approval-123",
			expiresAt: "2026-06-05T12:00:00.000Z",
		},
		now: new Date("2026-06-05T12:00:00.000Z"),
	});

	assert.equal(decision.status, "blocked_quarantined");
	assert.equal(decision.dispatchAllowed, false);
	assert.equal(decision.quarantineRequired, true);
	assert.equal(decision.reason, "stale_guard_approval_replay");
	assert.equal(decision.redactedBlockReason, "quarantine_stale_guard_approval_replay");
});

test("future unconsumed guard approval allows", () => {
	const decision = evaluateQuarantineEnforcer({
		...baseInput,
		guardApproval: {
			approvalId: "approval-123",
			expiresAt: "2026-06-05T12:00:01.000Z",
		},
		now: new Date("2026-06-05T12:00:00.000Z"),
	});

	assert.equal(decision.status, "allowed");
	assert.equal(decision.dispatchAllowed, true);
	assert.equal(decision.quarantineRequired, false);
	assert.equal(decision.reason, undefined);
	assert.equal(decision.authority.quarantineClearAuthority, false);
});

test("assert clear unsupported returns blocked and no clear authority", () => {
	const decision = assertQuarantineClearUnsupported();

	assert.equal(decision.status, "blocked_quarantined");
	assert.equal(decision.dispatchAllowed, false);
	assert.equal(decision.quarantineRequired, true);
	assert.equal(decision.reason, "idempotency_conflict");
	assert.equal(decision.authority.dispatchAuthorityEnabled, false);
	assert.equal(decision.authority.fallbackAuthority, false);
	assert.equal(decision.authority.quarantineClearAuthority, false);
});
