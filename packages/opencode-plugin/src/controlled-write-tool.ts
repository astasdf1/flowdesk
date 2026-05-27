import { createHash } from "node:crypto";
import {
	chmodSync,
	existsSync,
	lstatSync,
	mkdirSync,
	readFileSync,
	realpathSync,
	renameSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskControlledWorkspaceFileWriteRecordV1,
} from "@flowdesk/core";

export interface FlowDeskControlledWriteApplyToolConfigV1 {
	durableStateRoot: string;
	workspaceRoot: string;
}

export interface FlowDeskControlledWriteApplyToolRequestV1 {
	workflowId?: string;
	targetFilePath?: string;
	expectedSha256?: string;
	expectedContentSha256?: string;
	allowMissingExpectedHashForDevMode?: boolean;
	replacementText?: string;
	reasonSummary?: string;
	developerModeAcknowledged?: boolean;
	userApprovalRef?: string;
	allowControlledWrite?: boolean;
}

export interface FlowDeskControlledWriteApplyToolResultV1 {
	status: "controlled_write_applied" | "blocked_before_controlled_write";
	workflowId?: string;
	targetFilePath?: string;
	ledgerEntryId?: string;
	previousContentSha256Ref?: string;
	replacementContentSha256Ref?: string;
	redactedBlockReason?: string;
	summaryForUser: string;
	safeNextActions: readonly ("/flowdesk-status" | "/flowdesk-export-debug" | "/flowdesk-doctor")[];
	authority: {
		realOpenCodeDispatch: false;
		providerCall: false;
		runtimeExecution: false;
		actualLaneLaunch: false;
		fallbackAuthority: false;
		hardCancelOrNoReplyAuthority: false;
		toolAuthority: false;
		dispatchAuthorityEnabled: false;
		defaultRelease1WriteAuthority: false;
		controlledExternalWriteAuthorized: boolean;
		developerModeAcknowledged: boolean;
		allowControlledWrite: boolean;
		ledgerEvidenceReloaded: boolean;
	};
}

const maxReplacementTextLength = 200_000;

function sha256Ref(content: string | Buffer): string {
	return `sha256-${createHash("sha256").update(content).digest("hex")}`;
}

function safeNextActions(): FlowDeskControlledWriteApplyToolResultV1["safeNextActions"] {
	return ["/flowdesk-status", "/flowdesk-export-debug", "/flowdesk-doctor"];
}

function authority(input: {
	developerModeAcknowledged: boolean;
	allowControlledWrite: boolean;
	ledgerEvidenceReloaded: boolean;
	writeAuthorized: boolean;
}): FlowDeskControlledWriteApplyToolResultV1["authority"] {
	return {
		realOpenCodeDispatch: false,
		providerCall: false,
		runtimeExecution: false,
		actualLaneLaunch: false,
		fallbackAuthority: false,
		hardCancelOrNoReplyAuthority: false,
		toolAuthority: false,
		dispatchAuthorityEnabled: false,
		defaultRelease1WriteAuthority: false,
		controlledExternalWriteAuthorized: input.writeAuthorized,
		developerModeAcknowledged: input.developerModeAcknowledged,
		allowControlledWrite: input.allowControlledWrite,
		ledgerEvidenceReloaded: input.ledgerEvidenceReloaded,
	};
}

