import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import type {
  DoctorFailureCategoryV1,
  DoctorSectionResultV1,
  FlowDeskBootstrapBackupManifestV1,
  FlowDeskBootstrapInstallPlanV1,
  FlowDeskBootstrapReportV1,
  FlowDeskBootstrapRollbackPlanV1,
  FlowDeskBootstrapRollbackResultV1,
  FlowDeskCommandGenerationSummaryV1,
  FlowDeskConfigScaffoldSummaryV1,
  FlowDeskDoctorHandoffV1,
  FlowDeskDoctorReportV1,
  FlowDeskDoctorResponseV1,
  FlowDeskOmoCleanupSummaryV1,
  FlowDeskRelease2ManagedDispatchGatePromotionReadinessV1,
  FlowDeskRelease2Phase6AClosureEvidenceV1,
  FlowDeskProfileMutationSummaryV1
} from "./index.js";
import {
  applyBootstrapWriteIntentsToDurableState,
  applyBootstrapWriteIntentsToInMemoryState,
  buildDoctorSectionResultV1,
  DOCTOR_FAILURE_CATEGORIES,
  getDoctorFailureCategoryOutcomeV1,
  getRelease1ProductionToolRegistry,
  prepareRedactedBootstrapArtifactWriteIntent,
  RELEASE_1_SCHEMA_ARTIFACTS,
  validateBootstrapBackupManifestV1,
  validateBootstrapFailureEvidenceV1,
  validateBootstrapInstallPlanV1,
  validateBootstrapReportV1,
  validateBootstrapRollbackPlanV1,
  validateBootstrapRollbackResultV1,
  validateCommandGenerationSummaryV1,
  validateConfigScaffoldSummaryV1,
  validateDoctorHandoffV1,
  validateDoctorReportV1,
  validateDoctorResponseV1,
  validateFlowDeskBootstrapArtifactV1,
  validateOmoCleanupSummaryV1,
  validateProfileMutationSummaryV1,
  validateRedactedBootstrapArtifactWriteIntent,
} from "./index.js";

const now = "2026-05-17T00:00:00.000Z";

function installPlan(): FlowDeskBootstrapInstallPlanV1 {
  return {
    schema_version: "flowdesk.bootstrap_install_plan.v1",
    install_plan_id: "install-plan-123",
    created_at: now,
    target_profile_ref: "profile-123",
    release_mode: "release1",
    planned_phases: ["preflight", "backup", "profile_mutation", "omo_cleanup", "plugin_registration", "command_generation", "config_scaffold", "doctor_handoff"],
    requires_typed_confirmation: true,
    confirmation_ref: "confirmation-123",
    package_ref: "package-123",
    rollback_plan_ref: "rollback-plan-123",
    safe_next_actions: ["/flowdesk-doctor"]
  };
}

function backupManifest(): FlowDeskBootstrapBackupManifestV1 {
  return {
    schema_version: "flowdesk.bootstrap_backup_manifest.v1",
    backup_manifest_id: "backup-123",
    created_at: now,
    target_profile_ref: "profile-123",
    backup_ref: "backup-ref-123",
    backup_hash: "backup-hash-123",
    source_config_ref: "source-config-123",
    credential_preservation_check: "passed",
    restore_eligible: true,
    audit_ref: "audit-123"
  };
}

function profileMutation(): FlowDeskProfileMutationSummaryV1 {
  return {
    schema_version: "flowdesk.profile_mutation_summary.v1",
    mutation_id: "mutation-123",
    target_profile_ref: "profile-123",
    status: "applied",
    changed_entry_refs: ["changed-123"],
    skipped_entry_refs: ["skipped-123"],
    provider_auth_preserved: "passed",
    unrelated_profile_mutation: false,
    backup_manifest_ref: "backup-123",
    audit_ref: "audit-123"
  };
}

function cleanupSummary(): FlowDeskOmoCleanupSummaryV1 {
  return {
    schema_version: "flowdesk.omo_cleanup_summary.v1",
    cleanup_id: "cleanup-123",
    target_profile_ref: "profile-123",
    status: "applied",
    removed_ref_count: 2,
    retained_ref_count: 1,
    blocked_ref_count: 0,
    omitted_legacy_runtime_imports: true,
    provider_auth_preserved: "passed",
    backup_manifest_ref: "backup-123",
    audit_ref: "audit-123"
  };
}

function commandGeneration(): FlowDeskCommandGenerationSummaryV1 {
  return {
    schema_version: "flowdesk.command_generation_summary.v1",
    generation_id: "generation-123",
    target_profile_ref: "profile-123",
    status: "applied",
    command_refs: ["command-123"],
    template_hash: "template-hash-123",
    static_template_validation: "passed",
    rollback_ref: "rollback-command-123"
  };
}

