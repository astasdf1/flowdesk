import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	projectFlowDeskLaneStallV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskPendingAbortCancelV1,
	type FlowDeskPendingAbortWarningV1,
	type FlowDeskReviewerLaneContextV1,
	type FlowDeskAgentTaskContextV1,
	type FlowDeskAgentTaskProgressV1,
	type FlowDeskAgentTaskInconsistencyV1,
	type FlowDeskTaskResultV1,
	type FlowDeskTaskFailedV1,
	type FlowDeskTopTierReviewVerdictV1,
	type FlowDeskPendingRetryPlanV1,
	type FlowDeskRetryExecutedV1,
	type FlowDeskRetryFailedV1,
	type FlowDeskAutoRetryResultV1,
	type DisabledAutoRetryReason,
	validateTopTierReviewVerdictV1,
} from "@flowdesk/core";
import { createHmac, createHash, timingSafeEqual, randomBytes } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import type {
	FlowDeskManagedDispatchBetaOpenCodeClientV1,
} from "./managed-dispatch-adapter.js";
import {
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
} from "./managed-dispatch-adapter.js";
import {
	FLOWDESK_TIMEOUT_DEFAULTS,
	FlowDeskTimeoutError,
	withTimeout,
} from "./shared/with-timeout.js";
import { executeFlowDeskAgentTaskV1, AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION, sanitizeFlowDeskTaskResultTextV1, buildFlowDeskCaptureSafetyMetadataV1 } from "./agent-task-runner.js";
import { flowDeskAgentTaskMessageItems, observeFlowDeskAgentTaskOutputV1, type FlowDeskAgentTaskCompletionStatusV1 } from "./agent-task-output.js";
import { refreshFlowDeskCompletionUiCachesV1 } from "./completion-ui-cache.js";
import {
	buildFlowDeskSessionFinalizationObservation,
	evaluateFlowDeskSessionFinalizationEvidence,
	type FlowDeskSessionFinalizationDecision,
	type FlowDeskSessionRunningToolsState,
} from "./session-finalization-evidence.js";

export interface FlowDeskTimeoutConfig {
	sessionReadMs?: number;
}

export type FlowDeskSdkSessionHealthV1 =
	| { status: "api_responsive" }
	| { status: "api_timeout"; reason: string }
	| { status: "unknown"; reason: string };

export async function checkSdkSessionApiHealthV1(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	sessionId: string,
	timeouts: FlowDeskTimeoutConfig = {},
): Promise<FlowDeskSdkSessionHealthV1> {
	if (typeof client.session.messages !== "function") {
		return { status: "unknown", reason: "sdk_messages_not_available" };
	}
	try {
		const messages = client.session.messages as (options: unknown) => Promise<unknown>;
		await withTimeout(
			messages.call(client.session, { sessionID: sessionId }),
			timeouts.sessionReadMs ?? FLOWDESK_TIMEOUT_DEFAULTS.sessionReadMs,
			"session.messages",
		);
		return { status: "api_responsive" };
	} catch (error) {
		if (error instanceof FlowDeskTimeoutError) {
			return {
				status: "api_timeout",
				reason: "messages_api_did_not_respond_within_threshold",
			};
		}
		return { status: "unknown", reason: "messages_api_error" };
	}
}

const FLOWDESK_ABORT_WORKFLOW_PREFIXES = [
	"workflow-quick-reviewer-",
	"workflow-quick-fallback-",
	"workflow-stall-recovery-",
	"workflow-provider-usage-",
	"workflow-r3-",
	"workflow-p7-",
	"workflow-p8-",
] as const;

const TERMINAL_LANE_STATES = new Set([
	"complete",
	"incomplete",
	"no_output",
	"missing_verdict",
	"tool_calls_only_no_verdict",
	"aborted",
	"invocation_failed",
	"timeout",
	"late_output",
	"orphaned",
]);

const ABORT_ELIGIBLE_LANE_STATES = new Set(["created", "running"]);

export type FlowDeskLaneAbortHelperResultV1 =
	| { status: "aborted"; lane_id: string; lifecycle_evidence_id: string; reason: string }
	| { status: "blocked"; reason: string; current_state?: string }
	| { status: "write_failed"; reason: string };

export interface FlowDeskGuardSignOffV1 {
	schema_version: "flowdesk.guard_sign_off.v1";
	sign_off_id: string;
	created_at: string;
	target_markdown_sha256: string;
	p6_safe: boolean;
	nonce: string;
	expires_at?: string;
	hmac_sha256: string;
	dispatch_authority_enabled: false;
}

export interface FlowDeskAutoAbortConfigV1 {
	autoAbortOnStall?: boolean;
	preAbortWarningMs?: number;
	guardSignOffPath?: string;
	guardHmacKey?: string;
	productionMode?: boolean;
	autoRetryAfterAbort?: boolean;
	maxAutoRetries?: number;
}

export type FlowDeskAutoAbortEnablementV1 =
	| { enabled: true; sign_off_id: string }
	| { enabled: false; reason: string };

export type FlowDeskGuardedAutoAbortResultV1 =
	| { status: "noop"; reason: string }
	| { status: "manual_recommended"; reason: string }
	| { status: "warning_issued"; warning_id: string; expires_at: string; cancel_command: string }
	| { status: "warning_pending"; warning_id: string; expires_at: string; cancel_command: string }
	| { status: "warning_cancelled"; warning_id: string; cancel_id: string }
	| { status: "auto_abort_executed"; warning_id: string; lifecycle_evidence_id: string }
	| { status: "blocked"; reason: string };

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isLaneLifecycleRecord(value: unknown): value is FlowDeskLaneLifecycleRecordV1 {
	return isRecord(value) && value.schema_version === "flowdesk.lane_lifecycle_record.v1";
}

function workflowPrefixAllowed(workflowId: string): boolean {
	return FLOWDESK_ABORT_WORKFLOW_PREFIXES.some((prefix) => workflowId.startsWith(prefix));
}

function latestLifecycle(records: FlowDeskLaneLifecycleRecordV1[]): FlowDeskLaneLifecycleRecordV1 {
	return [...records].sort(
		(a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
	)[0]!;
}

function canonicalJson(value: unknown): string {
	if (value === null) return "null";
	if (typeof value === "string" || typeof value === "boolean") return JSON.stringify(value);
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error("non-finite canonical JSON number");
		return JSON.stringify(value);
	}
	if (Array.isArray(value)) return `[${value.map((entry) => canonicalJson(entry)).join(",")}]`;
	if (isRecord(value)) {
		return `{${Object.keys(value)
			.sort()
			.map((key) => `${JSON.stringify(key)}:${canonicalJson(value[key])}`)
			.join(",")}}`;
	}
	throw new Error("unsupported canonical JSON value");
}

function sha256Hex(text: string): string {
	return createHash("sha256").update(text.replaceAll("\r\n", "\n"), "utf8").digest("hex");
}

function safeToken(value: string): string {
	const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 80);
	return token.length > 0 ? token : "unknown";
}

function timestampToken(date: Date): string {
	return date.toISOString().replace(/[^0-9A-Za-z]/g, "");
}

function isGuardSignOff(value: unknown): value is FlowDeskGuardSignOffV1 {
	return (
		isRecord(value) &&
		value.schema_version === "flowdesk.guard_sign_off.v1" &&
		typeof value.sign_off_id === "string" &&
		typeof value.created_at === "string" &&
		typeof value.target_markdown_sha256 === "string" &&
		typeof value.p6_safe === "boolean" &&
		typeof value.nonce === "string" &&
		typeof value.hmac_sha256 === "string" &&
		(value.expires_at === undefined || typeof value.expires_at === "string") &&
		value.dispatch_authority_enabled === false
	);
}

export function verifyGuardSignOffHmacV1(input: {
	signOff: unknown;
	markdownText: string;
	hmacKey: string | undefined;
	now?: Date;
}): { ok: true; signOff: FlowDeskGuardSignOffV1 } | { ok: false; reason: string } {
	if (!isGuardSignOff(input.signOff)) return { ok: false, reason: "guard_sign_off_schema_invalid" };
	if (typeof input.hmacKey !== "string" || input.hmacKey.length < 16)
		return { ok: false, reason: "guard_hmac_key_missing" };
	if (input.signOff.p6_safe !== true) return { ok: false, reason: "guard_sign_off_not_p6_safe" };
	if (input.signOff.expires_at !== undefined) {
		const expiresAtMs = Date.parse(input.signOff.expires_at);
		if (!Number.isFinite(expiresAtMs)) return { ok: false, reason: "guard_sign_off_expiry_invalid" };
		if ((input.now ?? new Date()).getTime() >= expiresAtMs)
			return { ok: false, reason: "guard_sign_off_expired" };
	}
	if (input.signOff.target_markdown_sha256 !== sha256Hex(input.markdownText))
		return { ok: false, reason: "guard_sign_off_markdown_digest_mismatch" };
	const { hmac_sha256: _hmac, ...unsigned } = input.signOff;
	const expected = createHmac("sha256", input.hmacKey)
		.update(canonicalJson(unsigned), "utf8")
		.digest("hex");
	const actualBuffer = Buffer.from(input.signOff.hmac_sha256, "hex");
	const expectedBuffer = Buffer.from(expected, "hex");
	if (actualBuffer.length !== expectedBuffer.length || !timingSafeEqual(actualBuffer, expectedBuffer))
		return { ok: false, reason: "guard_sign_off_hmac_mismatch" };
	return { ok: true, signOff: input.signOff };
}

export function computeGuardSignOffHmacV1(input: {
	unsignedSignOff: Omit<FlowDeskGuardSignOffV1, "hmac_sha256">;
	hmacKey: string;
}): string {
	return createHmac("sha256", input.hmacKey)
		.update(canonicalJson(input.unsignedSignOff), "utf8")
		.digest("hex");
}

function loadGuardSignOffFromRoot(rootDir: string, signOffPath?: string): { signOff: unknown; markdownText: string } | undefined {
	const sidecarPath = signOffPath ?? join(rootDir, "docs/adr/0002-sdk-surface-verification.guard_sign_off.json");
	if (!existsSync(sidecarPath)) return undefined;
	const signOff = JSON.parse(readFileSync(sidecarPath, "utf8")) as unknown;
	const markdownPath = sidecarPath.replace(/\.guard_sign_off\.json$/, ".md");
	if (!existsSync(markdownPath)) return undefined;
	return { signOff, markdownText: readFileSync(markdownPath, "utf8") };
}

export function isAutoAbortEnabledV1(input: {
	config: FlowDeskAutoAbortConfigV1;
	rootDir: string;
	now?: Date;
	env?: Record<string, string | undefined>;
	loadedSignOff?: { signOff: unknown; markdownText: string };
}): FlowDeskAutoAbortEnablementV1 {
	if (input.config.autoAbortOnStall !== true) return { enabled: false, reason: "auto_abort_not_configured" };
	const keyFromConfig = input.config.guardHmacKey;
	const keyFromEnv = input.env?.FLOWDESK_GUARD_HMAC_KEY ?? process.env.FLOWDESK_GUARD_HMAC_KEY;
	if (input.config.productionMode === true && keyFromConfig === undefined && keyFromEnv !== undefined)
		return { enabled: false, reason: "env_guard_hmac_key_rejected_in_production" };
	const loaded = input.loadedSignOff ?? loadGuardSignOffFromRoot(input.rootDir, input.config.guardSignOffPath);
	if (loaded === undefined) return { enabled: false, reason: "guard_sign_off_missing" };
	const verified = verifyGuardSignOffHmacV1({
		signOff: loaded.signOff,
		markdownText: loaded.markdownText,
		hmacKey: keyFromConfig ?? keyFromEnv,
		now: input.now,
	});
	if (!verified.ok) return { enabled: false, reason: verified.reason };
	return { enabled: true, sign_off_id: verified.signOff.sign_off_id };
}

function isPendingAbortWarning(value: unknown): value is FlowDeskPendingAbortWarningV1 {
	return isRecord(value) && value.schema_version === "flowdesk.pending_abort_warning.v1";
}

function isPendingAbortCancel(value: unknown): value is FlowDeskPendingAbortCancelV1 {
	return isRecord(value) && value.schema_version === "flowdesk.pending_abort_cancel.v1";
}

function latestPendingAbortWarning(records: readonly FlowDeskPendingAbortWarningV1[]): FlowDeskPendingAbortWarningV1 | undefined {
	return [...records].sort((a, b) => Date.parse(b.warning_issued_at) - Date.parse(a.warning_issued_at))[0];
}

function writeEvidence(input: { rootDir: string; workflowId: string; evidenceId: string; record: Record<string, unknown> }): boolean {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: input.record,
	});
	if (!prepared.ok || prepared.writeIntent === undefined) return false;
	return applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]).ok;
}

function warningRecord(input: {
	warningId: string;
	workflowId: string;
	laneId: string;
	issuedAt: Date;
	expiresAt: Date;
	status: FlowDeskPendingAbortWarningV1["status"];
}): FlowDeskPendingAbortWarningV1 {
	return {
		schema_version: "flowdesk.pending_abort_warning.v1",
		warning_id: input.warningId,
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		warning_issued_at: input.issuedAt.toISOString(),
		expires_at: input.expiresAt.toISOString(),
		cancel_command: `/flowdesk-abort ${input.laneId} cancel`,
		status: input.status,
		dispatch_authority_enabled: false,
	};
}

export function validateAndAbortFlowDeskLaneEvidenceV1(input: {
	rootDir: string;
	workflow_id: string;
	lane_id: string;
	now?: () => Date;
	requireExplicitOwnership?: boolean;
}): FlowDeskLaneAbortHelperResultV1 {
	if (!workflowPrefixAllowed(input.workflow_id)) {
		return { status: "blocked", reason: "workflow_prefix_not_allowed" };
	}
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflow_id,
	});
	if (!reloaded.ok) return { status: "blocked", reason: "workflow_not_found" };
	const laneRecords: FlowDeskLaneLifecycleRecordV1[] = [];
	for (const entry of reloaded.entries) {
		if (isLaneLifecycleRecord(entry.record) && entry.record.lane_id === input.lane_id) {
			laneRecords.push(entry.record);
		}
	}
	if (laneRecords.length === 0) return { status: "blocked", reason: "lane_not_found" };
	const hasExplicitOwnership = laneRecords.some((record) => record.spawned_by === "flowdesk");
	if (input.requireExplicitOwnership === true && !hasExplicitOwnership) {
		return { status: "blocked", reason: "not_explicitly_flowdesk_owned" };
	}
	const hasLegacyOwnership = laneRecords.some((record) => record.spawned_by === undefined);
	if (!hasExplicitOwnership && !hasLegacyOwnership) {
		return { status: "blocked", reason: "not_flowdesk_owned" };
	}
	const latest = latestLifecycle(laneRecords);
	if (TERMINAL_LANE_STATES.has(latest.state)) {
		return { status: "blocked", reason: "lane_already_terminal", current_state: latest.state };
	}
	if (!ABORT_ELIGIBLE_LANE_STATES.has(latest.state)) {
		return { status: "blocked", reason: "lane_not_eligible", current_state: latest.state };
	}
	const observedAt = (input.now?.() ?? new Date()).toISOString();
	const evidenceId = `lifecycle-abort-${input.lane_id}-${observedAt.replace(/[^0-9A-Za-z]/g, "")}`;
	const abortRecord: FlowDeskLaneLifecycleRecordV1 = {
		...latest,
		state: "aborted",
		updated_at: observedAt,
		verdict_ref: undefined,
		spawned_by: latest.spawned_by ?? "flowdesk",
	};
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
		workflowId: input.workflow_id,
		evidenceId,
		record: abortRecord as unknown as Record<string, unknown>,
	});
	if (!prepared.ok || prepared.writeIntent === undefined) {
		return { status: "write_failed", reason: "abort_evidence_prepare_failed" };
	}
	const applyResult = applyFlowDeskSessionEvidenceWriteIntentsV1(input.rootDir, [prepared.writeIntent]);
	if (!applyResult.ok) return { status: "write_failed", reason: "abort_evidence_write_failed" };
	const verify = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflow_id,
	});
	const persisted = verify.ok && verify.entries.some(
		(entry) =>
			entry.evidenceClass === "lane_lifecycle" &&
			entry.evidenceId === evidenceId &&
			isLaneLifecycleRecord(entry.record) &&
			entry.record.state === "aborted",
	);
	if (!persisted) return { status: "write_failed", reason: "abort_evidence_not_persisted" };
	refreshFlowDeskCompletionUiCachesV1({
		rootDir: input.rootDir,
		workflowId: input.workflow_id,
		observedAt: observedAt,
	});
	return {
		status: "aborted",
		lane_id: input.lane_id,
		lifecycle_evidence_id: evidenceId,
		reason: `user-requested-abort at ${observedAt} via /flowdesk-abort`,
	};
}

export function cancelPendingAbortWarningEvidenceV1(input: {
	rootDir: string;
	workflow_id: string;
	lane_id: string;
	warning_id_ref: string;
	now?: () => Date;
}): FlowDeskGuardedAutoAbortResultV1 {
	const now = input.now?.() ?? new Date();
	const cancelId = `cancel-${safeToken(input.lane_id)}-${timestampToken(now)}`;
	const cancelRecord: FlowDeskPendingAbortCancelV1 = {
		schema_version: "flowdesk.pending_abort_cancel.v1",
		cancel_id: cancelId,
		warning_id_ref: input.warning_id_ref,
		workflow_id: input.workflow_id,
		lane_id: input.lane_id,
		cancelled_at: now.toISOString(),
		cancel_reason: "user_requested_via_command",
		cancel_actor: "user",
		dispatch_authority_enabled: false,
	};
	const cancelWritten = writeEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflow_id,
		evidenceId: cancelId,
		record: cancelRecord as unknown as Record<string, unknown>,
	});
	if (!cancelWritten) return { status: "blocked", reason: "pending_abort_cancel_write_failed" };
	const tombstoneId = `warning-cancelled-${safeToken(input.lane_id)}-${timestampToken(now)}`;
	const tombstone = warningRecord({
		warningId: tombstoneId,
		workflowId: input.workflow_id,
		laneId: input.lane_id,
		issuedAt: now,
		expiresAt: now,
		status: "cancelled",
	});
	const tombstoneWritten = writeEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflow_id,
		evidenceId: tombstoneId,
		record: tombstone as unknown as Record<string, unknown>,
	});
	if (!tombstoneWritten) return { status: "blocked", reason: "pending_abort_cancel_tombstone_write_failed" };
	return { status: "warning_cancelled", warning_id: input.warning_id_ref, cancel_id: cancelId };
}

export function evaluateGuardedAutoAbortHookV1(input: {
	rootDir: string;
	workflow_id: string;
	lane_id: string;
	config: FlowDeskAutoAbortConfigV1;
	stallConfirmed: boolean;
	sdkSessionHealth: FlowDeskSdkSessionHealthV1;
	now?: () => Date;
	loadedSignOff?: { signOff: unknown; markdownText: string };
	env?: Record<string, string | undefined>;
}): FlowDeskGuardedAutoAbortResultV1 {
	const now = input.now?.() ?? new Date();
	const enablement = isAutoAbortEnabledV1({
		config: input.config,
		rootDir: input.rootDir,
		now,
		loadedSignOff: input.loadedSignOff,
		env: input.env,
	});
	if (!enablement.enabled) return { status: "manual_recommended", reason: enablement.reason };
	if (!input.stallConfirmed) return { status: "noop", reason: "stall_not_confirmed" };
	if (input.sdkSessionHealth.status !== "api_timeout") {
		return { status: "manual_recommended", reason: `sdk_session_health_${input.sdkSessionHealth.status}` };
	}

	const reloaded = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflow_id,
	});
	if (!reloaded.ok) return { status: "blocked", reason: "session_evidence_reload_failed" };
	const warnings: FlowDeskPendingAbortWarningV1[] = [];
	for (const entry of reloaded.entries) {
		if (
			isPendingAbortWarning(entry.record) &&
			entry.record.workflow_id === input.workflow_id &&
			entry.record.lane_id === input.lane_id
		) {
			warnings.push(entry.record);
		}
	}
	const latestWarning = latestPendingAbortWarning(warnings);
	if (latestWarning !== undefined && latestWarning.status === "cancelled")
		return { status: "manual_recommended", reason: "pending_abort_cancelled" };
	if (latestWarning !== undefined && latestWarning.status === "executed")
		return { status: "noop", reason: "pending_abort_already_executed" };
	if (latestWarning !== undefined && latestWarning.status === "tombstoned")
		return { status: "noop", reason: "pending_abort_tombstoned" };
	if (latestWarning !== undefined) {
		const cancels: FlowDeskPendingAbortCancelV1[] = [];
		for (const entry of reloaded.entries) {
			if (isPendingAbortCancel(entry.record) && entry.record.warning_id_ref === latestWarning.warning_id) {
				cancels.push(entry.record);
			}
		}
		if (cancels.length > 0) {
			return cancelPendingAbortWarningEvidenceV1({
				rootDir: input.rootDir,
				workflow_id: input.workflow_id,
				lane_id: input.lane_id,
				warning_id_ref: latestWarning.warning_id,
				now: () => now,
			});
		}
		if (now.getTime() < Date.parse(latestWarning.expires_at)) {
			return {
				status: "warning_pending",
				warning_id: latestWarning.warning_id,
				expires_at: latestWarning.expires_at,
				cancel_command: latestWarning.cancel_command,
			};
		}
		const abort = validateAndAbortFlowDeskLaneEvidenceV1({
			rootDir: input.rootDir,
			workflow_id: input.workflow_id,
			lane_id: input.lane_id,
			now: () => now,
			requireExplicitOwnership: true,
		});
		if (abort.status !== "aborted") return { status: "blocked", reason: abort.reason };
		const executedId = `warning-executed-${safeToken(input.lane_id)}-${timestampToken(now)}`;
		const executed = warningRecord({
			warningId: executedId,
			workflowId: input.workflow_id,
			laneId: input.lane_id,
			issuedAt: now,
			expiresAt: now,
			status: "executed",
		});
		const executedWritten = writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflow_id,
			evidenceId: executedId,
			record: executed as unknown as Record<string, unknown>,
		});
		if (!executedWritten) return { status: "blocked", reason: "pending_abort_executed_tombstone_write_failed" };
		return {
			status: "auto_abort_executed",
			warning_id: latestWarning.warning_id,
			lifecycle_evidence_id: abort.lifecycle_evidence_id,
		};
	}

	const warningId = `warning-${safeToken(input.lane_id)}-${timestampToken(now)}`;
	const expiresAt = new Date(now.getTime() + Math.max(10_000, input.config.preAbortWarningMs ?? 60_000));
	const pending = warningRecord({
		warningId,
		workflowId: input.workflow_id,
		laneId: input.lane_id,
		issuedAt: now,
		expiresAt,
		status: "pending",
	});
	const warningWritten = writeEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflow_id,
		evidenceId: warningId,
		record: pending as unknown as Record<string, unknown>,
	});
	if (!warningWritten) return { status: "blocked", reason: "pending_abort_warning_write_failed" };
	return {
		status: "warning_issued",
		warning_id: warningId,
		expires_at: expiresAt.toISOString(),
		cancel_command: pending.cancel_command,
	};
}

