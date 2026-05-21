import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
  applyFlowDeskSessionEvidenceWriteIntentsV1,
  FLOWDESK_SESSION_EVIDENCE_CLASSES,
  prepareFlowDeskSessionEvidenceWriteIntentV1,
  prepareFlowDeskDispatchIdempotencyReservationV1,
  reloadFlowDeskSessionEvidenceV1,
  sessionEvidenceDirectoryPath,
  sessionEvidenceRecordPath,
  summarizeFlowDeskSessionEvidenceInventoryV1
} from "./index.js";

const workflowId = "workflow-evidence-1";

function usageAuthorityRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
    authority_ref: "authority-ref-1",
    usage_snapshot_ref: "usage-snapshot-1",
    provider_family: "claude",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    model_family: "opus",
    source_kind: "provider_native",
    source_version_ref: "source-version-1",
    auth_profile_ref: "principal-scope-claude",
    auth_evidence_ref: "auth-evidence-claude",
    credential_scope_ref: "principal-scope-claude",
    account_boundary_ref: "account-boundary-claude",
    quota_evidence_ref: "quota-evidence-claude",
    usage_acquired: true,
    reset_time: "2026-05-19T01:00:00.000Z",
    reset_bucket: "claude-weekly",
    source_ref: "usage-source-claude",
    conformance_ref: "usage-conformance-claude",
    redacted_evidence_refs: ["redacted-evidence-claude-1"],
    trusted: true,
    observed_at: "2026-05-19T00:00:00.000Z",
    expires_at: "2026-05-19T05:00:00.000Z",
    ...overrides
  };
}

function runtimeEchoRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
    runtime_echo_ref: "runtime-echo-ref-1",
    workflow_id: workflowId,
    step_id: "step-1",
    attempt_id: "attempt-1",
    provider_family: "claude",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    runtime_capability_ref: "runtime-capability-1",
    conformance_ref: "conformance-1",
    runtime_echo_mode: "trusted",
    trusted: true,
    observed_at: "2026-05-19T00:00:00.000Z",
    expires_at: "2026-05-19T05:00:00.000Z",
    ...overrides
  };
}

function telemetryRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
    telemetry_ref: "telemetry-ref-1",
    workflow_id: workflowId,
    step_id: "step-1",
    attempt_id: "attempt-1",
    event_telemetry_mode: "sufficient",
    correlation_count: 3,
    ambiguous: false,
    source_refs: ["telemetry-source-1"],
    ...overrides
  };
}

function productionApprovalSourceRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.production_approval_source.v1",
    approval_id: "approval-1",
    workflow_id: workflowId,
    attempt_id: "attempt-1",
    action_type: "managed_dispatch_beta",
    issuer_boundary: "external_user_confirmation",
    approval_method: "typed_phrase",
    actor_ref: "actor-user-1",
    profile_ref: "principal-scope-claude",
    provider_qualified_model_id: "claude/claude-opus-4-5",
    provider_binding_hash: "hash-provider-binding-1",
    evidence_bundle_hash: "hash-evidence-bundle-1",
    guard_decision_ref: "guard-decision-1",
    issuance_audit_ref: "audit-issuance-1",
    nonce_ref: "nonce-1",
    issued_at: "2026-05-19T00:00:00.000Z",
    expires_at: "2026-05-19T05:00:00.000Z",
    revoked: false,
    consume_strategy: "atomic_compare_and_swap_required",
    dispatch_authority_enabled: false,
    ...overrides
  };
}

function preDispatchAuditRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.pre_dispatch_audit_record.v1",
    workflow_id: workflowId,
    pre_dispatch_audit_ref: "audit-predispatch-1",
    observed_at: "2026-05-19T00:00:00.000Z",
    ...overrides
  };
}

function dispatchIdempotencyRecord(overrides: Record<string, unknown> = {}) {
  return {
    schema_version: "flowdesk.dispatch_idempotency_snapshot.v1",
    workflow_id: workflowId,
    snapshot_ref: "idempotency-snapshot-1",
    observed_at: "2026-05-19T00:00:00.000Z",
    entries: [],
    dispatch_authority_enabled: false,
    realOpenCodeDispatch: false,
    actualLaneLaunch: false,
    providerCall: false,
    runtimeExecution: false,
    ...overrides
  };
}