function configScaffold(): FlowDeskConfigScaffoldSummaryV1 {
  return {
    schema_version: "flowdesk.config_scaffold_summary.v1",
    scaffold_id: "scaffold-123",
    status: "applied",
    config_ref: "config-123",
    config_hash: "config-hash-123",
    policy_pack_refs: ["policy-pack-123"],
    policy_pack_hashes: ["policy-hash-123"],
    audit_ref: "audit-123"
  };
}

function rollbackPlan(): FlowDeskBootstrapRollbackPlanV1 {
  return {
    schema_version: "flowdesk.bootstrap_rollback_plan.v1",
    rollback_plan_id: "rollback-plan-123",
    install_plan_id: "install-plan-123",
    target_profile_ref: "profile-123",
    backup_manifest_ref: "backup-123",
    reversible_phase_refs: ["phase-backup-123"],
    non_reversible_summary_refs: ["summary-non-reversible-123"],
    restore_preconditions: [{ check: "audit", required: true, ref: "precondition-123" }],
    safe_next_actions: ["/flowdesk-doctor"]
  };
}

function rollbackResult(): FlowDeskBootstrapRollbackResultV1 {
  return {
    schema_version: "flowdesk.bootstrap_rollback_result.v1",
    rollback_result_id: "rollback-result-123",
    rollback_plan_id: "rollback-plan-123",
    completed_at: now,
    status: "restored",
    restored_ref_count: 1,
    skipped_ref_count: 0,
    warning_count: 0,
    audit_refs: ["audit-123"],
    safe_next_actions: ["/flowdesk-doctor"]
  };
}

function doctorSection(category: DoctorFailureCategoryV1): DoctorSectionResultV1 {
  const sectionByCategory: Record<DoctorFailureCategoryV1, DoctorSectionResultV1["section"]> = {
    dispatch_blocking: "policy_project_safety",
    chat_mode_disable: "opencode_plugin_compatibility",
    degraded_mode_warning: "provider_usage_readiness",
    informational: "migration_cleanup"
  };
  return buildDoctorSectionResultV1({
    run_id: "doctor-run-123",
    section: sectionByCategory[category],
    category,
    summary: `${category} diagnostic result`,
    refs: [`doctor-${category}-123`],
    redaction_version: "redaction-v1"
  });
}

function doctorDisabledModesFor(category: DoctorFailureCategoryV1): FlowDeskDoctorReportV1["disabled_modes"] {
  return getDoctorFailureCategoryOutcomeV1(category).disabled_modes;
}

function bootstrapReport(): FlowDeskBootstrapReportV1 {
  return {
    schema_version: "flowdesk.bootstrap_report.v1",
    report_id: "report-123",
    install_plan_id: "install-plan-123",
    target_profile_ref: "profile-123",
    started_at: now,
    completed_at: now,
    final_phase: "complete",
    status: "complete",
    failure_class: "unknown",
    backup_manifest_ref: "backup-123",
    profile_mutation_ref: "mutation-123",
    omo_cleanup_ref: "cleanup-123",
    command_generation_ref: "generation-123",
    config_scaffold_ref: "scaffold-123",
    rollback_plan_ref: "rollback-plan-123",
    rollback_result_ref: "rollback-result-123",
    doctor_handoff_ref: "handoff-123",
    doctor_report_ref: "doctor-run-123",
    disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"],
    safe_next_actions: ["/flowdesk-doctor"],
    audit_refs: ["audit-123"]
  };
}

function doctorReport(): FlowDeskDoctorReportV1 {
  return {
    schema_version: "flowdesk.doctor_report.v1",
    run_id: "doctor-run-123",
    checked_at: now,
    profile: "production",
    category_results: [doctorSection("informational")],
    disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"],
    compatibility_ref: "compatibility-123",
    safe_next_actions: ["/flowdesk-status"]
  };
}

function doctorResponse(category: DoctorFailureCategoryV1): FlowDeskDoctorResponseV1 {
  return {
    schema_version: "flowdesk.doctor.response.v1",
    ok: category !== "dispatch_blocking",
    status: category === "dispatch_blocking" ? "blocked" : category === "degraded_mode_warning" ? "degraded" : "diagnostic_only",
    safe_next_actions: getDoctorFailureCategoryOutcomeV1(category).safe_next_actions,
    user_message: "FlowDesk doctor returned a redacted diagnostic category.",
    doctor_results: [doctorSection(category)],
    provider_health_summary: {
      provider_family: "unknown",
      availability_state: category === "degraded_mode_warning" ? "degraded" : "unknown",
      failure_class: category === "degraded_mode_warning" ? "telemetry_ambiguous" : "none",
      dispatchability: category === "degraded_mode_warning" ? "diagnostic_only" : "non_dispatchable",
      safe_remediation: "Use doctor or status diagnostics."
    },
    compatibility_ref: "compatibility-123",
    disabled_modes: doctorDisabledModesFor(category)
  };
}