function blocked(input: {
	request: FlowDeskControlledWriteApplyToolRequestV1;
	reason: string;
	ledgerEvidenceReloaded?: boolean;
}): FlowDeskControlledWriteApplyToolResultV1 {
	return {
		status: "blocked_before_controlled_write",
		...(input.request.workflowId === undefined ? {} : { workflowId: input.request.workflowId }),
		...(input.request.targetFilePath === undefined ? {} : { targetFilePath: input.request.targetFilePath }),
		redactedBlockReason: input.reason,
		summaryForUser: `FlowDesk controlled write blocked: ${input.reason}.`,
		safeNextActions: safeNextActions(),
		authority: authority({
			developerModeAcknowledged: input.request.developerModeAcknowledged === true,
			allowControlledWrite: input.request.allowControlledWrite === true,
			ledgerEvidenceReloaded: input.ledgerEvidenceReloaded === true,
			writeAuthorized: false,
		}),
	};
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function normalizeRequest(value: unknown): FlowDeskControlledWriteApplyToolRequestV1 {
	if (!isRecord(value)) return {};
	return {
		...(typeof value.workflowId === "string" ? { workflowId: value.workflowId } : {}),
		...(typeof value.targetFilePath === "string" ? { targetFilePath: value.targetFilePath } : {}),
		...(typeof value.expectedSha256 === "string" ? { expectedSha256: value.expectedSha256 } : {}),
		...(typeof value.expectedContentSha256 === "string" ? { expectedContentSha256: value.expectedContentSha256 } : {}),
		allowMissingExpectedHashForDevMode: value.allowMissingExpectedHashForDevMode === true,
		...(typeof value.replacementText === "string" ? { replacementText: value.replacementText } : {}),
		...(typeof value.reasonSummary === "string" ? { reasonSummary: value.reasonSummary } : {}),
		developerModeAcknowledged: value.developerModeAcknowledged === true,
		...(typeof value.userApprovalRef === "string" ? { userApprovalRef: value.userApprovalRef } : {}),
		allowControlledWrite: value.allowControlledWrite === true,
	};
}

function stableToken(value: string, fallback: string): string {
	const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 96);
	return token.length >= 3 ? token : fallback;
}

function validateRelativeTarget(value: string | undefined): string | undefined {
	if (typeof value !== "string" || value.trim().length === 0) return "targetFilePath is required";
	if (value.length > 500) return "targetFilePath exceeds max length 500";
	if (
		value.startsWith("/") ||
		/^[A-Za-z]:[\\/]/.test(value) ||
		value.startsWith("~") ||
		value.includes("\\") ||
		value.includes("//") ||
		value === "." ||
		value === ".." ||
		value.startsWith("../") ||
		value.includes("/../") ||
		value.endsWith("/..") ||
		value.startsWith("./") ||
		value.includes("/./") ||
		value.endsWith("/")
	)
		return "targetFilePath must be a relative workspace file path without traversal";
	return undefined;
}

function validateText(value: string | undefined, label: string, maxLength: number): string | undefined {
	if (typeof value !== "string" || value.length === 0) return `${label} is required`;
	if (value.length > maxLength) return `${label} exceeds max length ${maxLength}`;
	if (value.includes("\u0000")) return `${label} contains a binary NUL marker`;
	if (/\b(system prompt|developer message|transcript|provider payload|provider response|api[_-]?key|bearer\s+[A-Za-z0-9]|token[:=]|credential|secret)\b/i.test(value))
		return `${label} contains forbidden raw or credential-shaped marker`;
	return undefined;
}

function safeJoinUnderRoot(rootDir: string, relativePath: string): string {
	const root = realpathSync.native(resolve(rootDir));
	const target = resolve(root, relativePath);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	if (target !== root && !target.startsWith(rootPrefix))
		throw new Error("controlled write target escapes workspace root");
	return target;
}

function ensureNoSymlinkEscape(rootDir: string, relativePath: string): void {
	const root = resolve(rootDir);
	if (!existsSync(root)) throw new Error("workspace root does not exist");
	if (lstatSync(root).isSymbolicLink()) throw new Error("workspace root must not be a symlink");
	const parts = dirname(relativePath).split("/").filter(Boolean);
	let current = root;
	for (const part of parts) {
		current = resolve(current, part);
		if (existsSync(current) && lstatSync(current).isSymbolicLink())
			throw new Error("controlled write parent directory must not be a symlink");
	}
}