test("session evidence path builders produce per-class relative paths", () => {
  for (const evidenceClass of FLOWDESK_SESSION_EVIDENCE_CLASSES) {
    const dir = sessionEvidenceDirectoryPath(workflowId, evidenceClass);
    assert.ok(dir.startsWith(`.flowdesk/sessions/${workflowId}/evidence/`));
    const record = sessionEvidenceRecordPath(workflowId, evidenceClass, "evidence-1");
    assert.ok(record.startsWith(dir));
    assert.ok(record.endsWith("/evidence-1.json"));
  }
});

test("session evidence write intent succeeds for valid usage authority records", () => {
  const result = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
  assert.equal(result.ok, true, result.errors.join("; "));
  const intent = result.writeIntent;
  assert.ok(intent);
  assert.equal(intent.evidenceClass, "usage_authority");
  assert.equal(intent.authority, "redacted_session_support");
  assert.equal(intent.realOpenCodeDispatch, false);
  assert.equal(intent.actualLaneLaunch, false);
  assert.equal(intent.providerCall, false);
  assert.equal(intent.runtimeExecution, false);
  assert.ok(intent.path.startsWith(`.flowdesk/sessions/${workflowId}/evidence/usage-authority/`));
  assert.ok(intent.tempPath.startsWith(`${intent.path}.tmp-`));
});

test("session evidence write intent succeeds for production approval source records", () => {
  const result = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "approval-source-1", record: productionApprovalSourceRecord() });
  assert.equal(result.ok, true, result.errors.join("; "));
  const intent = result.writeIntent;
  assert.ok(intent);
  assert.equal(intent.evidenceClass, "production_approval_source");
  assert.equal(intent.schemaId, "flowdesk.production_approval_source.v1");
  assert.equal(intent.providerCall, false);
  assert.ok(intent.path.startsWith(`.flowdesk/sessions/${workflowId}/evidence/production-approval-source/`));
});

test("session evidence write intent rejects schema version mismatch and authority leaks", () => {
  const wrongSchema = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: { ...usageAuthorityRecord(), schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v2" } });
  assert.equal(wrongSchema.ok, false);

  const unknownSchema = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: { schema_version: "flowdesk.unknown.v1" } });
  assert.equal(unknownSchema.ok, false);

  const wrongWorkflow = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: runtimeEchoRecord({ workflow_id: "workflow-other" }) });
  assert.equal(wrongWorkflow.ok, false);

  const promptLeak = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: { ...usageAuthorityRecord(), source_ref: "system prompt: hidden" } });
  assert.equal(promptLeak.ok, false);
});

test("session evidence write intent rejects malformed ids", () => {
  const badEvidence = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "../escape", record: usageAuthorityRecord() });
  assert.equal(badEvidence.ok, false);

  const badWorkflow = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId: "../escape", evidenceId: "evidence-1", record: usageAuthorityRecord() });
  assert.equal(badWorkflow.ok, false);

  const nonObject = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: "not-an-object" as unknown as Record<string, unknown> });
  assert.equal(nonObject.ok, false);
});

test("session evidence apply writes intents durably and reloads them", () => {
  withEvidenceTree((rootDir) => {
    const records = [usageAuthorityRecord(), runtimeEchoRecord(), telemetryRecord(), productionApprovalSourceRecord(), dispatchIdempotencyRecord(), preDispatchAuditRecord()];
    const intents = records.map((record, index) => {
      const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: `evidence-${index + 1}`, record });
      assert.equal(prepared.ok, true, prepared.errors.join("; "));
      assert.ok(prepared.writeIntent);
      return prepared.writeIntent;
    });

    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, intents);
    assert.equal(applied.ok, true, applied.errors.join("; "));
    assert.equal(applied.writtenPaths.length, 6);
    assert.equal(applied.providerCall, false);
    assert.equal(applied.runtimeExecution, false);

    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
    assert.equal(reloaded.entries.length, 6);
    assert.deepEqual(new Set(reloaded.entries.map((entry) => entry.evidenceClass)), new Set(["usage_authority", "runtime_echo", "telemetry_correlation", "production_approval_source", "dispatch_idempotency", "pre_dispatch_audit"]));
  });
});

test("session evidence reload validates dispatch idempotency snapshots", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "dispatch_idempotency", "idempotency-good"), JSON.stringify(dispatchIdempotencyRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "dispatch_idempotency", "idempotency-forged"), JSON.stringify(dispatchIdempotencyRecord({ providerCall: true })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "dispatch_idempotency");
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /cannot enable runtime authority/);
  });
});

