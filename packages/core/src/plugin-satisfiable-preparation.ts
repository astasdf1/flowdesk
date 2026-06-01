import {
	assessFlowDeskPluginVerificationBoundaryV1,
	type FlowDeskPluginBoundaryAssessmentV1,
} from "./plugin-verification-boundary.js";

// ── Plugin-satisfiable production-evidence preparation readiness ─────────────
//
// The production managed-dispatch gate's remaining blockers split into
// plugin_satisfiable vs opencode_platform_dependent (see
// plugin-verification-boundary.ts). The platform-dependent ones are out of the
// plugin's reach by construction and are skipped for this gate. THIS module is about the plugin_satisfiable
// ones: each has a real producer/issuer in @flowdesk/core
// (createFlowDeskConfiguredVerificationResultV1, createFlowDeskSanitizedAuth-
// CaptureResultV1, createFlowDeskExternalAuthProviderPolicyResultV1,
// issueFlowDeskProductionApprovalSourceV1, the provider usage collector, the
// pre-dispatch audit record, and the dispatch idempotency reservation).
//
// What was missing is an honest readiness view that, WITHOUT synthesizing
// anything, reports which plugin_satisfiable evidence inputs have actually been
// supplied for a workflow and which are still pending real input (a passed
// verification result, a sanitized auth capture, a policy result, fresh
// usage/health, a durable audit, an idempotency reservation, and a human
// Guard approval). It never fabricates evidence; it only classifies presence.
//
// This keeps the work strictly inside the plugin boundary: it inspects inputs
// the plugin already has, it does not attest any OpenCode platform capability,
// and it carries no dispatch authority.

export const FLOWDESK_PLUGIN_SATISFIABLE_EVIDENCE_KINDS = [
	"provider_health_snapshot",
	"pre_dispatch_audit",
	"dispatch_idempotency",
	"configured_verification",
	"sanitized_auth_capture",
	"external_auth_policy",
	"provider_policy",
	"production_approval_source",
] as const;
export type FlowDeskPluginSatisfiableEvidenceKindV1 =
	(typeof FLOWDESK_PLUGIN_SATISFIABLE_EVIDENCE_KINDS)[number];

/**
 * Maps each plugin_satisfiable evidence kind to the production-enablement
 * blocker label it clears, plus the core producer the caller must run with REAL
 * input to supply it (documented for honesty; this module does not call them).
 */
export const FLOWDESK_PLUGIN_SATISFIABLE_PRODUCERS: Record<
	FlowDeskPluginSatisfiableEvidenceKindV1,
	{ clears_blocker: string; producer_label: string; requires_human: boolean }
> = {
	provider_health_snapshot: {
		clears_blocker: "provider_health_snapshot_missing",
		producer_label: "collectManagedDispatchBetaUsageEvidenceV1 (fresh provider health)",
		requires_human: false,
	},
	pre_dispatch_audit: {
		clears_blocker: "pre_dispatch_audit_missing",
		producer_label: "FlowDeskPreDispatchAuditRecordV1 durable audit",
		requires_human: false,
	},
	dispatch_idempotency: {
		clears_blocker: "dispatch_idempotency_missing",
		producer_label: "dispatch idempotency reservation snapshot",
		requires_human: false,
	},
	configured_verification: {
		clears_blocker: "configured_verification_missing",
		producer_label: "createFlowDeskConfiguredVerificationResultV1 (result=passed)",
		requires_human: false,
	},
	sanitized_auth_capture: {
		clears_blocker: "sanitized_auth_capture_result_missing",
		producer_label: "createFlowDeskSanitizedAuthCaptureResultV1 (result=passed)",
		requires_human: false,
	},
	external_auth_policy: {
		clears_blocker: "external_auth_policy_missing",
		producer_label: "createFlowDeskExternalAuthProviderPolicyResultV1 (result=passed)",
		requires_human: false,
	},
	provider_policy: {
		clears_blocker: "provider_policy_missing",
		producer_label: "createFlowDeskExternalAuthProviderPolicyResultV1 (result=passed)",
		requires_human: false,
	},
	production_approval_source: {
		clears_blocker: "production_approval_source_missing",
		producer_label: "issueFlowDeskProductionApprovalSourceV1 (human typed-phrase approval)",
		requires_human: true,
	},
};

