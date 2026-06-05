import { createHash } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, realpathSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { resolve, sep } from "node:path";
import { pathToFileURL } from "node:url";
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

const flowDeskWriteCapableSubagentNames = new Set([
	"flowdesk-code-backend",
	"flowdesk-code-frontend",
	"flowdesk-code-language-specialist",
	"flowdesk-docs-writer",
	"flowdesk-migration-refactor",
]);

const flowDeskBuildTestCapableSubagentNames = new Set([
	"flowdesk-code-backend",
	"flowdesk-code-frontend",
	"flowdesk-code-language-specialist",
	"flowdesk-migration-refactor",
	"flowdesk-performance",
	"flowdesk-verifier-testing",
]);

const flowDeskReadOnlyGitCapableSubagentNames = new Set([
	"flowdesk-architecture",
	"flowdesk-algorithm-architect",
	"flowdesk-critical-reviewer",
	"flowdesk-docs-writer",
	"flowdesk-explorer-researcher",
	"flowdesk-git-master",
	"flowdesk-oracle-decision",
	"flowdesk-performance",
	"flowdesk-security-policy",
	"flowdesk-verifier-testing",
]);

const flowDeskReleasePackageVerificationCommandAllows = [
	"git diff --check",
	"git status --short",
	"npm ls --workspace @flowdesk/core",
	"npm ls --workspace @flowdesk/opencode-plugin",
	"npm ls @opencode-ai/plugin @opentui/core @flowdesk/core --workspace @flowdesk/opencode-plugin",
	"npm pack --dry-run --json --workspace @flowdesk/core",
	"npm pack --dry-run --json --workspace @flowdesk/opencode-plugin",
	"opencode --version",
	"npm run build --workspace @flowdesk/core",
	"npm run build --workspace @flowdesk/opencode-plugin",
	"node --test packages/opencode-plugin/dist/bootstrap-installer.test.js packages/opencode-plugin/dist/project-agent-profiles.test.js",
] as const;

const flowDeskMutatingGitCommandDenials = [
	"git add*",
	"git am*",
	"git apply*",
	"git bisect*",
	"git branch -d*",
	"git branch -D*",
	"git checkout*",
	"git cherry-pick*",
	"git clean*",
	"git commit*",
	"git merge*",
	"git mv*",
	"git pull*",
	"git push*",
	"git rebase*",
	"git reflog expire*",
	"git reset*",
	"git restore*",
	"git revert*",
	"git rm*",
	"git stash*",
	"git switch*",
	"git tag*",
	"gh pr merge*",
];

const flowDeskReleasePackageVerificationCommandDenials = [
	"npm publish*",
	"npm install*",
	"npm update*",
	"npm add*",
	"npm ci*",
	"rm*",
	...flowDeskMutatingGitCommandDenials,
] as const;

const flowDeskDangerousGitCommandDenials = [
	"git am*",
	"git apply*",
	"git bisect*",
	"git branch -d*",
	"git branch -D*",
	"git checkout*",
	"git cherry-pick*",
	"git clean*",
	"git commit --amend*",
	"git merge*",
	"git mv*",
	"git pull*",
	"git push --force*",
	"git push -f*",
	"git rebase*",
	"git reflog expire*",
	"git reset*",
	"git restore*",
	"git revert*",
	"git rm*",
	"git stash*",
	"git switch*",
	"git tag -d*",
	"gh pr merge*",
];