// ---------------------------------------------------------------------------
// P7 Guarded Auto-Retry helpers
// ---------------------------------------------------------------------------

function isReviewerLaneContext(value: unknown): value is FlowDeskReviewerLaneContextV1 {
	return isRecord(value) && value.schema_version === "flowdesk.reviewer_lane_context.v1";
}

function isAgentTaskContext(value: unknown): value is FlowDeskAgentTaskContextV1 {
	return isRecord(value) && value.schema_version === "flowdesk.agent_task_context.v1";
}

function isTaskFailed(value: unknown): value is FlowDeskTaskFailedV1 {
	return isRecord(value) && value.schema_version === "flowdesk.task_failed.v1";
}

function isTaskResult(value: unknown): value is FlowDeskTaskResultV1 {
	return isRecord(value) && value.schema_version === "flowdesk.task_result.v1";
}

function isPendingRetryPlan(value: unknown): value is FlowDeskPendingRetryPlanV1 {
	return isRecord(value) && value.schema_version === "flowdesk.pending_retry_plan.v1";
}

function isRetryExecuted(value: unknown): value is FlowDeskRetryExecutedV1 {
	return isRecord(value) && value.schema_version === "flowdesk.retry_executed.v1";
}

function isRetryFailed(value: unknown): value is FlowDeskRetryFailedV1 {
	return isRecord(value) && value.schema_version === "flowdesk.retry_failed.v1";
}

export type FlowDeskAgentTaskTerminalBackfillResultV1 =
	| {
		status: "backfill_completed";
		workflowId: string;
		lanesScanned: number;
		lanesTerminalized: number;
		terminalLifecycleEvidenceIds: string[];
	}
	| { status: "backfill_skipped"; workflowId: string; reason: "session_evidence_reload_failed" };

function latestLifecycleByLane(records: readonly FlowDeskLaneLifecycleRecordV1[]): Map<string, FlowDeskLaneLifecycleRecordV1> {
	const byLane = new Map<string, FlowDeskLaneLifecycleRecordV1>();
	for (const record of records) {
		const existing = byLane.get(record.lane_id);
		if (
			existing === undefined ||
			Date.parse(record.updated_at) > Date.parse(existing.updated_at) ||
			(Date.parse(record.updated_at) === Date.parse(existing.updated_at) && record.state > existing.state)
		) {
			byLane.set(record.lane_id, record);
		}
	}
	return byLane;
}

function latestTaskFailedByLane(records: readonly FlowDeskTaskFailedV1[]): Map<string, FlowDeskTaskFailedV1> {
	const byLane = new Map<string, FlowDeskTaskFailedV1>();
	for (const record of records) {
		const existing = byLane.get(record.lane_id);
		if (existing === undefined || Date.parse(record.created_at) >= Date.parse(existing.created_at)) {
			byLane.set(record.lane_id, record);
		}
	}
	return byLane;
}

function latestTaskResultByLane(records: readonly FlowDeskTaskResultV1[]): Map<string, FlowDeskTaskResultV1> {
	const byLane = new Map<string, FlowDeskTaskResultV1>();
	for (const record of records) {
		const existing = byLane.get(record.lane_id);
		if (existing === undefined || Date.parse(record.created_at) >= Date.parse(existing.created_at)) {
			byLane.set(record.lane_id, record);
		}
	}
	return byLane;
}

function agentTaskContextByLane(records: readonly FlowDeskAgentTaskContextV1[]): Map<string, FlowDeskAgentTaskContextV1> {
	const byLane = new Map<string, FlowDeskAgentTaskContextV1>();
	for (const record of records) byLane.set(record.lane_id, record);
	return byLane;
}

/**
 * Safe local cleanup/backfill for legacy `flowdesk_agent_task_run` lanes.
 *
 * Older agent-task results/failures could persist `task_result.v1` or
 * `task_failed.v1` while the latest `lane_lifecycle` remained
 * `created`/`running`, which made status cards keep reporting stale active
 * lanes. This helper only writes terminal lifecycle evidence when existing
 * durable evidence already proves the agent-task ended.
 * It never launches, aborts, retries, enables dispatch authority, or rewrites
 * existing evidence.
 */
export function backfillTerminalAgentTaskFailedLanesV1(input: {
	rootDir: string;
	workflowId: string;
	now?: Date;
	refreshCompletionUiCaches?: boolean;
}): FlowDeskAgentTaskTerminalBackfillResultV1 {
	const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: input.rootDir, workflowId: input.workflowId });
	if (!reloaded.ok) return { status: "backfill_skipped", workflowId: input.workflowId, reason: "session_evidence_reload_failed" };

	const lifecycles: FlowDeskLaneLifecycleRecordV1[] = [];
	const taskResults: FlowDeskTaskResultV1[] = [];
	const taskFailures: FlowDeskTaskFailedV1[] = [];
	const contexts: FlowDeskAgentTaskContextV1[] = [];
	for (const entry of reloaded.entries) {
		if (isLaneLifecycleRecord(entry.record)) lifecycles.push(entry.record);
		else if (isTaskResult(entry.record)) taskResults.push(entry.record);
		else if (isTaskFailed(entry.record)) taskFailures.push(entry.record);
		else if (isAgentTaskContext(entry.record)) contexts.push(entry.record);
	}

	const latestLifecycle = latestLifecycleByLane(lifecycles);
	const latestResult = latestTaskResultByLane(taskResults);
	const latestFailure = latestTaskFailedByLane(taskFailures);
	const contextByLane = agentTaskContextByLane(contexts);
	const observedAt = (input.now ?? new Date()).toISOString();
	const token = timestampToken(input.now ?? new Date());
	const terminalEvidenceIds: string[] = [];
	let lanesScanned = 0;

	for (const [laneId, result] of latestResult) {
		const latest = latestLifecycle.get(laneId);
		if (latest === undefined) continue;
		lanesScanned++;
		if (!ABORT_ELIGIBLE_LANE_STATES.has(latest.state)) continue;
		const context = contextByLane.get(laneId);
		const evidenceId = `lifecycle-agent-task-terminal-backfill-${safeToken(laneId)}-${token}`;
		const terminalRecord: FlowDeskLaneLifecycleRecordV1 = {
			...latest,
			workflow_id: result.workflow_id,
			lane_id: laneId,
			agent_ref: context?.agent_ref ?? result.agent_ref ?? latest.agent_ref,
			provider_qualified_model_id: context?.provider_qualified_model_id ?? result.provider_qualified_model_id ?? latest.provider_qualified_model_id,
			parent_session_ref: context?.parent_session_ref ?? latest.parent_session_ref,
			state: "incomplete",
			verdict_ref: undefined,
			output_ref: `output-${safeToken(result.task_id)}`,
			updated_at: observedAt,
			spawned_by: latest.spawned_by ?? "flowdesk",
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		};
		if (writeEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, evidenceId, record: terminalRecord as unknown as Record<string, unknown> })) {
			terminalEvidenceIds.push(evidenceId);
		}
	}

	for (const [laneId, failed] of latestFailure) {
		if (latestResult.has(laneId)) continue;
		const latest = latestLifecycle.get(laneId);
		if (latest === undefined) continue;
		lanesScanned++;
		if (!ABORT_ELIGIBLE_LANE_STATES.has(latest.state)) continue;
		const context = contextByLane.get(laneId);
		const state: FlowDeskLaneLifecycleRecordV1["state"] = failed.failure_category === "no_response" ? "no_output" : "invocation_failed";
		const evidenceId = `lifecycle-agent-task-terminal-backfill-${safeToken(laneId)}-${token}`;
		const terminalRecord: FlowDeskLaneLifecycleRecordV1 = {
			...latest,
			workflow_id: failed.workflow_id,
			lane_id: laneId,
			agent_ref: context?.agent_ref ?? failed.agent_ref ?? latest.agent_ref,
			provider_qualified_model_id: context?.provider_qualified_model_id ?? failed.provider_qualified_model_id ?? latest.provider_qualified_model_id,
			parent_session_ref: context?.parent_session_ref ?? latest.parent_session_ref,
			state,
			verdict_ref: undefined,
			output_ref: undefined,
			updated_at: observedAt,
			spawned_by: latest.spawned_by ?? "flowdesk",
			dispatch_authority_enabled: false,
			providerCall: false,
			actualLaneLaunch: false,
			runtimeExecution: false,
		};
		if (writeEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, evidenceId, record: terminalRecord as unknown as Record<string, unknown> })) {
			terminalEvidenceIds.push(evidenceId);
		}
	}

	if (
		(input.refreshCompletionUiCaches ?? true) &&
		(terminalEvidenceIds.length > 0 || latestFailure.size > 0)
	) {
		refreshFlowDeskCompletionUiCachesV1({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			observedAt,
		});
	}

	return {
		status: "backfill_completed",
		workflowId: input.workflowId,
		lanesScanned,
		lanesTerminalized: terminalEvidenceIds.length,
		terminalLifecycleEvidenceIds: terminalEvidenceIds,
	};
}

/**
 * On startup/reload: any `pending_retry_plan` in `launched` state with no matching
 * `retry_executed` or `retry_failed` within 10 minutes of `created_at` is reconciled
 * as `retry_failed(indeterminate_launch)`.
 */
export function reconcileStalePendingRetryPlansV1(input: {
	rootDir: string;
	workflowId: string;
	now?: Date;
	staleThresholdMs?: number;
}): void {
	const now = input.now ?? new Date();
	const staleThresholdMs = input.staleThresholdMs ?? 600_000; // 10 minutes default
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
	});
	if (!reloaded.ok) return;

	for (const entry of reloaded.entries) {
		if (!isPendingRetryPlan(entry.record)) continue;
		const plan = entry.record;
		if (plan.status !== "launched") continue;
		// Check if stale: created_at + staleThresholdMs < now
		const createdAtMs = Date.parse(plan.created_at);
		if (!Number.isFinite(createdAtMs)) continue;
		if (now.getTime() < createdAtMs + staleThresholdMs) continue;
		// Check if any terminal evidence exists for new_lane_id
		const hasTerminal = reloaded.entries.some((e) => {
			if (isRetryExecuted(e.record) && e.record.new_lane_id === plan.new_lane_id) return true;
			if (isRetryFailed(e.record) && e.record.new_lane_id === plan.new_lane_id) return true;
			return false;
		});
		if (hasTerminal) continue;
		// Write retry_failed(indeterminate_launch)
		const failedId = `retry-failed-indeterminate-${safeToken(plan.new_lane_id)}-${timestampToken(now)}`;
		const failedRecord: FlowDeskRetryFailedV1 = {
			schema_version: "flowdesk.retry_failed.v1",
			workflow_id: plan.workflow_id,
			original_lane_id: plan.original_lane_id,
			new_lane_id: plan.new_lane_id,
			retry_attempt: plan.retry_attempt,
			failure_category: "indeterminate_launch",
			redacted_reason: "pending_retry_plan launched state stale without terminal evidence",
			created_at: now.toISOString(),
			dispatch_authority_enabled: false,
		};
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: failedId,
			record: failedRecord as unknown as Record<string, unknown>,
		});
	}
}

/**
 * Build a minimal FlowDeskRuntimeLaneLaunchPlanV1-compatible structure
 * from reviewer lane context evidence, for use in retry launch.
 */
function buildRetryLaunchPlanFromContextV1(
	context: FlowDeskReviewerLaneContextV1,
	newLaneId: string,
	parentSessionId: string,
): {
	schema_version: "flowdesk.runtime_lane_launch_plan.v1";
	ok: boolean;
	errors: string[];
	launch_request_id: string;
	workflow_id: string;
	attempt_id: string;
	lane_id: string;
	state: "launch_ready";
	blocked_labels: string[];
	parent_session_ref: string;
	agent_ref: string;
	provider_qualified_model_id: string;
	launch_reason: string;
	pre_launch_audit_ref: string;
	lane_launch_approval_ref: string;
	durable_evidence_root_ref: string;
	lifecycle_evidence_class: "lane_lifecycle";
	exact_binding_confirmed: true;
	sdk_client_required: true;
	launch_attempted: false;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
} {
	const token = timestampToken(new Date());
	return {
		schema_version: "flowdesk.runtime_lane_launch_plan.v1",
		ok: true,
		errors: [],
		launch_request_id: `launch-request-retry-${context.perspective}-${token}`,
		workflow_id: context.workflow_id,
		attempt_id: context.original_attempt_id,
		lane_id: newLaneId,
		state: "launch_ready",
		blocked_labels: [],
		parent_session_ref: `ses-${parentSessionId}`,
		agent_ref: context.agent_ref,
		provider_qualified_model_id: context.provider_qualified_model_id,
		launch_reason: "reviewer_fanout",
		pre_launch_audit_ref: `audit-retry-pre-launch-${context.perspective}-${token}`,
		lane_launch_approval_ref: `approval-retry-lane-launch-${context.perspective}-${token}`,
		durable_evidence_root_ref: `evidence-root-retry-${token}`,
		lifecycle_evidence_class: "lane_lifecycle",
		exact_binding_confirmed: true,
		sdk_client_required: true,
		launch_attempted: false,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}

function parentSessionIdFromRef(parentSessionRef: string): string | undefined {
	return parentSessionRef.startsWith("ses-") && parentSessionRef.length > "ses-".length
		? parentSessionRef.slice("ses-".length)
		: undefined;
}

function writeRetryFailedV1(input: {
	rootDir: string;
	workflowId: string;
	evidenceId: string;
	record: FlowDeskRetryFailedV1;
}): void {
	writeEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		record: input.record as unknown as Record<string, unknown>,
	});
}

/**
 * Evaluate guarded auto-retry hook following the execution order from the design doc exactly.
 * Called after `evaluateGuardedAutoAbortHookV1` returns `auto_abort_executed`.
 */
