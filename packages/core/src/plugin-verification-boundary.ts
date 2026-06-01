// ── FlowDesk plugin verification boundary ───────────────────────────────────
//
// FlowDesk is an OpenCode PLUGIN. A plugin can only verify what happens inside
// its own boundary: what it asked OpenCode to do and what OpenCode returned to
// it. It cannot, by itself, prove platform-internal facts such as a trusted
// (attested) runtime echo, that OpenCode actually ran in a given conformance
// mode (real-opencode-dispatch, hook_harness=enforce, ...), or how the
// Bun-compiled OpenCode binary behaves internally. Those are OpenCode PLATFORM
// capabilities; a plugin can observe correlations but cannot attest them.
//
// This module classifies each piece of evidence the production managed-dispatch
// gate requires as either:
//   - "plugin_satisfiable": FlowDesk can honestly produce/verify it within the
//     plugin boundary (durable audit, idempotency reservation, human approval,
//     provider health/usage snapshots it collected, policy/verification refs).
//   - "opencode_platform_dependent": it requires a trusted OpenCode platform
//     capability (trusted/attested runtime echo, conformance-mode attestation,
//     telemetry-correlation authority) that the plugin cannot self-attest. The
//     plugin may OBSERVE these (see observed-runtime-echo.ts) but its observation
//     is "observed_unattested", never a platform-trusted attestation.
//
// The point: FlowDesk can honestly open the plugin-satisfiable preparation/
// registration path without pretending it proved platform-internal facts. These
// platform-dependent labels are explicitly SKIPPED for the plugin-satisfiable
// gate (not fatal blockers), while remaining visible so doctor/status do not
// imply that runtime echo, telemetry correlation, lane conformance, or trusted
// usage authority were proven by the plugin.

export const FLOWDESK_PLUGIN_VERIFICATION_CLASSIFICATIONS = [
	"plugin_satisfiable",
	"opencode_platform_dependent",
] as const;
export type FlowDeskPluginVerificationClassificationV1 =
	(typeof FLOWDESK_PLUGIN_VERIFICATION_CLASSIFICATIONS)[number];

/**
 * Evidence/gate concerns that require a trusted OpenCode PLATFORM capability the
 * plugin cannot self-attest. The plugin can observe correlations for these
 * (e.g. observed_unattested runtime echo) but cannot produce the trusted form.
 */
export const FLOWDESK_OPENCODE_PLATFORM_DEPENDENT_CONCERNS = [
	// Trusted/attested runtime echo: needs an OpenCode-signed/attested runtime
	// surface. The plugin only sees the SDK response it received.
	"runtime_echo",
	// Conformance-mode attestation (dispatch_mode=real-opencode-dispatch,
	// runtime_echo_mode=trusted, hook_harness=enforce, provider_health_mode=
	// dispatch_gate_ready, ...): the plugin cannot prove OpenCode actually runs
	// in these modes; only OpenCode conformance can.
	"lane_conformance",
	// Sufficient telemetry correlation as a trusted authority: event telemetry is
	// situational awareness for the plugin, not a platform-attested correlation.
	"telemetry_correlation",
	// Pinned/trusted managed-dispatch usage authority evidence
	// (flowdesk.managed_dispatch_beta.usage_authority_evidence.v1). This is part
	// of the same Guard-pinned trusted bundle as runtime echo/telemetry and is
	// checked via REQUIRED_SESSION_EVIDENCE_CLASSES, not as a caller-supplied
	// result. The plugin can collect raw provider usage (provider_usage_snapshot,
	// provider_health_snapshot) within its boundary, but it cannot self-attest
	// the TRUSTED usage-authority evidence the production Guard pins. So
	// usage_authority belongs here, not in plugin_satisfiable.
	"usage_authority",
] as const;
export type FlowDeskOpenCodePlatformDependentConcernV1 =
	(typeof FLOWDESK_OPENCODE_PLATFORM_DEPENDENT_CONCERNS)[number];

/**
 * Production-enablement blocker labels that map to OpenCode-platform-dependent
 * concerns (i.e. blocked by the plugin boundary, not by a FlowDesk defect).
 */
const PLATFORM_DEPENDENT_BLOCKER_LABELS = new Set<string>([
	"runtime_echo_missing",
	"telemetry_correlation_missing",
	"lane_conformance_missing",
	"usage_authority_missing",
]);

export interface FlowDeskPluginBoundaryClassificationEntryV1 {
	label: string;
	classification: FlowDeskPluginVerificationClassificationV1;
	disposition: "required_plugin_evidence" | "skipped_platform_dependent";
	platform_concern?: FlowDeskOpenCodePlatformDependentConcernV1;
	rationale_label: string;
}

export interface FlowDeskPluginBoundaryAssessmentV1 {
	schema_version: "flowdesk.plugin_verification_boundary_assessment.v1";
	total: number;
	plugin_satisfiable_count: number;
	opencode_platform_dependent_count: number;
	skipped_platform_dependent_count: number;
	entries: FlowDeskPluginBoundaryClassificationEntryV1[];
	// True when every remaining blocker is outside the plugin boundary. These are
	// skipped for the plugin-satisfiable gate, not treated as plugin fatal blockers.
	only_platform_dependent_blockers_remain: boolean;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

/**
 * Classify a single production-enablement blocker label by whether the FlowDesk
 * plugin can satisfy it within its own boundary, or whether it depends on an
 * OpenCode platform capability the plugin cannot self-attest.
 */
export function classifyFlowDeskProductionBlockerByPluginBoundaryV1(
	label: string,
): FlowDeskPluginBoundaryClassificationEntryV1 {
	if (PLATFORM_DEPENDENT_BLOCKER_LABELS.has(label)) {
		const concern: FlowDeskOpenCodePlatformDependentConcernV1 =
			label === "runtime_echo_missing"
				? "runtime_echo"
				: label === "telemetry_correlation_missing"
					? "telemetry_correlation"
					: label === "usage_authority_missing"
						? "usage_authority"
						: "lane_conformance";
		return {
			label,
			classification: "opencode_platform_dependent",
			disposition: "skipped_platform_dependent",
			platform_concern: concern,
			rationale_label:
				"skipped for plugin-satisfiable gate because it requires a trusted OpenCode platform capability the plugin cannot self-attest",
		};
	}
	return {
		label,
		classification: "plugin_satisfiable",
		disposition: "required_plugin_evidence",
		rationale_label: "satisfiable within the FlowDesk plugin boundary",
	};
}

/**
 * Assess a set of remaining production-enablement blocker labels against the
 * plugin verification boundary. Pure, redaction-safe, authority-free.
 */
export function assessFlowDeskPluginVerificationBoundaryV1(
	blockerLabels: readonly string[],
): FlowDeskPluginBoundaryAssessmentV1 {
	const entries = blockerLabels.map(
		classifyFlowDeskProductionBlockerByPluginBoundaryV1,
	);
	const platformDependent = entries.filter(
		(entry) => entry.classification === "opencode_platform_dependent",
	);
	const pluginSatisfiable = entries.filter(
		(entry) => entry.classification === "plugin_satisfiable",
	);
	return {
		schema_version: "flowdesk.plugin_verification_boundary_assessment.v1",
		total: entries.length,
		plugin_satisfiable_count: pluginSatisfiable.length,
		opencode_platform_dependent_count: platformDependent.length,
		skipped_platform_dependent_count: platformDependent.length,
		entries,
		only_platform_dependent_blockers_remain:
			entries.length > 0 && pluginSatisfiable.length === 0,
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
	};
}
