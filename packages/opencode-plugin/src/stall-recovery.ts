import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
	reloadFlowDeskSessionEvidenceV1,
	type FlowDeskLaneLifecycleRecordV1,
	type FlowDeskPendingAbortCancelV1,
	type FlowDeskPendingAbortWarningV1,
} from "@flowdesk/core";
import { createHmac, createHash, timingSafeEqual } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { FlowDeskManagedDispatchBetaOpenCodeClientV1 } from "./managed-dispatch-adapter.js";
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
