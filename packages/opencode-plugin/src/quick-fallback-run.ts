import {
	type FlowDeskFallbackDecisionV1,
	type FlowDeskFallbackReasonLabelV1,
	type FlowDeskProductionApprovalSourceV1,
	consumeFlowDeskProductionApprovalSourceV1,
} from "@flowdesk/core";
import {
	evaluateFallbackFreshEvidenceGate,
} from "./fallback-fresh-evidence-gate.js";
import {
	materializeFlowDeskManagedFallbackRegatePlanEvidenceV1,
	orchestrateFlowDeskManagedFallbackRegateV1,
} from "./managed-dispatch-adapter.js";

export interface FlowDeskQuickFallbackRunRequestV1 {
	fromProvider?: string;
	toProvider?: string;
	reason?: string;
	workflowId?: string;
	developerModeAcknowledged?: boolean;
	persistRegatePlanEvidence?: boolean;
}

export interface FlowDeskQuickFallbackRunConfigV1 {
	defaultFromProvider?: string;
	defaultToProvider?: string;
	rootDir?: string;
	sourceLabel?: string;
}

export interface FlowDeskQuickFallbackRunResultV1 {
	status:
		| "quick_fallback_run_completed"
		| "quick_fallback_run_incomplete"
		| "blocked_before_quick_fallback_run";
	observedAt: string;
	requestedFromProvider?: string;
	requestedToProvider?: string;
	requestedReason?: string;
	workflowId?: string;
	parentAttemptId?: string;
	newAttemptId?: string;
	regatePlanState?: string;
	regatePlanOk?: boolean;
	regatePlanRequiredEvidenceCount?: number;
	regatePlanRedactedErrors?: readonly string[];
	regatePlanEvidence?: {
		status: string;
		writeAttempted: boolean;
		evidenceReloaded: boolean;
		evidenceId?: string;
		redactedBlockReason?: string;
	};
	redactedBlockReason?: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-doctor")[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		automaticFallbackAuthorized: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		regatePlanPrepared: boolean;
	};
}

const FALLBACK_REASON_LABELS: readonly FlowDeskFallbackReasonLabelV1[] = [
	"provider_unhealthy",
	"quota_exhausted",
	"runtime_incompatible",
	"policy_ineligible",
	"manual_reselection_requested",
];

function isReasonLabel(value: string): value is FlowDeskFallbackReasonLabelV1 {
	return (FALLBACK_REASON_LABELS as readonly string[]).includes(value);
}

function defaultAuthority(prepared: boolean) {
	return {
		realOpenCodeDispatch: false as const,
		providerCall: false as const,
		runtimeExecution: false as const,
		actualLaneLaunch: false as const,
		fallbackAuthority: false as const,
		automaticFallbackAuthorized: false as const,
		hardCancelOrNoReplyAuthority: false as const,
		toolAuthority: false as const,
		regatePlanPrepared: prepared,
	};
}

function safeNextActions(): readonly ("/flowdesk-status" | "/flowdesk-doctor")[] {
	return ["/flowdesk-status", "/flowdesk-doctor"];
}

function safeStamp(observedAt: string): string {
	return observedAt.replace(/[^0-9A-Za-z]/g, "");
}

function blockedResponse(
	observedAt: string,
	request: FlowDeskQuickFallbackRunRequestV1,
	reason: string,
): FlowDeskQuickFallbackRunResultV1 {
	return {
		status: "blocked_before_quick_fallback_run",
		observedAt,
		...(request.fromProvider
			? { requestedFromProvider: request.fromProvider }
			: {}),
		...(request.toProvider ? { requestedToProvider: request.toProvider } : {}),
		...(request.reason ? { requestedReason: request.reason } : {}),
		...(request.workflowId ? { workflowId: request.workflowId } : {}),
		redactedBlockReason: reason,
		safeNextActions: safeNextActions(),
		authority: defaultAuthority(false),
	};
}

