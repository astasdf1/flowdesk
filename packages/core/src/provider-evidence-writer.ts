import type { ProviderFamily } from "./release1-contracts.js";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
} from "./session-evidence.js";

type FlowDeskProviderEvidenceAlertLevelV1 =
	| "ok"
	| "warning"
	| "critical"
	| "exhausted"
	| "stale"
	| "unknown";

type FlowDeskProviderEvidenceDispatchabilityV1 =
	| "dispatchable"
	| "diagnostic_only"
	| "non_dispatchable";

export interface FlowDeskProviderEvidenceWriteInputV1 {
	workflowId: string;
	attemptId: string;
	providerFamily: ProviderFamily;
	remainingPercent: number | null;
	alertLevel: FlowDeskProviderEvidenceAlertLevelV1;
	resetTime: string;
	dispatchability: FlowDeskProviderEvidenceDispatchabilityV1;
	snapshotRef: string;
	observedAt: string;
	rootDir: string;
}

export interface FlowDeskProviderEvidenceWriteResultV1 {
	usageEvidenceId: string;
	healthEvidenceId: string;
	ok: boolean;
	errors: string[];
}

const NON_DISPATCHABLE_ALERT_LEVELS = new Set<FlowDeskProviderEvidenceAlertLevelV1>([
	"exhausted",
	"stale",
	"unknown",
]);

function evidenceIdFromSnapshotRef(snapshotRef: string, suffix: "usage" | "health"): string {
	return `${snapshotRef}-${suffix}`.replace(/[^A-Za-z0-9._-]/g, "-");
}

function usageUncertaintyFromAlertLevel(
	alertLevel: FlowDeskProviderEvidenceAlertLevelV1,
): "unknown" | "stale" | "shared_limit_suspected" | "telemetry_ambiguous" | undefined {
	if (alertLevel === "stale") return "stale";
	if (alertLevel === "unknown") return "unknown";
	if (alertLevel === "exhausted") return "shared_limit_suspected";
	if (alertLevel === "critical") return "telemetry_ambiguous";
	return undefined;
}

function healthAvailabilityFromAlertLevel(
	alertLevel: FlowDeskProviderEvidenceAlertLevelV1,
): "healthy" | "degraded" | "unavailable" | "unknown" {
	if (alertLevel === "unknown" || alertLevel === "stale") return "unknown";
	if (alertLevel === "exhausted") return "unavailable";
	if (alertLevel === "critical" || alertLevel === "warning") return "degraded";
	return "healthy";
}

function effectiveHealthDispatchability(
	input: FlowDeskProviderEvidenceWriteInputV1,
): FlowDeskProviderEvidenceDispatchabilityV1 {
	return NON_DISPATCHABLE_ALERT_LEVELS.has(input.alertLevel) ? "non_dispatchable" : input.dispatchability;
}

function healthFailureClassFromAlertLevel(
	alertLevel: FlowDeskProviderEvidenceAlertLevelV1,
): "none" | "rate_limited" | "provider_error" | "telemetry_ambiguous" {
	if (alertLevel === "exhausted" || alertLevel === "critical") return "rate_limited";
	if (alertLevel === "warning") return "provider_error";
	if (alertLevel === "stale" || alertLevel === "unknown") return "telemetry_ambiguous";
	return "none";
}

export function persistProviderUsageHealthEvidenceV1(
	input: FlowDeskProviderEvidenceWriteInputV1,
): FlowDeskProviderEvidenceWriteResultV1 {
	const usageEvidenceId = evidenceIdFromSnapshotRef(input.snapshotRef, "usage");
	const healthEvidenceId = evidenceIdFromSnapshotRef(input.snapshotRef, "health");
	const sourceRef = `${input.snapshotRef}-source`.replace(/[^A-Za-z0-9._-]/g, "-");
	const modelFamily = `${input.providerFamily}-live`;
	const usageUncertainty = usageUncertaintyFromAlertLevel(input.alertLevel);
	const usageDispatchability = NON_DISPATCHABLE_ALERT_LEVELS.has(input.alertLevel)
		? "non_dispatchable"
		: input.dispatchability;

	const isFresh = !NON_DISPATCHABLE_ALERT_LEVELS.has(input.alertLevel);
	const freshnessTtl = 5;

	const usageFreshness = isFresh ? "fresh" : (input.alertLevel === "stale" ? "stale" : "unknown");

	const usageRecord = {
		schema_version: "flowdesk.usage_snapshot.v1",
		snapshot_id: usageEvidenceId,
		provider_family: input.providerFamily,
		model_family: modelFamily,
		freshness: usageFreshness,
		freshness_ttl: isFresh ? freshnessTtl : 0,
		remaining_percent: input.remainingPercent,
		reset_time: input.resetTime,
		reset_bucket: input.resetTime !== "unknown" ? `${input.providerFamily}-live` : "unknown",
		uncertainty_flags: isFresh ? [] : [usageFreshness],
		dispatchability: usageDispatchability,
		source_ref: sourceRef,
	};

	// failure_class must be a valid ProviderFailureClass enum value
	const healthFailureClass = isFresh ? "none"
		: input.alertLevel === "exhausted" ? "rate_limited"
		: "auth_missing";

	const healthRecord = {
		schema_version: "flowdesk.provider_health_snapshot.v1",
		snapshot_id: healthEvidenceId,
		provider_family: input.providerFamily,
		model_family: modelFamily,
		observed_at: input.observedAt,
		freshness: isFresh ? "fresh" : "unknown",
		freshness_ttl: isFresh ? freshnessTtl : 0,
		source_surface: "provider_smoke_test",
		availability_state: healthAvailabilityFromAlertLevel(input.alertLevel),
		failure_class: healthFailureClass,
		dispatchability: effectiveHealthDispatchability(input),
		source_ref: sourceRef,
		safe_remediation: isFresh
			? "Provider health snapshot acquired fresh."
			: "Refresh provider auth and usage evidence before managed dispatch.",
	};

	const usageIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: usageEvidenceId,
		record: usageRecord,
	});
	const healthIntent = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: healthEvidenceId,
		record: healthRecord,
	});
	const errors = [...usageIntent.errors, ...healthIntent.errors];

	if (!usageIntent.ok || usageIntent.writeIntent === undefined || !healthIntent.ok || healthIntent.writeIntent === undefined) {
		return { usageEvidenceId, healthEvidenceId, ok: false, errors };
	}

	const applyResult = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		usageIntent.writeIntent,
		healthIntent.writeIntent,
	]);

	return {
		usageEvidenceId,
		healthEvidenceId,
		ok: applyResult.ok,
		errors: [...errors, ...applyResult.errors],
	};
}