function doctorHandoff(): FlowDeskDoctorHandoffV1 {
  return {
    schema_version: "flowdesk.doctor_handoff.v1",
    handoff_id: "handoff-123",
    created_at: now,
    install_plan_ref: "install-plan-123",
    bootstrap_report_ref: "report-123",
    doctor_request_ref: "doctor-request-123",
    safe_next_actions: ["/flowdesk-doctor"]
  };
}

function typedConfirmation(overrides: Record<string, unknown> = {}) {
  return {
    confirmation_ref: "confirmation-123",
    target_profile_ref: "profile-123",
    install_plan_ref: "install-plan-123",
    backup_manifest_ref: "backup-123",
    rollback_plan_ref: "rollback-plan-123",
    expires_at: "2026-05-17T00:10:00.000Z",
    actor_class: "user" as const,
    consumed_by: "profile_mutation" as const,
    consumed_ref: "mutation-123",
    ...overrides
  };
}

function bootstrapFailureEvidence(overrides: Record<string, unknown> = {}) {
  return {
    installPlan: installPlan(),
    backupManifest: backupManifest(),
    profileMutation: profileMutation(),
    omoCleanup: cleanupSummary(),
    commandGeneration: commandGeneration(),
    configScaffold: configScaffold(),
    rollbackPlan: rollbackPlan(),
    rollbackResult: rollbackResult(),
    bootstrapReport: bootstrapReport(),
    doctorHandoff: doctorHandoff(),
    doctorReport: doctorReport(),
    typedConfirmation: typedConfirmation(),
    ...overrides
  };
}

function release2Phase6AClosureEvidence(): FlowDeskRelease2Phase6AClosureEvidenceV1 {
  return {
    schema_version: "flowdesk.release2_phase6a_closure_evidence.v1",
    closure_ref: "phase6a-closure-123",
    workflow_id: "workflow-123",
    phase: "phase_6a",
    result: "passed",
    closed_at: now,
    expires_at: "2026-05-18T00:00:00.000Z",
    closure_labels: ["plugin_sdk_compatibility_closed", "fanout_cap_cache_enforcement_closed", "reviewer_fanout_smoke_closed"],
    evidence_refs: ["fanout-evidence-123", "wake-evidence-123", "binding-evidence-123", "progress-evidence-123"],
    dispatch_authority_enabled: false,
    fallback_authority_enabled: false,
    hard_chat_authority_enabled: false,
    external_write_authority_enabled: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false
  };
}

function release2PromotionReadiness(): FlowDeskRelease2ManagedDispatchGatePromotionReadinessV1 {
  return {
    schema_version: "flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1",
    workflow_id: "workflow-123",
    ok: true,
    errors: [],
    state: "eligible",
    blocked_labels: [],
    evidence_refs: ["phase6a-closure-123", "production-evidence-123"],
    production_enablement_state: "dispatch_capable",
    managed_dispatch_ready: true,
    phase6a_closed: true,
    scoped_explicit_approval_present: true,
    fresh_evidence_present: true,
    release2_managed_dispatch_gate_ready: true,
    dispatch_authority_enabled: false,
    fallback_authority_enabled: false,
    hard_chat_authority_enabled: false,
    external_write_authority_enabled: false,
    providerCall: false,
    actualLaneLaunch: false,
    runtimeExecution: false,
    safe_next_actions: ["/flowdesk-status"],
    phase6a_closure_ref: "phase6a-closure-123"
  };
}

test("valid redacted Checkpoint 4 bootstrap artifacts and write intents pass", () => {
  const artifacts = [installPlan(), backupManifest(), profileMutation(), cleanupSummary(), commandGeneration(), configScaffold(), rollbackPlan(), rollbackResult(), bootstrapReport(), doctorHandoff(), doctorReport()];
  for (const artifact of artifacts) assert.equal(validateFlowDeskBootstrapArtifactV1(artifact).ok, true, artifact.schema_version);
  assert.equal(validateBootstrapInstallPlanV1(installPlan()).ok, true);
  assert.equal(validateBootstrapBackupManifestV1(backupManifest()).ok, true);
  assert.equal(validateProfileMutationSummaryV1(profileMutation()).ok, true);
  assert.equal(validateOmoCleanupSummaryV1(cleanupSummary()).ok, true);
  assert.equal(validateCommandGenerationSummaryV1(commandGeneration()).ok, true);
  assert.equal(validateConfigScaffoldSummaryV1(configScaffold()).ok, true);
  assert.equal(validateBootstrapRollbackPlanV1(rollbackPlan()).ok, true);
  assert.equal(validateBootstrapRollbackResultV1(rollbackResult()).ok, true);
  assert.equal(validateBootstrapReportV1(bootstrapReport()).ok, true);
  assert.equal(validateDoctorHandoffV1(doctorHandoff()).ok, true);
  assert.equal(validateDoctorReportV1(doctorReport()).ok, true);

  const prepared = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", bootstrapReport());
  assert.equal(prepared.ok, true);
  assert.ok(prepared.writeIntent?.path.startsWith(".flowdesk/bootstrap/install-plan-123/bootstrap-report/"));
  assert.equal(validateRedactedBootstrapArtifactWriteIntent(prepared.writeIntent).ok, true);
  assert.ok(prepared.writeIntent);
  const memoryState = applyBootstrapWriteIntentsToInMemoryState([prepared.writeIntent]);
  assert.match(memoryState.get(prepared.writeIntent?.path ?? "") ?? "", /"schema_version":"flowdesk.bootstrap_report.v1"/);
});

