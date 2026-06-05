const FUTURE_CLOCK_SKEW_MS = 5_000;

export type FreshEvidenceReason =
	| "fresh"
	| "missing_or_invalid_observed_at"
	| "observed_at_from_future"
	| "evidence_stale";

export interface FreshEvidenceInput {
	observedAt?: string;
	now?: Date;
	maxAgeMs: number;
}

export type FreshEvidenceResult =
	| { fresh: true; reason: "fresh" }
	| { fresh: false; reason: Exclude<FreshEvidenceReason, "fresh"> };

export type BindingPolicyRevalidationBlockedReason =
	| "policy_hash_missing"
	| "policy_hash_mismatch"
	| Exclude<FreshEvidenceReason, "fresh">
	| "provider_model_not_allowed";

export type BindingPolicyRevalidationReason =
	| "binding_policy_revalidated"
	| BindingPolicyRevalidationBlockedReason;

export interface BindingPolicyRevalidationInput {
	expectedPolicyHash: string;
	observedPolicyHash?: string;
	policyObservedAt?: string;
	maxPolicyAgeMs: number;
	now?: Date;
	providerQualifiedModelId: string;
	allowedProviderQualifiedModelIds: readonly string[];
}

export interface BindingPolicyRevalidationAuthority {
	dispatchAuthorityEnabled: false;
	providerCall: false;
	runtimeExecution: false;
	fallbackAuthority: false;
}

export interface BindingPolicyRevalidationResult {
	status: "allowed" | "blocked";
	dispatchAllowed: boolean;
	reason: BindingPolicyRevalidationReason;
	redactedBlockReason?: BindingPolicyRevalidationBlockedReason;
	authority: BindingPolicyRevalidationAuthority;
}

const NO_AUTHORITY: BindingPolicyRevalidationAuthority = {
	dispatchAuthorityEnabled: false,
	providerCall: false,
	runtimeExecution: false,
	fallbackAuthority: false,
};

export function isFreshEvidence(input: FreshEvidenceInput): FreshEvidenceResult {
	const observedMs = input.observedAt === undefined ? Number.NaN : Date.parse(input.observedAt);
	if (!Number.isFinite(observedMs)) {
		return { fresh: false, reason: "missing_or_invalid_observed_at" };
	}

	const nowMs = (input.now ?? new Date()).getTime();
	if (!Number.isFinite(nowMs)) {
		return { fresh: false, reason: "missing_or_invalid_observed_at" };
	}

	if (observedMs - nowMs > FUTURE_CLOCK_SKEW_MS) {
		return { fresh: false, reason: "observed_at_from_future" };
	}

	if (nowMs - observedMs > input.maxAgeMs) {
		return { fresh: false, reason: "evidence_stale" };
	}

	return { fresh: true, reason: "fresh" };
}

function blocked(reason: BindingPolicyRevalidationBlockedReason): BindingPolicyRevalidationResult {
	return {
		status: "blocked",
		dispatchAllowed: false,
		reason,
		redactedBlockReason: reason,
		authority: NO_AUTHORITY,
	};
}

export function evaluateBindingPolicyRevalidation(input: BindingPolicyRevalidationInput): BindingPolicyRevalidationResult {
	if (input.observedPolicyHash === undefined || input.observedPolicyHash.length === 0) {
		return blocked("policy_hash_missing");
	}

	if (input.observedPolicyHash !== input.expectedPolicyHash) {
		return blocked("policy_hash_mismatch");
	}

	const freshness = isFreshEvidence({
		observedAt: input.policyObservedAt,
		now: input.now,
		maxAgeMs: input.maxPolicyAgeMs,
	});
	if (!freshness.fresh) {
		return blocked(freshness.reason);
	}

	if (!input.allowedProviderQualifiedModelIds.includes(input.providerQualifiedModelId)) {
		return blocked("provider_model_not_allowed");
	}

	return {
		status: "allowed",
		dispatchAllowed: true,
		reason: "binding_policy_revalidated",
		authority: NO_AUTHORITY,
	};
}