function readUtf8IfSafe(target: string): { ok: true; content: string; mode?: number } | { ok: false; reason: string } {
	if (!existsSync(target)) return { ok: false, reason: "target file does not exist" };
	const stat = lstatSync(target);
	if (stat.isSymbolicLink()) return { ok: false, reason: "target file must not be a symlink" };
	if (!stat.isFile()) return { ok: false, reason: "target path must be a regular file" };
	if (stat.size > maxReplacementTextLength) return { ok: false, reason: "target file exceeds controlled write size limit" };
	const bytes = readFileSync(target);
	if (bytes.includes(0)) return { ok: false, reason: "target file appears binary" };
	return { ok: true, content: bytes.toString("utf8"), mode: stat.mode };
}

function rollbackTarget(target: string, previousContent: string, mode: number | undefined): void {
	const rollbackTemp = `${target}.tmp-flowdesk-controlled-write-rollback-${process.pid}`;
	writeFileSync(rollbackTemp, previousContent, "utf8");
	if (mode !== undefined) chmodSync(rollbackTemp, mode);
	renameSync(rollbackTemp, target);
}

export function executeFlowDeskControlledWriteApplyToolV1(input: {
	config: FlowDeskControlledWriteApplyToolConfigV1;
	request?: FlowDeskControlledWriteApplyToolRequestV1;
	rawInput?: unknown;
	now?: () => Date;
}): FlowDeskControlledWriteApplyToolResultV1 {
	const request = input.request ?? normalizeRequest(input.rawInput);
	if (typeof input.config.durableStateRoot !== "string" || input.config.durableStateRoot.trim().length === 0)
		return blocked({ request, reason: "controlled write requires a durable state root directory" });
	if (typeof input.config.workspaceRoot !== "string" || input.config.workspaceRoot.trim().length === 0)
		return blocked({ request, reason: "controlled write requires a workspace root directory" });
	if (request.developerModeAcknowledged !== true)
		return blocked({ request, reason: "developerModeAcknowledged=true is required" });
	if (request.allowControlledWrite !== true)
		return blocked({ request, reason: "allowControlledWrite=true is required" });
	if (typeof request.userApprovalRef !== "string" || request.userApprovalRef.trim().length === 0 || request.userApprovalRef.length > 128)
		return blocked({ request, reason: "bounded userApprovalRef is required" });
	if (typeof request.workflowId !== "string" || request.workflowId.trim().length === 0)
		return blocked({ request, reason: "workflowId is required" });
	const targetError = validateRelativeTarget(request.targetFilePath);
	if (targetError !== undefined) return blocked({ request, reason: targetError });
	const replacementError = validateText(request.replacementText, "replacementText", maxReplacementTextLength);
	if (replacementError !== undefined) return blocked({ request, reason: replacementError });
	const reasonError = validateText(request.reasonSummary, "reasonSummary", 500);
	if (reasonError !== undefined) return blocked({ request, reason: reasonError });
	const expectedHash = request.expectedContentSha256 ?? request.expectedSha256;
	if (expectedHash === undefined && request.allowMissingExpectedHashForDevMode !== true)
		return blocked({ request, reason: "expectedSha256 or expectedContentSha256 is required unless allowMissingExpectedHashForDevMode=true" });
	if (expectedHash !== undefined && !/^sha256-[a-f0-9]{64}$/.test(expectedHash))
		return blocked({ request, reason: "expected content hash must be sha256-<64 lowercase hex>" });

	const targetFilePath = request.targetFilePath as string;
	const replacementText = request.replacementText as string;
	const workflowId = stableToken(request.workflowId, "workflow-controlled-write");
	const observed = input.now ? input.now() : new Date();
	const stamp = observed.toISOString().replaceAll(/[-:.]/g, "").replace("Z", "Z");
	const ledgerEntryId = stableToken(`controlled-write-${workflowId}-${stamp}`, `controlled-write-${stamp}`);
	let target: string;
	try {
		ensureNoSymlinkEscape(input.config.workspaceRoot, targetFilePath);
		target = safeJoinUnderRoot(input.config.workspaceRoot, targetFilePath);
	} catch (error) {
		return blocked({ request, reason: error instanceof Error ? error.message : "controlled write path resolution failed" });
	}
	const current = readUtf8IfSafe(target);
	if (!current.ok) return blocked({ request, reason: current.reason });
	const previousContentSha256Ref = sha256Ref(current.content);
	if (expectedHash !== undefined && previousContentSha256Ref !== expectedHash)
		return blocked({ request, reason: "expected content hash mismatch" });
	const replacementContentSha256Ref = sha256Ref(replacementText);
	const record: FlowDeskControlledWorkspaceFileWriteRecordV1 = {
		schema_version: "flowdesk.controlled_workspace_file_write.v1",
		ledger_entry_id: ledgerEntryId,
		workflow_id: workflowId,
		user_approval_ref: request.userApprovalRef as string,
		target_file_path: targetFilePath,
		...(expectedHash === undefined ? {} : { expected_content_sha256_ref: expectedHash }),
		previous_content_sha256_ref: previousContentSha256Ref,
		replacement_content_sha256_ref: replacementContentSha256Ref,
		reason_summary: (request.reasonSummary as string).trim().slice(0, 500),
		materialized_at: observed.toISOString(),
		dev_beta_explicit_opt_in: true,
		developer_mode_acknowledged: true,
		allow_controlled_write: true,
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
	};
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId,
		evidenceId: ledgerEntryId,
		record,
	});
	if (!prepared.ok || prepared.writeIntent === undefined)
		return blocked({ request, reason: prepared.errors.join(", ") || "controlled write ledger evidence is invalid" });
	const preReload = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: input.config.durableStateRoot });
	if (!preReload.ok || preReload.blocked.length > 0)
		return blocked({ request, reason: "controlled write pre-write evidence reload failed" });

	const temp = `${target}.tmp-flowdesk-controlled-write-${process.pid}-${stamp}`;
	try {
		if (dirname(target) !== dirname(temp))
			return blocked({ request, reason: "controlled write temp path must stay beside target" });
		mkdirSync(dirname(target), { recursive: true });
		writeFileSync(temp, replacementText, "utf8");
		if (current.mode !== undefined) chmodSync(temp, current.mode);
		renameSync(temp, target);
		const written = readFileSync(target, "utf8");
		if (sha256Ref(written) !== replacementContentSha256Ref) {
			rollbackTarget(target, current.content, current.mode);
			return blocked({ request, reason: "controlled write replacement hash verification failed" });
		}
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(input.config.durableStateRoot, [prepared.writeIntent]);
		if (!applied.ok) {
			rollbackTarget(target, current.content, current.mode);
			return blocked({ request, reason: applied.errors.join(", ") || "controlled write ledger write failed" });
		}
		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId, rootDir: input.config.durableStateRoot });
		const ledgerReloaded =
			reloaded.ok &&
			reloaded.blocked.length === 0 &&
			reloaded.entries.some(
				(entry) =>
					entry.evidenceClass === "controlled_workspace_file_write" &&
					entry.evidenceId === ledgerEntryId &&
					entry.record.replacement_content_sha256_ref === replacementContentSha256Ref,
			);
		if (!ledgerReloaded) {
			rollbackTarget(target, current.content, current.mode);
			return blocked({ request, reason: "controlled write ledger reload failed" });
		}
		const finalStat = statSync(target);
		if (!finalStat.isFile()) {
			rollbackTarget(target, current.content, current.mode);
			return blocked({ request, reason: "controlled write final target is not a regular file" });
		}
		return {
			status: "controlled_write_applied",
			workflowId,
			targetFilePath,
			ledgerEntryId,
			previousContentSha256Ref,
			replacementContentSha256Ref,
			summaryForUser: `FlowDesk dev-mode controlled write applied to ${targetFilePath} and recorded durable ledger evidence ${ledgerEntryId}.`,
			safeNextActions: safeNextActions(),
			authority: authority({
				developerModeAcknowledged: true,
				allowControlledWrite: true,
				ledgerEvidenceReloaded: true,
				writeAuthorized: true,
			}),
		};
	} catch (error) {
		try {
			rmSync(temp, { force: true });
		} catch {
			// Best-effort cleanup only; result remains blocked.
		}
		return blocked({ request, reason: error instanceof Error ? error.message : "controlled write failed" });
	}
}