/**
 * Which plugin_satisfiable evidence kinds have actually been supplied for this
 * workflow. The caller passes the set it has REALLY produced/reloaded; this
 * module does not synthesize any of them. `requires_human` items (the Guard
 * approval) are tracked separately so a readiness view can show that the only
 * remaining plugin-side step is a human decision, never auto-filled.
 */
export interface FlowDeskPluginSatisfiablePreparationInputV1 {
	workflowId: string;
	suppliedEvidenceKinds: readonly FlowDeskPluginSatisfiableEvidenceKindV1[];
	/** Remaining production-enablement blocker labels (from the gate eval). */
	remainingBlockerLabels: readonly string[];
}

export interface FlowDeskPluginSatisfiablePreparationReadinessV1 {
	schema_version: "flowdesk.plugin_satisfiable_preparation_readiness.v1";
	workflow_id: string;
	supplied: FlowDeskPluginSatisfiableEvidenceKindV1[];
	pending_non_human: FlowDeskPluginSatisfiableEvidenceKindV1[];
	pending_human: FlowDeskPluginSatisfiableEvidenceKindV1[];
	plugin_boundary_assessment: FlowDeskPluginBoundaryAssessmentV1;
	// True when every plugin_satisfiable evidence kind has been supplied. Platform-
	// dependent proof labels are represented as skipped, not fatal blockers for
	// this preparation gate.
	all_non_human_plugin_evidence_supplied: boolean;
	all_plugin_satisfiable_supplied: boolean;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

/**
 * Pure, authority-free readiness view of plugin_satisfiable production evidence.
 * It never fabricates evidence; it classifies which real inputs have been
 * supplied vs are still pending, and reproduces the plugin/platform boundary so
 * a reader can see what FlowDesk can still do (supply pending non-human plugin
 * evidence) vs what only a human (Guard approval) or only OpenCode (platform
 * capabilities) can provide.
 */
export function assessFlowDeskPluginSatisfiablePreparationV1(
	input: FlowDeskPluginSatisfiablePreparationInputV1,
): FlowDeskPluginSatisfiablePreparationReadinessV1 {
	const suppliedSet = new Set(input.suppliedEvidenceKinds);
	const supplied: FlowDeskPluginSatisfiableEvidenceKindV1[] = [];
	const pendingNonHuman: FlowDeskPluginSatisfiableEvidenceKindV1[] = [];
	const pendingHuman: FlowDeskPluginSatisfiableEvidenceKindV1[] = [];
	for (const kind of FLOWDESK_PLUGIN_SATISFIABLE_EVIDENCE_KINDS) {
		if (suppliedSet.has(kind)) {
			supplied.push(kind);
			continue;
		}
		if (FLOWDESK_PLUGIN_SATISFIABLE_PRODUCERS[kind].requires_human)
			pendingHuman.push(kind);
		else pendingNonHuman.push(kind);
	}
	return {
		schema_version: "flowdesk.plugin_satisfiable_preparation_readiness.v1",
		workflow_id: input.workflowId,
		supplied,
		pending_non_human: pendingNonHuman,
		pending_human: pendingHuman,
		plugin_boundary_assessment: assessFlowDeskPluginVerificationBoundaryV1(
			input.remainingBlockerLabels,
		),
		all_non_human_plugin_evidence_supplied: pendingNonHuman.length === 0,
		all_plugin_satisfiable_supplied:
			pendingNonHuman.length === 0 && pendingHuman.length === 0,
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		actualLaneLaunch: false,
		providerCall: false,
		runtimeExecution: false,
	};
}
