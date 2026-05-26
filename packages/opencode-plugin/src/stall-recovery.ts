import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	projectFlowDeskLaneStallV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskPendingAbortCancelV1,
	type FlowDeskPendingAbortWarningV1,
	type FlowDeskReviewerLaneContextV1,
	type FlowDeskPendingRetryPlanV1,
	type FlowDeskRetryExecutedV1,
	type FlowDeskRetryFailedV1,
	type FlowDeskAutoRetryResultV1,
	type DisabledAutoRetryReason,
} from "@flowdesk/core";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
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
		await withTimeout(
			client.session.messages({ path: { id: sessionId } }) as Promise<unknown>,
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

function isPendingRetryPlan(value: unknown): value is FlowDeskPendingRetryPlanV1 {
	return isRecord(value) && value.schema_version === "flowdesk.pending_retry_plan.v1";
}

function isRetryExecuted(value: unknown): value is FlowDeskRetryExecutedV1 {
	return isRecord(value) && value.schema_version === "flowdesk.retry_executed.v1";
}

function isRetryFailed(value: unknown): value is FlowDeskRetryFailedV1 {
	return isRecord(value) && value.schema_version === "flowdesk.retry_failed.v1";
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

	// Step 4: Load reviewer_lane_context.v1 for laneId
	const reloaded = reloadFlowDeskSessionEvidenceV1({
		rootDir: input.rootDir,
		workflowId: input.workflowId,
	});
	if (!reloaded.ok) {
		return { status: "auto_retry_disabled", reason: "context_missing" };
	}
	const contextEntry = reloaded.entries.find(
		(e) => isReviewerLaneContext(e.record) && (e.record as FlowDeskReviewerLaneContextV1).lane_id === input.laneId,
	);
	if (contextEntry === undefined) {
		return { status: "auto_retry_disabled", reason: "context_missing" };
	}
	const context = contextEntry.record as unknown as FlowDeskReviewerLaneContextV1;

	// Step 5: Verify context.redaction_version present
	if (!context.redaction_version || typeof context.redaction_version !== "string" || context.redaction_version.trim().length === 0) {
		return { status: "auto_retry_disabled", reason: "context_redaction_invalid" };
	}

	// Step 6: Verify context.workflow_id === workflowId && context.perspective valid
	const VALID_PERSPECTIVES = new Set(["policy_security", "architecture", "verification_implementation"]);
	if (context.workflow_id !== input.workflowId || !VALID_PERSPECTIVES.has(context.perspective)) {
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

	// Step 12: Call launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1
	const launchPlan = buildRetryLaunchPlanFromContextV1(context, newLaneId, input.parentSessionId);

	let launchResult: Awaited<ReturnType<typeof launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1>>;
	try {
		const launchPromise = launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: input.client,
			launchPlan: launchPlan as unknown as import("@flowdesk/core").FlowDeskRuntimeLaneLaunchPlanV1,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId: input.parentSessionId,
				promptText: context.prompt_text,
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
		perspective: context.perspective,
		provider_qualified_model_id: context.provider_qualified_model_id,
		new_parent_session_ref: newParentSessionRef,
		original_attempt_id: context.original_attempt_id,
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

		for (const workflowId of workflowIds) {
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