test("redacted bootstrap artifacts materialize durable .flowdesk bootstrap files", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-bootstrap-"));
  try {
    const preparedReport = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", bootstrapReport()).writeIntent;
    const preparedHandoff = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", doctorHandoff()).writeIntent;
    assert.ok(preparedReport);
    assert.ok(preparedHandoff);

    const result = applyBootstrapWriteIntentsToDurableState(root, [preparedReport, preparedHandoff]);
    assert.equal(result.ok, true);
    assert.deepEqual(result.writtenPaths, [preparedReport.path, preparedHandoff.path]);
    assert.equal(result.bootstrapAuthority, "redacted_bootstrap_artifact");
    assert.equal(result.productionRegistrationEligible, false);
    assert.equal(result.providerCall, false);

    const reportPath = join(root, preparedReport.path);
    const handoffPath = join(root, preparedHandoff.path);
    assert.equal(existsSync(reportPath), true);
    assert.equal(JSON.parse(readFileSync(reportPath, "utf8")).schema_version, "flowdesk.bootstrap_report.v1");
    assert.equal(JSON.parse(readFileSync(handoffPath, "utf8")).install_plan_ref, "install-plan-123");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Release 2 gate promotion evidence materializes as redacted non-authorizing bootstrap artifacts", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-release2-materialize-"));
  const otherRoot = mkdtempSync(join(tmpdir(), "flowdesk-release2-other-root-"));
  try {
    const closure = prepareRedactedBootstrapArtifactWriteIntent("install-plan-release2", release2Phase6AClosureEvidence());
    const readiness = prepareRedactedBootstrapArtifactWriteIntent("install-plan-release2", release2PromotionReadiness());
    assert.equal(closure.ok, true);
    assert.equal(readiness.ok, true);
    assert.ok(closure.writeIntent);
    assert.ok(readiness.writeIntent);
    assert.match(closure.writeIntent.path, /^\.flowdesk\/bootstrap\/install-plan-release2\/release2-phase6a-closure-evidence\/phase6a-closure-123\.json$/);
    assert.match(readiness.writeIntent.path, /^\.flowdesk\/bootstrap\/install-plan-release2\/release2-managed-dispatch-gate-promotion-readiness\/workflow-123\.json$/);

    const result = applyBootstrapWriteIntentsToDurableState(root, [closure.writeIntent, readiness.writeIntent]);
    assert.equal(result.ok, true);
    assert.equal(result.realOpenCodeDispatch, false);
    assert.equal(result.dispatchApprovalEligible, false);
    assert.equal(result.providerCall, false);
    assert.equal(result.actualLaneLaunch, false);
    assert.equal(result.runtimeExecution, false);
    assert.deepEqual(result.writtenPaths, [closure.writeIntent.path, readiness.writeIntent.path]);

    const writtenClosure = JSON.parse(readFileSync(join(root, closure.writeIntent.path), "utf8")) as Record<string, unknown>;
    const writtenReadiness = JSON.parse(readFileSync(join(root, readiness.writeIntent.path), "utf8")) as Record<string, unknown>;
    assert.equal(writtenClosure.schema_version, "flowdesk.release2_phase6a_closure_evidence.v1");
    assert.equal(writtenReadiness.schema_version, "flowdesk.release2_managed_dispatch_gate_promotion_readiness.v1");
    assert.equal(writtenReadiness.dispatch_authority_enabled, false);
    assert.equal(writtenReadiness.fallback_authority_enabled, false);
    assert.equal(existsSync(join(otherRoot, ".flowdesk")), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
    rmSync(otherRoot, { recursive: true, force: true });
  }
});

