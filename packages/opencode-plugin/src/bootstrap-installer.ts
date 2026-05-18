import type {
  FlowDeskBootstrapInstallPlanV1,
  FlowDeskBootstrapReportV1,
  FlowDeskCommandGenerationSummaryV1,
  FlowDeskDoctorHandoffV1,
  ValidationResult
} from "@flowdesk/core";
import {
  applyBootstrapWriteIntentsToDurableState,
  invalid,
  prepareRedactedBootstrapArtifactWriteIntent,
  valid,
  validateOpaqueRef
} from "@flowdesk/core";
import { materializeFlowDeskPortableCommandFiles, type FlowDeskPortableCommandMaterializationResultV1 } from "./commands.js";

export interface FlowDeskRelease1BootstrapInstallRequestV1 {
  profileRootDir: string;
  durableStateRootDir: string;
  targetProfileRef: string;
  typedConfirmationRef: string;
  now?: Date;
}

export interface FlowDeskRelease1BootstrapInstallResultV1 extends ValidationResult {
  profileRootDir?: string;
  durableStateRootDir?: string;
  commandMaterialization?: FlowDeskPortableCommandMaterializationResultV1;
  bootstrapArtifactRefs?: string[];
  bootstrapArtifactsWritten: number;
  commandFilesWritten: number;
  aliasFilesWritten: 0;
  doctorHandoffRef?: string;
  productionRegistrationEligible: false;
  commandAliasEligible: false;
  dispatchApprovalEligible: false;
  realOpenCodeDispatch: false;
  actualLaneLaunch: false;
  providerCall: false;
  runtimeExecution: false;
  fallbackAuthority: false;
  hardCancelOrNoReplyAuthority: false;
}

const disabledBootstrapInstallAuthority = {
  productionRegistrationEligible: false,
  commandAliasEligible: false,
  dispatchApprovalEligible: false,
  realOpenCodeDispatch: false,
  actualLaneLaunch: false,
  providerCall: false,
  runtimeExecution: false,
  fallbackAuthority: false,
  hardCancelOrNoReplyAuthority: false
} as const;

function resultBase(): Pick<FlowDeskRelease1BootstrapInstallResultV1, "bootstrapArtifactsWritten" | "commandFilesWritten" | "aliasFilesWritten"> & typeof disabledBootstrapInstallAuthority {
  return { bootstrapArtifactsWritten: 0, commandFilesWritten: 0, aliasFilesWritten: 0, ...disabledBootstrapInstallAuthority };
}

function validateRequest(request: FlowDeskRelease1BootstrapInstallRequestV1): ValidationResult {
  const errors: string[] = [];
  if (typeof request.profileRootDir !== "string" || request.profileRootDir.trim().length === 0) errors.push("profileRootDir is required");
  if (typeof request.durableStateRootDir !== "string" || request.durableStateRootDir.trim().length === 0) errors.push("durableStateRootDir is required");
  errors.push(...validateOpaqueRef(request.targetProfileRef, "targetProfileRef").errors);
  errors.push(...validateOpaqueRef(request.typedConfirmationRef, "typedConfirmationRef").errors);
  return errors.length === 0 ? valid() : invalid(...errors);
}

function ids(targetProfileRef: string) {
  const suffix = targetProfileRef.replace(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 48);
  return {
    installPlanId: `install-plan-${suffix}`,
    generationId: `generation-${suffix}`,
    rollbackPlanId: `rollback-plan-${suffix}`,
    reportId: `report-${suffix}`,
    handoffId: `handoff-${suffix}`
  };
}

function installPlan(nowIso: string, targetProfileRef: string, typedConfirmationRef: string, installPlanId: string, rollbackPlanId: string): FlowDeskBootstrapInstallPlanV1 {
  return {
    schema_version: "flowdesk.bootstrap_install_plan.v1",
    install_plan_id: installPlanId,
    created_at: nowIso,
    target_profile_ref: targetProfileRef,
    release_mode: "release1",
    planned_phases: ["preflight", "command_generation", "doctor_handoff"],
    requires_typed_confirmation: true,
    confirmation_ref: typedConfirmationRef,
    package_ref: "package-flowdesk-opencode-plugin",
    rollback_plan_ref: rollbackPlanId,
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"]
  };
}

function commandGeneration(targetProfileRef: string, generationId: string, commandRefs: readonly string[]): FlowDeskCommandGenerationSummaryV1 {
  return {
    schema_version: "flowdesk.command_generation_summary.v1",
    generation_id: generationId,
    target_profile_ref: targetProfileRef,
    status: "applied",
    command_refs: [...commandRefs],
    template_hash: "template-hash-flowdesk-release1-portable-commands",
    static_template_validation: "passed",
    rollback_ref: "rollback-command-files"
  };
}