const flowDeskSubagentProfiles = [
	["flowdesk-docs-writer", "Use when FlowDesk documentation, README, changelog, runbook, or user guide text needs drafting, editing, or review.", "documentation writer", "Draft and edit concise documentation for FlowDesk features, user flows, runbooks, release notes, and troubleshooting material.", "openai/gpt-5.5"],
	["flowdesk-explorer-researcher", "Use when an unknown FlowDesk code path, API surface, or implementation option needs repository research.", "explorer researcher", "Research repository structure, APIs, implementation options, and evidence without editing files.", "openai/gpt-5.5"],
	["flowdesk-git-master", "Use when FlowDesk git status, diff scope, commit planning, commit execution, or push readiness is needed.", "git master", "Analyze git status, diffs, commit scope, branch readiness, and execute user-approved ordinary staging, commit, and non-force push actions.", "openai/gpt-5.5"],
	["flowdesk-code-backend", "Use when FlowDesk backend, CLI, SDK, persistence, or TypeScript service logic needs implementation or a patch plan.", "backend code", "Implement bounded backend, CLI, SDK, persistence, and TypeScript service changes.", "openai/gpt-5.5"],
	["flowdesk-code-frontend", "Use when FlowDesk UI, status card, chat surface, React, CSS, or accessibility work needs implementation or a patch plan.", "frontend code", "Implement bounded UI, status card, chat surface, React, CSS, and accessibility changes.", "openai/gpt-5.5"],
	["flowdesk-code-language-specialist", "Use when a FlowDesk task depends on language-specific TypeScript, shell, JSON schema, config, or runtime details.", "language specialist", "Analyze and patch bounded TypeScript, Node.js, shell, JSON schema, package script, and config details.", "openai/gpt-5.5"],
	["flowdesk-critical-reviewer", "Use when FlowDesk code, docs, plans, or designs need adversarial review for bugs and regressions.", "critical reviewer", "Review proposed code, docs, plans, or designs for correctness, regressions, missing tests, and unsafe claims.", "anthropic/claude-opus-4-7"],
	["flowdesk-architecture", "Use when FlowDesk module boundaries, contracts, APIs, workflow design, or migration shape need architecture analysis.", "architecture reviewer", "Analyze module boundaries, contracts, APIs, workflow design, and migration shape.", "anthropic/claude-opus-4-7"],
	["flowdesk-algorithm-architect", "Use when FlowDesk needs complex algorithm, data-structure, state-machine, scheduler, optimization, or formal design analysis before implementation.", "algorithm architect", "Design complex algorithms, data structures, state machines, schedulers, optimization strategies, and correctness constraints before implementation.", "openai/gpt-5.5"],
	["flowdesk-oracle-decision", "Use when FlowDesk reviewer, architecture, implementation, or verification lanes disagree and need a recommendation.", "oracle decision", "Synthesize disagreements into a recommendation with assumptions, confidence, and residual risks.", "openai/gpt-5.5"],
	["flowdesk-verifier-testing", "Use when FlowDesk tests, reproduction steps, validation commands, or verification evidence need analysis.", "verifier and testing", "Design verification plans, run or analyze bounded test/build evidence when allowed, and identify remaining gaps.", "openai/gpt-5.5"],
	["flowdesk-release-package-verifier", "Use when FlowDesk release/package verification needs npm pack, package diff, workspace version, or package metadata checks.", "release package verifier", "Run or analyze narrow release/package verification evidence including npm pack dry-runs, package metadata, git whitespace diff checks, and version checks.", "openai/gpt-5.5"],
	["flowdesk-security-policy", "Use when FlowDesk permissions, redaction, auth, provider use, safety gates, or threat-model policy need review.", "security policy", "Review permissions, redaction, auth, provider use, safety gates, and threat-model policy.", "anthropic/claude-opus-4-7"],
	["flowdesk-performance", "Use when FlowDesk latency, quota, memory, fan-out cost, or bottleneck behavior needs analysis.", "performance", "Analyze latency, quota, memory, fan-out cost, and bottleneck behavior without editing files.", "openai/gpt-5.5"],
	["flowdesk-migration-refactor", "Use when FlowDesk schema migration, module split, rename, cleanup, or refactor sequencing needs implementation or a plan.", "migration refactor", "Implement bounded schema migration, module split, rename, cleanup, or refactor sequencing changes.", "openai/gpt-5.5"],
] as const;

/**
 * Background subagent bash policy: NO `ask` rules — only `allow` and `deny`.
 *
 * `ask` causes permanent stall in background child sessions because the
 * permission UI is unreachable. Instead we use explicit allow-lists per role
	 * tier with `"*": deny` first so later explicit allow rules win under
	 * OpenCode's last-match-wins permission evaluation.
 *
 * Tier 1 — advisory-readonly: safe inspection commands only.
 * Tier 2 — implementation: Tier 1 + build/test/verification commands.
 * Tier 3 — git-master: broad allow + dangerous git deny (existing policy).
 */
