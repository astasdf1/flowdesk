import assert from "node:assert/strict";
import test from "node:test";
import { validateFlowDeskPreDispatchAuditRecordV1 } from "./index.js";

function record(overrides: Record<string, unknown> = {}) {
	return {
		schema_version: "flowdesk.pre_dispatch_audit_record.v1",
		workflow_id: "workflow-1",
		pre_dispatch_audit_ref: "audit-predispatch-1",
		attempt_id: "attempt-1",
		binding_ref: "binding-provider-model-1",
		verification_ref: "verification-1",
		approval_source_ref: "approval-source-1",
		idempotency_ref: "idempotency-1",
		evidence_bundle_refs: ["evidence-bundle-1", "evidence-bundle-2"],
		redaction_validation_passed: true,
		auditor_observed_at: "2026-06-15T00:00:00.000Z",
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
		...overrides,
	};
}

test("pre-dispatch audit record accepts a valid complete record", () => {
	const result = validateFlowDeskPreDispatchAuditRecordV1(record());

	assert.equal(result.ok, true, result.errors.join("; "));
});

test("pre-dispatch audit record blocks missing required fields", () => {
	const invalidRecord: Record<string, unknown> = { ...record() };
	delete invalidRecord.verification_ref;

	const result = validateFlowDeskPreDispatchAuditRecordV1(invalidRecord);

	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /missing required fields: verification_ref/);
});

test("pre-dispatch audit record blocks failed redaction validation", () => {
	const result = validateFlowDeskPreDispatchAuditRecordV1(
		record({ redaction_validation_passed: false }),
	);

	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /redaction_validation_passed must be true/);
});

test("pre-dispatch audit record blocks forbidden raw payload fields", () => {
	const result = validateFlowDeskPreDispatchAuditRecordV1(
		record({ raw_provider_payload: "payload-ref-1" }),
	);

	assert.equal(result.ok, false);
	assert.match(result.errors.join("; "), /forbidden raw payload field/);
});