test("Release 2 gate promotion materialization rejects malformed and authority-smuggling records fail-closed", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-release2-materialize-invalid-"));
  try {
    const validClosure = prepareRedactedBootstrapArtifactWriteIntent("install-plan-release2", release2Phase6AClosureEvidence()).writeIntent;
    assert.ok(validClosure);
    const smuggledReadiness = prepareRedactedBootstrapArtifactWriteIntent("install-plan-release2", {
      ...release2PromotionReadiness(),
      dispatch_authority_enabled: true,
      providerCall: true,
      rawProviderPayload: "secret-token"
    } as unknown as FlowDeskRelease2ManagedDispatchGatePromotionReadinessV1);
    assert.equal(smuggledReadiness.ok, false);

    const malformedClosure = { ...validClosure, record: { ...validClosure.record, actualLaneLaunch: true } } as unknown as typeof validClosure;
    const result = applyBootstrapWriteIntentsToDurableState(root, [malformedClosure, validClosure]);
    assert.equal(result.ok, false);
    assert.deepEqual(result.writtenPaths, []);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
    assert.equal(existsSync(join(root, validClosure.path)), false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("durable bootstrap materialization rejects forged intents before writing", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-bootstrap-invalid-"));
  try {
    const preparedReport = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", bootstrapReport()).writeIntent;
    assert.ok(preparedReport);
    const forged = { ...preparedReport, path: "../bootstrap-report.json" };
    const result = applyBootstrapWriteIntentsToDurableState(root, [forged]);
    assert.equal(result.ok, false);
    assert.equal(result.writtenPaths?.length ?? 0, 0);
    assert.equal(result.realOpenCodeDispatch, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("durable bootstrap materialization prevalidates full batches before writing", () => {
  const root = mkdtempSync(join(tmpdir(), "flowdesk-bootstrap-batch-invalid-"));
  try {
    const preparedReport = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", bootstrapReport()).writeIntent;
    const preparedHandoff = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", doctorHandoff()).writeIntent;
    assert.ok(preparedReport);
    assert.ok(preparedHandoff);

    const forged = { ...preparedHandoff, path: "../doctor-handoff.json" };
    const result = applyBootstrapWriteIntentsToDurableState(root, [preparedReport, forged]);
    assert.equal(result.ok, false);
    assert.deepEqual(result.writtenPaths, []);
    assert.equal(existsSync(join(root, preparedReport.path)), false);
    assert.equal(result.providerCall, false);
    assert.equal(result.runtimeExecution, false);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("Checkpoint 4 validators reject unknown properties and forbidden raw values", () => {
  assert.equal(validateBootstrapInstallPlanV1({ ...installPlan(), unexpected: true }).ok, false);
  assert.equal(validateBootstrapBackupManifestV1({ ...backupManifest(), source_config_ref: "/Users/example/raw-config.json" }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorReport().category_results[0], summary: "see /usr/local/bin/opencode" }] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorReport().category_results[0], summary: "see /opt" }] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorReport().category_results[0], summary: "see /opt/profile/config.json" }] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorReport().category_results[0], summary: "see C:/Users/example/config.json" }] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorReport().category_results[0], summary: "see /Volumes" }] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorReport().category_results[0], summary: "see /Volumes/project/profile.json" }] }).ok, false);
  assert.equal(validateProfileMutationSummaryV1({ ...profileMutation(), changed_entry_refs: ["credential-secret-ref"] }).ok, false);
  assert.equal(validateOmoCleanupSummaryV1({ ...cleanupSummary(), audit_ref: "bearer token:abc123" }).ok, false);
  assert.equal(validateRedactedBootstrapArtifactWriteIntent({ ...prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", bootstrapReport()).writeIntent, path: "/tmp/report.json" }).ok, false);
});

test("install plans fail closed for non-release1 mode, missing confirmation, unsafe actions, and interpolation", () => {
  const interpolation = "$" + "{provider}";
  assert.equal(validateBootstrapInstallPlanV1({ ...installPlan(), release_mode: "managed_dispatch_beta" }).ok, false);
  assert.equal(validateBootstrapInstallPlanV1({ ...installPlan(), requires_typed_confirmation: false }).ok, false);
  assert.equal(validateBootstrapInstallPlanV1({ ...installPlan(), confirmation_ref: undefined }).ok, false);
  assert.equal(validateBootstrapInstallPlanV1({ ...installPlan(), planned_phases: ["preflight"], requires_typed_confirmation: false, confirmation_ref: undefined }).ok, true);
  assert.equal(validateBootstrapInstallPlanV1({ ...installPlan(), safe_next_actions: ["/flowdesk-run"] }).ok, false);
  assert.equal(validateBootstrapInstallPlanV1({ ...installPlan(), planned_phases: ["config_".concat(interpolation)] }).ok, false);
  assert.equal(validateCommandGenerationSummaryV1({ ...commandGeneration(), command_refs: ["command-".concat(interpolation)] }).ok, false);
  assert.equal(validateCommandGenerationSummaryV1({ ...commandGeneration(), template_hash: "template-".concat(interpolation) }).ok, false);
});

test("backup, profile, rollback, and report artifacts stay redacted and non-authorizing", () => {
  assert.equal(validateBootstrapBackupManifestV1({ ...backupManifest(), backup_ref: ".flowdesk/bootstrap/backup.json" }).ok, false);
  assert.equal(validateProfileMutationSummaryV1({ ...profileMutation(), unrelated_profile_mutation: true }).ok, false);
  assert.equal(validateProfileMutationSummaryV1({ ...profileMutation(), provider_auth_preserved: false }).ok, false);
  assert.equal(validateProfileMutationSummaryV1({ ...profileMutation(), provider_auth_preserved: "deleted" }).ok, false);
  assert.equal(validateBootstrapRollbackPlanV1({ ...rollbackPlan(), restore_preconditions: ["/etc/passwd"] }).ok, false);
  assert.equal(validateBootstrapRollbackPlanV1({ ...rollbackPlan(), safe_next_actions: ["/flowdesk-abort"] }).ok, false);
  assert.equal(validateBootstrapRollbackResultV1({ ...rollbackResult(), restored_ref_count: Infinity }).ok, false);
  assert.equal(validateBootstrapRollbackResultV1({ ...rollbackResult(), skipped_ref_count: 1.5 }).ok, false);
  assert.equal(validateOmoCleanupSummaryV1({ ...cleanupSummary(), removed_ref_count: Number.NaN }).ok, false);
  assert.equal(validateOmoCleanupSummaryV1({ ...cleanupSummary(), retained_ref_count: 1.5 }).ok, false);
  assert.equal(validateBootstrapRollbackResultV1({ ...rollbackResult(), safe_next_actions: ["/flowdesk-retry"] }).ok, false);
  assert.equal(validateBootstrapReportV1({ ...bootstrapReport(), disabled_modes: ["real_dispatch", "managed_fallback"] }).ok, false);
  assert.equal(validateBootstrapReportV1({ ...bootstrapReport(), completed_at: undefined, failure_class: undefined, backup_manifest_ref: undefined, doctor_handoff_ref: undefined, status: "partial", final_phase: "failed" }).ok, true);
  assert.equal(validateBootstrapReportV1({ ...bootstrapReport(), safe_next_actions: ["/flowdesk-run"] }).ok, false);
});

test("installer failure evidence proves backup-first ordering and typed confirmation binding", () => {
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence()).ok, true);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ backupManifest: undefined })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ typedConfirmation: undefined })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ typedConfirmation: typedConfirmation({ target_profile_ref: "profile-other" }) })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ typedConfirmation: typedConfirmation({ backup_manifest_ref: "backup-other" }) })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ typedConfirmation: typedConfirmation({ actor_class: "system" }) })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ backupManifest: { ...backupManifest(), target_profile_ref: "profile-other" } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ profileMutation: { ...profileMutation(), backup_manifest_ref: "backup-other" } })).ok, false);
});