export async function evaluateGuardedAutoRetryHookV1(input: {
	config: FlowDeskAutoAbortConfigV1;
	rootDir: string;
	workflowId: string;
	laneId: string;
	abortEvidenceId: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined;
	parentSessionId: string;
	timeoutMs?: number;
	abortSignal?: AbortSignal;
	now?: Date;
	/** Override nudge quiet period — for testing only */
	_nudgeQuietPeriodMs?: number;
	/** Override messages poll timeout — for testing only */
	_messagesTimeoutMs?: number;
}): Promise<FlowDeskAutoRetryResultV1> {
	const now = input.now ?? new Date();
	const maxAutoRetries = Math.min(2, Math.max(1, input.config.maxAutoRetries ?? 1));
	const timeoutMs = input.timeoutMs ?? 30_000;

	// Step 1: Check opt-in
	if (input.config.autoRetryAfterAbort !== true) {
		return { status: "auto_retry_not_configured", reason: "opt_in_false" };
	}

	// Step 2: Re-verify Guard HMAC
	const guardLoaded = loadGuardSignOffFromRoot(input.rootDir, input.config.guardSignOffPath);
	if (guardLoaded === undefined) {
		return { status: "auto_retry_disabled", reason: "guard_unverified" };
	}
	const guardVerified = verifyGuardSignOffHmacV1({
		signOff: guardLoaded.signOff,
		markdownText: guardLoaded.markdownText,
		hmacKey: input.config.guardHmacKey,
		now,
	});
	if (!guardVerified.ok) {
		return { status: "auto_retry_disabled", reason: "guard_unverified" };
	}

	// Step 3: Check SDK client availability
	if (input.client === undefined || typeof input.client.session?.create !== "function") {
		const failedId = `retry-failed-sdk-unavailable-${safeToken(input.laneId)}-${timestampToken(now)}`;
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: failedId,
			record: {
				schema_version: "flowdesk.retry_failed.v1",
				workflow_id: input.workflowId,
				original_lane_id: input.laneId,
				retry_attempt: 1,
				failure_category: "sdk_unavailable",
				redacted_reason: "sdk_client_missing_or_session_create_unavailable",
				created_at: now.toISOString(),
				dispatch_authority_enabled: false,
			} satisfies FlowDeskRetryFailedV1 as unknown as Record<string, unknown>,
		});
		return {
			status: "retry_failed",
			failureCategory: "sdk_unavailable",
			redactedReason: "sdk_client_missing_or_session_create_unavailable",
		};
	}

	// Step 4: Load retry context for laneId. Reviewer context remains the
	// preferred P7 path; generic agent tasks fall back to agent_task_context.v1.
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
	});
	if (!reloaded.ok) {
		return { status: "auto_retry_disabled", reason: "context_missing" };
	}
	const reviewerContextEntry = reloaded.entries.find(
		(e) => isReviewerLaneContext(e.record) && (e.record as FlowDeskReviewerLaneContextV1).lane_id === input.laneId,
	);
	const agentTaskContextEntry = reviewerContextEntry === undefined
		? reloaded.entries.find(
			(e) => isAgentTaskContext(e.record) && (e.record as FlowDeskAgentTaskContextV1).lane_id === input.laneId,
		)
		: undefined;
	const contextEntry = reviewerContextEntry ?? agentTaskContextEntry;
	if (contextEntry === undefined) {
		return { status: "auto_retry_disabled", reason: "context_missing" };
	}
	const isAgentTaskRetry = reviewerContextEntry === undefined;
	const reviewerContext = isAgentTaskRetry ? undefined : contextEntry.record as unknown as FlowDeskReviewerLaneContextV1;
	const agentTaskContext = isAgentTaskRetry ? contextEntry.record as unknown as FlowDeskAgentTaskContextV1 : undefined;
	const context = reviewerContext ?? agentTaskContext!;

	// Step 5: Verify context.redaction_version present
	if (!context.redaction_version || typeof context.redaction_version !== "string" || context.redaction_version.trim().length === 0) {
		return { status: "auto_retry_disabled", reason: "context_redaction_invalid" };
	}

	// Step 6: Verify context.workflow_id === workflowId and context-specific invariants.
	const VALID_PERSPECTIVES = new Set(["policy_security", "architecture", "verification_implementation"]);
	if (context.workflow_id !== input.workflowId) {
		return { status: "auto_retry_disabled", reason: "invariant_violated" };
	}
	if (reviewerContext !== undefined && !VALID_PERSPECTIVES.has(reviewerContext.perspective)) {
		return { status: "auto_retry_disabled", reason: "invariant_violated" };
	}
	if (agentTaskContext !== undefined && agentTaskContext.prompt_text_truncated === true) {
		return { status: "auto_retry_disabled", reason: "invariant_violated" };
	}

	// Step 7: Count cap — retry_executed + retry_failed + pending_retry_plan(pending|launched) for laneId
	const retryExecutedCount = reloaded.entries.filter(
		(e) => isRetryExecuted(e.record) && (e.record as FlowDeskRetryExecutedV1).original_lane_id === input.laneId,
	).length;
	const retryFailedCount = reloaded.entries.filter(
		(e) => isRetryFailed(e.record) && (e.record as FlowDeskRetryFailedV1).original_lane_id === input.laneId,
	).length;
	const pendingActiveCount = reloaded.entries.filter((e) => {
		if (!isPendingRetryPlan(e.record)) return false;
		const plan = e.record as unknown as FlowDeskPendingRetryPlanV1;
		return plan.original_lane_id === input.laneId && (plan.status === "pending" || plan.status === "launched");
	}).length;
	const retriesUsed = retryExecutedCount + retryFailedCount + pendingActiveCount;

	if (retriesUsed >= maxAutoRetries) {
		const capFailedId = `retry-failed-cap-${safeToken(input.laneId)}-${timestampToken(now)}`;
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: capFailedId,
			record: {
				schema_version: "flowdesk.retry_failed.v1",
				workflow_id: input.workflowId,
				original_lane_id: input.laneId,
				retry_attempt: retriesUsed + 1,
				failure_category: "cap_reached",
				redacted_reason: `retry_cap_reached(max=${maxAutoRetries},used=${retriesUsed})`,
				created_at: now.toISOString(),
				dispatch_authority_enabled: false,
			} satisfies FlowDeskRetryFailedV1 as unknown as Record<string, unknown>,
		});
		return { status: "auto_retry_disabled", reason: "cap_reached", retriesUsed };
	}

	// Step 8: Check no pending_retry_plan(pending|launched) already exists for laneId
	if (pendingActiveCount > 0) {
		return { status: "auto_retry_disabled", reason: "concurrent_retry_in_progress" };
	}

	// Step 9: Verify lane_lifecycle terminal state = aborted for laneId (monotonic check)
	const lifecycleEntries = reloaded.entries.filter(
		(e) => e.evidenceClass === "lane_lifecycle" && isRecord(e.record) && (e.record as Record<string, unknown>).lane_id === input.laneId,
	);
	if (lifecycleEntries.length === 0) {
		return { status: "auto_retry_disabled", reason: "lane_not_terminal_aborted" };
	}
	const latestLifecycle = lifecycleEntries
		.map((e) => e.record as unknown as FlowDeskLaneLifecycleRecordV1)
		.sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())[0]!;
	if (latestLifecycle.state !== "aborted") {
		return { status: "auto_retry_disabled", reason: "lane_not_terminal_aborted" };
	}

	// Step 10: Generate newLaneId and pendingRetryEvidenceId
	const retryAttempt = retriesUsed + 1;
	const retryToken = timestampToken(now);
	const newLaneId = `lane-retry-${safeToken(input.laneId)}-${retryToken}`;
	const pendingRetryEvidenceId = `pending-retry-${safeToken(input.laneId)}-${retryToken}`;

	// Step 11: Write pending_retry_plan.v1(status=pending) — IDEMPOTENCY FENCE — before any SDK call
	const guardSignOffExpiry = guardLoaded.signOff && isRecord(guardLoaded.signOff) && typeof (guardLoaded.signOff as Record<string, unknown>).expires_at === "string"
		? Date.parse((guardLoaded.signOff as Record<string, unknown>).expires_at as string)
		: now.getTime() + 30 * 24 * 60 * 60 * 1000; // 30 days default
	const pendingExpiresAt = new Date(Math.min(guardSignOffExpiry, now.getTime() + 60 * 60 * 1000)); // 1h max
	const pendingRecord: FlowDeskPendingRetryPlanV1 = {
		schema_version: "flowdesk.pending_retry_plan.v1",
		workflow_id: input.workflowId,
		original_lane_id: input.laneId,
		new_lane_id: newLaneId,
		retry_attempt: retryAttempt,
		context_evidence_id: contextEntry.evidenceId,
		abort_evidence_id: input.abortEvidenceId,
		status: "pending",
		created_at: now.toISOString(),
		expires_at: pendingExpiresAt.toISOString(),
		dispatch_authority_enabled: false,
	};
	const pendingWritten = writeEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: pendingRetryEvidenceId,
		record: pendingRecord as unknown as Record<string, unknown>,
	});
	if (!pendingWritten) {
		return {
			status: "retry_failed",
			failureCategory: "invariant_violated",
			redactedReason: "pending_retry_plan_write_failed",
		};
	}

	if (agentTaskContext !== undefined) {
		const retryParentSessionId = parentSessionIdFromRef(agentTaskContext.parent_session_ref);
		if (retryParentSessionId === undefined) {
			const failedId = `retry-failed-agent-task-parent-${safeToken(newLaneId)}-${retryToken}`;
			writeRetryFailedV1({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				evidenceId: failedId,
				record: {
					schema_version: "flowdesk.retry_failed.v1",
					workflow_id: input.workflowId,
					original_lane_id: input.laneId,
					new_lane_id: newLaneId,
					retry_attempt: retryAttempt,
					failure_category: "invariant_violated",
					redacted_reason: "agent_task_context_parent_session_ref_invalid",
					created_at: now.toISOString(),
					dispatch_authority_enabled: false,
				},
			});
			writeEvidence({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				evidenceId: `${pendingRetryEvidenceId}-failed`,
				record: { ...pendingRecord, status: "failed" as const } as unknown as Record<string, unknown>,
			});
			return {
				status: "retry_failed",
				failureCategory: "invariant_violated",
				redactedReason: "agent_task_context_parent_session_ref_invalid",
			};
		}

		const taskResult = await executeFlowDeskAgentTaskV1({
			workflowId: input.workflowId,
			taskId: agentTaskContext.task_id,
			laneId: newLaneId,
			agentRef: agentTaskContext.agent_ref,
			providerQualifiedModelId: agentTaskContext.provider_qualified_model_id,
			promptText: agentTaskContext.prompt_text,
			parentSessionId: retryParentSessionId,
			parentSessionProviderQualifiedModelId:
				agentTaskContext.recorded_parent_provider_qualified_model_id ??
				agentTaskContext.parent_wake_provider_qualified_model_id,
			rootDir: input.rootDir,
			client: input.client,
			timeoutMs: timeoutMs,
			_nudgeQuietPeriodMs: input._nudgeQuietPeriodMs,
			_messagesTimeoutMs: input._messagesTimeoutMs,
		});

		if (taskResult.status === "task_failed") {
			const failedId = `retry-failed-agent-task-${safeToken(newLaneId)}-${retryToken}`;
			writeRetryFailedV1({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				evidenceId: failedId,
				record: {
					schema_version: "flowdesk.retry_failed.v1",
					workflow_id: input.workflowId,
					original_lane_id: input.laneId,
					new_lane_id: newLaneId,
					retry_attempt: retryAttempt,
					failure_category: taskResult.failureCategory === "no_response" ? "indeterminate_launch" : "sdk_create_failed",
					redacted_reason: `agent_task_retry_${taskResult.failureCategory}`,
					created_at: now.toISOString(),
					dispatch_authority_enabled: false,
				},
			});
			writeEvidence({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				evidenceId: `${pendingRetryEvidenceId}-failed`,
				record: { ...pendingRecord, status: "failed" as const } as unknown as Record<string, unknown>,
			});
			return {
				status: "retry_failed",
				failureCategory: taskResult.failureCategory,
				redactedReason: taskResult.redactedReason,
			};
		}

		const executedId = `retry-executed-${safeToken(newLaneId)}-${retryToken}`;
		const executedRecord: FlowDeskRetryExecutedV1 = {
			schema_version: "flowdesk.retry_executed.v1",
			workflow_id: input.workflowId,
			original_lane_id: input.laneId,
			new_lane_id: newLaneId,
			retry_attempt: retryAttempt,
			retry_kind: "agent_task",
			task_id: agentTaskContext.task_id,
			provider_qualified_model_id: agentTaskContext.provider_qualified_model_id,
			new_parent_session_ref: agentTaskContext.parent_session_ref,
			created_at: now.toISOString(),
			dispatch_authority_enabled: false,
		};
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: executedId,
			record: executedRecord as unknown as Record<string, unknown>,
		});
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: `${pendingRetryEvidenceId}-launched`,
			record: { ...pendingRecord, status: "launched" as const } as unknown as Record<string, unknown>,
		});
		return {
			status: "retry_launched",
			newLaneId,
			pendingRetryEvidenceId,
		};
	}

	// Step 12: Call launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1
	const launchPlan = buildRetryLaunchPlanFromContextV1(reviewerContext!, newLaneId, input.parentSessionId);

	let launchResult: Awaited<ReturnType<typeof launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1>>;
	try {
		const launchPromise = launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: input.client,
			launchPlan: launchPlan as unknown as import("@flowdesk/core").FlowDeskRuntimeLaneLaunchPlanV1,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId: input.parentSessionId,
				promptText: reviewerContext!.prompt_text,
				dispatchMethod: "prompt",
			},
		});
		launchResult = await withTimeout(launchPromise, timeoutMs, "retry_lane_launch");
	} catch (launchErr) {
		// SDK call itself threw — treat as sdk_create_failed
		const failedId = `retry-failed-launch-err-${safeToken(newLaneId)}-${retryToken}`;
		const failedRecord: FlowDeskRetryFailedV1 = {
			schema_version: "flowdesk.retry_failed.v1",
			workflow_id: input.workflowId,
			original_lane_id: input.laneId,
			new_lane_id: newLaneId,
			retry_attempt: retryAttempt,
			failure_category: "sdk_create_failed",
			redacted_reason: "sdk_launch_threw_exception",
			created_at: now.toISOString(),
			dispatch_authority_enabled: false,
		};
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: failedId,
			record: failedRecord as unknown as Record<string, unknown>,
		});
		// Update pending plan to failed
		const failedPendingRecord = { ...pendingRecord, status: "failed" as const };
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: `${pendingRetryEvidenceId}-failed`,
			record: failedPendingRecord as unknown as Record<string, unknown>,
		});
		return {
			status: "retry_failed",
			failureCategory: "sdk_create_failed",
			redactedReason: "sdk_launch_threw_exception",
		};
	}

	// Step 13/14: Handle session.create success but promptAsync rejection, or create failure
	if (launchResult.status !== "lane_launch_started") {
		const isCreateAttempted = launchResult.createAttempted;
		const failureCategory: FlowDeskRetryFailedV1["failure_category"] = isCreateAttempted
			? "sdk_prompt_rejected"
			: "sdk_create_failed";
		const failedId = `retry-failed-${failureCategory}-${safeToken(newLaneId)}-${retryToken}`;
		const failedRecord: FlowDeskRetryFailedV1 = {
			schema_version: "flowdesk.retry_failed.v1",
			workflow_id: input.workflowId,
			original_lane_id: input.laneId,
			new_lane_id: newLaneId,
			retry_attempt: retryAttempt,
			failure_category: failureCategory,
			redacted_reason: `sdk_launch_${launchResult.status}`,
			created_at: now.toISOString(),
			dispatch_authority_enabled: false,
		};
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: failedId,
			record: failedRecord as unknown as Record<string, unknown>,
		});
		// Update pending plan to failed
		const failedPendingRecord = { ...pendingRecord, status: "failed" as const };
		writeEvidence({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			evidenceId: `${pendingRetryEvidenceId}-failed`,
			record: failedPendingRecord as unknown as Record<string, unknown>,
		});
		return {
			status: "retry_failed",
			failureCategory,
			redactedReason: `sdk_launch_${launchResult.status}`,
		};
	}

	// Step 15: Full success — write retry_executed.v1 + update pending to launched
	const newParentSessionRef = launchResult.childSessionRef ?? `ses-${input.parentSessionId}`;
	const executedId = `retry-executed-${safeToken(newLaneId)}-${retryToken}`;
	const executedRecord: FlowDeskRetryExecutedV1 = {
		schema_version: "flowdesk.retry_executed.v1",
		workflow_id: input.workflowId,
		original_lane_id: input.laneId,
		new_lane_id: newLaneId,
		retry_attempt: retryAttempt,
		retry_kind: "reviewer_lane",
		perspective: reviewerContext!.perspective,
		provider_qualified_model_id: reviewerContext!.provider_qualified_model_id,
		new_parent_session_ref: newParentSessionRef,
		original_attempt_id: reviewerContext!.original_attempt_id,
		created_at: now.toISOString(),
		dispatch_authority_enabled: false,
	};
	writeEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: executedId,
		record: executedRecord as unknown as Record<string, unknown>,
	});
	// Update pending plan to launched
	const launchedPendingRecord = { ...pendingRecord, status: "launched" as const };
	writeEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		evidenceId: `${pendingRetryEvidenceId}-launched`,
		record: launchedPendingRecord as unknown as Record<string, unknown>,
	});
	return {
		status: "retry_launched",
		newLaneId,
		pendingRetryEvidenceId,
	};
}

// ---------------------------------------------------------------------------
// P8 Background Watchdog
// ---------------------------------------------------------------------------

export interface FlowDeskWatchdogConfigV1 {
	enabled?: boolean;
	intervalMs?: number;        // min 10_000, default 30_000
	stallThresholdMs?: number;  // default 300_000 (5 min)
	mcpTriggerEnabled?: boolean;
}

export interface FlowDeskWatchdogCycleResultV1 {
	cycleAt: string;
	guardValid: boolean;
	lanesChecked: number;
	lanesAborted: number;
	lanesRetried: number;
	lanesFailed: number;
	skippedReason?: string;
}

// Module-level flag to prevent concurrent cycles
let _isWatchdogCycleRunning = false;

const FLOWDESK_SESSION_EVIDENCE_ROOT = ".flowdesk/sessions";

function listWatchdogWorkflowIds(rootDir: string): string[] {
	const sessionsDir = join(rootDir, FLOWDESK_SESSION_EVIDENCE_ROOT);
	if (!existsSync(sessionsDir)) return [];
	let entries: string[];
	try {
		entries = readdirSync(sessionsDir);
	} catch {
		return [];
	}
	const result: string[] = [];
	for (const name of entries) {
		const candidatePath = join(sessionsDir, name);
		try {
			const stat = statSync(candidatePath);
			if (stat.isDirectory()) result.push(name);
		} catch {
			// skip unreadable entries
		}
	}
	return result;
}

export async function runFlowDeskWatchdogCycleV1(input: {
	config: FlowDeskAutoAbortConfigV1;
	rootDir: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1 | undefined;
	parentSessionId: string;
	now?: Date;
	/** Override nudge quiet period — for testing only */
	_nudgeQuietPeriodMs?: number;
	/** Override messages poll timeout — for testing only */
	_messagesTimeoutMs?: number;
}): Promise<FlowDeskWatchdogCycleResultV1> {
	const cycleAt = (input.now ?? new Date()).toISOString();

	// Check Guard HMAC first (before concurrency check per the plan spec)
	const guardLoaded = loadGuardSignOffFromRoot(input.rootDir, input.config.guardSignOffPath);
	if (guardLoaded === undefined) {
		return {
			cycleAt,
			guardValid: false,
			lanesChecked: 0,
			lanesAborted: 0,
			lanesRetried: 0,
			lanesFailed: 0,
			skippedReason: "guard_invalid",
		};
	}
	const guardVerified = verifyGuardSignOffHmacV1({
		signOff: guardLoaded.signOff,
		markdownText: guardLoaded.markdownText,
		hmacKey: input.config.guardHmacKey,
		now: input.now,
	});
	if (!guardVerified.ok) {
		return {
			cycleAt,
			guardValid: false,
			lanesChecked: 0,
			lanesAborted: 0,
			lanesRetried: 0,
			lanesFailed: 0,
			skippedReason: "guard_invalid",
		};
	}

	// Check concurrent execution flag
	if (_isWatchdogCycleRunning) {
		return {
			cycleAt,
			guardValid: true,
			lanesChecked: 0,
			lanesAborted: 0,
			lanesRetried: 0,
			lanesFailed: 0,
			skippedReason: "cycle_already_running",
		};
	}

	_isWatchdogCycleRunning = true;
	let lanesChecked = 0;
	let lanesAborted = 0;
	let lanesRetried = 0;
	let lanesFailed = 0;

	try {
		const workflowIds = listWatchdogWorkflowIds(input.rootDir);
		const now = input.now ?? new Date();
		const nudgeQuietPeriodMs = typeof input._nudgeQuietPeriodMs === "number" && input._nudgeQuietPeriodMs > 0
			? Math.floor(input._nudgeQuietPeriodMs)
			: undefined;

		for (const workflowId of workflowIds) {
			// Monitor async-mode child sessions (nudge + abort + result collection)
			if (input.client !== undefined) {
				try {
					await monitorChildSessionsV1({
						rootDir: input.rootDir,
						workflowId,
						client: input.client,
						now,
						...(nudgeQuietPeriodMs === undefined ? {} : { nudgeQuietPeriodMs }),
					});
				} catch { /* best-effort, must not crash watchdog */ }
			}

			backfillTerminalAgentTaskFailedLanesV1({
				rootDir: input.rootDir,
				workflowId,
				now,
			});
			// Reload evidence for this workflow
			const reloaded = reloadFlowDeskSessionEvidenceV1({
				rootDir: input.rootDir,
				workflowId,
			});
			if (!reloaded.ok) continue;

			// Run stall projection
			const stallProjection = projectFlowDeskLaneStallV1({
				workflowId,
				reload: reloaded,
				observedAt: now.toISOString(),
			});

			// Find stalled lanes
			const stalledEntries = stallProjection.entries.filter(
				(entry) => entry.classification === "stalled",
			);

			for (const stalledEntry of stalledEntries) {
				lanesChecked++;
				try {
					// Run guarded auto-abort
					const autoAbort = evaluateGuardedAutoAbortHookV1({
						rootDir: input.rootDir,
						workflow_id: workflowId,
						lane_id: stalledEntry.laneId,
						config: input.config,
						stallConfirmed: true,
						sdkSessionHealth: { status: "api_timeout", reason: "watchdog_cycle_stall_detected" },
						now: () => now,
						loadedSignOff: guardLoaded,
					});

					if (autoAbort.status === "auto_abort_executed") {
						lanesAborted++;
						// Run guarded auto-retry if configured
						if (
							input.config.autoRetryAfterAbort === true &&
							input.client !== undefined
						) {
							try {
							const retryResult = await evaluateGuardedAutoRetryHookV1({
								config: input.config,
								rootDir: input.rootDir,
								workflowId,
								laneId: stalledEntry.laneId,
								abortEvidenceId: autoAbort.lifecycle_evidence_id,
								client: input.client,
								parentSessionId: input.parentSessionId,
								now,
								_nudgeQuietPeriodMs: input._nudgeQuietPeriodMs,
								_messagesTimeoutMs: input._messagesTimeoutMs,
							});
								if (retryResult.status === "retry_launched") {
									lanesRetried++;
								} else if (
									retryResult.status === "retry_failed" ||
									retryResult.status === "auto_retry_disabled"
								) {
									// Not a failure of the watchdog cycle itself
								}
							} catch {
								// Retry evaluation is best-effort; do not count as lanesFailed
							}
						}
					} else if (autoAbort.status === "blocked") {
						lanesFailed++;
					}
				} catch {
					lanesFailed++;
				}
			}
		}
	} finally {
		_isWatchdogCycleRunning = false;
	}

	return {
		cycleAt,
		guardValid: true,
		lanesChecked,
		lanesAborted,
		lanesRetried,
		lanesFailed,
	};
}

// ─────────────────────────────────────────────────────────────────────────────
// Child session monitor (async-mode lanes)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Idle-confirmed continuation prompt. Injected into the SAME child session once
 * when the lane has gone idle WITHOUT any captured assistant text. Unlike the
 * legacy noReply nudge this is a real, visible recovery prompt that keeps the
 * session alive and asks the model to either finish or state its blocker. It is
 * recorded with durable evidence and capped per lane.
 */
const AGENT_TASK_IDLE_CONTINUATION_TEXT =
	"You appear to have become idle without producing a final answer. If your work is complete, output your complete final answer now. If you are blocked, state the blocker concisely in one short paragraph." as const;

/**
 * Classify an agent_task_progress record as MEANINGFUL model/runtime activity
 * vs ambient/self-authored noise. Meaningful activity resets the watchdog nudge
 * budget and defers abort; noise does not.
 *
 * Excluded as non-meaningful:
 *   - phase "nudged"     → watchdog legacy nudge / idle continuation injection
 *   - phase "failed"     → terminal failure record
 *   - phase "finalizing" → watchdog-authored capture / session-idle marker
 *   - ambient session-status churn ("session busy", "session.diff",
 *     "session.updated") which can stream without any real progress
 *
 * Treated as meaningful:
 *   - streaming assistant message/part deltas ("message part event observed",
 *     "message.updated event observed")
 *   - tool error events, terminal step events
 *   - permission responses
 */
export function flowDeskProgressIsMeaningfulActivityV1(phase: string, progressLabel: string | undefined): boolean {
	if (phase === "nudged" || phase === "failed" || phase === "finalizing") return false;
	const label = (progressLabel ?? "").toLowerCase();
	if (label.includes("tool_run_overdue_observed") || label.includes("tool_execution_aborted_observed") || label.includes("coordinator_attention_observed")) return false;
	// Ambient session-status / diff churn is not, by itself, model progress.
	if (label.includes("session busy") || label.includes("session.diff") || label.includes("session.updated")) return false;
	if (label.includes("waiting for async child result")) return false;
	if (label.includes("session retry event observed")) return false;
	// Everything else at waiting/started/retrying with a real event label counts.
	return true;
}

/** Poll result from one session.messages call */
function monitorRecord(value: unknown): Record<string, unknown> | undefined {
	return typeof value === "object" && value !== null && !Array.isArray(value)
		? value as Record<string, unknown>
		: undefined;
}

function monitorResponseData(value: unknown): unknown {
	const record = monitorRecord(value);
	return record !== undefined && "data" in record ? record.data : value;
}

function monitorSdkErrorResponse(value: unknown): boolean {
	const record = monitorRecord(value);
	const data = monitorRecord(monitorResponseData(value));
	return record?.error !== undefined || data?.error !== undefined;
}

/**
 * SDK shape memoization for the watchdog `session.messages` path. The structured
 * `{ path: { id } }` shape fails on OpenCode 1.15.x with a `%7Bid%7D`
 * URL-encoding error. Retrying that shape on every watchdog poll cycle adds
 * wasted error/timeout per cycle. After one structured failure per client
 * instance, all subsequent calls for that client use the flat `{ sessionID }`
 * shape only. A WeakMap is used so the memo does not pin the client reference.
 */
const monitorSessionShapeCache = new WeakMap<object, boolean | undefined>();