test("session evidence materializes prepared dispatch idempotency reservations", () => {
  withEvidenceTree((rootDir) => {
    const reservation = prepareFlowDeskDispatchIdempotencyReservationV1({
      workflowId,
      attemptId: "attempt-1",
      idempotencyKey: "idempotency-1",
      snapshotRef: "idempotency-snapshot-1",
      reservedAt: "2026-05-19T00:01:00.000Z"
    });
    assert.equal(reservation.reservation_prepared, true, reservation.errors.join("; "));
    assert.ok(reservation.snapshot);
    const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "idempotency-snapshot-1", record: reservation.snapshot });
    assert.equal(prepared.ok, true, prepared.errors.join("; "));
    assert.ok(prepared.writeIntent);
    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
    assert.equal(applied.ok, true, applied.errors.join("; "));
    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(reloaded.ok, true, reloaded.errors.join("; "));
    assert.equal(reloaded.entries.length, 1);
    assert.equal(reloaded.entries[0].evidenceClass, "dispatch_idempotency");
    assert.equal((reloaded.entries[0].record.entries as Array<{ state: string }>)[0].state, "reserved");
  });
});

test("session evidence reload validates durable production approval sources", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval_source", "approval-good"), JSON.stringify(productionApprovalSourceRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval_source", "approval-forged"), JSON.stringify(productionApprovalSourceRecord({ dispatch_authority_enabled: true })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "production_approval_source", "approval-profile"), JSON.stringify(productionApprovalSourceRecord({ profile_ref: "profile-other" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir, expectedProfileRef: "principal-scope-claude" });
    assert.equal(result.entries.length, 1);
    assert.equal(result.entries[0].evidenceClass, "production_approval_source");
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((blocked) => blocked.reason).join("|");
    assert.match(reasons, /cannot enable dispatch authority/);
    assert.match(reasons, /profile_ref mismatch/);
  });
});

test("session evidence apply prevalidates forged intents before writing any entries", () => {
  withEvidenceTree((rootDir) => {
    const first = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
    const forged = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-2", record: runtimeEchoRecord() });
    assert.ok(first.writeIntent);
    assert.ok(forged.writeIntent);
    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [
      first.writeIntent,
      { ...forged.writeIntent, path: sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-other") }
    ]);
    assert.equal(applied.ok, false);
    assert.equal(applied.writtenPaths.length, 0);
    assert.match(applied.errors.join("; "), /path does not match/);

    const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(reloaded.entries.length, 0);
  });
});

test("session evidence apply rejects duplicate target paths before writing", () => {
  withEvidenceTree((rootDir) => {
    const first = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
    const second = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord({ authority_ref: "authority-ref-2" }) });
    assert.ok(first.writeIntent);
    assert.ok(second.writeIntent);
    const duplicateTarget = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [first.writeIntent, second.writeIntent]);
    assert.equal(duplicateTarget.ok, false);
    assert.match(duplicateTarget.errors.join("; "), /duplicate target path/);
    assert.deepEqual(duplicateTarget.writtenPaths, []);
  });
});

test("session evidence apply rejects escaping temp paths", () => {
  withEvidenceTree((rootDir) => {
    const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId: "evidence-1", record: usageAuthorityRecord() });
    assert.ok(prepared.writeIntent);
    const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [{ ...prepared.writeIntent, tempPath: `${prepared.writeIntent.path}.tmp-../../escape` }]);
    assert.equal(applied.ok, false);
    assert.deepEqual(applied.writtenPaths, []);
  });
});

function withEvidenceTree(callback: (rootDir: string) => void): void {
  const rootDir = mkdtempSync(join(tmpdir(), "flowdesk-evidence-"));
  try {
    callback(rootDir);
  } finally {
    rmSync(rootDir, { recursive: true, force: true });
  }
}

function writeEvidenceFile(rootDir: string, relativePath: string, content: string): void {
  const absolute = join(rootDir, relativePath);
  mkdirSync(join(absolute, ".."), { recursive: true });
  writeFileSync(absolute, content, "utf8");
}

test("session evidence reload returns empty entries when the directory does not exist", () => {
  withEvidenceTree((rootDir) => {
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true);
    assert.deepEqual(result.entries, []);
    assert.deepEqual(result.blocked, []);
    assert.equal(result.realOpenCodeDispatch, false);
  });
});