function flowDeskBashPermissionLines(agentName: string, indent = "  "): string {
	// Tier 3: git-master keeps existing broad policy
	if (agentName === "flowdesk-git-master") {
		const lines = [`${indent}bash:`, `${indent}  "*": allow`];
		for (const command of flowDeskDangerousGitCommandDenials) lines.push(`${indent}  "${command}": deny`);
		return lines.join("\n");
	}

	if (agentName === "flowdesk-release-package-verifier") {
		const lines = [`${indent}bash:`, `${indent}  "*": deny`];
		for (const command of flowDeskReleasePackageVerificationCommandAllows) lines.push(`${indent}  "${command}": allow`);
		for (const command of flowDeskReleasePackageVerificationCommandDenials) lines.push(`${indent}  "${command}": deny`);
		return lines.join("\n");
	}

	// Tier 1 — safe inspection commands (all non-git-master subagents get these).
	// OpenCode permission rules are last-match-wins, so the catch-all deny must
	// appear before explicit allow rules.
	const lines = [`${indent}bash:`, `${indent}  "*": deny`];
	lines.push(
		`${indent}  "head *": allow`,
		`${indent}  "tail *": allow`,
		`${indent}  "cat *": allow`,
		`${indent}  "less *": allow`,
		`${indent}  "grep *": allow`,
		`${indent}  "rg *": allow`,
		`${indent}  "find *": allow`,
		`${indent}  "ls *": allow`,
		`${indent}  "ls": allow`,
		`${indent}  "pwd": allow`,
		`${indent}  "wc *": allow`,
		`${indent}  "file *": allow`,
		`${indent}  "which *": allow`,
		`${indent}  "echo *": allow`,
		`${indent}  "sort *": allow`,
		`${indent}  "uniq *": allow`,
		`${indent}  "diff *": allow`,
		`${indent}  "sed *": allow`,
		`${indent}  "awk *": allow`,
		`${indent}  "cut *": allow`,
		`${indent}  "tr *": allow`,
		`${indent}  "jq *": allow`,
		`${indent}  "python3 -c *": allow`,
		`${indent}  "node -e *": allow`,
		`${indent}  "basename *": allow`,
		`${indent}  "dirname *": allow`,
		`${indent}  "realpath *": allow`,
		`${indent}  "stat *": allow`,
		`${indent}  "date*": allow`,
		`${indent}  "sleep *": allow`,
	);

	// Git read-only commands
	if (flowDeskReadOnlyGitCapableSubagentNames.has(agentName)) {
		lines.push(
			`${indent}  "git status": allow`,
			`${indent}  "git status --short": allow`,
			`${indent}  "git status *": allow`,
			`${indent}  "git diff": allow`,
			`${indent}  "git diff --check": allow`,
			`${indent}  "git diff *": allow`,
			`${indent}  "git log": allow`,
			`${indent}  "git log *": allow`,
			`${indent}  "git show": allow`,
			`${indent}  "git show *": allow`,
			`${indent}  "git branch --show-current": allow`,
			`${indent}  "git branch -a": allow`,
			`${indent}  "git remote -v": allow`,
			`${indent}  "git rev-parse": allow`,
			`${indent}  "git rev-parse *": allow`,
			`${indent}  "git ls-files": allow`,
			`${indent}  "git ls-files *": allow`,
		);
	}

	// Tier 2 — build/test/verification commands
	if (flowDeskBuildTestCapableSubagentNames.has(agentName)) {
		lines.push(
			`${indent}  "npm run build": allow`,
			`${indent}  "npm run build --workspace @flowdesk/opencode-plugin": allow`,
			`${indent}  "npm run build *": allow`,
			`${indent}  "npm run typecheck": allow`,
			`${indent}  "npm run typecheck *": allow`,
			`${indent}  "npm run test": allow`,
			`${indent}  "npm run test *": allow`,
			`${indent}  "npm test": allow`,
			`${indent}  "npm test *": allow`,
			`${indent}  "node scripts/run-tests.mjs": allow`,
			`${indent}  "node scripts/run-tests.mjs --mode functional --package core": allow`,
			`${indent}  "node scripts/run-tests.mjs *": allow`,
			`${indent}  "node ../../scripts/run-tests.mjs": allow`,
			`${indent}  "node ../../scripts/run-tests.mjs *": allow`,
			`${indent}  "node --test": allow`,
			`${indent}  "node --test packages/opencode-plugin/dist/bootstrap-installer.test.js packages/opencode-plugin/dist/project-agent-profiles.test.js": allow`,
			`${indent}  "node --test *": allow`,
			`${indent}  "npx tsc": allow`,
			`${indent}  "npx tsc *": allow`,
			`${indent}  "npm ls": allow`,
			`${indent}  "npm ls *": allow`,
			`${indent}  "npm run lint": allow`,
			`${indent}  "npm run lint *": allow`,
		);
	}

	return lines.join("\n");
}

