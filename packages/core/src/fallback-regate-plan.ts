import { promoteFlowDeskFallbackReselectionRegateV1 } from "./authority-promotion.js";
import type { FlowDeskFallbackDecisionV1 } from "./fallback-decision.js";
import type { FlowDeskProductionApprovalSourceV1 } from "./production-approval-source.js";
import { invalid, type ValidationResult, valid, validateNoForbiddenRawPayloads } from "./validators.js";

export interface FlowDeskFallbackRegatePlanV1 extends ValidationResult {
	schema_version: "flowdesk.fallback_regate_plan.v1";
	workflow_id?: string;
	parent_attempt_id?: string;
	new_attempt_id?: string;
	decision_ref?: string;
	from_provider_qualified_model_id?: string;
	to_provider_qualified_model_id?: string;
	state: "full_regate_required" | "blocked";
	required_fresh_evidence_refs: string[];
	required_guard_decision_ref?: string;
	required_approval_ref?: string;
	required_pre_dispatch_audit_ref?: string;
	policy_eligibility_ref?: string;
	runtime_compatibility_ref?: string;
	consumed_fallback_approval_ref?: string;
	safe_next_actions: ["/flowdesk-status", "/flowdesk-run"] | ["/flowdesk-status"];
	automatic_fallback_authorized: false;
	provider_switch_attempted: false;
	dispatch_authority_enabled: false;
	realOpenCodeDispatch: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

const disabledRegateAuthority = {
	automatic_fallback_authorized: false as const,
	provider_switch_attempted: false as const,
	dispatch_authority_enabled: false as const,
	realOpenCodeDispatch: false as const,
	providerCall: false as const,
	actualLaneLaunch: false as const,
	runtimeExecution: false as const,
};

function blockedPlan(
	decision: Partial<FlowDeskFallbackDecisionV1>,
	errors: readonly string[],
): FlowDeskFallbackRegatePlanV1 {
	return {
		schema_version: "flowdesk.fallback_regate_plan.v1",
		...invalid(...errors),
		workflow_id: decision.workflow_id,
		parent_attempt_id: decision.parent_attempt_id,
		new_attempt_id: decision.new_attempt_id,
		decision_ref: decision.decision_id,
		from_provider_qualified_model_id: decision.from_provider_qualified_model_id,
		to_provider_qualified_model_id: decision.to_provider_qualified_model_id,
		state: "blocked",
		required_fresh_evidence_refs: [],
		safe_next_actions: ["/flowdesk-status"],
		...disabledRegateAuthority,
	};
}

export function planFlowDeskFallbackRegateV1(input: {
	decision: FlowDeskFallbackDecisionV1;
	consumedApproval: FlowDeskProductionApprovalSourceV1;
}): FlowDeskFallbackRegatePlanV1 {
	const promotion = promoteFlowDeskFallbackReselectionRegateV1(input);
	if (!promotion.ok || promotion.fallback_reselection_regate_authority_enabled !== true) {
		return blockedPlan(
			input.decision,
			promotion.errors.length > 0 ? promotion.errors : ["fallback regate plan blocked"],
		);
	}
	const plan: FlowDeskFallbackRegatePlanV1 = {
		schema_version: "flowdesk.fallback_regate_plan.v1",
		...valid(),
		workflow_id: input.decision.workflow_id,
		parent_attempt_id: input.decision.parent_attempt_id,
		new_attempt_id: input.decision.new_attempt_id,
		decision_ref: input.decision.decision_id,
		from_provider_qualified_model_id: input.decision.from_provider_qualified_model_id,
		to_provider_qualified_model_id: input.decision.to_provider_qualified_model_id,
		state: "full_regate_required",
		required_fresh_evidence_refs: [...input.decision.fresh_evidence_refs],
		required_guard_decision_ref: input.decision.fresh_guard_decision_ref,
		required_approval_ref: input.decision.fresh_approval_ref,
		required_pre_dispatch_audit_ref: input.decision.fresh_pre_dispatch_audit_ref,
		policy_eligibility_ref: input.decision.policy_eligibility_ref,
		runtime_compatibility_ref: input.decision.runtime_compatibility_ref,
		consumed_fallback_approval_ref: input.consumedApproval.approval_id,
		safe_next_actions: ["/flowdesk-status", "/flowdesk-run"],
		...disabledRegateAuthority,
	};
	const redaction = validateNoForbiddenRawPayloads(plan, "fallback_regate_plan");
	return redaction.ok ? plan : blockedPlan(input.decision, redaction.errors);
}