function bootstrapReport(nowIso: string, targetProfileRef: string, installPlanId: string, generationId: string, reportId: string, handoffId: string): FlowDeskBootstrapReportV1 {
  return {
    schema_version: "flowdesk.bootstrap_report.v1",
    report_id: reportId,
    install_plan_id: installPlanId,
    target_profile_ref: targetProfileRef,
    started_at: nowIso,
    completed_at: nowIso,
    final_phase: "complete",
    status: "complete",
    failure_class: "unknown",
    command_generation_ref: generationId,
    doctor_handoff_ref: handoffId,
    disabled_modes: ["real_dispatch", "managed_fallback", "lane_launch", "hard_chat_blocking"],
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
    audit_refs: ["audit-bootstrap-install"]
  };
}

function doctorHandoff(nowIso: string, installPlanId: string, reportId: string, handoffId: string): FlowDeskDoctorHandoffV1 {
  return {
    schema_version: "flowdesk.doctor_handoff.v1",
    handoff_id: handoffId,
    created_at: nowIso,
    install_plan_ref: installPlanId,
    bootstrap_report_ref: reportId,
    doctor_request_ref: "doctor-request-bootstrap-install",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"]
  };
}

export function installFlowDeskRelease1Bootstrap(request: FlowDeskRelease1BootstrapInstallRequestV1): FlowDeskRelease1BootstrapInstallResultV1 {
  const requestValidation = validateRequest(request);
  if (!requestValidation.ok) return { ...requestValidation, ...resultBase() };

  const commandMaterialization = materializeFlowDeskPortableCommandFiles(request.profileRootDir);
  if (!commandMaterialization.ok) return { ...invalid(...commandMaterialization.errors), commandMaterialization, commandFilesWritten: commandMaterialization.commandFilesWritten, bootstrapArtifactsWritten: 0, aliasFilesWritten: 0, ...disabledBootstrapInstallAuthority };

  const nowIso = (request.now ?? new Date()).toISOString();
  const artifactIds = ids(request.targetProfileRef);
  const commandRefs = commandMaterialization.writtenCommandRefs?.map((ref) => `command-file-${ref.replace(/[^A-Za-z0-9_.:-]/g, "-")}`) ?? [];
  const artifacts = [
    installPlan(nowIso, request.targetProfileRef, request.typedConfirmationRef, artifactIds.installPlanId, artifactIds.rollbackPlanId),
    commandGeneration(request.targetProfileRef, artifactIds.generationId, commandRefs),
    bootstrapReport(nowIso, request.targetProfileRef, artifactIds.installPlanId, artifactIds.generationId, artifactIds.reportId, artifactIds.handoffId),
    doctorHandoff(nowIso, artifactIds.installPlanId, artifactIds.reportId, artifactIds.handoffId)
  ];
  const prepared = artifacts.map((artifact) => prepareRedactedBootstrapArtifactWriteIntent(artifactIds.installPlanId, artifact));
  const prepareErrors = prepared.flatMap((entry) => entry.ok ? [] : entry.errors);
  const intents = prepared.map((entry) => entry.writeIntent).filter((intent): intent is NonNullable<typeof intent> => intent !== undefined);
  if (prepareErrors.length > 0 || intents.length !== artifacts.length) return { ...invalid(...(prepareErrors.length > 0 ? prepareErrors : ["bootstrap artifact preparation failed"])), commandMaterialization, commandFilesWritten: commandMaterialization.commandFilesWritten, bootstrapArtifactsWritten: 0, aliasFilesWritten: 0, ...disabledBootstrapInstallAuthority };

  const durable = applyBootstrapWriteIntentsToDurableState(request.durableStateRootDir, intents);
  if (!durable.ok) return { ...invalid(...durable.errors), commandMaterialization, profileRootDir: commandMaterialization.profileRootDir, durableStateRootDir: durable.rootDir, bootstrapArtifactRefs: durable.writtenPaths, commandFilesWritten: commandMaterialization.commandFilesWritten, bootstrapArtifactsWritten: durable.writtenPaths?.length ?? 0, aliasFilesWritten: 0, ...disabledBootstrapInstallAuthority };

  return {
    ...valid(),
    profileRootDir: commandMaterialization.profileRootDir,
    durableStateRootDir: durable.rootDir,
    commandMaterialization,
    bootstrapArtifactRefs: durable.writtenPaths,
    bootstrapArtifactsWritten: durable.writtenPaths?.length ?? 0,
    commandFilesWritten: commandMaterialization.commandFilesWritten,
    aliasFilesWritten: 0,
    doctorHandoffRef: artifactIds.handoffId,
    ...disabledBootstrapInstallAuthority
  };
}
