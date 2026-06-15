import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";
import { test } from "node:test";
import type { FlowDeskControlledConformanceDocWriteRecordV1 } from "./controlled-conformance-doc-write.js";
import type { FlowDeskControlledRedactedAuditExportWriteRecordV1 } from "./controlled-redacted-audit-export-write.js";
import {
	consumeFlowDeskProductionApprovalSourceV1,
	type FlowDeskProductionApprovalSourceV1,
} from "./production-approval-source.js";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
} from "./session-evidence.js";
import { sessionEvidenceRecordPath } from "./state-paths.js";

const workflowId = "workflow-controlled-local-write-smoke";
const attemptId = "attempt-controlled-local-write-smoke";
const actorRef = "actor-controlled-local-write-smoke";
const profileRef = "profile-controlled-local-write-smoke";
const providerQualifiedModelId = "openai/gpt-5.5";
const providerBindingHash = "hash-provider-binding-controlled-local-write-smoke";
const evidenceBundleHash = "hash-evidence-bundle-controlled-local-write-smoke";
const guardDecisionRef = "guard-decision-controlled-local-write-smoke";
const approvalId = "approval-controlled-local-write-smoke";
const issuanceAuditRef = "audit-issuance-controlled-local-write-smoke";
const consumptionAuditRef = "audit-consumption-controlled-local-write-smoke";
const materializedAt = "2026-06-15T00:00:00.000Z";

type ControlledLocalWriteRecord =
	| FlowDeskControlledConformanceDocWriteRecordV1
	| FlowDeskControlledRedactedAuditExportWriteRecordV1;

