import assert from "node:assert/strict";
import test from "node:test";
import { planFederatedPublicationV1 } from "./federated-registry-publisher.js";

test("planFederatedPublicationV1 composes valid publication intent and dry-run plan", async () => {
	const mockLedgerEntry = {
		schema_version: "flowdesk.advisory_score_ledger_entry.v1" as const,
		ledger_entry_id: "entry-1",
		workflow_id: "workflow-test",
		sequence: 0,
		recorded_at: new Date().toISOString(),
		event_kind: "workflow_plan_proposal" as const,
		event: {
			schema_version: "flowdesk.workflow_plan_proposal.v1" as const,
			proposal_id: "prop-1",
			workflow_id: "workflow-test",
			proposal_label: "test proposal",
			variant: "standard" as const,
			candidates: [{
				candidate_ref: "candidate-1",
				candidate_label: "candidate one",
				candidate_summary_ref: "summary-candidate-1",
				hard_filter_state: "passed" as const,
				blocked_labels: [],
			}],
			advisory_summary_ref: "summary-1",
			created_at: new Date().toISOString(),
			release_gate: "operational_intelligence_later_gate" as const,
			advisory_only: true as const,
			dispatch_authority_enabled: false as const,
			approval_authority_enabled: false as const,
			provider_authority_enabled: false as const,
			runtime_authority_enabled: false as const,
			external_write_authority_enabled: false as const,
			fallback_authority_enabled: false as const,
			lane_launch_authority_enabled: false as const,
		},
		local_only: true as const,
		append_only: true as const,
		non_authorizing: true as const,
		advisory_only: true as const,
		dispatch_authority_enabled: false as const,
		approval_authority_enabled: false as const,
		provider_authority_enabled: false as const,
		runtime_authority_enabled: false as const,
		external_write_authority_enabled: false as const,
		fallback_authority_enabled: false as const,
		lane_launch_authority_enabled: false as const,
	};

	const input = {
		workflowId: "workflow-test",
		requestId: "req-1",
		registryRef: "registry-1",
		ledgerEntries: [mockLedgerEntry],
		consentRecord: {
			schema_version: "flowdesk.federated_consent_record.v1" as const,
			consent_record_id: "consent-1",
			workflow_id: "workflow-test",
			consent_granted_at: new Date().toISOString(),
			consent_granted_by: "operator-config-ref",
			target_registry_ref: "registry-1",
			revocable: true as const,
			revoked: false,
			consent_scope: ["publish_scores" as const],
			retention_days: 14,
			installation_id_hash_ref: "hash-installation-1",
			advisory_only: true as const,
			non_authorizing: true as const,
			remote_write_authority_enabled: false as const,
			dispatch_authority_enabled: false as const,
		},
		canonicalRef: {
			schema_version: "flowdesk.federated_canonical_workflow_ref.v1" as const,
			canonical_ref_id: "ref-1",
			source_hash_ref: "hash-canonical-1",
			algorithm: "sha256" as const,
			input_fields_hashed: ["installation_id" as const, "workflow_id" as const],
			created_at: new Date().toISOString(),
			reversible: false as const,
			source_workflow_id_exposed: false as const,
			advisory_only: true as const,
			non_authorizing: true as const,
			remote_write_authority_enabled: false as const,
		},
		oauthArchitecture: {
			schema_version: "flowdesk.github_oauth_architecture.v1" as const,
			architecture_id: "arch-1",
			auth_scope_ref: "scope-github-repo-or-public-repo",
			required_github_scopes: ["repo" as const, "public_repo" as const],
			token_storage: "config_file_only" as const,
			token_ref: "token-1",
			auth_state: "configured" as const,
			dry_run_allowed_without_token: true,
			advisory_only: true as const,
			non_authorizing: true as const,
			provider_call_made: false as const,
			token_transmitted_in_evidence: false as const,
			remote_write_authority_enabled: false as const,
			dispatch_authority_enabled: false as const,
		},
		minimizationPolicy: {
			schema_version: "flowdesk.federated_data_minimization_policy.v1" as const,
			policy_id: "pol-1",
			workflow_id: "workflow-test",
			strip_workflow_id: true as const,
			strip_proposal_id: true as const,
			strip_task_descriptions: true as const,
			strip_model_names: true as const,
			publish_dimension_scores_as_buckets: true as const,
			score_bucket_size: 25 as const,
			publish_timestamp_resolution: "day" as const,
			canonical_workflow_ref_algorithm: "sha256" as const,
			k_anonymity_threshold: 10,
			created_at: new Date().toISOString(),
			advisory_only: true as const,
			non_authorizing: true as const,
			remote_write_authority_enabled: false as const,
			dispatch_authority_enabled: false as const,
		},
		optIn: true,
	};

	const result = planFederatedPublicationV1(input);
	if (!result.ok) {
		assert.fail(`Plan failed: ${(result as any).errors.join(", ")}`);
	}
	assert.equal(result.ok, true);
	assert.ok(result.intent);
	assert.equal(result.intent.state, "blocked");
	assert.ok(result.dryRunPlan);
	assert.equal(result.dryRunPlan.ok, true);
});
