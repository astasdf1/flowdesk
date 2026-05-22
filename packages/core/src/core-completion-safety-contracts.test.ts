import assert from "node:assert/strict";
import test from "node:test";
import {
	FLOWDESK_ADVISORY_FORBIDDEN_CONSUMERS,
	validateFlowDeskAdvisoryOutputFirewallV1,
	validateFlowDeskFederatedRegistryStateV1,
	type FlowDeskAdvisoryOutputFirewallV1,
	type FlowDeskFederatedRegistryStateV1,
} from "./index.js";

function firewall(overrides: Partial<FlowDeskAdvisoryOutputFirewallV1> = {}): FlowDeskAdvisoryOutputFirewallV1 {
	return {
		schema_version: "flowdesk.advisory_output_firewall.v1",
		advisory_ref: "advisory-score-1",
		workflow_id: "workflow-1",
		source_schema_version: "flowdesk.operational_intelligence_score.v1",
		allowed_consumer_refs: ["status-summary", "doctor-summary"],
		forbidden_consumers: [...FLOWDESK_ADVISORY_FORBIDDEN_CONSUMERS],
		advisory_only: true,
		guard_authority_enabled: false,
		approval_authority_enabled: false,
		dispatch_authority_enabled: false,
		verification_authority_enabled: false,
		external_write_authority_enabled: false,
		...overrides,
	};
}

function registryState(overrides: Partial<FlowDeskFederatedRegistryStateV1> = {}): FlowDeskFederatedRegistryStateV1 {
	return {
		schema_version: "flowdesk.federated_registry_state.v1",
		registry_state_id: "federated-state-1",
		workflow_id: "workflow-1",
		state: "disabled",
		policy_ref: "policy-federated-disabled",
		remote_upload_enabled: false,
		remote_download_enabled: false,
		planning_influence_enabled: false,
		ranking_influence_enabled: false,
		guard_influence_enabled: false,
		approval_influence_enabled: false,
		dispatch_influence_enabled: false,
		external_write_authority_enabled: false,
		...overrides,
	};
}

test("advisory output firewall bars operational intelligence from authority consumers", () => {
	assert.equal(validateFlowDeskAdvisoryOutputFirewallV1(firewall()).ok, true);

	const missingGuard = validateFlowDeskAdvisoryOutputFirewallV1(firewall({
		forbidden_consumers: FLOWDESK_ADVISORY_FORBIDDEN_CONSUMERS.filter((consumer) => consumer !== "guard"),
	}));
	assert.equal(missingGuard.ok, false);
	assert.match(missingGuard.errors.join("; "), /guard/);

	const authority = validateFlowDeskAdvisoryOutputFirewallV1({ ...firewall(), dispatch_authority_enabled: true });
	assert.equal(authority.ok, false);
	assert.match(authority.errors.join("; "), /cannot enable authority/);
});

test("federated registry disabled state cannot upload, download, influence, or write", () => {
	assert.equal(validateFlowDeskFederatedRegistryStateV1(registryState()).ok, true);

	const upload = validateFlowDeskFederatedRegistryStateV1({ ...registryState(), remote_upload_enabled: true });
	assert.equal(upload.ok, false);
	assert.match(upload.errors.join("; "), /sharing or influence/);

	const planning = validateFlowDeskFederatedRegistryStateV1({ ...registryState(), planning_influence_enabled: true });
	assert.equal(planning.ok, false);
	assert.match(planning.errors.join("; "), /sharing or influence/);

	const unknown = validateFlowDeskFederatedRegistryStateV1({ ...registryState(), score_upload_url: "https://example.com" });
	assert.equal(unknown.ok, false);
	assert.match(unknown.errors.join("; "), /unknown properties|raw payload/);
});
