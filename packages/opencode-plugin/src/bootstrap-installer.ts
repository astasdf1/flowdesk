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
	agentProfileFilesWritten: number;
	profileConfigUpdated: boolean;
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
	rollbackProfileRefs?: string[];
}

export interface FlowDeskRelease1BootstrapTypedConfirmationInputV1 {
  profileRootDir: string;
  targetProfileRef: string;
  confirmationRef: string;
  expiresAt: string;
  typedPhrase: string;
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

function resultBase(): Pick<FlowDeskRelease1BootstrapInstallResultV1, "agentProfileFilesWritten" | "profileConfigUpdated" | "bootstrapArtifactsWritten" | "commandFilesWritten" | "aliasFilesWritten"> & typeof disabledBootstrapInstallAuthority {
	return { agentProfileFilesWritten: 0, profileConfigUpdated: false, bootstrapArtifactsWritten: 0, commandFilesWritten: 0, aliasFilesWritten: 0, ...disabledBootstrapInstallAuthority };
}

function expectedTypedPhrase(targetProfileRef: string, profileRootRef: string, confirmationRef: string, installPlanId: string): string {
  return `install FlowDesk release1 ${targetProfileRef} ${profileRootRef} ${confirmationRef} ${installPlanId}`;
}

export function expectedFlowDeskRelease1BootstrapApprovalPhrase(profileRootDir: string, targetProfileRef: string, confirmationRef: string): string {
  return expectedTypedPhrase(targetProfileRef, flowDeskBootstrapProfileRootRef(profileRootDir), confirmationRef, ids(targetProfileRef).installPlanId);
}

export function prepareFlowDeskRelease1BootstrapTypedConfirmation(input: FlowDeskRelease1BootstrapTypedConfirmationInputV1): FlowDeskRelease1BootstrapTypedConfirmationV1 {
  const artifactIds = ids(input.targetProfileRef);
  return {
    confirmationRef: input.confirmationRef,
    targetProfileRef: input.targetProfileRef,
    profileRootRef: flowDeskBootstrapProfileRootRef(input.profileRootDir),
    installPlanRef: artifactIds.installPlanId,
    rollbackPlanRef: artifactIds.rollbackPlanId,
    expiresAt: input.expiresAt,
    actorClass: "user",
    typedPhrase: input.typedPhrase
  };
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
		planned_phases: ["preflight", "profile_mutation", "command_generation", "doctor_handoff"],
    requires_typed_confirmation: true,
    confirmation_ref: typedConfirmationRef,
    package_ref: "package-flowdesk-opencode-plugin",
    rollback_plan_ref: rollbackPlanId,
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status"]
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
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status"],
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
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-usage", "/flowdesk-status"]
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

const flowDeskMainAgentName = "flowdesk-main";
const flowDeskMainAgentRef = "agent/flowdesk-main.md";

interface FlowDeskMainAgentMaterializationRollbackState {
	agentPath: string;
	agentExisted: boolean;
	previousAgentText?: string;
	configPath: string;
	configExisted: boolean;
	previousConfigText?: string;
	tuiConfigPath: string;
	tuiConfigExisted: boolean;
	previousTuiConfigText?: string;
}

interface FlowDeskMainAgentMaterializationResult extends ValidationResult {
	profileRootDir?: string;
	writtenProfileRefs?: string[];
	agentProfileFilesWritten: number;
	profileConfigUpdated: boolean;
	rollbackState?: FlowDeskMainAgentMaterializationRollbackState;
}

function flowDeskMainAgentMarkdown(): string {
	return `---
description: Primary FlowDesk coordinator for normal OpenCode work. Routes work through FlowDesk workflows, keeps main context small, and treats raw subtask/background paths as untracked unless FlowDesk owns them.
mode: primary
model: openai/gpt-5.3-codex-spark
permission:
  read: allow
  edit: allow
  glob: allow
  grep: allow
  list: allow
  todowrite: allow
  bash: allow
  task: allow
  question: allow
  skill: allow
  webfetch: allow
  lsp: allow
  external_directory:
    "*": allow
---

You are the FlowDesk primary coordinator for OpenCode.

Operational rules:

1. Treat normal work as a FlowDesk workflow first: intake, plan/update workflow state, run only command-backed or explicitly enabled FlowDesk lanes, then summarize results for the user.
2. Keep the main-agent role small: workflow author, FlowDesk lane/sub-agent dispatcher, result summarizer, Guard handoff, and safe next-action presenter.
3. Do not make the main session perform broad repository reading, large searches, multi-file investigation, or long review. Delegate that work to a FlowDesk-owned lane/sub-agent when available.
4. If only the raw OpenCode \`task\`/background path is available, use it sparingly and treat it as untracked unless FlowDesk durable evidence and a result-retrieval surface are both available.
5. For user requests that imply planning, review, run, status, diagnosis, install, or recovery, operate through FlowDesk commands and lanes first (/flowdesk-*), then summarize results.
6. If a sub-agent returns an empty result, tool-only transcript, timeout, aborted execution, or no final verdict, classify it as incomplete. Do not count it as success, approval, or review completion.
7. During delegated work, keep main context compact: ask for short findings, file/line references, decisions, blockers, and next actions; avoid copying full logs, prompts, transcripts, or large file contents into main context.
8. Before launching or continuing any long-running lane, make progress visible through FlowDesk status, lifecycle, heartbeat, or checkpoint evidence when the tool surface exists. If no FlowDesk lane owns the work, say it is outside FlowDesk stall monitoring.
9. Do not use OMO, OMC, Sisyphus, oh-my-openagent, or nested \`opencode run\` paths.
10. Do not claim that FlowDesk auto-retries, auto-aborts, auto-fallbacks, force-kills, or hard-cancels chat on stall unless a first-class FlowDesk/OpenCode control surface proves it. Surface /flowdesk-status, /flowdesk-retry, /flowdesk-resume, /flowdesk-abort, /flowdesk-doctor, and /flowdesk-export-debug as safe next actions.
11. Never persist or print raw provider tokens, auth payloads, raw prompts, transcripts, or debug bodies.

Install follow-through:

12. After FlowDesk is installed or updated, immediately verify the live diagnostics path by running /flowdesk-doctor, /flowdesk-usage, and /flowdesk-status.
13. If reviewer fanout diagnostics or SDK-health diagnostics are still unavailable, tell the user exactly which prerequisite is missing, whether a restart is required, and which command should be run next.
14. When a diagnostics path fails during install-time follow-through, prefer a concrete safe next action over silent success: explain the missing config, evidence, or restart boundary in plain language.

Work breakdown and lane sizing:

12. Before dispatching implementation, refactor, verification, or multi-file investigation work, create a short lane plan and keep each lane narrowly scoped. The coordinator is responsible for preventing mega-lanes that combine unrelated edits, tests, reviews, and release notes.
13. One lane should have exactly one primary objective and one clear deliverable. Long or complex work must be split into small lanes before dispatch, even when the user asks for one broad outcome. If the requested work cannot be expressed as a compact lane with one objective, do not dispatch it yet; split it first and launch only the first safe slice. Prefer 1-3 closely related files or one subsystem per implementation lane, and one failure mode, one bug, one test file, or one verification command family per analysis/verifier lane.
14. Never create a combined root-cause analysis + code search + implementation + verification mega-lane. Run RCA/search as a read-only lane first, implementation as a focused slice lane second, and verification as a separate focused lane or command check. Do not combine repository-wide code search with patch writing in one lane unless the search is trivial and bounded to the same 1-3 files being edited. Treat evidence/log inspection, source-code location, patch writing, validation, and release/progress documentation as separate objectives unless the edit is trivial and explicitly bounded.
15. Split into sequential lanes when a task combines two or more of these dimensions: durable evidence/schema, watchdog/runtime/session logic, TUI/sidebar/status presentation, workflow/auto-continue/fallback authority logic, agent/profile/config prompts, tests across multiple packages, or docs/progress snapshot updates.
16. Recommended fix sequence: root-cause read-only lane, one slice implementation lane with focused tests, focused verifier or command check, next slice only after the prior slice is terminal and judged usable, then broader build/test after all slices are in the working tree.
17. Unless the user explicitly overrides, run at most one active implementation lane for the same code area and at most two concurrent lanes total. Do not bundle more than one authority-sensitive change per lane, especially dispatch, fallback, write/apply, hard-chat, provider-call, or watchdog behavior.
18. If a lane reaches \`inconsistent_finalizing_without_terminal\`, \`MessageAbortedError\`, \`invocation_failed\`, or repeated nudge symptoms, stop expanding scope. Inspect FlowDesk status/evidence, salvage any patch, and relaunch only a smaller next slice.
19. If any lane receives one nudge, do not add scope or ask it to continue with extra work; wait only for its contracted deliverable. If it receives two nudges, ends with \`finalizing_without_terminal\`, or has many progress events without a final answer, treat the original slice as too large and retry only with a materially smaller scope. Do not treat continuous progress events as proof that a lane should keep running indefinitely. Retrying the same prompt on a different model is not enough; reduce the objective count and file/evidence scope first.

Natural-language auto-invocation policy:

20. When the user's intent matches a registered FlowDesk natural-language tool's WHEN TO USE or ALSO PROACTIVELY USE block, call that tool directly instead of asking for confirmation. The plugin user already opted in at configuration time. Tools to auto-call on intent match: \`flowdesk_quick_reviewer_run\` (review/critique/audit), \`flowdesk_provider_usage_live\` (usage/quota/availability), \`flowdesk_status_live\` (status/progress/follow-up "방금/직전/결과는?"), \`flowdesk_quick_fallback_run\` (explicit provider switch), \`flowdesk_lane_heartbeat_record\` (heartbeat / progress signal request).
21. Before launching a large multi-step task that depends on a specific provider (extensive refactor, long agentic loop, multi-perspective review), call \`flowdesk_provider_usage_live\` first; if worstAlertLevel is critical or exhausted, warn the user and ask whether to proceed, switch providers, or wait for reset.
22. After invoking a real-work FlowDesk tool, when the user asks a vague follow-up about the just-completed work ("잘 됐어?", "결과는?", "how did it go?"), call \`flowdesk_status_live\` with the just-created workflowId rather than guessing from memory.
23. When a FlowDesk tool result contains a \`summaryForUser\` string, surface that field verbatim or compress it; do not paraphrase critical fields (verdict labels, alert levels, blocker reasons) away.
24. If user intent is ambiguous between a FlowDesk tool and general chat, ask one focused clarification question first; do not silently fall through to general chat for known intent phrases.
`;
}

function readOptionalText(path: string): ValidationResult & { exists: boolean; text?: string } {
	try {
		return { ...valid(), exists: true, text: readFileSync(path, "utf8") };
	} catch (error) {
		if (error instanceof Error && "code" in error && error.code === "ENOENT") return { ...valid(), exists: false };
		const message = error instanceof Error ? error.message : "unknown error";
		return { ...invalid(`profile file read failed: ${message}`), exists: false };
	}
}

function flowDeskTuiConfig(profileRootDir: string, durableStateRootDir: string): Record<string, unknown> {
	return {
		plugin: [
			[
				resolve(profileRootDir, "node_modules", "@flowdesk", "opencode-plugin", "dist", "tui.js"),
				{
					durableStateRootDir: resolve(durableStateRootDir),
					usageWorkflowId: "workflow-global-provider-usage",
				},
			],
		],
	};
}

function materializeFlowDeskMainAgentProfile(profileRootDir: string): FlowDeskMainAgentMaterializationResult {
	return materializeFlowDeskMainAgentProfileWithTui(profileRootDir, profileRootDir);
}

function materializeFlowDeskMainAgentProfileWithTui(profileRootDir: string, durableStateRootDir: string): FlowDeskMainAgentMaterializationResult {
	const root = resolve(profileRootDir);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	const agentPath = resolve(root, flowDeskMainAgentRef);
	const configPath = resolve(root, "opencode.json");
	const tuiConfigPath = resolve(root, "tui.json");
	if (!agentPath.startsWith(rootPrefix) || !configPath.startsWith(rootPrefix) || !tuiConfigPath.startsWith(rootPrefix)) {
		return { ...invalid("FlowDesk main agent paths escape profile root"), agentProfileFilesWritten: 0, profileConfigUpdated: false };
	}

	const previousConfig = readOptionalText(configPath);
	if (!previousConfig.ok) return { ...previousConfig, agentProfileFilesWritten: 0, profileConfigUpdated: false };
	const previousAgent = readOptionalText(agentPath);
	if (!previousAgent.ok) return { ...previousAgent, agentProfileFilesWritten: 0, profileConfigUpdated: false };
	const previousTuiConfig = readOptionalText(tuiConfigPath);
	if (!previousTuiConfig.ok) return { ...previousTuiConfig, agentProfileFilesWritten: 0, profileConfigUpdated: false };

	let config: Record<string, unknown>;
	if (previousConfig.exists && previousConfig.text !== undefined) {
		try {
			const parsed = JSON.parse(previousConfig.text) as unknown;
			if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return { ...invalid("opencode.json must contain an object before FlowDesk main agent installation"), agentProfileFilesWritten: 0, profileConfigUpdated: false };
			config = parsed as Record<string, unknown>;
		} catch (error) {
			const message = error instanceof Error ? error.message : "unknown error";
			return { ...invalid(`opencode.json parse failed before FlowDesk main agent installation: ${message}`), agentProfileFilesWritten: 0, profileConfigUpdated: false };
		}
	} else {
		config = { $schema: "https://opencode.ai/config.json" };
	}
	if (typeof config.$schema !== "string") config.$schema = "https://opencode.ai/config.json";
	config.default_agent = flowDeskMainAgentName;

	try {
		mkdirSync(resolve(root, "agent"), { recursive: true });
		writeFileSync(agentPath, flowDeskMainAgentMarkdown(), "utf8");
		writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
		writeFileSync(tuiConfigPath, `${JSON.stringify(flowDeskTuiConfig(root, durableStateRootDir), null, 2)}\n`, "utf8");
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return { ...invalid(`FlowDesk main agent profile write failed: ${message}`), agentProfileFilesWritten: 0, profileConfigUpdated: false };
	}

	return {
		...valid(),
		profileRootDir: root,
		writtenProfileRefs: [flowDeskMainAgentRef, "opencode.json", "tui.json"],
		agentProfileFilesWritten: 1,
		profileConfigUpdated: true,
		rollbackState: {
			agentPath,
			agentExisted: previousAgent.exists,
			previousAgentText: previousAgent.text,
			configPath,
			configExisted: previousConfig.exists,
			previousConfigText: previousConfig.text,
			tuiConfigPath,
			tuiConfigExisted: previousTuiConfig.exists,
			previousTuiConfigText: previousTuiConfig.text,
		}
	};
}

function rollbackFlowDeskMainAgentProfile(state: FlowDeskMainAgentMaterializationRollbackState | undefined): string[] {
	if (state === undefined) return [];
	const rolledBack: string[] = [];
	if (state.agentExisted && state.previousAgentText !== undefined) writeFileSync(state.agentPath, state.previousAgentText, "utf8");
	else rmSync(state.agentPath, { force: true });
	rolledBack.push(flowDeskMainAgentRef);
	if (state.configExisted && state.previousConfigText !== undefined) writeFileSync(state.configPath, state.previousConfigText, "utf8");
	else rmSync(state.configPath, { force: true });
	rolledBack.push("opencode.json");
	if (state.tuiConfigExisted && state.previousTuiConfigText !== undefined) writeFileSync(state.tuiConfigPath, state.previousTuiConfigText, "utf8");
	else rmSync(state.tuiConfigPath, { force: true });
	rolledBack.push("tui.json");
	return rolledBack;
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
		return { ...invalid(...commandMaterialization.errors), commandMaterialization, ...resultBase(), rollbackCommandRefs };
	}

	const mainAgentMaterialization = materializeFlowDeskMainAgentProfileWithTui(request.profileRootDir, request.durableStateRootDir);
	if (!mainAgentMaterialization.ok) {
		const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
		const rollbackProfileRefs = rollbackFlowDeskMainAgentProfile(mainAgentMaterialization.rollbackState);
		return { ...invalid(...mainAgentMaterialization.errors), commandMaterialization, ...resultBase(), rollbackCommandRefs, rollbackProfileRefs };
	}

	const ledgerClaim = claimPendingDurableConfirmationLedger(request, nowIso);
	if (!ledgerClaim.ok) {
		const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
		const rollbackProfileRefs = rollbackFlowDeskMainAgentProfile(mainAgentMaterialization.rollbackState);
		return { ...invalid(...ledgerClaim.errors), commandMaterialization, profileRootDir: commandMaterialization.profileRootDir, ...resultBase(), rollbackCommandRefs, rollbackProfileRefs };
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
		const rollbackProfileRefs = rollbackFlowDeskMainAgentProfile(mainAgentMaterialization.rollbackState);
		return { ...invalid(...(prepareErrors.length > 0 ? prepareErrors : ["bootstrap artifact preparation failed"])), commandMaterialization, ...resultBase(), rollbackCommandRefs, rollbackProfileRefs };
	}

  const durable = applyBootstrapWriteIntentsToDurableState(request.durableStateRootDir, intents);
	if (!durable.ok) {
		const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
		const rollbackProfileRefs = rollbackFlowDeskMainAgentProfile(mainAgentMaterialization.rollbackState);
		return { ...invalid(...durable.errors), commandMaterialization, profileRootDir: commandMaterialization.profileRootDir, durableStateRootDir: durable.rootDir, bootstrapArtifactRefs: durable.writtenPaths, ...resultBase(), bootstrapArtifactsWritten: durable.writtenPaths?.length ?? 0, rollbackCommandRefs, rollbackProfileRefs };
	}

  const ledgerWrite = markDurableConfirmationLedgerConsumed(request, nowIso);
	if (!ledgerWrite.ok) {
		const rollbackCommandRefs = rollbackCommandFiles(request.profileRootDir, commandMaterialization.writtenCommandRefs);
		const rollbackProfileRefs = rollbackFlowDeskMainAgentProfile(mainAgentMaterialization.rollbackState);
		return { ...invalid(...ledgerWrite.errors), commandMaterialization, profileRootDir: commandMaterialization.profileRootDir, durableStateRootDir: durable.rootDir, bootstrapArtifactRefs: durable.writtenPaths, ...resultBase(), bootstrapArtifactsWritten: durable.writtenPaths?.length ?? 0, rollbackCommandRefs, rollbackProfileRefs };
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
		agentProfileFilesWritten: mainAgentMaterialization.agentProfileFilesWritten,
		profileConfigUpdated: mainAgentMaterialization.profileConfigUpdated,
		aliasFilesWritten: 0,
    doctorHandoffRef: artifactIds.handoffId,
    ...disabledBootstrapInstallAuthority
  };
}
