import {
	type FlowDeskFederatedDataMinimizationPolicyV1,
	validateFlowDeskFederatedDataMinimizationPolicyV1,
} from "../operational-intelligence/federated.js";
import {
	type FlowDeskSurplusUsageGateV1,
	validateFlowDeskSurplusUsageGateV1,
} from "../operational-intelligence/gates.js";
import {
	type FlowDeskGitHubConnectorProductionPublishFlagV1,
	validateFlowDeskGitHubConnectorProductionPublishFlagV1,
} from "../schemas/github-connector-production-publish-flag.js";

export type FlowDeskEvidenceRefResolverV1 = (ref: string) => unknown;

function requireResolver(resolveRef?: FlowDeskEvidenceRefResolverV1): FlowDeskEvidenceRefResolverV1 {
	if (resolveRef === undefined) throw new Error("evidence ref resolver is required");
	return resolveRef;
}

export function validateProductionPublishFlagRef(ref: string, resolveRef?: FlowDeskEvidenceRefResolverV1): FlowDeskGitHubConnectorProductionPublishFlagV1 {
	const value = requireResolver(resolveRef)(ref);
	const validation = validateFlowDeskGitHubConnectorProductionPublishFlagV1(value);
	if (!validation.ok) throw new Error(`production publish flag ref invalid: ${validation.errors.join("; ")}`);
	const flag = value as FlowDeskGitHubConnectorProductionPublishFlagV1;
	if (flag.state !== "enabled") throw new Error(`production publish flag state is ${flag.state}`);
	return flag;
}

export function validateSurplusUsageGateRef(ref: string, resolveRef?: FlowDeskEvidenceRefResolverV1): FlowDeskSurplusUsageGateV1 {
	const value = requireResolver(resolveRef)(ref);
	const validation = validateFlowDeskSurplusUsageGateV1(value);
	if (!validation.ok) throw new Error(`surplus usage gate ref invalid: ${validation.errors.join("; ")}`);
	const gate = value as FlowDeskSurplusUsageGateV1;
	if (gate.gate_verdict !== "allow") throw new Error(`surplus usage gate verdict is ${gate.gate_verdict}`);
	if (gate.snapshot_fresh !== true) throw new Error("surplus usage gate snapshot is stale");
	if (gate.alert_level_safe !== true) throw new Error(`surplus usage gate alert level is ${gate.alert_level}`);
	return gate;
}

export function validateMinimizationPolicyRef(ref: string, resolveRef?: FlowDeskEvidenceRefResolverV1): FlowDeskFederatedDataMinimizationPolicyV1 {
	const value = requireResolver(resolveRef)(ref);
	const validation = validateFlowDeskFederatedDataMinimizationPolicyV1(value);
	if (!validation.ok) throw new Error(`minimization policy ref invalid: ${validation.errors.join("; ")}`);
	const policy = value as FlowDeskFederatedDataMinimizationPolicyV1;
	if (policy.advisory_only !== true) throw new Error("minimization policy must be advisory_only");
	if (policy.k_anonymity_threshold < 10) throw new Error("minimization policy k_anonymity_threshold must be >= 10");
	return policy;
}