async function readAsyncMonitorChildSessionMessages(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	childSessionId: string,
	messagesTimeoutMs = 3_000,
): Promise<unknown | null> {
	const messages = client.session.messages;
	if (typeof messages !== "function") return null;
	const method = messages as (options: unknown) => unknown | Promise<unknown>;
	const sessionObj = client.session as object;
	let useStructured = monitorSessionShapeCache.get(sessionObj);
	const readMessages = (async (): Promise<unknown> => {
		// First call: probe the structured shape and memoize the result.
		if (useStructured === undefined) {
			try {
				const structured = await method.call(client.session, { path: { id: childSessionId } });
				if (!monitorSdkErrorResponse(structured)) {
					monitorSessionShapeCache.set(sessionObj, true);
					return structured;
				}
			} catch { /* structured shape unavailable */ }
			monitorSessionShapeCache.set(sessionObj, false);
			return method.call(client.session, { sessionID: childSessionId });
		}
		// Subsequent calls: use whichever shape succeeded.
		if (useStructured) {
			try {
				const structured = await method.call(client.session, { path: { id: childSessionId } });
				if (!monitorSdkErrorResponse(structured)) return structured;
			} catch { /* structured shape broke mid-session; fall back permanently */ }
			monitorSessionShapeCache.set(sessionObj, false);
		}
		return method.call(client.session, { sessionID: childSessionId });
	})();
	if (messagesTimeoutMs <= 0) return readMessages;
	return Promise.race([
		readMessages,
		new Promise<null>(resolve => setTimeout(() => resolve(null), messagesTimeoutMs)),
	]);
}

/** @internal Reset the session shape cache for testing */
export function _resetMonitorSessionShapeCacheForTest(): void {
	// WeakMap has no clear(); tests recreate clients anyway.
	// Provided for explicit documentation/contract only.
}

async function pollChildSessionOutput(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	childSessionId: string,
	messagesTimeoutMs = 3_000,
): Promise<{ text: string; completionStatus: FlowDeskAgentTaskCompletionStatusV1; outputKind: string; usableForSynthesis: boolean; looksLikeRefusalOrError: boolean; finalBodyObserved: boolean; terminalMarkerObserved: boolean; hasRunningTool: boolean } | null> {
	try {
		const raw = await readAsyncMonitorChildSessionMessages(client, childSessionId, messagesTimeoutMs);
		if (raw === null) return null;
		const observed = observeFlowDeskAgentTaskOutputV1(raw);
		if (observed.terminalObserved && observed.latestText !== undefined && observed.latestText.trim().length > 0)
			return { text: observed.latestText, completionStatus: "final", outputKind: observed.outputKind, usableForSynthesis: observed.usableForSynthesis, looksLikeRefusalOrError: observed.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: true, hasRunningTool: observed.hasRunningTool };
		return null;
	} catch {
		return null;
	}
}

async function pollChildSessionCandidate(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	childSessionId: string,
	messagesTimeoutMs = 3_000,
): Promise<{ text: string; completionStatus: FlowDeskAgentTaskCompletionStatusV1; outputKind: string; usableForSynthesis: boolean; looksLikeRefusalOrError: boolean; finalBodyObserved: boolean; terminalMarkerObserved: boolean } | null> {
	try {
		const raw = await readAsyncMonitorChildSessionMessages(client, childSessionId, messagesTimeoutMs);
		if (raw === null) return null;
		const observed = observeFlowDeskAgentTaskOutputV1(raw);
		if (observed.latestText !== undefined && observed.latestText.trim().length > 0)
			return { text: observed.latestText, completionStatus: observed.terminalObserved ? "final" : "partial", outputKind: observed.outputKind, usableForSynthesis: observed.usableForSynthesis, looksLikeRefusalOrError: observed.looksLikeRefusalOrError, finalBodyObserved: true, terminalMarkerObserved: observed.terminalObserved };
		return null;
	} catch {
		return null;
	}
}

/**
 * Idle-confirmed capture. When the child session has produced non-empty
 * assistant text but no explicit terminal marker (step-finish / finish_reason
 * = stop) is visible, OpenCode may still have gone idle with the final answer
 * already present. Relying only on `terminalObserved` lets such lanes drift
 * into `finalizing_without_terminal` and eventually a `MessageAbortedError`,
 * losing a result that is sitting right there in the transcript.
 *
 * This poll returns that text as an idle-confirmed final ONLY when:
 *   - there is non-empty latest assistant text,
 *   - no tool is currently running (the model is not mid-step), and
 *   - the caller has already confirmed the lane was silent past an
 *     idle-settle window (passed via `idleConfirmed`).
 *
 * It never sends a prompt and never aborts; it only reads `session.messages`.
 */
async function pollChildSessionIdleConfirmedOutput(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	childSessionId: string,
	messagesTimeoutMs = 3_000,
): Promise<{ text: string | undefined; outputKind: string; usableForSynthesis: boolean; looksLikeRefusalOrError: boolean; hasRunningTool: boolean; terminalMarkerObserved: boolean } | null> {
	try {
		const raw = await readAsyncMonitorChildSessionMessages(client, childSessionId, messagesTimeoutMs);
		if (raw === null) return null;
		const observed = observeFlowDeskAgentTaskOutputV1(raw);
		return {
			text: observed.latestText,
			outputKind: observed.outputKind,
			usableForSynthesis: observed.usableForSynthesis,
			looksLikeRefusalOrError: observed.looksLikeRefusalOrError,
			hasRunningTool: observed.hasRunningTool,
			terminalMarkerObserved: observed.terminalObserved,
		};
	} catch {
		return null;
	}
}

/**
 * Inject a real continuation prompt into the same child session (no noReply).
 * Best-effort with a hard timeout. Prefers promptAsync, falls back to prompt.
 * Returns "sent" when dispatch resolved, "timeout" otherwise, "skipped" when no
 * prompt API is available on the injected client.
 */
async function sendIdleContinuationPrompt(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	childSessionId: string,
	timeoutMs = 5_000,
	promptText: string = AGENT_TASK_IDLE_CONTINUATION_TEXT,
): Promise<"sent" | "timeout" | "skipped"> {
	const promptFn = client.session.promptAsync ?? client.session.prompt;
	if (promptFn === undefined) return "skipped";
	try {
		await Promise.race([
			(promptFn as (o: unknown) => unknown).call(client.session, {
				sessionID: childSessionId,
				parts: [{ type: "text", text: promptText }],
			}),
			new Promise<never>((_, reject) =>
				setTimeout(() => reject(new Error("continuation timeout")), timeoutMs),
			),
		]);
		return "sent";
	} catch {
		return "timeout";
	}
}

/** Abort a child session via the injected SDK client */
async function abortChildSession(
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1,
	childSessionId: string,
): Promise<void> {
	const abort = client.session.abort;
	if (typeof abort !== "function") return;
	try {
		await (abort as (o: unknown) => unknown).call(client.session, {
			sessionID: childSessionId,
		});
	} catch { /* best-effort */ }
}

function writeChildSessionEvidence(
	rootDir: string,
	workflowId: string,
	evidenceId: string,
	record: Record<string, unknown>,
): boolean {
	const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({ workflowId, evidenceId, record });
	if (!prepared.ok || prepared.writeIntent === undefined) return false;
	const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(rootDir, [prepared.writeIntent]);
	return applied.ok && applied.writtenPaths.length > 0;
}

function stableSessionFinalizationTextRef(text: string | undefined): { observedTextRef?: string; observedTextCharCount?: number } {
	if (typeof text !== "string" || text.length === 0) return {};
	return {
		observedTextRef: `observed-text-sha256-${createHash("sha256").update(text, "utf8").digest("hex")}`,
		observedTextCharCount: text.length,
	};
}

function sessionFinalizationTransitionKey(record: Record<string, unknown>): string {
	const observation = isRecord(record.observation) ? record.observation : {};
	return JSON.stringify({
		lane_id: record.lane_id,
		decision: record.decision,
		block_reason: record.block_reason,
		observed_text_ref: record.observed_text_ref,
		observed_text_char_count: record.observed_text_char_count,
		final_text_kind: observation.final_text_kind,
		session_idle_state: observation.session_idle_state,
		running_tools_state: observation.running_tools_state,
		confidence: observation.confidence,
		step_finish_observed: observation.step_finish_observed,
	});
}

function sessionFinalizationEvidenceAlreadyRecorded(input: {
	entries: readonly { evidenceClass: string; record: unknown }[];
	laneId: string;
	transitionKey: string;
}): boolean {
	return input.entries.some((entry) => {
		if (entry.evidenceClass !== "session_finalization_evidence" || !isRecord(entry.record)) return false;
		return entry.record.lane_id === input.laneId && sessionFinalizationTransitionKey(entry.record) === input.transitionKey;
	});
}

function evaluateSessionFinalizationForObservedText(input: {
	childSessionId: string;
	text?: string;
	stepFinishObserved: boolean;
	sessionIdleState: "confirmed_idle" | "not_idle" | "unknown";
	runningToolsState: FlowDeskSessionRunningToolsState;
	confidence: "high" | "medium" | "low";
}) {
	const textRef = stableSessionFinalizationTextRef(input.text);
	const observation = buildFlowDeskSessionFinalizationObservation({
		sessionRef: input.childSessionId,
		observedTextRef: textRef.observedTextRef,
		observedTextCharCount: textRef.observedTextCharCount,
		finalTextKind: textRef.observedTextRef !== undefined || textRef.observedTextCharCount !== undefined ? "assistant_final_text" : "empty",
		sessionIdleState: input.sessionIdleState,
		runningToolsState: input.runningToolsState,
		confidence: input.confidence,
		stepFinishObserved: input.stepFinishObserved,
	});
	return evaluateFlowDeskSessionFinalizationEvidence(observation);
}

function writeSessionFinalizationEvidenceIfMeaningful(input: {
	rootDir: string;
	workflowId: string;
	reloadedEntries: readonly { evidenceClass: string; record: unknown }[];
	laneId: string;
	taskId: string;
	childSessionId: string;
	observedAt: string;
	decisionContext: "turn_completed_empty" | "turn_completed_text" | "watchdog_terminal_text" | "idle_confirmed_text";
	text?: string;
	stepFinishObserved: boolean;
	sessionIdleState: "confirmed_idle" | "not_idle" | "unknown";
	runningToolsState: FlowDeskSessionRunningToolsState;
	confidence: "high" | "medium" | "low";
}): { written: boolean; evaluated: ReturnType<typeof evaluateFlowDeskSessionFinalizationEvidence> } {
	const evaluated = evaluateSessionFinalizationForObservedText(input);
	const record: Record<string, unknown> = {
		...evaluated,
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		child_session_id: input.childSessionId,
		decision_context: input.decisionContext,
		observed_at: input.observedAt,
	};
	const transitionKey = sessionFinalizationTransitionKey(record);
	if (sessionFinalizationEvidenceAlreadyRecorded({ entries: input.reloadedEntries, laneId: input.laneId, transitionKey })) return { written: false, evaluated };
	const transitionDigest = createHash("sha256").update(transitionKey, "utf8").digest("hex").slice(0, 16);
	const decision = typeof evaluated.decision === "string" ? evaluated.decision as FlowDeskSessionFinalizationDecision : "requires_review";
	const written = writeChildSessionEvidence(
		input.rootDir,
		input.workflowId,
		`session-finalization-${safeToken(input.laneId)}-${safeToken(decision)}-${transitionDigest}`,
		record,
	);
	return { written, evaluated };
}

function extractJsonBlocksFromText(raw: string): string[] {
	const trimmed = raw.trim();
	const results: string[] = [];
	if (trimmed.startsWith("{") && trimmed.endsWith("}")) return [trimmed];
	const fencePattern = /```(?:json)?\s*\n?(\{[\s\S]*?\})\s*\n?```/g;
	for (const match of trimmed.matchAll(fencePattern)) {
		if (match[1]) results.push(match[1].trim());
	}
	if (results.length > 0) return results;
	let depth = 0;
	let start = -1;
	let lastBlock: string | undefined;
	for (let i = 0; i < trimmed.length; i++) {
		const ch = trimmed[i];
		if (ch === "{") {
			if (depth === 0) start = i;
			depth++;
		} else if (ch === "}") {
			depth--;
			if (depth === 0 && start !== -1) {
				lastBlock = trimmed.slice(start, i + 1).trim();
				start = -1;
			}
		}
	}
	return lastBlock === undefined ? [] : [lastBlock];
}

function observedTopTierReviewerVerdictFromText(input: {
	text: string;
	workflowId: string;
}): FlowDeskTopTierReviewVerdictV1 | undefined {
	for (const block of extractJsonBlocksFromText(input.text)) {
		try {
			const candidate = JSON.parse(block) as unknown;
			const validation = validateTopTierReviewVerdictV1(candidate);
			if (!validation.ok) continue;
			const verdict = candidate as FlowDeskTopTierReviewVerdictV1;
			if (verdict.workflow_id === input.workflowId) return verdict;
		} catch {
			// Keep scanning candidates.
		}
	}
	return undefined;
}

function persistObservedReviewerVerdict(input: {
	rootDir: string;
	workflowId: string;
	verdict: FlowDeskTopTierReviewVerdictV1;
}): boolean {
	const evidenceId = input.verdict.verdict_id;
	if (!writeChildSessionEvidence(input.rootDir, input.workflowId, evidenceId, input.verdict as unknown as Record<string, unknown>)) return false;
	const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: input.rootDir, workflowId: input.workflowId });
	return reloaded.ok && reloaded.blocked.length === 0 && reloaded.entries.some((entry) =>
		entry.evidenceClass === "reviewer_verdict" &&
		entry.evidenceId === evidenceId &&
		entry.record.verdict_id === input.verdict.verdict_id
	);
}

function writeAgentTaskCompleteLifecycleForVerdict(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	attemptId: string;
	parentSessionRef: string;
	childSessionId: string;
	taskResultEvidenceId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	verdictId: string;
	observedAt: string;
}): boolean {
	return writeChildSessionEvidence(input.rootDir, input.workflowId, `lifecycle-agent-task-complete-${input.laneId}-${input.verdictId}`, {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: input.laneId,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		parent_session_ref: input.parentSessionRef,
		child_session_ref: input.childSessionId.startsWith("ses-") ? input.childSessionId : `ses-${input.childSessionId}`,
		message_ref: `msg-${input.laneId}`,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		state: "complete",
		verdict_ref: input.verdictId,
		output_ref: `output-${input.taskResultEvidenceId}`,
		runtime_echo_ref: `runtime-echo-${input.laneId}`,
		telemetry_ref: `telemetry-${input.laneId}`,
		timeout_ms: 0,
		orphan_max_age_ms: 0,
		retry_count: 0,
		created_at: input.observedAt,
		updated_at: input.observedAt,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	});
}

function writeAgentTaskTerminalLifecycleForTaskResult(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	attemptId: string;
	parentSessionRef: string;
	childSessionId: string;
	taskResultEvidenceId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	observedAt: string;
}): boolean {
	return writeChildSessionEvidence(input.rootDir, input.workflowId, `lifecycle-agent-task-result-${input.laneId}-${input.taskResultEvidenceId}`, {
		schema_version: "flowdesk.lane_lifecycle_record.v1",
		lane_id: input.laneId,
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		parent_session_ref: input.parentSessionRef,
		child_session_ref: input.childSessionId.startsWith("ses-") ? input.childSessionId : `ses-${input.childSessionId}`,
		message_ref: `msg-${input.laneId}`,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		// A task_result is terminal even when it is not a typed reviewer verdict. Use
		// the existing terminal non-verdict state so status does not leave the earlier
		// running lifecycle as the only lifecycle signal for a completed async lane.
		state: "incomplete",
		verdict_ref: undefined,
		output_ref: `output-${input.taskResultEvidenceId}`,
		runtime_echo_ref: `runtime-echo-${input.laneId}`,
		telemetry_ref: `telemetry-${input.laneId}`,
		timeout_ms: 0,
		orphan_max_age_ms: 0,
		retry_count: 0,
		created_at: input.observedAt,
		updated_at: input.observedAt,
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	});
}

function laneAlreadyHasTerminalTaskEvidence(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
}): boolean {
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
	});
	if (!reloaded.ok) return false;
	return reloaded.entries.some((entry) => {
		if (entry.evidenceClass !== "task_result" && entry.evidenceClass !== "task_failed") return false;
		const record = entry.record as Record<string, unknown>;
		return record.lane_id === input.laneId;
	});
}

type FlowDeskTerminalLaneEndStateV1 = {
	laneId: string;
	state: string;
	observedAtMs: number;
	hasTaskResult: boolean;
};