function flowDeskMainBashPermissionLines(indent = "  "): string {
	const lines = [`${indent}bash:`, `${indent}  "*": allow`];
	for (const command of flowDeskDangerousGitCommandDenials) lines.push(`${indent}  "${command}": deny`);
	return lines.join("\n");
}

function flowDeskSubagentMarkdown([agentName, description, roleLabel, roleSummary, model]: (typeof flowDeskSubagentProfiles)[number]): string {
	const editPermission = flowDeskWriteCapableSubagentNames.has(agentName) ? "allow" : "deny";
	const webfetchPermissionLine = agentName === "flowdesk-explorer-researcher" ? "  webfetch: allow\n" : "";
	const gitPolicyLine = agentName === "flowdesk-git-master"
		? "Bash allows ordinary git staging, commit, and non-force push when explicitly requested, while denying destructive rollback, force-push, and history-rewrite commands."
		: "Bash has an explicit safe-command allowlist with everything else denied; no ask rules exist because background subagent sessions cannot show permission UI.";
	return `---
description: ${description}
mode: subagent
model: ${model}
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  edit: ${editPermission}
${flowDeskBashPermissionLines(agentName)}
${webfetchPermissionLine}
  external_directory:
    "*": allow
---

You are the FlowDesk ${roleLabel} subagent.

Role:
- ${roleSummary}
- Keep work bounded to the assigned FlowDesk task and report uncertainty with file or evidence references.

Release 1 constraints:
- ${editPermission === "allow" ? "This profile is write-capable only for bounded edits that match the assigned implementation, documentation, or refactor task." : "Edit permission is denied; provide analysis, recommendations, or verification evidence without patching files."}
- External-directory access is allowed only as an OpenCode boundary permission so read/glob/grep/list can inspect external paths; bash and edit remain governed by their separate permissions above.
- ${gitPolicyLine}
- Do not claim dispatch approval, fallback approval, release approval, hard chat cancellation, or runtime execution authority.

Output contract:
- Return concise findings, changed or relevant files, caveats, and tests or evidence that should be run.
`;
}

function flowDeskAgentProfileTemplates(): Array<{ ref: string; markdown: string }> {
	return [
		{ ref: flowDeskMainAgentRef, markdown: flowDeskMainAgentMarkdown() },
		...flowDeskSubagentProfiles.map((profile) => ({ ref: `agent/${profile[0]}.md`, markdown: flowDeskSubagentMarkdown(profile) })),
	];
}

interface FlowDeskAgentProfileRollbackEntry {
	ref: string;
	path: string;
	existed: boolean;
	previousText?: string;
}