function withTempRoot(run: (rootDir: string) => void): void {
	const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-controlled-local-write-"));
	try {
		run(rootDir);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
}

function baseApproval(): FlowDeskProductionApprovalSourceV1 {
	return {
		schema_version: "flowdesk.production_approval_source.v1",
		approval_id: approvalId,
		workflow_id: workflowId,
		attempt_id: attemptId,
		action_type: "external_write",
		issuer_boundary: "external_user_confirmation",
		approval_method: "typed_phrase",
		actor_ref: actorRef,
		profile_ref: profileRef,
		provider_qualified_model_id: providerQualifiedModelId,
		provider_binding_hash: providerBindingHash,
		evidence_bundle_hash: evidenceBundleHash,
		guard_decision_ref: guardDecisionRef,
		issuance_audit_ref: issuanceAuditRef,
		nonce_ref: "nonce-controlled-local-write-smoke",
		issued_at: "2026-06-14T23:59:00.000Z",
		expires_at: "2026-06-15T00:29:00.000Z",
		revoked: false,
		consume_strategy: "atomic_compare_and_swap_required",
		dispatch_authority_enabled: false,
	};
}

function consumedExternalWriteApproval(): FlowDeskProductionApprovalSourceV1 {
	const consumed = consumeFlowDeskProductionApprovalSourceV1({
		approval: baseApproval(),
		workflowId,
		attemptId,
		actionType: "external_write",
		actorRef,
		profileRef,
		providerQualifiedModelId,
		providerBindingHash,
		evidenceBundleHash,
		guardDecisionRef,
		consumptionAuditRef,
		consumedAt: materializedAt,
	});
	assert.equal(consumed.state, "consumed", consumed.errors.join("; "));
	assert.ok(consumed.consumed_approval);
	return consumed.consumed_approval;
}

function authorityDisabledRecordFields() {
	return {
		local_only: true,
		writeAttempted: true,
		remoteWriteAttempted: false,
		githubWriteAttempted: false,
		connectorWriteAttempted: false,
		storageWriteAttempted: false,
		databaseWriteAttempted: false,
		urlWriteAttempted: false,
		rawPathWriteAttempted: false,
		dispatch_authority_enabled: false,
		realOpenCodeDispatch: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		fallbackAuthority: false,
		toolAuthority: false,
		hardCancelOrNoReplyAuthority: false,
	} as const;
}

function conformanceDocWriteRecord(): FlowDeskControlledConformanceDocWriteRecordV1 {
	const targetRef = "release-conformance-doc-controlled-local-write-smoke";
	return {
		schema_version: "flowdesk.controlled_conformance_doc_write.v1",
		ledger_entry_id: "ledger-conformance-doc-controlled-local-write-smoke",
		request_id: "request-conformance-doc-controlled-local-write-smoke",
		workflow_id: workflowId,
		attempt_id: attemptId,
		target_kind: "release_conformance_doc",
		target_ref: targetRef,
		approval_id: approvalId,
		actor_ref: actorRef,
		profile_ref: profileRef,
		evidence_bundle_hash: evidenceBundleHash,
		guard_decision_ref: guardDecisionRef,
		issuance_audit_ref: issuanceAuditRef,
		consumption_audit_ref: consumptionAuditRef,
		redaction_policy_ref: "redaction-policy-controlled-local-write-smoke",
		content_hash_ref: "sha256-controlled-local-write-smoke",
		pre_write_audit_ref: "audit-prewrite-controlled-local-write-smoke",
		dry_run_ref: "dry-run-controlled-local-write-smoke",
		artifact_ref: "artifact-conformance-doc-controlled-local-write-smoke",
		artifact_path: `docs/conformance/${targetRef}.md`,
		artifact_sha256_ref: "sha256-controlled-local-write-smoke",
		materialized_at: materializedAt,
		...authorityDisabledRecordFields(),
	};
}

function redactedAuditExportWriteRecord(): FlowDeskControlledRedactedAuditExportWriteRecordV1 {
	const targetRef = "redacted-audit-export-controlled-local-write-smoke";
	return {
		schema_version: "flowdesk.controlled_redacted_audit_export_write.v1",
		ledger_entry_id: "ledger-redacted-audit-controlled-local-write-smoke",
		request_id: "request-redacted-audit-controlled-local-write-smoke",
		workflow_id: workflowId,
		attempt_id: attemptId,
		target_kind: "redacted_audit_export",
		target_ref: targetRef,
		approval_id: approvalId,
		actor_ref: actorRef,
		profile_ref: profileRef,
		evidence_bundle_hash: evidenceBundleHash,
		guard_decision_ref: guardDecisionRef,
		issuance_audit_ref: issuanceAuditRef,
		consumption_audit_ref: consumptionAuditRef,
		redaction_policy_ref: "redaction-policy-controlled-local-write-smoke",
		content_hash_ref: "sha256-controlled-local-write-smoke",
		pre_write_audit_ref: "audit-prewrite-controlled-local-write-smoke",
		dry_run_ref: "dry-run-controlled-local-write-smoke",
		artifact_ref: "artifact-redacted-audit-controlled-local-write-smoke",
		artifact_path: `.flowdesk/sessions/${workflowId}/redacted-audit/${targetRef}.json`,
		artifact_sha256_ref: "sha256-controlled-local-write-smoke",
		materialized_at: materializedAt,
		redacted: true,
		...authorityDisabledRecordFields(),
	};
}

function writeControlledLocalEvidence(input: {
	rootDir: string;
	evidenceId: string;
	record: ControlledLocalWriteRecord;
	consumedApproval?: FlowDeskProductionApprovalSourceV1;
}) {
	const approval = input.consumedApproval;
	if (approval === undefined) {
		return {
			state: "blocked" as const,
			writtenPaths: [] as string[],
			errors: ["consumed external_write approval is required"],
		};
	}
	const errors: string[] = [];
	if (approval.action_type !== "external_write") errors.push("approval action_type must be external_write");
	if (approval.consumed_at === undefined) errors.push("approval must be consumed");
	if (approval.approval_id !== input.record.approval_id) errors.push("approval_id mismatch");
	if (approval.workflow_id !== input.record.workflow_id) errors.push("workflow_id mismatch");
	if (approval.attempt_id !== input.record.attempt_id) errors.push("attempt_id mismatch");
	if (approval.actor_ref !== input.record.actor_ref) errors.push("actor_ref mismatch");
	if (approval.profile_ref !== input.record.profile_ref) errors.push("profile_ref mismatch");
	if (approval.evidence_bundle_hash !== input.record.evidence_bundle_hash)
		errors.push("evidence_bundle_hash mismatch");
	if (approval.guard_decision_ref !== input.record.guard_decision_ref)
		errors.push("guard_decision_ref mismatch");
	if (approval.issuance_audit_ref !== input.record.issuance_audit_ref)
		errors.push("issuance_audit_ref mismatch");
	if (approval.consumption_audit_ref !== input.record.consumption_audit_ref)
		errors.push("consumption_audit_ref mismatch");
	if (errors.length > 0) {
		return { state: "blocked" as const, writtenPaths: [] as string[], errors };
	}

	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.record.workflow_id,
		evidenceId: input.evidenceId,
		record: input.record as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined) {
		return { state: "blocked" as const, writtenPaths: [] as string[], errors: prepared.errors };
	}
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [
		prepared.writeIntent,
	]);
	return {
		state: applied.ok ? ("written" as const) : ("blocked" as const),
		writtenPaths: applied.writtenPaths,
		errors: applied.errors,
	};
}