test("session evidence reload reads validated records and ignores valid foreign files", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "usage_authority", "evidence-1"), JSON.stringify(usageAuthorityRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-1"), JSON.stringify(runtimeEchoRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "telemetry_correlation", "evidence-1"), JSON.stringify(telemetryRecord()));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.ok, true, result.errors.join("; "));
    assert.equal(result.entries.length, 3);
    const classes = new Set(result.entries.map((entry) => entry.evidenceClass));
    assert.deepEqual([...classes].sort(), ["runtime_echo", "telemetry_correlation", "usage_authority"]);
  });
});

test("session evidence reload fails closed on malformed JSON and schema mismatch", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "usage_authority", "evidence-malformed"), "{not json");
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-mismatch"), JSON.stringify(usageAuthorityRecord()));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "telemetry_correlation", "evidence-workflow"), JSON.stringify(telemetryRecord({ workflow_id: "workflow-other" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 3);
    const reasons = result.blocked.map((blocked) => blocked.reason).join("|");
    assert.match(reasons, /JSON|json|parse/);
    assert.match(reasons, /schema_version/);
    assert.match(reasons, /workflow_id mismatch/);
    assert.equal(result.realOpenCodeDispatch, false);
    assert.equal(result.actualLaneLaunch, false);
  });
});

test("session evidence reload rejects path-shaped evidence_id and root escape", () => {
  withEvidenceTree((rootDir) => {
    const traversalFile = join(rootDir, sessionEvidenceDirectoryPath(workflowId, "usage_authority"), "..escape.json");
    mkdirSync(join(traversalFile, ".."), { recursive: true });
    writeFileSync(traversalFile, JSON.stringify(usageAuthorityRecord()), "utf8");
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /not schema-safe|outside 3..128|must not contain paths/);
  });
});

test("session evidence reload fails closed when evidence root is a symlink to outside", () => {
  withEvidenceTree((rootDir) => {
    const evidenceDir = join(rootDir, sessionEvidenceDirectoryPath(workflowId, "telemetry_correlation"));
    mkdirSync(join(evidenceDir, ".."), { recursive: true });
    const outside = mkdtempSync(join(tmpdir(), "flowdesk-evidence-outside-"));
    try {
      writeFileSync(join(outside, "evidence-outside.json"), JSON.stringify(telemetryRecord()), "utf8");
      symlinkSync(outside, evidenceDir, "dir");
      const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
      assert.equal(result.entries.length, 0);
      assert.equal(result.errors.length === 0 ? result.blocked.length > 0 : true, true);
    } finally {
      rmSync(outside, { recursive: true, force: true });
    }
  });
});

test("session evidence reload can reject stale and cross-profile evidence", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "usage_authority", "evidence-stale"), JSON.stringify(usageAuthorityRecord({ expires_at: "2026-05-19T00:01:00.000Z" })));
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "runtime_echo", "evidence-profile"), JSON.stringify(runtimeEchoRecord({ auth_profile_ref: "profile-other", expires_at: "2026-05-22T00:01:00.000Z" })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir, rejectStaleAt: "2026-05-20T00:00:00.000Z", expectedProfileRef: "principal-scope-claude" });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 2);
    const reasons = result.blocked.map((blocked) => blocked.reason).join("|");
    assert.match(reasons, /stale/);
    assert.match(reasons, /profile_ref mismatch/);
  });
});

test("session evidence reload blocks redaction failures and reports inventory", () => {
  withEvidenceTree((rootDir) => {
    writeEvidenceFile(rootDir, sessionEvidenceRecordPath(workflowId, "telemetry_correlation", "evidence-redacted"), JSON.stringify(telemetryRecord({ source_refs: ["Bearer secret-token"] })));
    const result = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir });
    assert.equal(result.entries.length, 0);
    assert.equal(result.blocked.length, 1);
    assert.match(result.blocked[0].reason, /forbidden raw payload|token|credential-shaped/i);

    const inventory = summarizeFlowDeskSessionEvidenceInventoryV1(workflowId, result);
    assert.equal(inventory.schema_version, "flowdesk.session_evidence_inventory.v1");
    assert.equal(inventory.total_entries, 0);
    assert.equal(inventory.total_blocked, 1);
    assert.equal(inventory.providerCall, false);
    const telemetry = inventory.classes.find((entry) => entry.evidenceClass === "telemetry_correlation");
    assert.equal(telemetry?.blocked, 1);
    assert.match(telemetry?.lastBlockedReason ?? "", /forbidden raw payload|token|credential-shaped/i);
  });
});