function terminalEvidenceObservedAtMs(record: Record<string, unknown>): number {
	const value = typeof record.updated_at === "string"
		? record.updated_at
		: typeof record.created_at === "string"
			? record.created_at
			: typeof record.observed_at === "string"
				? record.observed_at
				: undefined;
	const parsed = value === undefined ? Number.NaN : Date.parse(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

function chooseLaterTerminalEndState(
	existing: FlowDeskTerminalLaneEndStateV1 | undefined,
	candidate: FlowDeskTerminalLaneEndStateV1,
): FlowDeskTerminalLaneEndStateV1 {
	if (existing === undefined) return candidate;
	if (candidate.observedAtMs > existing.observedAtMs) return candidate;
	if (candidate.observedAtMs < existing.observedAtMs) return existing;
	// Prefer task_result for equal timestamps; otherwise keep the existing entry so
	// duplicate event-session-error / failed-child evidence is idempotent.
	return candidate.hasTaskResult && !existing.hasTaskResult ? candidate : existing;
}

function collectTerminalLaneEndStatesV1(entries: readonly { evidenceClass: string; record: unknown }[]): Map<string, FlowDeskTerminalLaneEndStateV1> {
	const terminalByLane = new Map<string, FlowDeskTerminalLaneEndStateV1>();
	for (const entry of entries) {
		const rec = entry.record as Record<string, unknown>;
		const laneId = typeof rec.lane_id === "string" ? rec.lane_id : undefined;
		if (laneId === undefined) continue;
		let state: string | undefined;
		let hasTaskResult = false;
		if (entry.evidenceClass === "lane_lifecycle") {
			state = typeof rec.state === "string" && TERMINAL_LANE_STATES.has(rec.state) ? rec.state : undefined;
		} else if (entry.evidenceClass === "task_result") {
			state = "complete";
			hasTaskResult = true;
		} else if (entry.evidenceClass === "task_failed") {
			state = rec.failure_category === "no_response" ? "no_output" : "invocation_failed";
		}
		if (state === undefined) continue;
		terminalByLane.set(laneId, chooseLaterTerminalEndState(terminalByLane.get(laneId), {
			laneId,
			state,
			observedAtMs: terminalEvidenceObservedAtMs(rec),
			hasTaskResult,
		}));
	}
	return terminalByLane;
}

function latestTerminalObservedAtIso(endStates: Iterable<FlowDeskTerminalLaneEndStateV1>, fallbackMs: number): string {
	let latest = 0;
	for (const state of endStates) latest = Math.max(latest, state.observedAtMs);
	return new Date(latest > 0 ? latest : fallbackMs).toISOString();
}

function childProgressLabel(value: string): string {
	const compact = value.replace(/\s+/g, " ").trim();
	return compact.length > 120 ? `${compact.slice(0, 119)}…` : compact;
}

function isChildSessionIdleSignalProgress(value: unknown): boolean {
	if (typeof value !== "string") return false;
	const label = value.toLowerCase();
	return label === "agent task session idle event observed" || label === "agent task session idle status observed";
}

// V11.2 Slice 1: parse an event-hook tool-state progress label into a per-callID
// transition. The event hook emits `agent task tool running callid=<id>` /
// `... tool settled callid=<id>` / `... tool error callid=<id>`. Returns the
// transition kind and callID so the monitor can maintain an event-based
// open-tool set instead of a polling snapshot.
function parseChildToolStateProgressV1(value: unknown): { kind: "open" | "settled"; callId: string } | undefined {
	if (typeof value !== "string") return undefined;
	const m = /^agent task tool (running|settled|error) callid=(.+)$/.exec(value.trim());
	if (m === null) return undefined;
	const kind = m[1] === "running" ? "open" : "settled"; // settled/error both close the call
	return { kind, callId: m[2] };
}

function deriveOpenChildToolCallIdsV1(transitions: ReadonlyArray<{ observedAtMs: number; label: string }>): Set<string> {
	const open = new Set<string>();
	for (const transition of transitions) {
		const parsed = parseChildToolStateProgressV1(transition.label);
		if (parsed === undefined) continue;
		if (parsed.kind === "open") open.add(parsed.callId);
		else open.delete(parsed.callId);
	}
	return open;
}

type FlowDeskChildToolSnapshotTerminalV1 = {
	callId: string;
	settledKind: "settled" | "error";
	status: "completed" | "error" | "cancelled" | "aborted";
	toolExecutionAborted: boolean;
};

function hasExactToolExecutionAbortedLabelV1(value: unknown, depth = 0): boolean {
	if (typeof value === "string") return value.trim() === "Tool execution aborted";
	if (depth >= 4) return false;
	if (Array.isArray(value)) return value.some((entry) => hasExactToolExecutionAbortedLabelV1(entry, depth + 1));
	if (!isRecord(value)) return false;
	for (const entry of Object.values(value)) {
		if (hasExactToolExecutionAbortedLabelV1(entry, depth + 1)) return true;
	}
	return false;
}

function normalizeChildToolTerminalStatusV1(value: unknown): FlowDeskChildToolSnapshotTerminalV1["status"] | undefined {
	if (typeof value !== "string") return undefined;
	const normalized = value.trim().toLowerCase();
	if (normalized === "completed" || normalized === "error" || normalized === "cancelled" || normalized === "aborted") return normalized;
	return undefined;
}

function extractChildSessionTerminalToolSnapshotsV1(input: {
	raw: unknown;
	openCallIds: ReadonlySet<string>;
}): FlowDeskChildToolSnapshotTerminalV1[] {
	const byCallId = new Map<string, FlowDeskChildToolSnapshotTerminalV1>();
	for (const item of flowDeskAgentTaskMessageItems(input.raw)) {
		const msg = isRecord(item) ? item : undefined;
		const info = isRecord(msg?.info) ? msg.info : msg;
		let parts: unknown[] = Array.isArray(msg?.parts)
			? msg.parts
			: Array.isArray(info?.parts)
				? info.parts as unknown[]
				: [];
		if (parts.length === 0 && msg !== undefined && Array.isArray(msg.content)) parts = msg.content;
		for (const rawPart of parts) {
			const part = isRecord(rawPart) ? rawPart : undefined;
			if (part === undefined) continue;
			const type = typeof part.type === "string" ? part.type : "";
			if (type !== "tool" && part.tool === undefined && part.callID === undefined && part.call_id === undefined) continue;
			const state = isRecord(part.state) ? part.state : undefined;
			const status = normalizeChildToolTerminalStatusV1(state?.status ?? part.status);
			if (status === undefined) continue;
			const callId = safeDiagnosticString(part.callID ?? part.call_id ?? part.id ?? state?.id);
			if (callId === undefined || !input.openCallIds.has(callId)) continue;
			byCallId.set(callId, {
				callId,
				status,
				settledKind: status === "completed" ? "settled" : "error",
				toolExecutionAborted: hasExactToolExecutionAbortedLabelV1(part.error)
					|| hasExactToolExecutionAbortedLabelV1(part.state)
					|| hasExactToolExecutionAbortedLabelV1(part),
			});
		}
	}
	return [...byCallId.values()].sort((a, b) => a.callId.localeCompare(b.callId));
}

// V11.2 Slice 2: parse an event-hook TURN_COMPLETED progress label
// (`agent task turn completed msgid=<id> created=<ms> completed=<ms>`) emitted
// when an assistant message.updated carries info.time.completed.
function parseChildTurnCompletedProgressV1(value: unknown): { messageId: string; createdMs: number; completedMs: number } | undefined {
	if (typeof value !== "string") return undefined;
	const m = /^agent task turn completed msgid=(.+?) created=(\d+) completed=(\d+)$/.exec(value.trim());
	if (m === null) return undefined;
	return { messageId: m[1], createdMs: Number(m[2]), completedMs: Number(m[3]) };
}

/**
 * V11.2 Slice 2 (G3) — resolve the finalizable completed turn for this lane attempt.
 *
 * The watchdog cannot know the assistant message id before the model creates it,
 * so it only considers assistant turns whose message was created at/after the lane
 * epoch (created_at). For tool-heavy/multi-turn tasks, a completed assistant turn
 * can be an intermediate tool-call turn, not the task's final answer. Therefore the
 * caller may provide minObservedAtMs (usually the latest meaningful tool/message
 * activity) and we select the latest qualifying turn observed at/after that floor.
 * This mirrors OMO's completion discipline: a turn-completed event is a candidate
 * signal, while later meaningful work keeps the task open.
 *
 * Returns the finalizable turn-completed signal, or undefined when no qualifying
 * completed turn for this attempt has been observed yet (caller must HOLD capture,
 * never fall back to an older/intermediate completed turn).
 */
export function resolveFlowDeskExpectedTurnCompletedV1(input: {
	transitions: ReadonlyArray<{ observedAtMs: number; label: string }>;
	laneEpochMs: number;
	minObservedAtMs?: number;
}): { messageId: string; completedMs: number; observedAtMs: number } | undefined {
	let best: { messageId: string; completedMs: number; observedAtMs: number; createdMs: number } | undefined;
	const minObservedAtMs = typeof input.minObservedAtMs === "number" && Number.isFinite(input.minObservedAtMs)
		? input.minObservedAtMs
		: input.laneEpochMs;
	for (const t of input.transitions) {
		const parsed = parseChildTurnCompletedProgressV1(t.label);
		if (parsed === undefined) continue;
		// Only consider turns created at/after the lane epoch (this attempt's turn).
		if (Number.isFinite(parsed.createdMs) && parsed.createdMs > 0 && parsed.createdMs < input.laneEpochMs) continue;
		// Ignore completed turns that were observed before newer meaningful activity
		// (for example the assistant tool-call turn before the tool result arrived).
		if (Number.isFinite(t.observedAtMs) && t.observedAtMs < minObservedAtMs) continue;
		// Among finalizable candidates, prefer the latest observed/completed turn. A
		// later assistant turn after tools settle is more likely to be the task answer
		// than an earlier intermediate turn.
		if (best === undefined || t.observedAtMs > best.observedAtMs || (t.observedAtMs === best.observedAtMs && parsed.createdMs > best.createdMs)) {
			best = { messageId: parsed.messageId, completedMs: parsed.completedMs, observedAtMs: t.observedAtMs, createdMs: parsed.createdMs };
		}
	}
	if (best === undefined) return undefined;
	return { messageId: best.messageId, completedMs: best.completedMs, observedAtMs: best.observedAtMs };
}

/**
 * V11.2 Slice 1 — derive the event-based tool execution state for a lane.
 *
 * Replaces the polling `hasRunningTool` snapshot. We replay the lane's ordered
 * tool-state progress transitions into a per-callID open set: a `running`/`pending`
 * transition opens a callID, a `completed`/`error` transition closes it. The set
 * being non-empty means a tool is genuinely still running (`toolRunningNow`).
 *
 * Exception handling: if the set has been continuously non-empty for longer than
 * `staleToolMs` (a settle event was likely dropped), we do NOT treat the lane as
 * idle and we do not terminalize it. Instead we report `toolStateUnknown` with
 * the time the oldest still-open call started so the caller can write advisory
 * diagnostic attention while blocking abort/continuation.
 */
export function deriveFlowDeskLaneToolStateV1(input: {
	// ordered { observedAtMs, label } tool-state transitions for the lane, oldest first
	transitions: ReadonlyArray<{ observedAtMs: number; label: string }>;
	nowMs: number;
	staleToolMs: number;
}): { toolRunningNow: boolean; toolStateUnknown: boolean; oldestOpenAtMs: number | undefined } {
	// callId -> last open timestamp (deleted on settle)
	const openAt = new Map<string, number>();
	for (const t of input.transitions) {
		const parsed = parseChildToolStateProgressV1(t.label);
		if (parsed === undefined) continue;
		if (parsed.kind === "open") {
			// Only record the first open time for a callId so age reflects how long
			// it has genuinely been running; re-open of the same id keeps the original.
			if (!openAt.has(parsed.callId)) openAt.set(parsed.callId, t.observedAtMs);
		} else {
			openAt.delete(parsed.callId);
		}
	}
	if (openAt.size === 0) {
		return { toolRunningNow: false, toolStateUnknown: false, oldestOpenAtMs: undefined };
	}
	let oldestOpenAtMs = Number.POSITIVE_INFINITY;
	for (const at of openAt.values()) oldestOpenAtMs = Math.min(oldestOpenAtMs, at);
	const ageMs = input.nowMs - oldestOpenAtMs;
	if (ageMs >= input.staleToolMs) {
		// Likely-dropped settle event: demote to UNKNOWN (not idle, not running).
		return { toolRunningNow: false, toolStateUnknown: true, oldestOpenAtMs };
	}
	return { toolRunningNow: true, toolStateUnknown: false, oldestOpenAtMs };
}

function writeAgentTaskProgressEvidence(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	phase: FlowDeskAgentTaskProgressV1["phase"];
	progressSeq: number;
	progressLabel: string;
	observedAt: string;
}): void {
	const record: FlowDeskAgentTaskProgressV1 = {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		progress_seq: input.progressSeq,
		observed_at: input.observedAt,
		phase: input.phase,
		progress_label: childProgressLabel(input.progressLabel),
		progress_ref: `progress-${input.laneId}-${input.progressSeq}`,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	};
	writeChildSessionEvidence(input.rootDir, input.workflowId, `agent-task-progress-${input.laneId}-${input.progressSeq}`, record as unknown as Record<string, unknown>);
}

type FlowDeskCaptureFailureDiagnosticV1 = {
	observedAt: string;
	childSessionId: string;
	lastPartKind?: string;
	finalTextPresent: boolean;
	stepFinishPresent: boolean;
	runningToolCallId?: string;
	runningToolStatus?: string;
	recommendedNextAction: "/flowdesk-status" | "/flowdesk-export-debug";
};

function safeDiagnosticString(value: unknown, fallback: string | undefined = undefined): string | undefined {
	if (typeof value !== "string") return fallback;
	const token = value.replaceAll(/[^A-Za-z0-9_.:-]/g, "-").slice(0, 80);
	return token.length > 0 ? token : fallback;
}

function extractCaptureFailureDiagnosticFromMessages(input: {
	childSessionId: string;
	observedAt: string;
	raw: unknown;
}): FlowDeskCaptureFailureDiagnosticV1 {
	const observed = observeFlowDeskAgentTaskOutputV1(input.raw);
	let lastPartKind: string | undefined;
	let stepFinishPresent = observed.terminalObserved;
	let runningToolCallId: string | undefined;
	let runningToolStatus: string | undefined;
	for (const item of flowDeskAgentTaskMessageItems(input.raw)) {
		const msg = isRecord(item) ? item : undefined;
		const info = isRecord(msg?.info) ? msg.info : msg;
		let parts: unknown[] = Array.isArray(msg?.parts)
			? msg.parts
			: Array.isArray(info?.parts)
				? info.parts as unknown[]
				: [];
		if (parts.length === 0 && msg !== undefined && Array.isArray(msg.content)) parts = msg.content;
		for (const rawPart of parts) {
			const part = isRecord(rawPart) ? rawPart : undefined;
			if (part === undefined) continue;
			lastPartKind = safeDiagnosticString(part.type, "unknown");
			const type = typeof part.type === "string" ? part.type : "";
			if (type === "step-finish" || type === "step_finish" || type === "finish") stepFinishPresent = true;
			const state = isRecord(part.state) ? part.state : undefined;
			const status = safeDiagnosticString(state?.status ?? part.status);
			if (type === "tool" || part.tool !== undefined || part.callID !== undefined || part.call_id !== undefined) {
				if (status === "running") {
					runningToolStatus = status;
					runningToolCallId = safeDiagnosticString(part.callID ?? part.call_id ?? part.id ?? state?.id, "unknown");
				}
			}
		}
	}
	return {
		observedAt: input.observedAt,
		childSessionId: input.childSessionId,
		...(lastPartKind === undefined ? {} : { lastPartKind }),
		finalTextPresent: typeof observed.latestText === "string" && observed.latestText.trim().length > 0,
		stepFinishPresent,
		...(runningToolCallId === undefined ? {} : { runningToolCallId }),
		...(runningToolStatus === undefined ? {} : { runningToolStatus }),
		recommendedNextAction: observed.hasRunningTool ? "/flowdesk-status" : "/flowdesk-export-debug",
	};
}

async function pollCaptureFailureDiagnostic(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	childSessionId: string;
	observedAt: string;
	messagesTimeoutMs?: number;
}): Promise<FlowDeskCaptureFailureDiagnosticV1> {
	try {
		const raw = await readAsyncMonitorChildSessionMessages(input.client, input.childSessionId, input.messagesTimeoutMs ?? 3_000);
		if (raw !== null) return extractCaptureFailureDiagnosticFromMessages({ childSessionId: input.childSessionId, observedAt: input.observedAt, raw });
	} catch { /* diagnostic is best-effort */ }
	return {
		observedAt: input.observedAt,
		childSessionId: input.childSessionId,
		finalTextPresent: false,
		stepFinishPresent: false,
		recommendedNextAction: "/flowdesk-export-debug",
	};
}

function withCaptureFailureDiagnosticFields(record: Record<string, unknown>, diagnostic: FlowDeskCaptureFailureDiagnosticV1, reason: string): Record<string, unknown> {
	return {
		...record,
		capture_failure_diagnostic_observed_at: diagnostic.observedAt,
		capture_failure_diagnostic_reason: childProgressLabel(reason),
		capture_failure_child_session_id: diagnostic.childSessionId,
		...(diagnostic.lastPartKind === undefined ? {} : { capture_failure_last_part_kind: diagnostic.lastPartKind }),
		capture_failure_final_text_present: diagnostic.finalTextPresent,
		capture_failure_step_finish_present: diagnostic.stepFinishPresent,
		...(diagnostic.runningToolCallId === undefined ? {} : { capture_failure_running_tool_call_id: diagnostic.runningToolCallId }),
		...(diagnostic.runningToolStatus === undefined ? {} : { capture_failure_running_tool_status: diagnostic.runningToolStatus }),
		capture_failure_recommended_next_action: diagnostic.recommendedNextAction,
		capture_failure_redaction_version: "v1",
	};
}

function writeCoordinatorAttentionReviewRequestedEvidence(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	progressSeq: number;
	observedAt: string;
	reason: string;
}): void {
	writeAgentTaskProgressEvidence({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
		laneId: input.laneId,
		taskId: input.taskId,
		agentRef: input.agentRef,
		providerQualifiedModelId: input.providerQualifiedModelId,
		phase: "waiting",
		progressSeq: input.progressSeq,
		progressLabel: `coordinator_attention_observed; ${input.reason}; diagnostic only; re-check FlowDesk status/messages/process before deciding`,
		observedAt: input.observedAt,
	});
}

function writeToolTimeoutReviewRequestedEvidence(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	lastProgressSeq: number;
	lastProgressObservedAt: string;
	observedAt: string;
	staleToolMs: number;
}): void {
	const graceWindowMs = Math.min(600_000, Math.max(30_000, Math.floor(input.staleToolMs)));
	const advisoryLabel = childProgressLabel(
		`tool_run_overdue_observed; diagnostic only; underlying child abort not confirmed; re-check status/messages/process before deciding`,
	);
	const inconsistency: FlowDeskAgentTaskInconsistencyV1 = {
		schema_version: "flowdesk.agent_task_inconsistency.v1",
		workflow_id: input.workflowId,
		attempt_id: `attempt-${input.laneId}`,
		lane_id: input.laneId,
		task_id: input.taskId,
		last_progress_seq: input.lastProgressSeq,
		last_progress_observed_at: input.lastProgressObservedAt,
		inconsistency_kind: "tool_run_overdue_observed",
		grace_window_ms: graceWindowMs,
		grace_source_label: advisoryLabel,
		observed_at: input.observedAt,
		safe_next_actions: ["/flowdesk-status", "/flowdesk-doctor", "/flowdesk-export-debug"],
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	};
	writeChildSessionEvidence(
		input.rootDir,
		input.workflowId,
		`agent-task-inconsistency-${input.laneId}-tool-run-overdue-observed`,
		inconsistency as unknown as Record<string, unknown>,
	);
	writeChildSessionEvidence(input.rootDir, input.workflowId, `agent-task-progress-${input.laneId}-tool-run-overdue-observed`, {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		progress_seq: input.lastProgressSeq + 1,
		observed_at: input.observedAt,
		phase: "waiting",
		progress_label: advisoryLabel,
		progress_ref: `progress-${input.laneId}-tool-run-overdue-observed`,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	});
}

function writeToolExecutionAbortedReviewRequestedEvidence(input: {
	rootDir: string;
	workflowId: string;
	laneId: string;
	taskId: string;
	agentRef: string;
	providerQualifiedModelId: string;
	lastProgressSeq: number;
	observedAt: string;
}): void {
	const advisoryLabel = childProgressLabel(
		"tool_execution_aborted_observed; diagnostic only; child tool reported error/aborted/cancelled; main coordinator must inspect durable status before deciding",
	);
	writeChildSessionEvidence(input.rootDir, input.workflowId, `agent-task-progress-${input.laneId}-tool-execution-aborted-observed`, {
		schema_version: "flowdesk.agent_task_progress.v1",
		workflow_id: input.workflowId,
		lane_id: input.laneId,
		task_id: input.taskId,
		agent_ref: input.agentRef,
		provider_qualified_model_id: input.providerQualifiedModelId,
		progress_seq: input.lastProgressSeq + 1,
		observed_at: input.observedAt,
		phase: "waiting",
		progress_label: advisoryLabel,
		progress_ref: `progress-${input.laneId}-tool-execution-aborted-observed`,
		redaction_version: "v1",
		dispatch_authority_enabled: false,
	});
}

export interface FlowDeskChildSessionMonitorResultV1 {
	lanesPolled: number;
	lanesCompleted: number;
	lanesNudged: number;
	lanesAborted: number;
	/** Lanes still awaiting body capture (turn completed but body not yet readable). */
	lanesAwaitingCapture?: number;
}

/**
 * Monitor all async-mode agent task lanes in the given workflow.
 * Called from the watchdog cycle once per interval:
 *   - Poll session.messages for each running child session
 *   - On result: write task_result evidence + terminal lifecycle
 *   - At 10s silence: nudge with noReply: true
 *   - At 20s: second nudge
 *   - At 30s+: session.abort + task_failed + terminal lifecycle
 */