test("installer failure evidence validator returns invalid for malformed aggregate inputs", () => {
  for (const malformed of [
    { installPlan: null },
    { installPlan: 42 },
    bootstrapFailureEvidence({ typedConfirmation: null }),
    bootstrapFailureEvidence({ typedConfirmation: 42 }),
    bootstrapFailureEvidence({ backupManifest: null }),
    bootstrapFailureEvidence({ profileMutation: 42 }),
    bootstrapFailureEvidence({ profileMutation: null }),
    bootstrapFailureEvidence({ omoCleanup: null }),
    bootstrapFailureEvidence({ rollbackPlan: null }),
    bootstrapFailureEvidence({ rollbackResult: null }),
    bootstrapFailureEvidence({ bootstrapReport: null }),
    bootstrapFailureEvidence({ doctorHandoff: null }),
    bootstrapFailureEvidence({ commandGeneration: 42 }),
    bootstrapFailureEvidence({ commandGeneration: null }),
    bootstrapFailureEvidence({ configScaffold: null }),
    bootstrapFailureEvidence({ backupManifest: 42 }),
    bootstrapFailureEvidence({ doctorReport: 42, bootstrapAuthorityRequestedAfterDoctorPass: true }),
    bootstrapFailureEvidence({ doctorReport: null, bootstrapAuthorityRequestedAfterDoctorPass: true })
  ]) {
    assert.doesNotThrow(() => validateBootstrapFailureEvidenceV1(malformed));
    assert.equal(validateBootstrapFailureEvidenceV1(malformed).ok, false);
  }
});

test("installer failure evidence proves provider-auth preservation and selected-profile-only mutation", () => {
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ profileMutation: { ...profileMutation(), provider_auth_preserved: "blocked" } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ omoCleanup: { ...cleanupSummary(), provider_auth_preserved: "blocked" } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ profileMutation: { ...profileMutation(), unrelated_profile_mutation: true } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ profileMutation: { ...profileMutation(), target_profile_ref: "profile-other" } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ commandGeneration: { ...commandGeneration(), target_profile_ref: "profile-other" } })).ok, false);
});

