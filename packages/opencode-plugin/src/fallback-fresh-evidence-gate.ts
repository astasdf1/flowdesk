import { isFreshEvidence, type FreshEvidenceReason } from "./binding-policy-revalidation.js";

type FreshEvidenceBlockedReason = Exclude<FreshEvidenceReason, "fresh">;

export interface FallbackApprovalFreshEvidence {
	approvalId: string;
	actionType?: string;
	attemptId?: string;
	consumed?: boolean;
	consumedAt?: string;
	observedAt?: string;
}

export interface FallbackFreshEvidenceGateInput {
	previousAttemptId: string;
	newAttemptId: string;
	fallbackApproval?: FallbackApprovalFreshEvidence;
	providerUsageObservedAt?: string;
	providerHealthObservedAt?: string;
	maxEvidenceAgeMs: number;
	now?: Date;
}

export interface FallbackFreshEvidenceGateAuthority {
	fallbackAuthority: false;
	dispatchAuthorityEnabled: false;
	providerCall: false;
	runtimeExecution: false;
}

export type FallbackFreshEvidenceGateBlockedReason =
	| "fallback_requires_new_attempt_id"
	| "fallback_approval_missing"
	| "fallback_approval_wrong_action_type"
	| "fallback_approval_attempt_mismatch"
	| "fallback_approval_already_consumed"
	| FreshEvidenceBlockedReason
	| "provider_usage_stale"
	| "provider_health_stale";

export type FallbackFreshEvidenceGateReason =
	| "fallback_fresh_evidence_validated"
	| FallbackFreshEvidenceGateBlockedReason;

export interface FallbackFreshEvidenceGateResult {
	status: "allowed" | "blocked";
	fallbackAllowed: boolean;
	reason: FallbackFreshEvidenceGateReason;
	redactedBlockReason?: FallbackFreshEvidenceGateBlockedReason;
	authority: FallbackFreshEvidenceGateAuthority;
}

const NO_AUTHORITY: FallbackFreshEvidenceGateAuthority = {
	fallbackAuthority: false,
	dispatchAuthorityEnabled: false,
	providerCall: false,
	runtimeExecution: false,
};

function blocked(reason: FallbackFreshEvidenceGateBlockedReason): FallbackFreshEvidenceGateResult {
	return {
		status: "blocked",
		fallbackAllowed: false,
		reason,
		redactedBlockReason: reason,
		authority: NO_AUTHORITY,
	};
}

function evaluateFreshness(
	observedAt: string | undefined,
	input: Pick<FallbackFreshEvidenceGateInput, "maxEvidenceAgeMs" | "now">,
) {
	return isFreshEvidence({
		observedAt,
		now: input.now,
		maxAgeMs: input.maxEvidenceAgeMs,
	});
}

export function evaluateFallbackFreshEvidenceGate(
	input: FallbackFreshEvidenceGateInput,
): FallbackFreshEvidenceGateResult {
	if (input.newAttemptId === input.previousAttemptId) {
		return blocked("fallback_requires_new_attempt_id");
	}

	const approval = input.fallbackApproval;
	if (approval === undefined) {
		return blocked("fallback_approval_missing");
	}

	if (approval.actionType !== "fallback_reselection") {
		return blocked("fallback_approval_wrong_action_type");
	}

	if (approval.attemptId !== input.newAttemptId) {
		return blocked("fallback_approval_attempt_mismatch");
	}

	if (approval.consumed === true || approval.consumedAt !== undefined) {
		return blocked("fallback_approval_already_consumed");
	}

	const approvalFreshness = evaluateFreshness(approval.observedAt, input);
	if (!approvalFreshness.fresh) {
		return blocked(approvalFreshness.reason);
	}

	const usageFreshness = evaluateFreshness(input.providerUsageObservedAt, input);
	if (!usageFreshness.fresh) {
		return blocked("provider_usage_stale");
	}

	const healthFreshness = evaluateFreshness(input.providerHealthObservedAt, input);
	if (!healthFreshness.fresh) {
		return blocked("provider_health_stale");
	}

	return {
		status: "allowed",
		fallbackAllowed: true,
		reason: "fallback_fresh_evidence_validated",
		authority: NO_AUTHORITY,
	};
}