export async function monitorChildSessionsV1(input: {
	rootDir: string;
	workflowId: string;
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	now?: Date;
	nudgeQuietPeriodMs?: number;  // default 10_000
	maxNudges?: number;            // default 2
	abortThresholdMs?: number;     // default 30_000
	/**
	 * Idle-settle window for idle-confirmed capture. When a lane has produced
	 * assistant text but no explicit terminal marker, and it has been silent at
	 * least this long with no running tool, the watchdog captures that text as an
	 * idle-confirmed final result instead of waiting for a terminal marker that
	 * may never arrive. Defaults to the effective nudge quiet period.
	 */
	idleSettleMs?: number;
	/**
	 * Max idle-confirmed continuation prompt injections per lane. When a lane is
	 * idle past the settle window WITHOUT any captured text, the watchdog injects
	 * a real continuation prompt into the same child session to recover a final
	 * answer, up to this cap. Defaults to 1. Set to 0 to disable injection and
	 * fall back to evidence-only recording.
	 */
	maxIdleContinuations?: number;
	/**
	 * Capability/config gate for raw SDK prompt/noReply watchdog nudges.
	 * Default is false because FlowDesk has no proven hard noReply/prompt-nudge
	 * authority by default; evidence-only nudge attempts are still recorded.
	 */
	allowRawPromptNoReplyNudge?: boolean;
	/**
	 * V11.2 G/Slice 1 — injectable timeout clocks for the event-based tool-state
	 * terminator. All default to conservative values and are overridable for
	 * deterministic tests.
	 *
	 * - staleToolMs: how long a callID may stay open (no settle event) before the
	 *   open-tool set is treated as `toolStateUnknown` and advisory diagnostic
	 *   attention is written. This is a one-stage diagnostic threshold; it never
	 *   terminalizes, aborts, retries, or falls back.
	 * - absoluteLaneAgeMs: hard upper bound on total lane age, independent of the
	 *   meaningful-activity gate, guaranteeing a true zero-event lane still
	 *   terminates (G2).
	 */
	staleToolMs?: number;          // default 150_000
	unknownStateMaxMs?: number;    // default 60_000
	absoluteLaneAgeMs?: number;    // default 600_000
	/**
	 * V11.2 G5/Slice 3 — bounded awaiting_body_capture. When an authoritative
	 * turn-completed event fired but the body poll returned empty (SDK buffer not
	 * yet synced), the lane is NOT immediately failed as no_response: it is marked
	 * awaiting_body_capture and retried on later cycles up to bodyRetryMax. After
	 * the retries are exhausted the lane is terminalized (turn_completed_empty when
	 * a turn completed, else no_response). finalizingAbsoluteMaxMs is a hard cap
	 * for this bounded finalizing wait. bodyRetryIntervalMs is advisory for tests.
	 */
	bodyRetryMax?: number;         // default 3
	bodyRetryIntervalMs?: number;  // default 2_000 (advisory)
	finalizingAbsoluteMaxMs?: number; // default 180_000
	/**
	 * Evidence-only coordinator attention timer. The timer is persisted on every
	 * async child-session record, resets on meaningful state/progress changes, and
	 * writes coordinator-attention diagnostic progress when overdue. It never aborts,
	 * retries, falls back, or claims chat/runtime control.
	 */
	coordinatorAttentionMs?: number; // default abortThresholdMs
	_forceTaskResultWriteFailureForTest?: boolean;
}): Promise<FlowDeskChildSessionMonitorResultV1> {
	const nowMs = (input.now ?? new Date()).getTime();
	const nudgeQuietPeriodMs = typeof input.nudgeQuietPeriodMs === "number" && input.nudgeQuietPeriodMs > 0
		? Math.floor(input.nudgeQuietPeriodMs)
		: 10_000;
	const abortThresholdMs = input.abortThresholdMs ?? 30_000;
	const idleSettleMs = typeof input.idleSettleMs === "number" && input.idleSettleMs > 0
		? Math.floor(input.idleSettleMs)
		: nudgeQuietPeriodMs;
	// V11.2 Slice 4: continuation auto-injection is OFF by default. Injecting a
	// continuation prompt into a child session that was actually still working was
	// the exact mechanism that caused the slice1c MessageAbortedError. It is now
	// opt-in only (caller must pass maxIdleContinuations > 0) and, even when opted
	// in, is gated on corroborated fresh idle + no running/unknown tool.
	const maxIdleContinuations = typeof input.maxIdleContinuations === "number" && input.maxIdleContinuations >= 0
		? Math.floor(input.maxIdleContinuations)
		: 0;
	// V11.2 Slice 1 injectable timeout clocks.
	const staleToolMs = typeof input.staleToolMs === "number" && input.staleToolMs > 0
		? Math.floor(input.staleToolMs)
		: 150_000;
	const unknownStateMaxMs = typeof input.unknownStateMaxMs === "number" && input.unknownStateMaxMs > 0
		? Math.floor(input.unknownStateMaxMs)
		: 60_000;
	void unknownStateMaxMs;
	const absoluteLaneAgeMs = typeof input.absoluteLaneAgeMs === "number" && input.absoluteLaneAgeMs > 0
		? Math.floor(input.absoluteLaneAgeMs)
		: 600_000;
	const bodyRetryMax = typeof input.bodyRetryMax === "number" && input.bodyRetryMax >= 0
		? Math.floor(input.bodyRetryMax)
		: 3;
	const finalizingAbsoluteMaxMs = typeof input.finalizingAbsoluteMaxMs === "number" && input.finalizingAbsoluteMaxMs > 0
		? Math.floor(input.finalizingAbsoluteMaxMs)
		: 180_000;
	const coordinatorAttentionMs = typeof input.coordinatorAttentionMs === "number" && input.coordinatorAttentionMs > 0
		? Math.floor(input.coordinatorAttentionMs)
		: Math.max(300_000, Math.floor(abortThresholdMs));
	const result = { lanesPolled: 0, lanesCompleted: 0, lanesNudged: 0, lanesAborted: 0 } as FlowDeskChildSessionMonitorResultV1;

	const reloaded = reloadFlowDeskSessionEvidenceV1({ rootDir: input.rootDir, workflowId: input.workflowId });
	if (!reloaded.ok) return result;

	// Find all child session records for running lanes
	const childRecords = reloaded.entries
		.filter(e => e.evidenceClass === "agent_task_child_session")
		.map(e => e.record as Record<string, unknown>)
		.filter(r => r.schema_version === AGENT_TASK_CHILD_SESSION_SCHEMA_VERSION);

	// Find lanes that are NOT yet terminal. Terminal evidence can come from
	// task_result, task_failed (including event-session-error records), or a
	// lifecycle terminal state. The map keeps the extracted end-state timestamp so
	// cache refreshes are monotonic/idempotent even when no task_result exists.
	const terminalEndStates = collectTerminalLaneEndStatesV1(reloaded.entries);
	const terminalLaneIds = new Set<string>(terminalEndStates.keys());
	const awaitingPermissionLaneIds = new Set<string>();
	const latestProgressByLane = new Map<string, { observedAtMs: number; phase: string; progressSeq: number }>();
	const latestSessionIdleSignalByLane = new Map<string, number>();
	const latestHandledSessionIdleSignalByLane = new Map<string, number>();
	// Meaningful progress = real model/runtime activity (streaming message/part
	// deltas, tool events, terminal step, permission responses). It deliberately
	// EXCLUDES watchdog-authored records (phase "nudged"/"failed"/"finalizing")
	// and ambient session-status noise so those self-authored events cannot keep
	// resetting the nudge budget or deferring abort. This is what fixes the
	// "lane looks alive forever" / stuck stall-detection problem.
	const latestMeaningfulProgressByLane = new Map<string, number>();
	const latestLifecycleStateChangeByLane = new Map<string, number>();
	const awaitingBodyCaptureProgressByLane = new Map<string, number[]>();
	const turnCompletedEmptyRepairProgressByLane = new Map<string, number[]>();
	// V11.2 Slice 1: ordered per-lane tool-state transitions (running/settled),
	// derived from event-hook progress labels, feeding the event-based open-tool
	// set. Sorted by observedAtMs before use.
	const toolTransitionsByLane = new Map<string, Array<{ observedAtMs: number; label: string }>>();
	// V11.2 Slice 2: ordered per-lane TURN_COMPLETED transitions (assistant
	// message.updated with time.completed), feeding expected-turn binding (G3).
	const turnCompletedByLane = new Map<string, Array<{ observedAtMs: number; label: string }>>();
	for (const entry of reloaded.entries) {
		const rec = entry.record as Record<string, unknown>;
		const laneIdVal = typeof rec.lane_id === "string" ? rec.lane_id : undefined;
		if (!laneIdVal) continue;
		if (entry.evidenceClass === "agent_task_child_session") {
			const idleSignalAtMs = typeof rec.last_session_idle_signal_at === "string" ? Date.parse(rec.last_session_idle_signal_at) : NaN;
			if (Number.isFinite(idleSignalAtMs)) {
				const currentIdleSignal = latestSessionIdleSignalByLane.get(laneIdVal);
				if (currentIdleSignal === undefined || currentIdleSignal <= idleSignalAtMs) {
					latestSessionIdleSignalByLane.set(laneIdVal, idleSignalAtMs);
				}
			}
			const handledIdleSignalAtMs = typeof rec.last_idle_continuation_signal_at === "string" ? Date.parse(rec.last_idle_continuation_signal_at) : NaN;
			if (Number.isFinite(handledIdleSignalAtMs)) {
				const currentHandledSignal = latestHandledSessionIdleSignalByLane.get(laneIdVal);
				if (currentHandledSignal === undefined || currentHandledSignal <= handledIdleSignalAtMs) {
					latestHandledSessionIdleSignalByLane.set(laneIdVal, handledIdleSignalAtMs);
				}
			}
		}
		if (entry.evidenceClass === "lane_lifecycle") {
			const updatedAt = typeof rec.updated_at === "string" ? Date.parse(rec.updated_at)
				: typeof rec.created_at === "string" ? Date.parse(rec.created_at)
				: NaN;
			if (Number.isFinite(updatedAt)) {
				const currentLifecycle = latestLifecycleStateChangeByLane.get(laneIdVal);
				if (currentLifecycle === undefined || currentLifecycle <= updatedAt) {
					latestLifecycleStateChangeByLane.set(laneIdVal, updatedAt);
				}
			}
		}
		if (entry.evidenceClass === "agent_task_progress") {
			const observedAtMs = typeof rec.observed_at === "string" ? Date.parse(rec.observed_at) : NaN;
			const phase = typeof rec.phase === "string" ? rec.phase : undefined;
			const progressLabel = typeof rec.progress_label === "string" ? rec.progress_label : undefined;
			const diagnosticProgressLabel = typeof progressLabel === "string" ? progressLabel.toLowerCase() : "";
			if (Number.isFinite(observedAtMs) && diagnosticProgressLabel.includes("awaiting body capture after turn completed event")) {
				const list = awaitingBodyCaptureProgressByLane.get(laneIdVal) ?? [];
				list.push(observedAtMs);
				awaitingBodyCaptureProgressByLane.set(laneIdVal, list);
			}
			if (Number.isFinite(observedAtMs) && diagnosticProgressLabel.includes("final-report repair") && diagnosticProgressLabel.includes("empty turn completed")) {
				const list = turnCompletedEmptyRepairProgressByLane.get(laneIdVal) ?? [];
				list.push(observedAtMs);
				turnCompletedEmptyRepairProgressByLane.set(laneIdVal, list);
			}
			const isToolTimeoutReviewProgress = diagnosticProgressLabel.includes("tool_run_overdue_observed") || diagnosticProgressLabel.includes("tool_execution_aborted_observed");
			const progressSeq = typeof rec.progress_seq === "number" && Number.isInteger(rec.progress_seq) && rec.progress_seq > 0
				? rec.progress_seq
				: 1;
			const current = latestProgressByLane.get(laneIdVal);
			if (!isToolTimeoutReviewProgress && phase !== undefined && Number.isFinite(observedAtMs) && (current === undefined || current.observedAtMs <= observedAtMs)) {
				latestProgressByLane.set(laneIdVal, { observedAtMs, phase, progressSeq });
			}
			if (Number.isFinite(observedAtMs) && phase === "finalizing" && isChildSessionIdleSignalProgress(progressLabel)) {
				const currentIdleSignal = latestSessionIdleSignalByLane.get(laneIdVal);
				if (currentIdleSignal === undefined || currentIdleSignal <= observedAtMs) {
					latestSessionIdleSignalByLane.set(laneIdVal, observedAtMs);
				}
			}
			if (phase !== undefined && Number.isFinite(observedAtMs) && flowDeskProgressIsMeaningfulActivityV1(phase, progressLabel)) {
				const currentMeaningful = latestMeaningfulProgressByLane.get(laneIdVal);
				if (currentMeaningful === undefined || currentMeaningful <= observedAtMs) {
					latestMeaningfulProgressByLane.set(laneIdVal, observedAtMs);
				}
			}
			// V11.2 Slice 1: collect per-callID tool-state transitions for the
			// event-based open-tool set (replaces polling hasRunningTool snapshot).
			if (Number.isFinite(observedAtMs) && parseChildToolStateProgressV1(progressLabel) !== undefined) {
				const list = toolTransitionsByLane.get(laneIdVal) ?? [];
				list.push({ observedAtMs, label: progressLabel as string });
				toolTransitionsByLane.set(laneIdVal, list);
			}
			// V11.2 Slice 2: collect TURN_COMPLETED transitions for expected-turn binding.
			if (Number.isFinite(observedAtMs) && parseChildTurnCompletedProgressV1(progressLabel) !== undefined) {
				const list = turnCompletedByLane.get(laneIdVal) ?? [];
				list.push({ observedAtMs, label: progressLabel as string });
				turnCompletedByLane.set(laneIdVal, list);
			}
		}
	}
	const terminalRefreshObservedAt = latestTerminalObservedAtIso(terminalEndStates.values(), nowMs);
	for (const [laneId, progress] of latestProgressByLane) {
		if (progress.phase === "awaiting_permission") awaitingPermissionLaneIds.add(laneId);
	}
	// Defensive fallback for older/event-written progress records: if any explicit
	// awaiting_permission marker is present and no later permission response has
	// been observed, suspend watchdog nudge/abort for the lane.
	for (const entry of reloaded.entries) {
		if (entry.evidenceClass !== "agent_task_progress") continue;
		const rec = entry.record as Record<string, unknown>;
		if (rec.phase === "awaiting_permission" && typeof rec.lane_id === "string") awaitingPermissionLaneIds.add(rec.lane_id);
		if (rec.phase === "waiting" && typeof rec.progress_label === "string" && rec.progress_label.includes("permission response") && typeof rec.lane_id === "string") awaitingPermissionLaneIds.delete(rec.lane_id);
	}

	let uiCacheRefreshed = false;
	for (const record of childRecords) {
		const laneId = typeof record.lane_id === "string" ? record.lane_id : "";
		const childSessionId = typeof record.child_session_id === "string" ? record.child_session_id : "";
		if (!laneId || !childSessionId) continue;
		if (terminalLaneIds.has(laneId)) {
			// Refresh the completion UI cache for terminal lanes so stale "running"
			// rows are promoted to terminal. This must run for any terminal lane,
			// including lanes that only have lane_lifecycle/task_failed evidence and
			// no task_result (e.g. reviewer execution bridge writing only
			// lane_lifecycle=invocation_failed). Without this, the sidebar row stays
			// stuck at progressing_normal/running until a task_result appears.
			if (!uiCacheRefreshed) {
				refreshFlowDeskCompletionUiCachesV1({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					observedAt: terminalRefreshObservedAt,
				});
				uiCacheRefreshed = true;
			}
			continue; // already done
		}
		if (awaitingPermissionLaneIds.has(laneId)) continue; // user permission is outstanding; do not nudge or abort

		result.lanesPolled++;
		const createdAtMs = typeof record.created_at === "string" ? Date.parse(record.created_at) : nowMs;
		const recordQuietPeriodMs = typeof record.nudge_quiet_period_ms === "number" && record.nudge_quiet_period_ms > 0
			? Math.floor(record.nudge_quiet_period_ms)
			: undefined;
		const laneNudgeQuietPeriodMs = typeof input.nudgeQuietPeriodMs === "number" && input.nudgeQuietPeriodMs > 0
			? nudgeQuietPeriodMs
			: (recordQuietPeriodMs ?? nudgeQuietPeriodMs);
		// Idle-settle window for this lane: an explicit idleSettleMs wins,
		// otherwise mirror the lane's effective quiet period so a persisted
		// custom quiet period also defers idle-confirmed capture/continuation.
		const laneIdleSettleMs = typeof input.idleSettleMs === "number" && input.idleSettleMs > 0
			? idleSettleMs
			: laneNudgeQuietPeriodMs;
		const recordedNudgeCount = typeof record.nudge_count === "number" ? record.nudge_count : 0;
		const lastNudgeAtMs = typeof record.last_nudge_at === "string" ? Date.parse(record.last_nudge_at) : createdAtMs;
		const childSessionEvidenceId = reloaded.entries
			.find(e => e.evidenceClass === "agent_task_child_session" && (e.record as Record<string, unknown>).lane_id === laneId)
			?.evidenceId ?? `agent-task-child-session-${laneId}-watchdog`;
		let recordForWrites = record;
		let toolTransitions = (toolTransitionsByLane.get(laneId) ?? []).slice().sort((a, b) => a.observedAtMs - b.observedAtMs);
		const openToolCallIdsBeforeSnapshot = deriveOpenChildToolCallIdsV1(toolTransitions);
		if (openToolCallIdsBeforeSnapshot.size > 0) {
			try {
				const rawSnapshot = await readAsyncMonitorChildSessionMessages(input.client, childSessionId, 3_000);
				if (rawSnapshot !== null) {
					const snapshotObservation = observeFlowDeskAgentTaskOutputV1(rawSnapshot);
					const snapshotHasAssistantFinalText = typeof snapshotObservation.latestText === "string" && snapshotObservation.latestText.trim().length > 0;
					const terminalToolSnapshots = extractChildSessionTerminalToolSnapshotsV1({
						raw: rawSnapshot,
						openCallIds: openToolCallIdsBeforeSnapshot,
					});
					if (terminalToolSnapshots.length > 0) {
						const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
						const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
						const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
						const observedAt = new Date(nowMs).toISOString();
						const latestProgress = latestProgressByLane.get(laneId);
						let progressSeq = latestProgress?.progressSeq ?? 1;
						for (const snapshot of terminalToolSnapshots) {
							progressSeq++;
							const label = `agent task tool ${snapshot.settledKind} callid=${snapshot.callId}`;
							writeAgentTaskProgressEvidence({
								rootDir: input.rootDir,
								workflowId: input.workflowId,
								laneId,
								taskId,
								agentRef,
								providerQualifiedModelId: modelId,
								phase: "waiting",
								progressSeq,
								progressLabel: label,
								observedAt,
							});
							toolTransitions.push({ observedAtMs: nowMs, label });
						}
						latestProgressByLane.set(laneId, { observedAtMs: nowMs, phase: "waiting", progressSeq });
						latestMeaningfulProgressByLane.set(laneId, nowMs);
					}
					const toolExecutionAbortedObserved = terminalToolSnapshots.some((snapshot) => snapshot.toolExecutionAborted)
						|| hasExactToolExecutionAbortedLabelV1(monitorRecord(monitorResponseData(rawSnapshot))?.error);
					if (toolExecutionAbortedObserved && !snapshotHasAssistantFinalText && !laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
						const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
						const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
						const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
						const observedAt = new Date(nowMs).toISOString();
						const diagnosticProgressAt = new Date(nowMs + 1).toISOString();
						const diagnostic = await pollCaptureFailureDiagnostic({ client: input.client, childSessionId, observedAt });
						recordForWrites = withCaptureFailureDiagnosticFields({
							...recordForWrites,
							coordinator_attention_status: "review_requested",
							coordinator_attention_last_review_requested_at: observedAt,
							coordinator_attention_last_review_reason: "tool_execution_aborted_observed",
						}, diagnostic, "tool_execution_aborted_observed");
						writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
						writeToolExecutionAbortedReviewRequestedEvidence({
							rootDir: input.rootDir,
							workflowId: input.workflowId,
							laneId,
							taskId,
							agentRef,
							providerQualifiedModelId: modelId,
							lastProgressSeq: latestProgressByLane.get(laneId)?.progressSeq ?? 1,
							observedAt: diagnosticProgressAt,
						});
						refreshFlowDeskCompletionUiCachesV1({
							rootDir: input.rootDir,
							workflowId: input.workflowId,
							observedAt: diagnosticProgressAt,
						});
						continue;
					}
				}
			} catch { /* best-effort snapshot reconciliation; later diagnostics still apply */ }
		}
		// Use MEANINGFUL progress (real model/runtime activity) for activity and
		// nudge-budget decisions. Watchdog-authored progress (nudge/continuation/
		// finalizing) and ambient session-status churn are intentionally ignored
		// here so they cannot keep a silent lane looking "alive" forever.
		const latestProgressAtMs = latestMeaningfulProgressByLane.get(laneId);
		const latestSessionIdleSignalAtMs = latestSessionIdleSignalByLane.get(laneId);
		const latestHandledSessionIdleSignalAtMs = latestHandledSessionIdleSignalByLane.get(laneId);
		const lastActivityMs = Math.max(
			createdAtMs,
			Number.isFinite(lastNudgeAtMs) ? lastNudgeAtMs : createdAtMs,
			latestProgressAtMs !== undefined && Number.isFinite(latestProgressAtMs) ? latestProgressAtMs : createdAtMs,
		);
		const latestLifecycleStateChangeAtMs = latestLifecycleStateChangeByLane.get(laneId);
		const coordinatorAttentionResetAtMs = Math.max(
			createdAtMs,
			latestLifecycleStateChangeAtMs !== undefined && Number.isFinite(latestLifecycleStateChangeAtMs) ? latestLifecycleStateChangeAtMs : createdAtMs,
			latestProgressAtMs !== undefined && Number.isFinite(latestProgressAtMs) ? latestProgressAtMs : createdAtMs,
		);
		const coordinatorAttentionResetAt = new Date(coordinatorAttentionResetAtMs).toISOString();
		const coordinatorAttentionDueAtMs = coordinatorAttentionResetAtMs + coordinatorAttentionMs;
		const coordinatorAttentionDueAt = new Date(coordinatorAttentionDueAtMs).toISOString();
		const priorCoordinatorResetAtMs = typeof recordForWrites.coordinator_attention_timer_reset_at === "string"
			? Date.parse(recordForWrites.coordinator_attention_timer_reset_at)
			: NaN;
		const priorCoordinatorDueAt = typeof recordForWrites.coordinator_attention_due_at === "string"
			? recordForWrites.coordinator_attention_due_at
			: undefined;
		const coordinatorTimerChanged = !Number.isFinite(priorCoordinatorResetAtMs) || priorCoordinatorResetAtMs !== coordinatorAttentionResetAtMs || priorCoordinatorDueAt !== coordinatorAttentionDueAt;
		if (coordinatorTimerChanged) {
			recordForWrites = {
				...recordForWrites,
				coordinator_attention_timer_reset_at: coordinatorAttentionResetAt,
				coordinator_attention_timer_reset_reason: latestProgressAtMs !== undefined && latestProgressAtMs === coordinatorAttentionResetAtMs
					? "meaningful_progress"
					: latestLifecycleStateChangeAtMs !== undefined && latestLifecycleStateChangeAtMs === coordinatorAttentionResetAtMs
						? "lane_state_change"
						: "child_session_created",
				coordinator_attention_due_at: coordinatorAttentionDueAt,
				coordinator_attention_interval_ms: coordinatorAttentionMs,
				coordinator_attention_status: "armed",
			};
			writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
		}
		const priorCoordinatorReviewAtMs = typeof recordForWrites.coordinator_attention_last_review_requested_at === "string"
			? Date.parse(recordForWrites.coordinator_attention_last_review_requested_at)
			: NaN;
		let coordinatorReviewRequestedThisCycle = false;
		if (nowMs >= coordinatorAttentionDueAtMs && (!Number.isFinite(priorCoordinatorReviewAtMs) || priorCoordinatorReviewAtMs < coordinatorAttentionResetAtMs)) {
			const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
			const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
			const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
			const reviewAt = new Date(nowMs).toISOString();
			const diagnostic = await pollCaptureFailureDiagnostic({ client: input.client, childSessionId, observedAt: reviewAt });
			recordForWrites = withCaptureFailureDiagnosticFields({
				...recordForWrites,
				coordinator_attention_status: "review_requested",
				coordinator_attention_last_review_requested_at: reviewAt,
				coordinator_attention_last_review_reason: "attention_timer_overdue",
				coordinator_attention_review_request_count: (typeof recordForWrites.coordinator_attention_review_request_count === "number" ? recordForWrites.coordinator_attention_review_request_count : 0) + 1,
			}, diagnostic, "attention_timer_overdue");
			writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
			coordinatorReviewRequestedThisCycle = true;
			writeCoordinatorAttentionReviewRequestedEvidence({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				laneId,
				taskId,
				agentRef,
				providerQualifiedModelId: modelId,
				progressSeq: 30 + (typeof recordForWrites.coordinator_attention_review_request_count === "number" ? recordForWrites.coordinator_attention_review_request_count : 1),
				observedAt: reviewAt,
				reason: "attention timer overdue",
			});
		}
		const hasFreshSessionIdleSignal = latestSessionIdleSignalAtMs !== undefined &&
			Number.isFinite(latestSessionIdleSignalAtMs) &&
			latestSessionIdleSignalAtMs >= lastActivityMs &&
			(latestProgressAtMs === undefined || latestProgressAtMs <= latestSessionIdleSignalAtMs);
		const hasUnhandledFreshSessionIdleSignal = hasFreshSessionIdleSignal &&
			(latestHandledSessionIdleSignalAtMs === undefined || latestHandledSessionIdleSignalAtMs < latestSessionIdleSignalAtMs);
		if (hasFreshSessionIdleSignal) {
			const previousSignalMs = typeof record.last_session_idle_signal_at === "string" ? Date.parse(record.last_session_idle_signal_at) : NaN;
			if (!Number.isFinite(previousSignalMs) || previousSignalMs < latestSessionIdleSignalAtMs) {
				recordForWrites = {
					...recordForWrites,
					last_session_idle_signal_at: new Date(latestSessionIdleSignalAtMs).toISOString(),
					last_session_idle_signal_state: "observed",
				};
				writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
			}
		}
		// If the child session emitted MEANINGFUL progress after the last nudge,
		// treat that as real activity and reset the effective nudge budget for this
		// watchdog cycle. The persisted child-session nudge_count is only updated
		// when we actually send another nudge; deriving the effective value here
		// avoids aborting a lane that is actively streaming real message/part deltas.
		const nudgeCount =
			latestProgressAtMs !== undefined && latestProgressAtMs > lastNudgeAtMs
				? 0
				: recordedNudgeCount;
		const silenceMs = nowMs - lastActivityMs;
		const totalAgeMs = nowMs - createdAtMs;

		// V11.2 Slice 1: event-based tool execution state (replaces polling snapshot).
		// toolRunningNow gates every abort/continuation branch so a genuinely-working
		// lane (e.g. a long single tool call) is never terminated mid-work. A likely-
		// dropped settle event demotes the lane to toolStateUnknown (not idle), which
		// also blocks abort/continuation but allows body polling, and is force-
		// terminated only after unknownStateMaxMs (G1).
		const laneToolState = deriveFlowDeskLaneToolStateV1({ transitions: toolTransitions, nowMs, staleToolMs });
		const toolRunningNow = laneToolState.toolRunningNow;
		const toolStateUnknown = laneToolState.toolStateUnknown;
		// How long the lane has been stuck in UNKNOWN (oldest still-open call age).
		const unknownDwellMs = toolStateUnknown && laneToolState.oldestOpenAtMs !== undefined
			? nowMs - laneToolState.oldestOpenAtMs
			: 0;

		// V11.2 Slice 2: resolve the finalizable completed turn for this attempt (G3).
		// A message.updated time.completed event marks an assistant turn boundary, not
		// necessarily the task boundary. If newer meaningful activity (tool running /
		// settled, text delta, etc.) occurred after a completed turn, that turn was an
		// intermediate candidate and must not drive body-capture/empty terminalization.
		const turnCompletedTransitions = (turnCompletedByLane.get(laneId) ?? []).slice().sort((a, b) => a.observedAtMs - b.observedAtMs);
		const expectedTurnCompleted = resolveFlowDeskExpectedTurnCompletedV1({
			transitions: turnCompletedTransitions,
			laneEpochMs: createdAtMs,
			minObservedAtMs: Math.max(createdAtMs, latestProgressAtMs ?? createdAtMs),
		});

		// 0. V11.2 Slice 2 — event-primary TURN_COMPLETED capture. When an assistant
		// turn for THIS attempt has reported time.completed (the authoritative turn-end
		// signal), and no tool is genuinely running and the tool state is not unknown,
		// fetch the body and capture it as a turn_completed final result. The body poll
		// only fetches WHAT; the event decided WHEN. Empty body falls through to the
		// existing polling/idle/timeout paths (Slice 3 will add awaiting_body_capture).
		if (expectedTurnCompleted !== undefined && !toolRunningNow && !toolStateUnknown) {
			if (laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
				continue;
			}
			const idleObservation = await pollChildSessionIdleConfirmedOutput(input.client, childSessionId);
			if (idleObservation !== null && idleObservation.hasRunningTool === false && idleObservation.text !== undefined && idleObservation.text.trim().length > 0) {
				// V11.4 race fix: re-check terminal evidence AFTER the poll await.
				// The event-awakened poke (V11.3) and the setInterval cycle can both
				// pass the pre-poll check, then interleave across the `await` above and
				// each write a duplicate task_result. Re-checking right before the
				// write ensures the SECOND writer observes the first capture and skips,
				// so the result is written exactly once (not "written twice, one wins").
				if (laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
					continue;
				}
				const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
				const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
				const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
				const token = randomBytes(4).toString("hex");
				const completedAt = new Date(nowMs).toISOString();
				const sanitizedResult = sanitizeFlowDeskTaskResultTextV1(idleObservation.text);
				writeSessionFinalizationEvidenceIfMeaningful({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					reloadedEntries: reloaded.entries,
					laneId,
					taskId,
					childSessionId,
					observedAt: completedAt,
					decisionContext: "turn_completed_text",
					text: sanitizedResult.text,
					stepFinishObserved: idleObservation.terminalMarkerObserved || expectedTurnCompleted !== undefined,
					sessionIdleState: "confirmed_idle",
					runningToolsState: "none_running_confirmed",
					confidence: "high",
				});
				const captureSafetyMetadata = buildFlowDeskCaptureSafetyMetadataV1({
					text: sanitizedResult.text,
					completionStatus: "final",
					outputKind: idleObservation.outputKind,
					finalizationReason: "terminal_marker",
					finalBodyObserved: true,
					terminalMarkerObserved: idleObservation.terminalMarkerObserved || expectedTurnCompleted !== undefined,
				});
				const taskResultEvidenceId = `task-result-${taskId}-watchdog-turncompleted-${token}`;
				const taskResultWritten = writeChildSessionEvidence(input.rootDir, input.workflowId, taskResultEvidenceId, {
					schema_version: "flowdesk.task_result.v1",
					workflow_id: input.workflowId,
					lane_id: laneId,
					task_id: taskId,
					agent_ref: agentRef,
					provider_qualified_model_id: modelId,
					task_prompt_sha256: createHash("sha256").update("watchdog-collected").digest("hex"),
					result_text: sanitizedResult.text,
					result_text_truncated: sanitizedResult.truncated,
					result_text_sha256: createHash("sha256").update(idleObservation.text).digest("hex"),
					completion_status: "final",
					output_kind: idleObservation.outputKind,
					usable_for_synthesis: captureSafetyMetadata.safe_for_auto_synthesis,
					missing_contract: false,
					// turn-completed is an authoritative turn-end observation; reuse the
					// existing valid finalization_reason enum value (no schema change in
					// this slice). The progress label below records the turn_completed
					// event provenance for diagnostics.
					finalization_reason: "terminal_marker",
					looks_like_refusal_or_error: idleObservation.looksLikeRefusalOrError,
					...captureSafetyMetadata,
					created_at: completedAt,
					dispatch_authority_enabled: false,
				});
				if (taskResultWritten) {
					writeAgentTaskTerminalLifecycleForTaskResult({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId,
						attemptId: `attempt-${laneId}`,
						parentSessionRef: typeof record.parent_session_ref === "string" ? record.parent_session_ref : "ses-agent-task-parent",
						childSessionId,
						taskResultEvidenceId,
						agentRef,
						providerQualifiedModelId: modelId,
						observedAt: completedAt,
					});
					writeAgentTaskProgressEvidence({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId,
						taskId,
						agentRef,
						providerQualifiedModelId: modelId,
						phase: "finalizing",
						progressSeq: 10 + nudgeCount,
						progressLabel: "async agent task result captured on turn completed event",
						observedAt: completedAt,
					});
					refreshFlowDeskCompletionUiCachesV1({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						observedAt: completedAt,
					});
					result.lanesCompleted++;
					continue;
				}
			}
			// V11.2 Slice 3 (G5) — awaiting_body_capture. The turn completed but the
			// body poll is still empty (SDK buffer not yet synced). Do NOT immediately
			// fail as no_response and do NOT capture empty/intermediate text. Mark the
			// lane awaiting and retry on later cycles up to bodyRetryMax, then keep
			// awaiting quiescence until a separate failure/timeout/absolute cap fires.
			if (idleObservation === null || idleObservation.text === undefined || idleObservation.text.trim().length === 0) {
				const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
				const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
				const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
				const latestRepairProgressAtMs = Math.max(
					...((turnCompletedEmptyRepairProgressByLane.get(laneId) ?? []).filter((value) => Number.isFinite(value))),
					Number.NEGATIVE_INFINITY,
				);
				const durableAwaitingProgressAttempts = (awaitingBodyCaptureProgressByLane.get(laneId) ?? [])
					.filter((value) => Number.isFinite(value) && value > latestRepairProgressAtMs)
					.length;
				const recordedAwaitingAttempts = Number.isFinite(latestRepairProgressAtMs)
					? 0
					: typeof recordForWrites.awaiting_body_capture_attempts === "number" ? recordForWrites.awaiting_body_capture_attempts : 0;
				const priorAttempts = Math.max(recordedAwaitingAttempts, durableAwaitingProgressAttempts);
				const nextAttempts = priorAttempts + 1;
				const nowIso = new Date(nowMs).toISOString();
				const captureDiagnostic = await pollCaptureFailureDiagnostic({ client: input.client, childSessionId, observedAt: nowIso });
				writeSessionFinalizationEvidenceIfMeaningful({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					reloadedEntries: reloaded.entries,
					laneId,
					taskId,
					childSessionId,
					observedAt: nowIso,
					decisionContext: "turn_completed_empty",
					stepFinishObserved: true,
					sessionIdleState: "confirmed_idle",
					runningToolsState: "none_running_confirmed",
					confidence: "medium",
				});
				if (captureDiagnostic.finalTextPresent === true) {
					try {
						const rescueRaw = await readAsyncMonitorChildSessionMessages(input.client, childSessionId, 5_000);
						if (rescueRaw !== null) {
							const rescueObserved = observeFlowDeskAgentTaskOutputV1(rescueRaw);
							const latestText = rescueObserved.latestText;
							if (typeof latestText === "string" && latestText.trim().length > 0) {
								if (!laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
									const token = randomBytes(4).toString("hex");
									const captureMetadata = buildFlowDeskCaptureSafetyMetadataV1({
										outputKind: rescueObserved.outputKind,
										finalBodyObserved: true,
										terminalMarkerObserved: rescueObserved.terminalObserved,
									});
									writeChildSessionEvidence(input.rootDir, input.workflowId, `task-result-${taskId}-watchdog-awaiting-body-rescue-${token}`, {
										schema_version: "flowdesk.task_result.v1",
										workflow_id: input.workflowId,
										lane_id: laneId,
										task_id: taskId,
										agent_ref: agentRef,
										provider_qualified_model_id: modelId,
										child_session_id: childSessionId,
										completion_status: rescueObserved.terminalObserved ? "final" : "partial",
										result_text: latestText,
										output_kind: rescueObserved.outputKind,
										usable_for_synthesis: rescueObserved.usableForSynthesis,
										looks_like_refusal_or_error: rescueObserved.looksLikeRefusalOrError,
										capture_safety_metadata: captureMetadata,
										capture_failure_diagnostic: captureDiagnostic,
										observed_at: nowIso,
									});
									writeChildSessionEvidence(input.rootDir, input.workflowId, `runtime-lane-lifecycle-${laneId}-complete-awaiting-body-rescue-${token}`, {
										schema_version: "flowdesk.runtime_lane_lifecycle.v1",
										workflow_id: input.workflowId,
										lane_id: laneId,
										task_id: taskId,
										agent_ref: agentRef,
										provider_qualified_model_id: modelId,
										child_session_id: childSessionId,
										state: "complete",
										reason: "awaiting_body_capture_active_messages_rescue",
										observed_at: nowIso,
									});
								}
								continue;
							}
						}
					} catch { /* rescue is best-effort; keep existing retry/timeout path */ }
				}
				const awaitingSinceMs = typeof recordForWrites.awaiting_body_capture_since === "string"
					? Date.parse(recordForWrites.awaiting_body_capture_since)
					: nowMs;
				const finalizingWaitExpired = Number.isFinite(awaitingSinceMs) && nowMs - awaitingSinceMs >= finalizingAbsoluteMaxMs;
				if (finalizingWaitExpired) {
					if (!laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
						const token = randomBytes(4).toString("hex");
						const noOutputCaptureMetadata = buildFlowDeskCaptureSafetyMetadataV1({
							outputKind: "empty",
							finalBodyObserved: false,
							terminalMarkerObserved: true,
						});
						writeChildSessionEvidence(input.rootDir, input.workflowId, `task-failed-${taskId}-watchdog-finalizing-absolute-${token}`, {
							schema_version: "flowdesk.task_failed.v1",
							workflow_id: input.workflowId,
							lane_id: laneId,
							task_id: taskId,
							agent_ref: agentRef,
							provider_qualified_model_id: modelId,
							failure_category: "no_response",
							redacted_reason: `turn completed but no body captured before finalizing absolute max ${finalizingAbsoluteMaxMs}ms (turn_completed_empty)`,
							...noOutputCaptureMetadata,
							created_at: nowIso,
							dispatch_authority_enabled: false,
						});
						writeAgentTaskProgressEvidence({
							rootDir: input.rootDir,
							workflowId: input.workflowId,
							laneId,
							taskId,
							agentRef,
							providerQualifiedModelId: modelId,
							phase: "failed",
							progressSeq: 20 + nudgeCount,
							progressLabel: "async agent task turn completed empty; finalizing absolute max exceeded",
							observedAt: nowIso,
						});
						refreshFlowDeskCompletionUiCachesV1({
							rootDir: input.rootDir,
							workflowId: input.workflowId,
							observedAt: nowIso,
						});
						result.lanesAborted++;
						continue;
					}
				}
				if (nextAttempts <= bodyRetryMax) {
					// Persist the retry counter and wait for a later cycle (bounded).
					recordForWrites = withCaptureFailureDiagnosticFields({
						...recordForWrites,
						awaiting_body_capture_attempts: nextAttempts,
						...(typeof recordForWrites.awaiting_body_capture_since === "string"
							? {}
							: { awaiting_body_capture_since: nowIso }),
					}, captureDiagnostic, "awaiting_body_capture_empty");
					writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
					writeAgentTaskProgressEvidence({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId,
						taskId,
						agentRef,
						providerQualifiedModelId: modelId,
						phase: "finalizing",
						progressSeq: 8 + nextAttempts,
						progressLabel: `async agent task awaiting body capture after turn completed event (attempt ${nextAttempts}/${bodyRetryMax})`,
						observedAt: nowIso,
					});
					result.lanesAwaitingCapture = (result.lanesAwaitingCapture ?? 0) + 1;
					continue;
				}
				const durableRepairCount = (turnCompletedEmptyRepairProgressByLane.get(laneId) ?? []).filter((value) => Number.isFinite(value)).length;
				const recordedRepairCount = typeof recordForWrites.turn_completed_empty_repair_count === "number" ? recordForWrites.turn_completed_empty_repair_count : 0;
				const repairCount = Math.max(recordedRepairCount, durableRepairCount);
				if (repairCount < 1) {
					const repairAt = nowIso;
					const deliveryStatus = await sendIdleContinuationPrompt(input.client, childSessionId);
					if (deliveryStatus === "sent") {
						recordForWrites = withCaptureFailureDiagnosticFields({
							...recordForWrites,
							awaiting_body_capture_attempts: 0,
							turn_completed_empty_repair_count: repairCount + 1,
							turn_completed_empty_last_repair_at: repairAt,
							turn_completed_empty_last_repair_delivery_status: deliveryStatus,
							...(typeof recordForWrites.awaiting_body_capture_since === "string"
								? {}
								: { awaiting_body_capture_since: nowIso }),
						}, captureDiagnostic, "turn_completed_empty_repair_prompt");
						writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
						writeAgentTaskProgressEvidence({
							rootDir: input.rootDir,
							workflowId: input.workflowId,
							laneId,
							taskId,
							agentRef,
							providerQualifiedModelId: modelId,
							phase: "nudged",
							progressSeq: 8 + nextAttempts,
							progressLabel: "async agent task final-report repair prompt injected after empty turn completed event",
							observedAt: repairAt,
						});
						result.lanesNudged++;
						continue;
					}
				}
				// Retry budget after the explicit repair is exhausted is not, by itself,
				// a terminal failure signal. Keep the demoted awaiting path below until an
				// independent hard cap or failure path fires.
				recordForWrites = withCaptureFailureDiagnosticFields({
					...recordForWrites,
					awaiting_body_capture_attempts: nextAttempts,
					...(typeof recordForWrites.awaiting_body_capture_since === "string"
						? {}
						: { awaiting_body_capture_since: nowIso }),
					...(typeof recordForWrites.awaiting_session_quiescence_since === "string"
						? {}
						: { awaiting_session_quiescence_since: nowIso }),
				}, captureDiagnostic, "awaiting_session_quiescence_empty");
				writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
				writeAgentTaskProgressEvidence({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					laneId,
					taskId,
					agentRef,
					providerQualifiedModelId: modelId,
					phase: "finalizing",
					progressSeq: 8 + nextAttempts,
					progressLabel: `async agent task awaiting session quiescence after empty turn completed event (attempt ${nextAttempts}/${bodyRetryMax})`,
					observedAt: nowIso,
				});
				result.lanesAwaitingCapture = (result.lanesAwaitingCapture ?? 0) + 1;
				continue;
			}
		}

		// 1. Try to collect terminal result text. Candidate text without terminal is kept for abort-time partial capture.
		const resultObservation = await pollChildSessionOutput(input.client, childSessionId);
		if (resultObservation !== null && resultObservation.text.trim().length > 0) {
			const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
			const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
			const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
			if (laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
				continue;
			}
			const token = randomBytes(4).toString("hex");
			const completedAt = new Date(nowMs).toISOString();
			const sanitizedResult = sanitizeFlowDeskTaskResultTextV1(resultObservation.text);
			const finalText = sanitizedResult.text;
			const runningToolsState: FlowDeskSessionRunningToolsState = resultObservation.hasRunningTool || toolRunningNow
				? "running_confirmed"
				: toolStateUnknown
					? "unknown"
					: "none_running_confirmed";
			const finalizationGate = writeSessionFinalizationEvidenceIfMeaningful({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				reloadedEntries: reloaded.entries,
				laneId,
				taskId,
				childSessionId,
				observedAt: completedAt,
				decisionContext: "watchdog_terminal_text",
				text: finalText,
				stepFinishObserved: resultObservation.terminalMarkerObserved,
				sessionIdleState: "confirmed_idle",
				runningToolsState,
				confidence: "high",
			});
			if (finalizationGate.evaluated.safe_capture_ready !== true) {
				const reviewAt = new Date(nowMs).toISOString();
				const diagnostic = await pollCaptureFailureDiagnostic({ client: input.client, childSessionId, observedAt: reviewAt });
				recordForWrites = withCaptureFailureDiagnosticFields({
					...recordForWrites,
					coordinator_attention_status: "review_requested",
					coordinator_attention_last_review_requested_at: reviewAt,
					coordinator_attention_last_review_reason: `session_finalization_${finalizationGate.evaluated.block_reason}`,
				}, diagnostic, `session_finalization_${finalizationGate.evaluated.block_reason}`);
				writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
				writeCoordinatorAttentionReviewRequestedEvidence({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					laneId,
					taskId,
					agentRef,
					providerQualifiedModelId: modelId,
					progressSeq: 30 + nudgeCount,
					observedAt: reviewAt,
					reason: `session finalization blocked: ${finalizationGate.evaluated.block_reason}`,
				});
				refreshFlowDeskCompletionUiCachesV1({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					observedAt: reviewAt,
				});
				result.lanesAwaitingCapture = (result.lanesAwaitingCapture ?? 0) + 1;
				continue;
			}
			const captureSafetyMetadata = buildFlowDeskCaptureSafetyMetadataV1({
				text: finalText,
				completionStatus: resultObservation.completionStatus,
				outputKind: resultObservation.outputKind,
				finalizationReason: "terminal_marker",
				finalBodyObserved: resultObservation.finalBodyObserved,
				terminalMarkerObserved: resultObservation.terminalMarkerObserved,
			});

			const taskResultEvidenceId = `task-result-${taskId}-watchdog-${token}`;
			const taskResultWritten = input._forceTaskResultWriteFailureForTest === true
				? false
				: writeChildSessionEvidence(input.rootDir, input.workflowId, taskResultEvidenceId, {
				schema_version: "flowdesk.task_result.v1",
				workflow_id: input.workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: agentRef,
				provider_qualified_model_id: modelId,
				task_prompt_sha256: createHash("sha256").update("watchdog-collected").digest("hex"),
				result_text: finalText,
				result_text_truncated: sanitizedResult.truncated,
				result_text_sha256: createHash("sha256").update(resultObservation.text).digest("hex"),
				completion_status: resultObservation.completionStatus,
				output_kind: resultObservation.outputKind,
				usable_for_synthesis: captureSafetyMetadata.safe_for_auto_synthesis,
				missing_contract: false,
				finalization_reason: "terminal_marker",
				looks_like_refusal_or_error: resultObservation.looksLikeRefusalOrError,
				...captureSafetyMetadata,
				created_at: completedAt,
				dispatch_authority_enabled: false,
			});
			if (!taskResultWritten) {
				const captureDiagnostic = await pollCaptureFailureDiagnostic({ client: input.client, childSessionId, observedAt: completedAt });
				writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, withCaptureFailureDiagnosticFields({
					...recordForWrites,
					capture_failure_terminalized_at: completedAt,
				}, captureDiagnostic, "task_result_persistence_failed"));
				writeChildSessionEvidence(input.rootDir, input.workflowId, `task-failed-${taskId}-watchdog-result-write-${token}`, {
					schema_version: "flowdesk.task_failed.v1",
					workflow_id: input.workflowId,
					lane_id: laneId,
					task_id: taskId,
					agent_ref: agentRef,
					provider_qualified_model_id: modelId,
					failure_category: "unknown",
					redacted_reason: "watchdog could not persist task_result evidence",
					...captureSafetyMetadata,
					created_at: completedAt,
					dispatch_authority_enabled: false,
				});
				writeAgentTaskProgressEvidence({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					laneId,
					taskId,
					agentRef,
					providerQualifiedModelId: modelId,
					phase: "failed",
					progressSeq: 20 + nudgeCount,
					progressLabel: "async agent task result persistence failed",
					observedAt: completedAt,
				});
				refreshFlowDeskCompletionUiCachesV1({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					observedAt: completedAt,
				});
				continue;
			}
			const observedReviewerVerdict = observedTopTierReviewerVerdictFromText({
				text: resultObservation.text,
				workflowId: input.workflowId,
			});
			const reviewerVerdictPersisted = observedReviewerVerdict === undefined
				? false
				: persistObservedReviewerVerdict({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					verdict: observedReviewerVerdict,
				});
			const runningLifecycle = reloaded.entries.find((entry) => {
				const lifecycle = entry.record as Record<string, unknown>;
				return entry.evidenceClass === "lane_lifecycle" && lifecycle.lane_id === laneId && typeof lifecycle.attempt_id === "string";
			})?.record as Record<string, unknown> | undefined;
			if (reviewerVerdictPersisted && observedReviewerVerdict !== undefined) {
				writeAgentTaskCompleteLifecycleForVerdict({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					laneId,
					attemptId: typeof runningLifecycle?.attempt_id === "string" ? runningLifecycle.attempt_id : `attempt-${laneId}`,
					parentSessionRef: typeof record.parent_session_ref === "string" ? record.parent_session_ref : "ses-agent-task-parent",
					childSessionId,
					taskResultEvidenceId,
					agentRef,
					providerQualifiedModelId: modelId,
					verdictId: observedReviewerVerdict.verdict_id,
					observedAt: completedAt,
				});
			} else {
				writeAgentTaskTerminalLifecycleForTaskResult({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					laneId,
					attemptId: typeof runningLifecycle?.attempt_id === "string" ? runningLifecycle.attempt_id : `attempt-${laneId}`,
					parentSessionRef: typeof record.parent_session_ref === "string" ? record.parent_session_ref : "ses-agent-task-parent",
					childSessionId,
					taskResultEvidenceId,
					agentRef,
					providerQualifiedModelId: modelId,
					observedAt: completedAt,
				});
			}
				writeAgentTaskProgressEvidence({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					laneId,
					taskId,
				agentRef,
				providerQualifiedModelId: modelId,
				phase: "finalizing",
				progressSeq: 10 + nudgeCount,
				progressLabel: reviewerVerdictPersisted
					? "async agent task result captured with reviewer verdict evidence"
					: "async agent task result captured by watchdog",
				observedAt: completedAt,
			});
			refreshFlowDeskCompletionUiCachesV1({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				observedAt: completedAt,
			});
			result.lanesCompleted++;
			continue;
		}

		// 1b. Idle-confirmed capture. No explicit terminal marker was observed,
		// but if the lane has produced assistant text, is not mid-tool, and has
		// been silent past the idle-settle window, OpenCode has effectively gone
		// idle with the final answer already present. Capture it as a final
		// result (finalization_reason = "stable_idle") instead of waiting for a
		// terminal marker that may never arrive and letting the lane drift into
		// finalizing_without_terminal / MessageAbortedError.
		// V11.2 Slice 4 (post 2-model review) — idle-confirmed capture is gated on a
		// REAL fresh session.idle event, NOT a silence heuristic. The silence-only
		// trigger and the body-stability hash machinery were removed: the multi-model
		// review (Claude keep_1b_idle_signal_only + GPT) converged that silence-based
		// idle inference is the bug source and body-stability was a patch only needed
		// because of it. A genuine session.idle is an authoritative "turn quiescent"
		// runtime signal, so it does not need the 2-cycle hash corroboration to avoid
		// finalizing intermediate "I'll start..." text. We still gate on the EVENT-based
		// tool state so a running/unknown tool blocks idle capture/continuation, and
		// the timeout terminator (G2) + absolute lane-age cap remain the safety net.
		const idleCheckEligible = hasUnhandledFreshSessionIdleSignal && !toolRunningNow && !toolStateUnknown;
		if (idleCheckEligible) {
			const idleObservation = await pollChildSessionIdleConfirmedOutput(input.client, childSessionId);
			if (idleObservation !== null && idleObservation.hasRunningTool === false && idleObservation.text !== undefined && idleObservation.text.trim().length > 0) {
				const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
				const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
				const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
				if (laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
					continue;
				}
				const token = randomBytes(4).toString("hex");
				const completedAt = new Date(nowMs).toISOString();
				const sanitizedResult = sanitizeFlowDeskTaskResultTextV1(idleObservation.text);
				writeSessionFinalizationEvidenceIfMeaningful({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					reloadedEntries: reloaded.entries,
					laneId,
					taskId,
					childSessionId,
					observedAt: completedAt,
					decisionContext: "idle_confirmed_text",
					text: sanitizedResult.text,
					stepFinishObserved: idleObservation.terminalMarkerObserved,
					sessionIdleState: "confirmed_idle",
					runningToolsState: "none_running_confirmed",
					confidence: "high",
				});
				const captureSafetyMetadata = buildFlowDeskCaptureSafetyMetadataV1({
					text: sanitizedResult.text,
					completionStatus: "final",
					outputKind: idleObservation.outputKind,
					finalizationReason: "stable_idle",
					finalBodyObserved: true,
					terminalMarkerObserved: idleObservation.terminalMarkerObserved,
				});
				const taskResultEvidenceId = `task-result-${taskId}-watchdog-idle-${token}`;
				const taskResultWritten = writeChildSessionEvidence(input.rootDir, input.workflowId, taskResultEvidenceId, {
					schema_version: "flowdesk.task_result.v1",
					workflow_id: input.workflowId,
					lane_id: laneId,
					task_id: taskId,
					agent_ref: agentRef,
					provider_qualified_model_id: modelId,
					task_prompt_sha256: createHash("sha256").update("watchdog-collected").digest("hex"),
					result_text: sanitizedResult.text,
					result_text_truncated: sanitizedResult.truncated,
					result_text_sha256: createHash("sha256").update(idleObservation.text).digest("hex"),
					completion_status: "final",
					output_kind: idleObservation.outputKind,
					usable_for_synthesis: captureSafetyMetadata.safe_for_auto_synthesis,
					missing_contract: false,
					finalization_reason: "stable_idle",
					looks_like_refusal_or_error: idleObservation.looksLikeRefusalOrError,
					...captureSafetyMetadata,
					created_at: completedAt,
					dispatch_authority_enabled: false,
				});
				if (taskResultWritten) {
					writeAgentTaskTerminalLifecycleForTaskResult({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId,
						attemptId: `attempt-${laneId}`,
						parentSessionRef: typeof record.parent_session_ref === "string" ? record.parent_session_ref : "ses-agent-task-parent",
						childSessionId,
						taskResultEvidenceId,
						agentRef,
						providerQualifiedModelId: modelId,
						observedAt: completedAt,
					});
					writeAgentTaskProgressEvidence({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId,
						taskId,
						agentRef,
						providerQualifiedModelId: modelId,
						phase: "finalizing",
						progressSeq: 10 + nudgeCount,
						progressLabel: "async agent task result captured after idle without terminal marker",
						observedAt: completedAt,
					});
					refreshFlowDeskCompletionUiCachesV1({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						observedAt: completedAt,
					});
					result.lanesCompleted++;
					continue;
				}
			} else if (
				maxIdleContinuations > 0 &&
				(idleObservation === null || idleObservation.hasRunningTool === false)
			) {
				// 1c. Idle-confirmed continuation. The lane is idle past the settle
				// window, or it emitted a fresh session.idle signal, but has NOT
				// produced any usable assistant text. Inject a real continuation
				// prompt into the same child session (capped) to recover a final
				// answer, instead of waiting for the abort path.
				const idleContinuationCount = typeof recordForWrites.idle_continuation_count === "number" ? recordForWrites.idle_continuation_count : 0;
				if (idleContinuationCount < maxIdleContinuations) {
					const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
					const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
					const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
					const continuationAt = new Date(nowMs).toISOString();
					const deliveryStatus = await sendIdleContinuationPrompt(input.client, childSessionId);
					writeAgentTaskProgressEvidence({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId,
						taskId,
						agentRef,
						providerQualifiedModelId: modelId,
						phase: "nudged",
						progressSeq: 5 + idleContinuationCount,
						progressLabel: deliveryStatus === "sent"
							? "async agent task idle continuation prompt injected after idle without final answer"
							: "async agent task idle continuation attempt recorded; provider-side injection unavailable",
						observedAt: continuationAt,
					});
					writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, {
						...recordForWrites,
						idle_continuation_count: idleContinuationCount + 1,
						...(hasUnhandledFreshSessionIdleSignal && latestSessionIdleSignalAtMs !== undefined
							? { last_idle_continuation_signal_at: new Date(latestSessionIdleSignalAtMs).toISOString() }
							: {}),
						last_idle_continuation_at: continuationAt,
						last_idle_continuation_delivery_status: deliveryStatus,
						last_activity_at: continuationAt,
					});
					result.lanesNudged++;
					continue;
				}
			}
		}

		// 2. Abort threshold exceeded.
		// V11.4: the silence-based nudge branch was removed (it was a default-noop,
		// silence-heuristic predecessor of the event-based idle continuation). Abort
		// no longer depends on a "nudge budget" — a stuck lane is abort-eligible once
		// it has been silent past the abort threshold with no running/unknown tool.
		// When idle continuation is OPTED IN, give it a chance first: only abort once
		// the continuation budget is exhausted. When continuation is OFF (default),
		// there is no recovery precondition and silence+tool-gate alone governs abort.
		const idleContinuationCountForAbort = typeof record.idle_continuation_count === "number" ? record.idle_continuation_count : 0;
		const continuationBudgetPending = maxIdleContinuations > 0 && idleContinuationCountForAbort < maxIdleContinuations;
		// V11.2 Slice 1 — event-based termination gating.
		//  - NEVER abort while a tool is genuinely running (toolRunningNow): protects
		//    long single tool calls / long reasoning that emit no mid events.
		//  - While toolStateUnknown (likely-dropped settle), block the normal abort
		//    path; this slice records diagnostic review evidence instead of terminalizing.
		//  - At staleToolMs, a lane stuck in UNKNOWN wakes the coordinator with
		//    advisory diagnostic evidence. Underlying child abort is NOT confirmed and
		//    must be checked before any decision.
		//  - G2: an absolute lane-age cap guarantees a true zero-event lane still
		//    terminates even though the meaningful-activity silence gate never trips.
		const unknownForceTerminate = false;
		// Phase 7.5: auto-mark inconsistent lanes as orphaned after 1h (3,600,000ms)
		const inconsistentOrphanMs = 3_600_000;
		const latestInconsistencyAtMs = latestLifecycleStateChangeAtMs !== undefined && 
			reloaded.entries.some(e => e.evidenceClass === "agent_task_inconsistency" && (e.record as any).lane_id === laneId)
			? latestLifecycleStateChangeAtMs
			: (reloaded.entries.find(e => e.evidenceClass === "agent_task_inconsistency" && (e.record as any).lane_id === laneId) 
				? Date.parse((reloaded.entries.find(e => e.evidenceClass === "agent_task_inconsistency" && (e.record as any).lane_id === laneId)!.record as any).observed_at)
				: NaN);
		const inconsistentForceTerminate = Number.isFinite(latestInconsistencyAtMs) && (nowMs - latestInconsistencyAtMs >= inconsistentOrphanMs);
		const laneAgeForceTerminate = (totalAgeMs >= absoluteLaneAgeMs || (inconsistentForceTerminate && workflowPrefixAllowed(input.workflowId))) && !toolRunningNow && !toolStateUnknown && !coordinatorReviewRequestedThisCycle;
		const normalAbortEligible = silenceMs >= abortThresholdMs && !continuationBudgetPending && !toolRunningNow && !toolStateUnknown && !coordinatorReviewRequestedThisCycle;
		if (toolStateUnknown) {
			const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
			const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
			const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
			const latestProgress = latestProgressByLane.get(laneId);
			const diagnosticAt = new Date((laneToolState.oldestOpenAtMs ?? nowMs) + staleToolMs).toISOString();
			const diagnostic = await pollCaptureFailureDiagnostic({ client: input.client, childSessionId, observedAt: diagnosticAt });
			recordForWrites = withCaptureFailureDiagnosticFields({
				...recordForWrites,
				coordinator_attention_status: "review_requested",
				coordinator_attention_last_review_requested_at: diagnosticAt,
				coordinator_attention_last_review_reason: "tool_run_overdue_observed",
			}, diagnostic, "tool_run_overdue_observed");
			writeChildSessionEvidence(input.rootDir, input.workflowId, childSessionEvidenceId, recordForWrites);
			writeToolTimeoutReviewRequestedEvidence({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				laneId,
				taskId,
				agentRef,
				providerQualifiedModelId: modelId,
				lastProgressSeq: latestProgress?.progressSeq ?? 1,
				lastProgressObservedAt: latestProgress === undefined
					? new Date(laneToolState.oldestOpenAtMs ?? nowMs).toISOString()
					: new Date(latestProgress.observedAtMs).toISOString(),
				observedAt: diagnosticAt,
				staleToolMs,
			});
			refreshFlowDeskCompletionUiCachesV1({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				observedAt: diagnosticAt,
			});
			continue;
		}
		if (normalAbortEligible || unknownForceTerminate || laneAgeForceTerminate) {
			await abortChildSession(input.client, childSessionId);
			const taskId = typeof record.task_id === "string" ? record.task_id : laneId;
			const agentRef = typeof record.agent_ref === "string" ? record.agent_ref : "agent-unknown";
			const modelId = typeof record.provider_qualified_model_id === "string" ? record.provider_qualified_model_id : "unknown/unknown";
			if (laneAlreadyHasTerminalTaskEvidence({ rootDir: input.rootDir, workflowId: input.workflowId, laneId })) {
				continue;
			}
			const token = randomBytes(4).toString("hex");
			const abortedAt = new Date(nowMs).toISOString();
			const partialObservation = await pollChildSessionCandidate(input.client, childSessionId);
			if (partialObservation !== null && partialObservation.text.trim().length > 0) {
				const sanitizedResult = sanitizeFlowDeskTaskResultTextV1(partialObservation.text);
				const captureSafetyMetadata = buildFlowDeskCaptureSafetyMetadataV1({
					text: sanitizedResult.text,
					completionStatus: "partial",
					outputKind: partialObservation.outputKind,
					finalizationReason: "timeout_partial",
					finalBodyObserved: partialObservation.finalBodyObserved,
					terminalMarkerObserved: partialObservation.terminalMarkerObserved,
				});
				const taskResultWritten = writeChildSessionEvidence(input.rootDir, input.workflowId, `task-result-${taskId}-watchdog-partial-${token}`, {
					schema_version: "flowdesk.task_result.v1",
					workflow_id: input.workflowId,
					lane_id: laneId,
					task_id: taskId,
					agent_ref: agentRef,
					provider_qualified_model_id: modelId,
					task_prompt_sha256: createHash("sha256").update("watchdog-collected").digest("hex"),
					result_text: sanitizedResult.text,
					result_text_truncated: sanitizedResult.truncated,
					result_text_sha256: createHash("sha256").update(partialObservation.text).digest("hex"),
					completion_status: "partial",
					output_kind: partialObservation.outputKind,
					usable_for_synthesis: captureSafetyMetadata.safe_for_auto_synthesis,
					// Captured partial text is still a usable result, not a contract
					// failure. The coordinator judges substance from the advisory fields.
					missing_contract: false,
					finalization_reason: "timeout_partial",
					looks_like_refusal_or_error: partialObservation.looksLikeRefusalOrError,
					...captureSafetyMetadata,
					created_at: abortedAt,
					dispatch_authority_enabled: false,
				});
				if (taskResultWritten) {
					writeAgentTaskProgressEvidence({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						laneId,
						taskId,
						agentRef,
						providerQualifiedModelId: modelId,
						phase: "finalizing",
						progressSeq: 20 + nudgeCount,
						progressLabel: "async agent task partial result captured before abort",
						observedAt: abortedAt,
					});
					refreshFlowDeskCompletionUiCachesV1({
						rootDir: input.rootDir,
						workflowId: input.workflowId,
						observedAt: abortedAt,
					});
					result.lanesCompleted++;
					continue;
				}
			}

			// If we already injected an idle continuation prompt and the lane STILL
			// produced no final answer, terminalize as a no-response failure with a
			// reason that makes the exhausted recovery explicit — instead of leaving
			// the lane to drift into a later OpenCode MessageAbortedError.
			const idleContinuationsUsed = typeof record.idle_continuation_count === "number" ? record.idle_continuation_count : 0;
			// V11.2 Slice 1 — classify the termination reason by which guard fired.
			// Reuse existing valid failure_category enum values (no schema change in
			// this slice); the precise cause is recorded in redacted_reason below.
			const failureCategory = unknownForceTerminate
				? "sdk_prompt_timeout"
				: inconsistentForceTerminate
					? "orphaned"
					: laneAgeForceTerminate
						? "no_response"
						: totalAgeMs > abortThresholdMs * 2
							? "network_interrupted"
							: "sdk_prompt_timeout";
			const abortReason = unknownForceTerminate
				? `watchdog force-terminated child session: tool state unrecoverable (open tool had no settle event for ${Math.round(unknownDwellMs / 1000)}s)`
				: inconsistentForceTerminate
					? `watchdog force-terminated child session after ${Math.round((nowMs - latestInconsistencyAtMs) / 1000)}s in inconsistent finalizing_without_terminal state (orphaned)`
					: laneAgeForceTerminate
						? `watchdog force-terminated child session after ${Math.round(totalAgeMs / 1000)}s reaching the absolute lane-age cap with no response`
					: idleContinuationsUsed > 0
						? `watchdog aborted child session after ${Math.round(totalAgeMs / 1000)}s with no final answer following ${idleContinuationsUsed} idle continuation attempt(s)`
						: `watchdog aborted child session after ${Math.round(totalAgeMs / 1000)}s with no response`;
			const noOutputCaptureMetadata = buildFlowDeskCaptureSafetyMetadataV1({
				outputKind: "empty",
				finalBodyObserved: false,
				terminalMarkerObserved: false,
			});
			writeChildSessionEvidence(input.rootDir, input.workflowId, `task-failed-${taskId}-watchdog-abort-${token}`, {
				schema_version: "flowdesk.task_failed.v1",
				workflow_id: input.workflowId,
				lane_id: laneId,
				task_id: taskId,
				agent_ref: agentRef,
				provider_qualified_model_id: modelId,
				failure_category: failureCategory,
				redacted_reason: abortReason,
				...noOutputCaptureMetadata,
				created_at: abortedAt,
				dispatch_authority_enabled: false,
			});
			writeAgentTaskProgressEvidence({
				rootDir: input.rootDir,
				workflowId: input.workflowId,
				laneId,
				taskId,
				agentRef,
				providerQualifiedModelId: modelId,
				phase: "failed",
				progressSeq: 20 + nudgeCount,
					progressLabel: idleContinuationsUsed > 0
						? "async agent task aborted; no final answer after idle continuation budget exhausted"
						: "async agent task aborted after no response",
					observedAt: abortedAt,
				});
				refreshFlowDeskCompletionUiCachesV1({
					rootDir: input.rootDir,
					workflowId: input.workflowId,
					observedAt: abortedAt,
				});
				result.lanesAborted++;
				continue;
			}

		// V11.4: the silence-based nudge branch was removed. A stuck lane now
		// terminates via the silence+tool-gate abort above (branch 2) or the
		// G1/G2 force-terminators; "waking" an idle child is the job of the
		// event-gated, opt-in idle continuation (branch 1c), not a silence nudge.
	}

	// Invariant: terminal/failure lanes observed during this cycle MUST cause a
	// completion UI cache refresh, even when the failed lane has no paired
	// `agent_task_child_session` record (e.g. reviewer execution bridge wrote
	// only `lane_lifecycle=invocation_failed`, or `task_failed`/`no_output`
	// arrived via the event hook without a task_result). Without this defensive
	// refresh, the `subtask-activity-sidebar` and `auto-next-ready` caches stay
	// stuck at `progressing_normal/running` until the next backfill pass.
	if (!uiCacheRefreshed && terminalLaneIds.size > 0) {
		refreshFlowDeskCompletionUiCachesV1({
			rootDir: input.rootDir,
			workflowId: input.workflowId,
			observedAt: terminalRefreshObservedAt,
		});
	}

	return result;
}