test("installer failure evidence proves rollback reporting, doctor handoff, and bootstrap authority closure", () => {
  const partialRollback = { ...rollbackResult(), status: "partial" as const, skipped_ref_count: 1, warning_count: 1, safe_next_actions: ["/flowdesk-doctor", "/flowdesk-export-debug"] as const };
  assert.equal(validateBootstrapRollbackResultV1(partialRollback).ok, true);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ rollbackResult: partialRollback, bootstrapReport: { ...bootstrapReport(), status: "partial", final_phase: "failed", rollback_result_ref: "rollback-result-123" } })).ok, true);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ rollbackResult: { ...rollbackResult(), status: "partial", skipped_ref_count: 0, warning_count: 0 } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ rollbackPlan: undefined })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ bootstrapReport: { ...bootstrapReport(), rollback_result_ref: "rollback-other" } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ doctorHandoff: undefined })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ doctorHandoff: { ...doctorHandoff(), bootstrap_report_ref: "report-other" } })).ok, false);
  assert.equal(validateBootstrapFailureEvidenceV1(bootstrapFailureEvidence({ bootstrapAuthorityRequestedAfterDoctorPass: true })).ok, false);
});

test("doctor report and handoff remain diagnostic and separate usage from provider health", () => {
  assert.equal(validateDoctorReportV1(doctorReport()).ok, true);
  assert.equal(validateDoctorHandoffV1(doctorHandoff()).ok, true);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), report_authority: "dispatchable" }).ok, false);
  assert.equal(validateDoctorHandoffV1({ ...doctorHandoff(), handoff_authority: "authoritative" }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), usage_snapshot_ref: "usage-123" }).ok, false);
  assert.equal(validateDoctorHandoffV1({ ...doctorHandoff(), provider_health_snapshot_ref: "health-123" }).ok, false);
  assert.equal(validateDoctorHandoffV1({ ...doctorHandoff(), safe_next_actions: ["/flowdesk-run"] }).ok, false);
  assert.equal(validateDoctorHandoffV1({ ...doctorHandoff(), fallback_ref: "fallback-123" }).ok, false);
});

test("doctor failure categories map to non-authorizing outcomes", () => {
  assert.deepEqual([...DOCTOR_FAILURE_CATEGORIES], ["dispatch_blocking", "chat_mode_disable", "degraded_mode_warning", "informational"]);
  assert.deepEqual(RELEASE_1_SCHEMA_ARTIFACTS["flowdesk.doctor_section_result.v1"].properties.category.enum, DOCTOR_FAILURE_CATEGORIES);

  for (const category of DOCTOR_FAILURE_CATEGORIES) {
    const outcome = getDoctorFailureCategoryOutcomeV1(category);
    const response = doctorResponse(category);
    const report = { ...doctorReport(), category_results: [doctorSection(category)], disabled_modes: doctorDisabledModesFor(category), safe_next_actions: outcome.safe_next_actions };

    assert.equal(outcome.managed_dispatch_allowed, false, category);
    assert.equal(outcome.privileged_automation_allowed, false, category);
    assert.equal(outcome.dispatch_authorized, false, category);
    assert.equal(outcome.fallback_authorized, false, category);
    assert.equal(outcome.guard_bypassed, false, category);
    assert.deepEqual(response.disabled_modes, outcome.disabled_modes, category);
    assert.equal(outcome.safe_next_actions.includes("/flowdesk-run"), false, category);
    assert.equal(validateDoctorResponseV1(response).ok, true, category);
    assert.equal(validateDoctorReportV1(report).ok, true, category);
  }
});