function assertControlledWriteAuthorities(record: Record<string, unknown>): void {
	assert.equal(record.dispatch_authority_enabled, false);
	assert.equal(record.providerCall, false);
	assert.equal(record.actualLaneLaunch, false);
	assert.equal(record.runtimeExecution, false);
}

test("valid conformance doc local write is reloadable and local-only", () => {
	withTempRoot((rootDir) => {
		const result = writeControlledLocalEvidence({
			rootDir,
			evidenceId: "controlled-conformance-doc-write-smoke",
			record: conformanceDocWriteRecord(),
			consumedApproval: consumedExternalWriteApproval(),
		});
		assert.equal(result.state, "written", result.errors.join("; "));

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
		assert.equal(reloaded.entries.length, 1);
		assert.equal(reloaded.entries[0]?.evidenceClass, "controlled_conformance_doc_write");
		const record = reloaded.entries[0]?.record;
		assert.equal(record?.local_only, true);
		assert.equal(record?.remoteWriteAttempted, false);
	});
});

test("valid redacted audit export local write is reloadable and local-only", () => {
	withTempRoot((rootDir) => {
		const result = writeControlledLocalEvidence({
			rootDir,
			evidenceId: "controlled-redacted-audit-export-write-smoke",
			record: redactedAuditExportWriteRecord(),
			consumedApproval: consumedExternalWriteApproval(),
		});
		assert.equal(result.state, "written", result.errors.join("; "));

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
		assert.equal(reloaded.entries.length, 1);
		assert.equal(reloaded.entries[0]?.evidenceClass, "controlled_redacted_audit_export_write");
		const record = reloaded.entries[0]?.record;
		assert.equal(record?.local_only, true);
		assert.equal(record?.remoteWriteAttempted, false);
	});
});

test("controlled local write without consumed approval is blocked and writes no evidence", () => {
	withTempRoot((rootDir) => {
		const evidenceId = "controlled-conformance-doc-write-missing-approval";
		const result = writeControlledLocalEvidence({
			rootDir,
			evidenceId,
			record: conformanceDocWriteRecord(),
		});
		assert.equal(result.state, "blocked");
		assert.deepEqual(result.writtenPaths, []);
		assert.match(result.errors.join("; "), /approval is required/);
		assert.equal(
			existsSync(
				join(
					rootDir,
					sessionEvidenceRecordPath(
						workflowId,
						"controlled_conformance_doc_write",
						evidenceId,
					),
				),
			),
			false,
		);

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
		assert.equal(reloaded.entries.length, 0);
	});
});

test("controlled local write records never enable dispatch, provider, lane, or runtime authority", () => {
	withTempRoot((rootDir) => {
		const conformance = writeControlledLocalEvidence({
			rootDir,
			evidenceId: "controlled-conformance-doc-write-authority-smoke",
			record: conformanceDocWriteRecord(),
			consumedApproval: consumedExternalWriteApproval(),
		});
		const redactedAudit = writeControlledLocalEvidence({
			rootDir,
			evidenceId: "controlled-redacted-audit-export-write-authority-smoke",
			record: redactedAuditExportWriteRecord(),
			consumedApproval: consumedExternalWriteApproval(),
		});
		assert.equal(conformance.state, "written", conformance.errors.join("; "));
		assert.equal(redactedAudit.state, "written", redactedAudit.errors.join("; "));

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
		assert.equal(reloaded.entries.length, 2);
		for (const entry of reloaded.entries) assertControlledWriteAuthorities(entry.record);
	});
});
