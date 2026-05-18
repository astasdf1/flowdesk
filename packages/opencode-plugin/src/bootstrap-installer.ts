import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import {
  applyBootstrapWriteIntentsToDurableState,
  type FlowDeskBootstrapInstallPlanV1,
  type FlowDeskBootstrapReportV1,
  type FlowDeskCommandGenerationSummaryV1,
  type FlowDeskDoctorHandoffV1,
  invalid,
  prepareRedactedBootstrapArtifactWriteIntent,
  type ValidationResult,
  valid,
  validateOpaqueRef
} from "@flowdesk/core";
import { type FlowDeskPortableCommandMaterializationResultV1, materializeFlowDeskPortableCommandFiles } from "./commands.js";

export interface FlowDeskRelease1BootstrapTypedConfirmationV1 {
  confirmationRef: string;
  targetProfileRef: string;
  profileRootRef: string;
  installPlanRef: string;
  rollbackPlanRef: string;
  expiresAt: string;
  actorClass: "user";
  typedPhrase: string;
}

export interface FlowDeskRelease1BootstrapInstallRequestV1 {
  profileRootDir: string;
  durableStateRootDir: string;
  targetProfileRef: string;
  typedConfirmation: FlowDeskRelease1BootstrapTypedConfirmationV1;
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
  rollbackCommandRefs?: string[];
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

const consumedBootstrapConfirmationRefs = new Set<string>();
const bootstrapConfirmationLedgerSchemaVersion = "flowdesk.bootstrap_confirmation_consumption.v1";
const safeLedgerConfirmationRefPattern = /^[A-Za-z0-9_.:-]+$/;

interface FlowDeskBootstrapConfirmationLedgerV1 {
  schema_version: typeof bootstrapConfirmationLedgerSchemaVersion;
  confirmation_ref: string;
  status: "pending" | "consumed";
  target_profile_ref: string;
  profile_root_ref: string;
  install_plan_ref: string;
  rollback_plan_ref: string;
  typed_phrase_hash: string;
  created_at: string;
  consumed_at?: string;
  expires_at: string;
  actor_class: "user";
}

interface FlowDeskBootstrapConfirmationLedgerLocation {
  rootDir: string;
  ledgerPath: string;
  ledgerDir: string;
}

function resultBase(): Pick<FlowDeskRelease1BootstrapInstallResultV1, "bootstrapArtifactsWritten" | "commandFilesWritten" | "aliasFilesWritten"> & typeof disabledBootstrapInstallAuthority {
  return { bootstrapArtifactsWritten: 0, commandFilesWritten: 0, aliasFilesWritten: 0, ...disabledBootstrapInstallAuthority };
}

function expectedTypedPhrase(targetProfileRef: string, profileRootRef: string, confirmationRef: string, installPlanId: string): string {
  return `install FlowDesk release1 ${targetProfileRef} ${profileRootRef} ${confirmationRef} ${installPlanId}`;
}

function safeHash(value: string): string {
  let hash = 2166136261;
  for (const char of value) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
}

function typedPhraseHash(value: string): string {
  return createHash("sha256").update(value, "utf8").digest("hex");
}

export function flowDeskBootstrapProfileRootRef(profileRootDir: string): string {
  return `profile-root-${safeHash(resolve(profileRootDir))}`;
}

function validateRequest(request: FlowDeskRelease1BootstrapInstallRequestV1, artifactIds: ReturnType<typeof ids>, now: Date): ValidationResult {
  const errors: string[] = [];
  if (typeof request.profileRootDir !== "string" || request.profileRootDir.trim().length === 0) errors.push("profileRootDir is required");
  if (typeof request.durableStateRootDir !== "string" || request.durableStateRootDir.trim().length === 0) errors.push("durableStateRootDir is required");
  errors.push(...validateOpaqueRef(request.targetProfileRef, "targetProfileRef").errors);
  const derivedProfileRootRef = flowDeskBootstrapProfileRootRef(request.profileRootDir);
  errors.push(...validateOpaqueRef(derivedProfileRootRef, "derivedProfileRootRef").errors);
  const confirmation = request.typedConfirmation;
  if (confirmation === undefined || confirmation === null || typeof confirmation !== "object") errors.push("typedConfirmation is required");
  else {
    errors.push(...validateOpaqueRef(confirmation.confirmationRef, "typedConfirmation.confirmationRef").errors);
    errors.push(...validateOpaqueRef(confirmation.targetProfileRef, "typedConfirmation.targetProfileRef").errors);
    errors.push(...validateOpaqueRef(confirmation.profileRootRef, "typedConfirmation.profileRootRef").errors);
    errors.push(...validateOpaqueRef(confirmation.installPlanRef, "typedConfirmation.installPlanRef").errors);
    errors.push(...validateOpaqueRef(confirmation.rollbackPlanRef, "typedConfirmation.rollbackPlanRef").errors);
    if (consumedBootstrapConfirmationRefs.has(confirmation.confirmationRef)) errors.push("typed confirmation has already been consumed");
    if (confirmation.targetProfileRef !== request.targetProfileRef) errors.push("typed confirmation must bind target profile");
    if (confirmation.profileRootRef !== derivedProfileRootRef) errors.push("typed confirmation must bind selected profile root");
    if (confirmation.installPlanRef !== artifactIds.installPlanId) errors.push("typed confirmation must bind install plan");
    if (confirmation.rollbackPlanRef !== artifactIds.rollbackPlanId) errors.push("typed confirmation must bind rollback plan");
    if (confirmation.actorClass !== "user") errors.push("typed confirmation actor must be user");
    if (confirmation.typedPhrase !== expectedTypedPhrase(request.targetProfileRef, derivedProfileRootRef, confirmation.confirmationRef, artifactIds.installPlanId)) errors.push("typed confirmation phrase is invalid");
    const expiresAtMs = Date.parse(confirmation.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= now.getTime()) errors.push("typed confirmation is expired or invalid");
  }
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

function validateSafeLedgerConfirmationRef(confirmationRef: string): ValidationResult {
  const errors = [...validateOpaqueRef(confirmationRef, "typedConfirmation.confirmationRef").errors];
  if (!safeLedgerConfirmationRefPattern.test(confirmationRef) || confirmationRef === "." || confirmationRef === "..") {
    errors.push("typed confirmation ref is not safe for durable ledger path");
  }
  return errors.length === 0 ? valid() : invalid(...errors);
}

function pathIsInside(parent: string, child: string): boolean {
  const parentPrefix = parent.endsWith(sep) ? parent : `${parent}${sep}`;
  return child === parent || child.startsWith(parentPrefix);
}

function bootstrapConfirmationLedgerLocation(durableStateRootDir: string, confirmationRef: string): ValidationResult & Partial<FlowDeskBootstrapConfirmationLedgerLocation> {
  const refValidation = validateSafeLedgerConfirmationRef(confirmationRef);
  if (!refValidation.ok) return refValidation;
  const rootDir = resolve(durableStateRootDir);
  const ledgerDir = resolve(rootDir, ".flowdesk", "bootstrap", "confirmations");
  const ledgerPath = resolve(ledgerDir, `${confirmationRef}.json`);
  if (!pathIsInside(rootDir, ledgerPath)) {
    return invalid("typed confirmation ledger path escapes durable state root");
  }
  return { ...valid(), rootDir, ledgerPath, ledgerDir };
}

function validateRealLedgerDirectory(location: FlowDeskBootstrapConfirmationLedgerLocation, create: boolean): ValidationResult {
  let rootRealPath: string;
  try {
    const rootStat = lstatSync(location.rootDir);
    if (rootStat.isSymbolicLink() || !rootStat.isDirectory()) return invalid("typed confirmation durable root is not a real directory");
    rootRealPath = realpathSync(location.rootDir);
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return invalid(`typed confirmation durable root is unavailable: ${message}`);
  }

  const directories = [resolve(location.rootDir, ".flowdesk"), resolve(location.rootDir, ".flowdesk", "bootstrap"), location.ledgerDir];
  for (const directory of directories) {
    try {
      const stat = lstatSync(directory);
      if (stat.isSymbolicLink()) return invalid("typed confirmation durable ledger directory must not be a symlink");
      if (!stat.isDirectory()) return invalid("typed confirmation durable ledger directory is not a directory");
    } catch (error) {
      if (error instanceof Error && "code" in error && error.code === "ENOENT") {
        if (!create) return valid();
        try {
          mkdirSync(directory);
        } catch (mkdirError) {
          const message = mkdirError instanceof Error ? mkdirError.message : "unknown error";
          return invalid(`typed confirmation durable ledger directory creation failed: ${message}`);
        }
      } else {
        const message = error instanceof Error ? error.message : "unknown error";
        return invalid(`typed confirmation durable ledger directory is unavailable: ${message}`);
      }
    }

    let realDirectory: string;
    try {
      const stat = lstatSync(directory);
      if (stat.isSymbolicLink()) return invalid("typed confirmation durable ledger directory must not be a symlink");
      if (!stat.isDirectory()) return invalid("typed confirmation durable ledger directory is not a directory");
      realDirectory = realpathSync(directory);
    } catch (error) {
      const message = error instanceof Error ? error.message : "unknown error";
      return invalid(`typed confirmation durable ledger directory validation failed: ${message}`);
    }
    if (!pathIsInside(rootRealPath, realDirectory)) return invalid("typed confirmation durable ledger directory escapes durable state root");
  }
  return valid();
}

function readExistingDurableConfirmationLedger(location: FlowDeskBootstrapConfirmationLedgerLocation): ValidationResult & { ledger?: Record<string, unknown> } {
  const directoryValidation = validateRealLedgerDirectory(location, false);
  if (!directoryValidation.ok) return directoryValidation;

  try {
    const stat = lstatSync(location.ledgerPath);
    if (stat.isSymbolicLink()) return invalid("typed confirmation durable ledger file must not be a symlink");
    if (!stat.isFile()) return invalid("typed confirmation durable ledger path is not a file");
  } catch (error) {
    if (error instanceof Error && "code" in error && error.code === "ENOENT") return valid();
    const message = error instanceof Error ? error.message : "unknown error";
    return invalid(`typed confirmation durable ledger is unavailable: ${message}`);
  }

  try {
    return { ...valid(), ledger: JSON.parse(readFileSync(location.ledgerPath, "utf8")) as Record<string, unknown> };
  } catch {
    return invalid("typed confirmation durable ledger is unreadable");
  }
}

function expectedConfirmationLedger(request: FlowDeskRelease1BootstrapInstallRequestV1, status: "pending" | "consumed", createdAt: string, consumedAt?: string): FlowDeskBootstrapConfirmationLedgerV1 {
  const confirmation = request.typedConfirmation;
  const ledger: FlowDeskBootstrapConfirmationLedgerV1 = {
    schema_version: bootstrapConfirmationLedgerSchemaVersion,
    confirmation_ref: confirmation.confirmationRef,
    status,
    target_profile_ref: confirmation.targetProfileRef,
    profile_root_ref: confirmation.profileRootRef,
    install_plan_ref: confirmation.installPlanRef,
    rollback_plan_ref: confirmation.rollbackPlanRef,
    typed_phrase_hash: typedPhraseHash(confirmation.typedPhrase),
    created_at: createdAt,
    expires_at: confirmation.expiresAt,
    actor_class: confirmation.actorClass
  };
  if (consumedAt !== undefined) ledger.consumed_at = consumedAt;
  return ledger;
}

function existingLedgerBindingMismatches(ledger: Record<string, unknown>, expected: FlowDeskBootstrapConfirmationLedgerV1): string[] {
  const checks: Array<[keyof FlowDeskBootstrapConfirmationLedgerV1, string | undefined]> = [
    ["schema_version", expected.schema_version],
    ["confirmation_ref", expected.confirmation_ref],
    ["target_profile_ref", expected.target_profile_ref],
    ["profile_root_ref", expected.profile_root_ref],
    ["install_plan_ref", expected.install_plan_ref],
    ["rollback_plan_ref", expected.rollback_plan_ref],
    ["typed_phrase_hash", expected.typed_phrase_hash],
    ["expires_at", expected.expires_at],
    ["actor_class", expected.actor_class]
  ];
  return checks.flatMap(([key, value]) => ledger[key] === value ? [] : [String(key)]);
}

function validateDurableConfirmationLedgerAvailable(request: FlowDeskRelease1BootstrapInstallRequestV1, nowIso: string): ValidationResult {
  const pathResult = bootstrapConfirmationLedgerLocation(request.durableStateRootDir, request.typedConfirmation.confirmationRef);
  if (!pathResult.ok) return pathResult;
  if (pathResult.rootDir === undefined || pathResult.ledgerPath === undefined || pathResult.ledgerDir === undefined) return invalid("typed confirmation durable ledger path is unavailable");
  const readResult = readExistingDurableConfirmationLedger(pathResult as FlowDeskBootstrapConfirmationLedgerLocation);
  if (!readResult.ok) return readResult;
  if (readResult.ledger === undefined) return valid();

  const ledger = readResult.ledger;
  const expected = expectedConfirmationLedger(request, "pending", nowIso);
  const mismatches = existingLedgerBindingMismatches(ledger, expected);
  if (mismatches.length > 0) return invalid("typed confirmation durable ledger binding mismatch");
  if (ledger.status === "pending") return invalid("typed confirmation has already been claimed by durable ledger");
  if (ledger.status === "consumed") return invalid("typed confirmation has already been consumed by durable ledger");
  return invalid("typed confirmation durable ledger status is invalid");
}

function claimPendingDurableConfirmationLedger(request: FlowDeskRelease1BootstrapInstallRequestV1, nowIso: string): ValidationResult {
  const pathResult = bootstrapConfirmationLedgerLocation(request.durableStateRootDir, request.typedConfirmation.confirmationRef);
  if (!pathResult.ok) return pathResult;
  if (pathResult.rootDir === undefined || pathResult.ledgerPath === undefined || pathResult.ledgerDir === undefined) return invalid("typed confirmation durable ledger path is unavailable");
  const location = pathResult as FlowDeskBootstrapConfirmationLedgerLocation;

  const existing = readExistingDurableConfirmationLedger(location);
  if (!existing.ok) return existing;
  if (existing.ledger !== undefined) {
    const expected = expectedConfirmationLedger(request, "pending", nowIso);
    const mismatches = existingLedgerBindingMismatches(existing.ledger, expected);
    if (mismatches.length > 0) return invalid("typed confirmation durable ledger binding mismatch");
    if (existing.ledger.status === "pending") return invalid("typed confirmation has already been claimed by durable ledger");
    if (existing.ledger.status === "consumed") return invalid("typed confirmation has already been consumed by durable ledger");
    return invalid("typed confirmation durable ledger status is invalid");
  }

  const directoryValidation = validateRealLedgerDirectory(location, true);
  if (!directoryValidation.ok) return directoryValidation;
  try {
    writeFileSync(location.ledgerPath, `${JSON.stringify(expectedConfirmationLedger(request, "pending", nowIso), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    return valid();
  } catch (error) {
    const message = error instanceof Error ? error.message : "unknown error";
    return invalid(`typed confirmation durable ledger claim failed: ${message}`);
  }
}

function markDurableConfirmationLedgerConsumed(request: FlowDeskRelease1BootstrapInstallRequestV1, nowIso: string): ValidationResult {
  const pathResult = bootstrapConfirmationLedgerLocation(request.durableStateRootDir, request.typedConfirmation.confirmationRef);
  if (!pathResult.ok) return pathResult;
  if (pathResult.rootDir === undefined || pathResult.ledgerPath === undefined || pathResult.ledgerDir === undefined) return invalid("typed confirmation durable ledger path is unavailable");
  const location = pathResult as FlowDeskBootstrapConfirmationLedgerLocation;
  const existing = readExistingDurableConfirmationLedger(location);
  if (!existing.ok) return existing;
  if (existing.ledger === undefined) return invalid("typed confirmation durable ledger claim is missing");
  const createdAt = typeof existing.ledger.created_at === "string" ? existing.ledger.created_at : undefined;
  if (createdAt === undefined) return invalid("typed confirmation durable ledger claim timestamp is invalid");
  const expected = expectedConfirmationLedger(request, "pending", createdAt);
  const mismatches = existingLedgerBindingMismatches(existing.ledger, expected);
  if (mismatches.length > 0) return invalid("typed confirmation durable ledger binding mismatch");
  if (existing.ledger.status !== "pending") return invalid("typed confirmation durable ledger is not pending");

  const directoryValidation = validateRealLedgerDirectory(location, false);
  if (!directoryValidation.ok) return directoryValidation;
  const tempPath = resolve(location.ledgerDir, `.${request.typedConfirmation.confirmationRef}.${process.pid}.${Date.now()}.tmp`);
  try {
    writeFileSync(tempPath, `${JSON.stringify(expectedConfirmationLedger(request, "consumed", createdAt, nowIso), null, 2)}\n`, { encoding: "utf8", flag: "wx" });
    renameSync(tempPath, location.ledgerPath);
    return valid();
  } catch (error) {
    rmSync(tempPath, { force: true });
    const message = error instanceof Error ? error.message : "unknown error";
    return invalid(`typed confirmation durable ledger consume update failed: ${message}`);
  }
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

function rollbackCommandFiles(profileRootDir: string, refs: readonly string[] | undefined): string[] {
  const root = resolve(profileRootDir);
  const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
  const removed: string[] = [];
  for (const ref of refs ?? []) {
    const target = resolve(root, ref);
    if (target === root || !target.startsWith(rootPrefix)) continue;
    rmSync(target, { force: true });
    removed.push(ref);
  }
  return removed;
}

export function installFlowDeskRelease1Bootstrap(request: FlowDeskRelease1BootstrapInstallRequestV1): FlowDeskRelease1BootstrapInstallResultV1 {
  const now = request.now ?? new Date();
  const nowIso = now.toISOString();
  const artifactIds = ids(request.targetProfileRef);
  const requestValidation = validateRequest(request, artifactIds, now);
  if (!requestValidation.ok) return { ...requestValidation, ...resultBase() };
  const durableConfirmationValidation = validateDurableConfirmationLedgerAvailable(request, nowIso);
  if (!durableConfirmationValidation.ok) return { ...durableConfirmationValidation, ...resultBase() };

  const commandMaterialization = materializeFlowDeskPortableCommandFiles(request.profileRootDir);
  if (!commandMaterialization.ok) {
    const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
    return { ...invalid(...commandMaterialization.errors), commandMaterialization, commandFilesWritten: 0, bootstrapArtifactsWritten: 0, aliasFilesWritten: 0, rollbackCommandRefs, ...disabledBootstrapInstallAuthority };
  }

  const ledgerClaim = claimPendingDurableConfirmationLedger(request, nowIso);
  if (!ledgerClaim.ok) {
    const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
    return { ...invalid(...ledgerClaim.errors), commandMaterialization, profileRootDir: commandMaterialization.profileRootDir, commandFilesWritten: 0, bootstrapArtifactsWritten: 0, aliasFilesWritten: 0, rollbackCommandRefs, ...disabledBootstrapInstallAuthority };
  }

  const commandRefs = commandMaterialization.writtenCommandRefs?.map((ref) => `command-file-${ref.replace(/[^A-Za-z0-9_.:-]/g, "-")}`) ?? [];
  const artifacts = [
    installPlan(nowIso, request.targetProfileRef, request.typedConfirmation.confirmationRef, artifactIds.installPlanId, artifactIds.rollbackPlanId),
    commandGeneration(request.targetProfileRef, artifactIds.generationId, commandRefs),
    bootstrapReport(nowIso, request.targetProfileRef, artifactIds.installPlanId, artifactIds.generationId, artifactIds.reportId, artifactIds.handoffId),
    doctorHandoff(nowIso, artifactIds.installPlanId, artifactIds.reportId, artifactIds.handoffId)
  ];
  const prepared = artifacts.map((artifact) => prepareRedactedBootstrapArtifactWriteIntent(artifactIds.installPlanId, artifact));
  const prepareErrors = prepared.flatMap((entry) => entry.ok ? [] : entry.errors);
  const intents = prepared.map((entry) => entry.writeIntent).filter((intent): intent is NonNullable<typeof intent> => intent !== undefined);
  if (prepareErrors.length > 0 || intents.length !== artifacts.length) {
    const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
    return { ...invalid(...(prepareErrors.length > 0 ? prepareErrors : ["bootstrap artifact preparation failed"])), commandMaterialization, commandFilesWritten: 0, bootstrapArtifactsWritten: 0, aliasFilesWritten: 0, rollbackCommandRefs, ...disabledBootstrapInstallAuthority };
  }

  const durable = applyBootstrapWriteIntentsToDurableState(request.durableStateRootDir, intents);
  if (!durable.ok) {
    const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
    return { ...invalid(...durable.errors), commandMaterialization, profileRootDir: commandMaterialization.profileRootDir, durableStateRootDir: durable.rootDir, bootstrapArtifactRefs: durable.writtenPaths, commandFilesWritten: 0, bootstrapArtifactsWritten: durable.writtenPaths?.length ?? 0, aliasFilesWritten: 0, rollbackCommandRefs, ...disabledBootstrapInstallAuthority };
  }

  const ledgerWrite = markDurableConfirmationLedgerConsumed(request, nowIso);
  if (!ledgerWrite.ok) {
    const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
    return { ...invalid(...ledgerWrite.errors), commandMaterialization, profileRootDir: commandMaterialization.profileRootDir, durableStateRootDir: durable.rootDir, bootstrapArtifactRefs: durable.writtenPaths, commandFilesWritten: 0, bootstrapArtifactsWritten: durable.writtenPaths?.length ?? 0, aliasFilesWritten: 0, rollbackCommandRefs, ...disabledBootstrapInstallAuthority };
  }

  consumedBootstrapConfirmationRefs.add(request.typedConfirmation.confirmationRef);

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