function buildSyntheticDecision(input: {
	fromProvider: string;
	toProvider: string;
	reasonLabel: FlowDeskFallbackReasonLabelV1;
	workflowId: string;
	parentAttemptId: string;
	newAttemptId: string;
	stamp: string;
}): FlowDeskFallbackDecisionV1 {
	return {
		schema_version: "flowdesk.fallback_decision.v1",
		decision_id: `fallback-decision-quick-${input.stamp}`,
		workflow_id: input.workflowId,
		parent_attempt_id: input.parentAttemptId,
		new_attempt_id: input.newAttemptId,
		from_provider_qualified_model_id: input.fromProvider,
		to_provider_qualified_model_id: input.toProvider,
		reason_label: input.reasonLabel,
		depth: 1,
		max_depth: 2,
		fresh_evidence_refs: [
			`usage-fresh-${input.stamp}`,
			`health-fresh-${input.stamp}`,
			`runtime-fresh-${input.stamp}`,
		],
		fresh_guard_decision_ref: `guard-fresh-${input.stamp}`,
		fresh_approval_ref: `approval-fresh-${input.stamp}`,
		fresh_pre_dispatch_audit_ref: `audit-fresh-${input.stamp}`,
		policy_eligibility_ref: `policy-fresh-${input.stamp}`,
		runtime_compatibility_ref: `runtime-compatibility-fresh-${input.stamp}`,
		state: "requires_full_regate",
		automatic_fallback_authorized: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}

function buildSyntheticConsumedApproval(input: {
	toProvider: string;
	workflowId: string;
	newAttemptId: string;
	stamp: string;
	observedAt: string;
	sourceLabel?: string;
}): FlowDeskProductionApprovalSourceV1 | undefined {
	const observedAtMs = Date.parse(input.observedAt);
	const issuedAt = new Date(observedAtMs - 60_000).toISOString();
	const consumedAt = input.observedAt;
	const expiresAt = new Date(observedAtMs + 10 * 60_000).toISOString();
	const actorRef = `actor-quick-fallback-${input.sourceLabel ?? "developer"}`;
	const profileRef = `profile-quick-fallback-${input.sourceLabel ?? "developer"}`;
	const result = consumeFlowDeskProductionApprovalSourceV1({
		approval: {
			schema_version: "flowdesk.production_approval_source.v1",
			approval_id: `approval-fresh-${input.stamp}`,
			workflow_id: input.workflowId,
			attempt_id: input.newAttemptId,
			action_type: "fallback_reselection",
			issuer_boundary: "external_user_confirmation",
			approval_method: "typed_phrase",
			actor_ref: actorRef,
			profile_ref: profileRef,
			provider_qualified_model_id: input.toProvider,
			provider_binding_hash: `hash-provider-quick-fallback-${input.stamp}`,
			evidence_bundle_hash: `hash-evidence-quick-fallback-${input.stamp}`,
			guard_decision_ref: `guard-fresh-${input.stamp}`,
			issuance_audit_ref: `audit-issuance-quick-fallback-${input.stamp}`,
			nonce_ref: `nonce-quick-fallback-${input.stamp}`,
			issued_at: issuedAt,
			expires_at: expiresAt,
			revoked: false,
			consume_strategy: "atomic_compare_and_swap_required",
			dispatch_authority_enabled: false,
		},
		workflowId: input.workflowId,
		attemptId: input.newAttemptId,
		actionType: "fallback_reselection",
		actorRef,
		profileRef,
		providerQualifiedModelId: input.toProvider,
		providerBindingHash: `hash-provider-quick-fallback-${input.stamp}`,
		evidenceBundleHash: `hash-evidence-quick-fallback-${input.stamp}`,
		guardDecisionRef: `guard-fresh-${input.stamp}`,
		consumptionAuditRef: `audit-consumption-quick-fallback-${input.stamp}`,
		consumedAt,
	});
	if (!result.ok || result.consumed_approval === undefined) return undefined;
	return result.consumed_approval;
}

export async function executeFlowDeskQuickFallbackRunV1(input: {
	config: FlowDeskQuickFallbackRunConfigV1;
	request?: FlowDeskQuickFallbackRunRequestV1;
	now?: () => Date;
}): Promise<FlowDeskQuickFallbackRunResultV1> {
	const observedAt = (input.now ? input.now() : new Date()).toISOString();
	const stamp = safeStamp(observedAt);
	const request = input.request ?? {};

	if (request.developerModeAcknowledged !== true) {
		return blockedResponse(
			observedAt,
			request,
			"developerModeAcknowledged must be true to acknowledge that quick fallback synthesizes a developer-mode fallback_reselection approval",
		);
	}

	const fromProvider = request.fromProvider ?? input.config.defaultFromProvider;
	const toProvider = request.toProvider ?? input.config.defaultToProvider;
	if (
		typeof fromProvider !== "string" ||
		fromProvider.trim().length === 0 ||
		typeof toProvider !== "string" ||
		toProvider.trim().length === 0
	) {
		return blockedResponse(
			observedAt,
			request,
			"fromProvider and toProvider concrete provider-qualified model ids are required",
		);
	}
	if (fromProvider === toProvider) {
		return blockedResponse(
			observedAt,
			request,
			"fromProvider and toProvider must differ for a fallback regate plan",
		);
	}

	const reasonLabelCandidate = (request.reason ?? "manual_reselection_requested").trim();
	if (!isReasonLabel(reasonLabelCandidate)) {
		return blockedResponse(
			observedAt,
			request,
			`reason must be one of ${FALLBACK_REASON_LABELS.join(", ")}`,
		);
	}

	const workflowId =
		request.workflowId && request.workflowId.trim().length > 0
			? request.workflowId.trim()
			: `workflow-quick-fallback-${stamp}`;
	const parentAttemptId = `attempt-quick-fallback-parent-${stamp}`;
	const newAttemptId = `attempt-quick-fallback-${stamp}`;

	const decision = buildSyntheticDecision({
		fromProvider,
		toProvider,
		reasonLabel: reasonLabelCandidate,
		workflowId,
		parentAttemptId,
		newAttemptId,
		stamp,
	});
	const freshnessGate = evaluateFallbackFreshEvidenceGate({
		previousAttemptId: parentAttemptId,
		newAttemptId,
		fallbackApproval: {
			approvalId: `approval-fresh-${stamp}`,
			actionType: "fallback_reselection",
			attemptId: newAttemptId,
			consumed: false,
			observedAt,
		},
		providerUsageObservedAt: observedAt,
		providerHealthObservedAt: observedAt,
		maxEvidenceAgeMs: 10 * 60_000,
		now: new Date(observedAt),
	});
	if (freshnessGate.status !== "allowed") {
		return blockedResponse(
			observedAt,
			request,
			`fallback freshness gate blocked: ${freshnessGate.redactedBlockReason ?? freshnessGate.reason}`,
		);
	}
	const consumedApproval = buildSyntheticConsumedApproval({
		toProvider,
		workflowId,
		newAttemptId,
		stamp,
		observedAt,
		sourceLabel: input.config.sourceLabel,
	});
	if (consumedApproval === undefined) {
		return blockedResponse(
			observedAt,
			request,
			"failed to synthesize a developer-mode fallback_reselection approval",
		);
	}

	const orchestrator = orchestrateFlowDeskManagedFallbackRegateV1({
		decision,
		consumedApproval,
	});

	const regatePlanState = orchestrator.regatePlan?.state;
	const regatePlanOk = orchestrator.regatePlan?.ok;
	const requiredEvidenceCount = Array.isArray(
		orchestrator.regatePlan?.required_fresh_evidence_refs,
	)
		? orchestrator.regatePlan.required_fresh_evidence_refs.length
		: undefined;
	const planErrors = orchestrator.regatePlan?.errors ?? [];
	const prepared = orchestrator.status === "regate_plan_ready";

	let regatePlanEvidence:
		| FlowDeskQuickFallbackRunResultV1["regatePlanEvidence"]
		| undefined;
	const shouldPersist =
		prepared &&
		request.persistRegatePlanEvidence === true &&
		typeof input.config.rootDir === "string" &&
		input.config.rootDir.trim().length > 0 &&
		orchestrator.regatePlan !== undefined;
	if (shouldPersist && orchestrator.regatePlan !== undefined) {
		const materialized =
			await materializeFlowDeskManagedFallbackRegatePlanEvidenceV1({
				rootDir: input.config.rootDir as string,
				regatePlan: orchestrator.regatePlan,
				evidenceId: `fallback-regate-plan-quick-${stamp}`,
			});
		regatePlanEvidence = {
			status: materialized.status,
			writeAttempted: materialized.writeAttempted,
			evidenceReloaded: materialized.evidenceReloaded,
			...(materialized.evidenceId
				? { evidenceId: materialized.evidenceId }
				: {}),
			...(materialized.redactedBlockReason
				? { redactedBlockReason: materialized.redactedBlockReason }
				: {}),
		};
	}

	return {
		status: prepared
			? "quick_fallback_run_completed"
			: "quick_fallback_run_incomplete",
		observedAt,
		requestedFromProvider: fromProvider,
		requestedToProvider: toProvider,
		requestedReason: reasonLabelCandidate,
		workflowId,
		parentAttemptId,
		newAttemptId,
		...(regatePlanState ? { regatePlanState } : {}),
		...(regatePlanOk !== undefined ? { regatePlanOk } : {}),
		...(requiredEvidenceCount !== undefined
			? { regatePlanRequiredEvidenceCount: requiredEvidenceCount }
			: {}),
		...(planErrors.length > 0 ? { regatePlanRedactedErrors: planErrors } : {}),
		...(regatePlanEvidence ? { regatePlanEvidence } : {}),
		...(!prepared && orchestrator.redactedBlockReason
			? { redactedBlockReason: orchestrator.redactedBlockReason }
			: {}),
		safeNextActions: safeNextActions(),
		authority: defaultAuthority(prepared),
	};
}
