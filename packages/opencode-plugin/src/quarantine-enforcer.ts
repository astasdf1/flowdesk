/**
 * Standalone deny-only quarantine enforcer for managed dispatch beta.
 *
 * This module intentionally has no clear/unquarantine path and is not wired
 * into the managed dispatch adapter in this slice.
 */

export type QuarantineReason =
	| "terminal_evidence_conflict"
	| "stale_guard_approval_replay"
	| "consumed_guard_approval_replay"
	| "idempotency_conflict";

export interface QuarantineDecision {
	status: "allowed" | "blocked_quarantined";
	dispatchAllowed: boolean;
	quarantineRequired: boolean;
	reason?: QuarantineReason;
	redactedBlockReason?: string;
	quarantineId?: string;
	authority: QuarantineAuthority;
}

export interface QuarantineAuthority {
	dispatchAuthorityEnabled: false;
	fallbackAuthority: false;
	quarantineClearAuthority: false;
}

export interface QuarantineEnforcerInput {
	workflowId: string;
	attemptId: string;
	laneId: string;
	terminalEvidenceConflict?: boolean;
	idempotencyState?: string;
	guardApproval?: {
		approvalId: string;
		consumed?: boolean;
		consumedAt?: string;
		expiresAt?: string;
	};
	now?: Date;
}

const DENY_ONLY_AUTHORITY: QuarantineAuthority = {
	dispatchAuthorityEnabled: false,
	fallbackAuthority: false,
	quarantineClearAuthority: false,
};

const REDACTED_BLOCK_REASON: Record<QuarantineReason, string> = {
	terminal_evidence_conflict: "quarantine_terminal_evidence_conflict",
	idempotency_conflict: "quarantine_idempotency_conflict",
	consumed_guard_approval_replay: "quarantine_consumed_guard_approval_replay",
	stale_guard_approval_replay: "quarantine_stale_guard_approval_replay",
};

export function evaluateQuarantineEnforcer(input: QuarantineEnforcerInput): QuarantineDecision {
	const quarantineId = `quarantine-${input.workflowId}-${input.attemptId}-${input.laneId}`;

	if (input.terminalEvidenceConflict === true) {
		return blockedDecision("terminal_evidence_conflict", quarantineId);
	}

	if (input.idempotencyState === "quarantined" || input.idempotencyState === "conflict") {
		return blockedDecision("idempotency_conflict", quarantineId);
	}

	if (input.guardApproval?.consumed === true || input.guardApproval?.consumedAt !== undefined) {
		return blockedDecision("consumed_guard_approval_replay", quarantineId);
	}

	if (isExpired(input.guardApproval?.expiresAt, input.now ?? new Date())) {
		return blockedDecision("stale_guard_approval_replay", quarantineId);
	}

	return {
		status: "allowed",
		dispatchAllowed: true,
		quarantineRequired: false,
		authority: { ...DENY_ONLY_AUTHORITY },
	};
}

export function assertQuarantineClearUnsupported(): QuarantineDecision {
	return blockedDecision("idempotency_conflict");
}

function blockedDecision(reason: QuarantineReason, quarantineId?: string): QuarantineDecision {
	return {
		status: "blocked_quarantined",
		dispatchAllowed: false,
		quarantineRequired: true,
		reason,
		redactedBlockReason: REDACTED_BLOCK_REASON[reason],
		quarantineId,
		authority: { ...DENY_ONLY_AUTHORITY },
	};
}

function isExpired(expiresAt: string | undefined, now: Date): boolean {
	if (expiresAt === undefined) return false;
	const expiresAtMs = Date.parse(expiresAt);
	const nowMs = now.getTime();
	return Number.isFinite(expiresAtMs) && Number.isFinite(nowMs) && expiresAtMs <= nowMs;
}