interface FlowDeskMainAgentMaterializationRollbackState {
	agentFiles: FlowDeskAgentProfileRollbackEntry[];
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
description: Primary FlowDesk coordinator. Plans workflows, splits work into small FlowDesk-owned lanes, and summarizes durable results.
mode: primary
model: openai/gpt-5.3-codex-spark
permission:
  read: allow
  glob: allow
  grep: allow
  list: allow
  edit: allow
  todowrite: allow
${flowDeskMainBashPermissionLines()}
  task: deny
  question: allow
  skill: allow
  webfetch: allow
  lsr: allow
  external_directory:
    "*": allow
---

You are the FlowDesk primary coordinator for OpenCode.

## Role

You orchestrate; you do not act as a broad implementer.

1. Plan: split the user's goal into small FlowDesk-owned slices.
2. Dispatch: launch delegated work only through FlowDesk tools.
3. Summarize: judge captured lane results and present concise next actions.

## Mandatory dispatch boundary

All delegated analysis, implementation, search, review, verification, and documentation subtasks must use \`flowdesk_agent_task_run\`. Do not use raw \`task\`, background sessions, ad-hoc subagents, nested OpenCode CLI execution, unsupported autonomous runtimes, or hidden prompt-injection patterns for FlowDesk work.

Every \`flowdesk_agent_task_run\` call must include:

\`\`\`ts
parentSessionId: ""
developerModeAcknowledged: true
allowProviderCall: true
nudgeQuietPeriodMs: 10000
\`\`\`

\`flowdesk_quick_reviewer_run\` remains quarantined until explicitly revalidated by the user; use explicit \`flowdesk_agent_task_run\` reviewer lanes instead.

If FlowDesk-owned lanes are unsafe or blocked, stop and report the blocker, or do only a bounded direct main-session action with normal tools. Do not bypass FlowDesk monitoring with untracked subagents.

## Lane Size Gate — apply before every dispatch

Before each \`flowdesk_agent_task_run\`, state the slice briefly and launch only if all are true:

- exactly 1 primary objective
- exactly 1 clear deliverable
- compact scope: 1-3 closely related files, one subsystem, one failure mode, one bug, one test file, or one verification command family
- no mixing of implementation with broad search, full-suite verification, release notes, docs/progress updates, or unrelated config/install work

Split sequentially when a request combines two or more of these dimensions:

1. durable evidence/schema
2. watchdog/runtime/session logic
3. TUI/sidebar/status presentation
4. workflow/auto-continue/fallback authority logic
5. agent/profile/config prompt changes
6. installer/materialization behavior
7. tests across multiple packages or full-suite verification
8. docs/progress snapshot updates

Recommended sequence: read-only root-cause slice → one focused implementation slice → focused verifier slice → next implementation slice only after the prior slice is terminal and judged usable → broader build/test at the end.

Hard limits unless the user explicitly overrides:

- at most 1 active implementation lane for the same code area
- at most 5 concurrent lanes total, only for independent areas
- multi-model reviews count as one lane per perspective and must stay within the 5-concurrent cap
- never bundle more than one authority-sensitive change per lane, especially dispatch, fallback, write/apply, hard-chat, provider-call, or watchdog behavior
- if a lane reaches \`inconsistent_finalizing_without_terminal\`, \`MessageAbortedError\`, \`invocation_failed\`, repeated nudges, or many progress events without a final answer, stop expanding scope; inspect status/evidence, salvage any patch, and relaunch only a materially smaller slice

When presenting a plan, list slices explicitly, for example: \`slice 1: status display only; slice 2: quiet-period persistence; slice 3: focused tests\`.

## Agent routing

Use the narrowest project-local \`flowdesk-*\` agent whose role matches the slice. Do not send implementation, refactor, docs, or verification work to generic \`reviewer-*\` profiles unless the user explicitly asks.

| Task type | Agent | Model |
|---|---|---|
| Backend/plugin/core implementation | flowdesk-code-backend | openai/gpt-5.5 |
| Frontend/chat/status UI implementation | flowdesk-code-frontend | openai/gpt-5.5 |
| TypeScript/schema/config/runtime detail | flowdesk-code-language-specialist | openai/gpt-5.5 |
| Migration/refactor/module split | flowdesk-migration-refactor | openai/gpt-5.5 |
| Tests/reproduction/verification | flowdesk-verifier-testing | openai/gpt-5.5 |
| Documentation/user guide/runbook | flowdesk-docs-writer | openai/gpt-5.5 |
| Security/policy analysis | flowdesk-security-policy | anthropic/claude-opus-4-7 |
| Architecture/design | flowdesk-architecture | openai/gpt-5.5 |
| Critical/adversarial review | flowdesk-critical-reviewer | anthropic/claude-opus-4-7 |
| Git diff/commit planning | flowdesk-git-master | openai/gpt-5.5 |

For implementation work, dispatch an edit-capable code/docs/refactor lane first, then a separate verifier/reviewer lane if needed.

## Usage-aware multi-lane routing

Before multi-perspective reviews or other multi-lane fan-out, call \`flowdesk_provider_usage_live\` and route from fresh usage evidence.

Default healthy bindings:

| Perspective | Agent | Model |
|---|---|---|
| Security/policy | flowdesk-security-policy | anthropic/claude-opus-4-7 |
| Architecture/design | flowdesk-architecture | openai/gpt-5.5 |
| Implementation/verification | flowdesk-verifier-testing | google/gemini-3.1-flash-lite-preview |

For multi-model or multi-perspective reviews, count one lane per perspective and stay within the 5-concurrent-lane cap. If a provider is critical, exhausted, stale, unknown, or non-dispatchable, avoid that binding unless the user insists. Substitute usage-aware alternatives without calling managed fallback tools; this is pre-launch routing, not provider fallback authority. Do not select \`google/gemini-3.1-pro-preview\` unless fresh exact-model availability confirms it.

## Status, nudge, and result handling

\`task_launched\` is launch ack only, not progress, completion, approval, or todo completion. Do not call \`flowdesk_status_live\` immediately just to confirm startup.

Wake prompts are notification triggers only; durable status/result evidence remains the source of truth.

Call \`flowdesk_status_live\` when: a FlowDesk wake arrives; launch result failed/uncertain or lacks workflow/lane ids; the user asks status/progress/result (for example “잘 됐어?”, “결과는?”, “어디까지?”, “진행 상황”, “how did it go?”); the next decision depends on lane state/result; stalled/late/recovery is suspected; multi-lane synthesis needs durable evidence; or a bounded heartbeat/status duty requires it.

Otherwise continue independent in-scope work without polling. If work is dependent on the lane, gracefully conclude with the pending workflowId/laneId and \`/flowdesk-status\`; do not mark todos completed from launch ack alone.

When multiple lanes are in flight, do not wait for all lanes by default. If a completed lane is independent of still-running lanes, inspect its durable result and continue the next independent in-scope step. Wait for all lanes only when the next decision, synthesis, approval, or verification depends on their aggregate result. Never mark an aggregate todo complete until all required dependent lanes are terminal or explicitly handled as failed/stalled.

Never manually wait for a stalled lane. Let FlowDesk status/watchdog evidence classify it; then surface safe next actions such as /flowdesk-status, /flowdesk-retry, /flowdesk-resume, /flowdesk-abort, /flowdesk-doctor, or /flowdesk-export-debug. For long-running work, record heartbeats only when you own a stable FlowDesk lane id.

Lane capture is not substantive approval. Read captured \`resultText\`/\`summaryForUser\` plus advisory metadata and judge success yourself. Treat a lane as failed only when it genuinely has no text or transport/launch failure (\`sdk_create_failed\`, \`launch_timeout\`, \`no_response\`). Do not reject results merely for missing JSON, process-note shape, or missing contract. On judged substance failure, retry at most twice with a fresh smaller prompt and a usage-aware different model; do not call managed fallback for this coordinator retry.

## Auto-invocation rules

Call FlowDesk tools directly on clear intent:

- usage/quota/remaining/reset → \`flowdesk_provider_usage_live\`
- status/progress/recent result/stalled → \`flowdesk_status_live\`; see Status, nudge, and result handling
- explicit provider switch/retry on another provider → \`flowdesk_quick_fallback_run\`
- heartbeat/progress signal request → \`flowdesk_lane_heartbeat_record\`
- delegated subtask to a specific agent/model → \`flowdesk_agent_task_run\`
- review/critique/audit → explicit \`flowdesk_agent_task_run\` reviewer lane(s); see Usage-aware multi-lane routing

Ask one focused clarification question when intent is ambiguous between FlowDesk action and ordinary chat.

## Todo and safety discipline

Use \`todowrite\` for non-trivial work, verification, patching, reviews, multi-step investigation, or whenever new instructions arrive. Keep exactly one item \`in_progress\`; update it as work completes or blocks; do not give a final answer until todos reflect the real state.

Keep main context small. Do not paste large file contents, raw transcripts, provider payloads, tokens, raw prompts, or debug bodies. Do not claim auto-retry, auto-abort, auto-fallback, hard chat cancellation, or no-reply authority unless durable FlowDesk/OpenCode evidence proves it.
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

function flowDeskPluginServerFileUrl(profileRootDir: string): string {
	return pathToFileURL(resolve(profileRootDir, "node_modules", "@flowdesk", "opencode-plugin", "dist", "server.js")).href;
}

function flowDeskPluginDefaultOptions(durableStateRootDir: string): Record<string, unknown> {
	const providerAcquisitionAllowedModelIds = [
		"anthropic/claude-opus-4-7",
		"claude/claude-opus-4-7",
		"anthropic/claude-opus-4-8",
		"claude/claude-opus-4-8",
		"anthropic/claude-opus-4-6",
		"claude/claude-opus-4-6",
		"anthropic/claude-opus-4-5",
		"claude/claude-opus-4-5",
		"anthropic/claude-opus-4-1",
		"claude/claude-opus-4-1",
		"anthropic/claude-opus-4-0",
		"claude/claude-opus-4-0",
		"anthropic/claude-sonnet-4-6",
		"claude/claude-sonnet-4-6",
		"anthropic/claude-sonnet-4-5",
		"claude/claude-sonnet-4-5",
		"anthropic/claude-sonnet-4-0",
		"claude/claude-sonnet-4-0",
		"anthropic/claude-haiku-4-5",
		"claude/claude-haiku-4-5",
		"openai/gpt-5.5",
		"openai/gpt-5.5-fast",
		"openai/gpt-5.4",
		"openai/gpt-5.4-fast",
		"openai/gpt-5.4-mini",
		"openai/gpt-5.4-mini-fast",
		"openai/gpt-5.3-codex",
		"openai/gpt-5.3-codex-spark",
		"openai/gpt-5.2",
		"google/gemini-2.5-flash",
		"gemini/gemini-2.5-flash",
		"google/gemini-2.5-flash-lite",
		"gemini/gemini-2.5-flash-lite",
		"google/gemini-2.5-pro",
		"gemini/gemini-2.5-pro",
		"google/gemini-3-flash-preview",
		"gemini/gemini-3-flash-preview",
		"google/gemini-3-pro-preview",
		"gemini/gemini-3-pro-preview",
		"google/gemini-3.1-flash-lite",
		"gemini/gemini-3.1-flash-lite",
		"google/gemini-3.1-flash-lite-preview",
		"gemini/gemini-3.1-flash-lite-preview",
		"google/gemini-3.1-pro-preview",
		"gemini/gemini-3.1-pro-preview",
	];
	return {
		durableStateRoot: durableStateRootDir,
		statusLive: { enabled: true, maxWorkflows: 10 },
		providerUsageLive: {
			enabled: true,
			providers: ["claude", "openai", "gemini"],
			claudeOAuthUsage: true,
			codexLiveUsage: true,
			geminiQuota: true,
			persistSnapshots: true,
			persistWorkflowId: "workflow-global-provider-usage",
		},
		reviewerFanoutDiagnostics: { enabled: true },
		agentTaskRun: { enabled: true },
		exactModelProviderAcquisitionLiveTest: {
			enabled: true,
			durableStateRoot: durableStateRootDir,
			promptBackedCheck: {
				enabled: true,
				allowProviderCall: true,
				agent: "flowdesk-verifier-testing",
				allowedProviderQualifiedModelIds: providerAcquisitionAllowedModelIds,
			},
		},
		runtimeReviewerExecution: { enabled: true },
		workflowDispatchPlanTool: { enabled: true },
		workflowDispatch: { enabled: true, devBetaActualLaneLaunch: true },
		autoContinueExecution: { enabled: true, devBetaActualLaneLaunch: true },
		workflowOrchestrate: { enabled: true, devBetaActualLaneLaunch: true },
		quickFallbackRun: { enabled: true },
		managedFallbackRegate: { enabled: true },
		laneHeartbeatWriter: { enabled: true, defaultExpectedIntervalMs: 120000 },
		controlledWriteApply: { enabled: true, devBetaControlledWriteApply: true },
		chatMessageStallAlert: { enabled: true, includeProgressCards: true, maxProgressCards: 4 },
		completionWakeMainSession: { enabled: true },
	};
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function fillMissingFlowDeskPluginOptions(target: Record<string, unknown>, defaults: Record<string, unknown>): void {
	for (const [key, defaultValue] of Object.entries(defaults)) {
		const existingValue = target[key];
		if (existingValue === undefined) {
			target[key] = defaultValue;
			continue;
		}
		if (isPlainRecord(existingValue) && isPlainRecord(defaultValue)) fillMissingFlowDeskPluginOptions(existingValue, defaultValue);
	}
}

function isFlowDeskPluginEntry(value: unknown): value is [string, unknown?] {
	if (!Array.isArray(value) || typeof value[0] !== "string") return false;
	return /(?:^|[/\\])@flowdesk[/\\]opencode-plugin[/\\]dist[/\\]server\.js$/.test(value[0]) || value[0].endsWith("@flowdesk/opencode-plugin/dist/server.js");
}

function ensureFlowDeskPluginConfig(config: Record<string, unknown>, profileRootDir: string, durableStateRootDir: string): void {
	const pluginEntries = Array.isArray(config.plugin) ? config.plugin : [];
	const defaults = flowDeskPluginDefaultOptions(durableStateRootDir);
	const existingEntry = pluginEntries.find(isFlowDeskPluginEntry);
	if (existingEntry !== undefined) {
		const options = isPlainRecord(existingEntry[1]) ? existingEntry[1] : {};
		existingEntry[1] = options;
		fillMissingFlowDeskPluginOptions(options, defaults);
		config.plugin = pluginEntries;
		return;
	}
	pluginEntries.push([flowDeskPluginServerFileUrl(profileRootDir), defaults]);
	config.plugin = pluginEntries;
}

function materializeFlowDeskMainAgentProfile(profileRootDir: string): FlowDeskMainAgentMaterializationResult {
	return materializeFlowDeskMainAgentProfileWithTui(profileRootDir, profileRootDir);
}

function materializeFlowDeskMainAgentProfileWithTui(profileRootDir: string, durableStateRootDir: string): FlowDeskMainAgentMaterializationResult {
	const root = resolve(profileRootDir);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	const agentTemplates = flowDeskAgentProfileTemplates();
	const agentPaths = agentTemplates.map((template) => ({ ...template, path: resolve(root, template.ref) }));
	const configPath = resolve(root, "opencode.json");
	const tuiConfigPath = resolve(root, "tui.json");
	if (agentPaths.some((entry) => !entry.path.startsWith(rootPrefix)) || !configPath.startsWith(rootPrefix) || !tuiConfigPath.startsWith(rootPrefix)) {
		return { ...invalid("FlowDesk main agent paths escape profile root"), agentProfileFilesWritten: 0, profileConfigUpdated: false };
	}

	const previousConfig = readOptionalText(configPath);
	if (!previousConfig.ok) return { ...previousConfig, agentProfileFilesWritten: 0, profileConfigUpdated: false };
	const previousAgents: FlowDeskAgentProfileRollbackEntry[] = [];
	for (const entry of agentPaths) {
		const previousAgent = readOptionalText(entry.path);
		if (!previousAgent.ok) return { ...previousAgent, agentProfileFilesWritten: 0, profileConfigUpdated: false };
		previousAgents.push({ ref: entry.ref, path: entry.path, existed: previousAgent.exists, previousText: previousAgent.text });
	}
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
	ensureFlowDeskPluginConfig(config, root, durableStateRootDir);

	try {
		mkdirSync(resolve(root, "agent"), { recursive: true });
		for (const entry of agentPaths) writeFileSync(entry.path, entry.markdown, "utf8");
		writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`, "utf8");
		writeFileSync(tuiConfigPath, `${JSON.stringify(flowDeskTuiConfig(root, durableStateRootDir), null, 2)}\n`, "utf8");
	} catch (error) {
		const message = error instanceof Error ? error.message : "unknown error";
		return { ...invalid(`FlowDesk main agent profile write failed: ${message}`), agentProfileFilesWritten: 0, profileConfigUpdated: false };
	}

	return {
		...valid(),
		profileRootDir: root,
		writtenProfileRefs: [...agentTemplates.map((template) => template.ref), "opencode.json", "tui.json"],
		agentProfileFilesWritten: agentTemplates.length,
		profileConfigUpdated: true,
		rollbackState: {
			agentFiles: previousAgents,
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
	for (const agent of state.agentFiles) {
		if (agent.existed && agent.previousText !== undefined) writeFileSync(agent.path, agent.previousText, "utf8");
		else rmSync(agent.path, { force: true });
		rolledBack.push(agent.ref);
	}
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