test("doctor category validators enforce dispatch blocking, chat-only disablement, and diagnostic actions", () => {
  const dispatchResponse = doctorResponse("dispatch_blocking");
  assert.equal(validateDoctorResponseV1({ ...dispatchResponse, disabled_modes: ["real_dispatch", "managed_fallback", "hard_chat_blocking"] }).ok, false);
  assert.equal(validateDoctorResponseV1({ ...dispatchResponse, safe_next_actions: ["/flowdesk-run"] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [doctorSection("dispatch_blocking")], disabled_modes: ["real_dispatch", "managed_fallback", "hard_chat_blocking"], safe_next_actions: ["/flowdesk-status"] }).ok, false);

  const chatResponse = doctorResponse("chat_mode_disable");
  assert.equal(validateDoctorResponseV1({ ...chatResponse, disabled_modes: ["chat_routed"] }).ok, false);
  assert.equal(validateDoctorResponseV1({ ...chatResponse, disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"] }).ok, false);
  assert.equal(validateDoctorResponseV1({ ...chatResponse, disabled_modes: [...chatResponse.disabled_modes, "workflow_optimization"] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [doctorSection("chat_mode_disable")], disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"], safe_next_actions: ["/flowdesk-status"] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [doctorSection("informational")], disabled_modes: [...doctorDisabledModesFor("informational"), "chat_routed"], safe_next_actions: ["/flowdesk-status"] }).ok, false);

  for (const category of ["degraded_mode_warning", "informational"] as const) {
    const response = doctorResponse(category);
    assert.equal(validateDoctorResponseV1({ ...response, disabled_modes: [] }).ok, false, category);
    assert.equal(validateDoctorResponseV1({ ...response, safe_next_actions: ["/flowdesk-retry"] }).ok, false, category);
    assert.equal(validateDoctorResponseV1({ ...response, fallback_authorized: true }).ok, false, category);
    assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorSection(category), safe_next_actions: ["/flowdesk-plan"] }] }).ok, false, category);
  }
});

test("doctor category artifacts reject forged authority and raw payload markers", () => {
  const forgedSection = { ...doctorSection("informational"), dispatch_authorized: true };
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [forgedSection] }).ok, false);
  assert.equal(validateDoctorResponseV1({ ...doctorResponse("informational"), doctor_results: [forgedSection] }).ok, false);
  assert.equal(validateDoctorResponseV1({ ...doctorResponse("degraded_mode_warning"), provider_payload: "raw provider response" }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorSection("dispatch_blocking"), summary: "stack trace from provider response" }] }).ok, false);
  assert.equal(validateDoctorReportV1({ ...doctorReport(), category_results: [{ ...doctorSection("chat_mode_disable"), refs: ["credential-secret-ref"] }] }).ok, false);
});

test("bootstrap write intents reject forged paths, missing schema ids, and unknown authority fields", () => {
  const prepared = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", bootstrapReport());
  assert.equal(prepared.ok, true);
  assert.ok(prepared.writeIntent);
  assert.equal(validateRedactedBootstrapArtifactWriteIntent({ ...prepared.writeIntent, schemaId: undefined }).ok, false);
  assert.equal(validateRedactedBootstrapArtifactWriteIntent({ ...prepared.writeIntent, unexpected: true }).ok, false);
  assert.equal(validateRedactedBootstrapArtifactWriteIntent({ ...prepared.writeIntent, atomicity: { ...prepared.writeIntent.atomicity, unexpected: true } }).ok, false);
  assert.equal(validateRedactedBootstrapArtifactWriteIntent({ ...prepared.writeIntent, path: ".flowdesk/workflows/active.json", atomicity: { strategy: "temp_then_rename_intent", tempPath: ".flowdesk/workflows/active.json.tmp-flowdesk.bootstrap_report.v1" } }).ok, false);
  assert.equal(validateRedactedBootstrapArtifactWriteIntent({ ...prepared.writeIntent, path: ".flowdesk/bootstrap/install-plan-123/bootstrap-report/other-report.json", atomicity: { strategy: "temp_then_rename_intent", tempPath: ".flowdesk/bootstrap/install-plan-123/bootstrap-report/other-report.json.tmp-flowdesk.bootstrap_report.v1" } }).ok, false);
  const installPlanIntent = prepareRedactedBootstrapArtifactWriteIntent("install-plan-123", installPlan()).writeIntent;
  assert.ok(installPlanIntent);
  assert.equal(validateRedactedBootstrapArtifactWriteIntent({ ...installPlanIntent, path: ".flowdesk/bootstrap/other-plan/bootstrap-install-plan/install-plan-123.json", atomicity: { strategy: "temp_then_rename_intent", tempPath: ".flowdesk/bootstrap/other-plan/bootstrap-install-plan/install-plan-123.json.tmp-flowdesk.bootstrap_install_plan.v1" } }).ok, false);
});

test("Checkpoint 4 source safety keeps production plugin registration and runtime launch paths disabled", () => {
  const sourceDir = new URL("../src/", import.meta.url);
  const sourceText = readdirSync(sourceDir)
    .filter((entry) => entry.endsWith(".ts") && !entry.endsWith(".test.ts") && entry !== "agent-profiles.ts")
    .map((entry) => readFileSync(new URL(entry, sourceDir), "utf8"))
    .join("\n");
  assert.equal(/from ["'](?:child_process|node:child_process)["']/.test(sourceText), false);
  assert.equal(/\b(?:spawn|exec|execFile)\s*\(/.test(sourceText), false);
  assert.equal(/opencode\s+run/.test(sourceText), false);
  assert.equal(/@oh-my-claudecode|oh-my-claudecode|omo\/|omc\//i.test(sourceText), false);
  assert.equal(/productionToolRegistration\s*:\s*["']enabled["']/.test(sourceText), false);
  assert.ok(getRelease1ProductionToolRegistry().length > 0);
});
