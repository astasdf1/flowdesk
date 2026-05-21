import {
	existsSync,
	lstatSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	renameSync,
	writeFileSync,
} from "node:fs";
import { dirname, resolve, sep } from "node:path";
import {
	FLOWDESK_SESSION_EVIDENCE_CLASSES,
	type FlowDeskSessionEvidenceClass,
	sessionEvidenceDirectoryPath,
	sessionEvidenceRecordPath,
} from "./state-paths.js";
import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

const EVIDENCE_SCHEMA_BY_CLASS: Record<FlowDeskSessionEvidenceClass, string> = {
	usage_authority: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
	runtime_echo: "flowdesk.managed_dispatch_beta.runtime_echo_evidence.v1",
	telemetry_correlation:
		"flowdesk.managed_dispatch_beta.telemetry_correlation.v1",
	configured_verification: "flowdesk.configured_verification_result.v1",
	sanitized_auth_capture: "flowdesk.sanitized_auth_capture_result.v1",
	external_auth_provider_policy:
		"flowdesk.external_auth_provider_policy_result.v1",
	production_approval: "flowdesk.production_approval_decision.v1",
	pre_dispatch_audit: "flowdesk.pre_dispatch_audit_record.v1",
};

const CLASS_BY_SCHEMA: Record<string, FlowDeskSessionEvidenceClass> =
	Object.fromEntries(
		(
			Object.entries(EVIDENCE_SCHEMA_BY_CLASS) as Array<
				[FlowDeskSessionEvidenceClass, string]
			>
		).map(([cls, schema]) => [schema, cls]),
	);

export interface FlowDeskSessionEvidenceWriteIntentV1 {
	operation: "write_json";
	authority: "redacted_session_support";
	workflowId: string;
	evidenceId: string;
	evidenceClass: FlowDeskSessionEvidenceClass;
	schemaId: string;
	path: string;
	tempPath: string;
	record: Record<string, unknown>;
	fsSafety: "validated_relative_flowdesk_path_only";
	atomicity: { strategy: "temp_then_rename_intent" };
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskSessionEvidencePrepareResult extends ValidationResult {
	writeIntent?: FlowDeskSessionEvidenceWriteIntentV1;
}

export interface FlowDeskSessionEvidenceReloadEntryV1 {
	evidenceClass: FlowDeskSessionEvidenceClass;
	evidenceId: string;
	record: Record<string, unknown>;
	path: string;
}

export interface FlowDeskSessionEvidenceReloadResultV1
	extends ValidationResult {
	entries: FlowDeskSessionEvidenceReloadEntryV1[];
	blocked: Array<{
		evidenceClass: FlowDeskSessionEvidenceClass;
		evidenceId: string;
		reason: string;
		path: string;
	}>;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskSessionEvidenceInventoryV1 {
	schema_version: "flowdesk.session_evidence_inventory.v1";
	workflow_id: string;
	total_entries: number;
	total_blocked: number;
	classes: Array<{
		evidenceClass: FlowDeskSessionEvidenceClass;
		valid: number;
		blocked: number;
		lastBlockedReason?: string;
	}>;
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

export interface FlowDeskSessionEvidenceApplyResultV1 extends ValidationResult {
	rootDir?: string;
	writtenPaths: string[];
	realOpenCodeDispatch: false;
	actualLaneLaunch: false;
	providerCall: false;
	runtimeExecution: false;
}

const disabledEvidenceAuthority = {
	realOpenCodeDispatch: false as const,
	actualLaneLaunch: false as const,
	providerCall: false as const,
	runtimeExecution: false as const,
};

function isRecordObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function validateSchemaVersionForClass(
	record: Record<string, unknown>,
	evidenceClass: FlowDeskSessionEvidenceClass,
): ValidationResult {
	const expected = EVIDENCE_SCHEMA_BY_CLASS[evidenceClass];
	return record.schema_version === expected
		? valid()
		: invalid(`evidence schema_version must be ${expected}`);
}

function validateEvidenceShape(
	record: Record<string, unknown>,
	evidenceClass: FlowDeskSessionEvidenceClass,
): ValidationResult {
	const schemaCheck = validateSchemaVersionForClass(record, evidenceClass);
	if (!schemaCheck.ok) return schemaCheck;
	const requiredCommon = ["schema_version"] as const;
	for (const key of requiredCommon)
		if (!(key in record))
			return invalid(`evidence is missing required field: ${key}`);
	return validateNoForbiddenRawPayloads(record, "session_evidence_record");
}

function validateOptionalTimestampFreshness(
	record: Record<string, unknown>,
	rejectStaleAt: string | undefined,
): ValidationResult {
	if (rejectStaleAt === undefined || !("expires_at" in record)) return valid();
	const checkedAt = Date.parse(rejectStaleAt);
	if (!Number.isFinite(checkedAt))
		return invalid("rejectStaleAt must be a parseable timestamp");
	if (typeof record.expires_at !== "string")
		return invalid("evidence expires_at must be a timestamp string");
	const expiresAt = Date.parse(record.expires_at);
	if (!Number.isFinite(expiresAt))
		return invalid("evidence expires_at must be parseable");
	return expiresAt > checkedAt ? valid() : invalid("evidence is stale");
}

function validateOptionalProfileAlignment(
	record: Record<string, unknown>,
	expectedProfileRef: string | undefined,
): ValidationResult {
	if (expectedProfileRef === undefined) return valid();
	const expected = validateOpaqueRef(expectedProfileRef, "expected_profile_ref");
	if (!expected.ok) return expected;
	const profileRef = record.profile_ref ?? record.auth_profile_ref;
	if (profileRef === undefined) return valid();
	return profileRef === expectedProfileRef
		? valid()
		: invalid("evidence profile_ref mismatch");
}

function ensureWorkflowAlignment(
	record: Record<string, unknown>,
	workflowId: string,
): ValidationResult {
	if (!("workflow_id" in record)) return valid();
	return record.workflow_id === workflowId
		? valid()
		: invalid(`evidence workflow_id mismatch: expected ${workflowId}`);
}

export function classifyFlowDeskSessionEvidenceRecord(
	record: unknown,
):
	| { ok: true; evidenceClass: FlowDeskSessionEvidenceClass }
	| { ok: false; errors: string[] } {
	if (!isRecordObject(record))
		return { ok: false, errors: ["evidence must be an object"] };
	const schema = record.schema_version;
	if (typeof schema !== "string")
		return { ok: false, errors: ["evidence schema_version must be a string"] };
	const evidenceClass = CLASS_BY_SCHEMA[schema];
	if (evidenceClass === undefined)
		return {
			ok: false,
			errors: [
				`evidence schema_version is not a managed session evidence class: ${schema}`,
			],
		};
	return { ok: true, evidenceClass };
}

export interface FlowDeskSessionEvidencePrepareInputV1 {
	workflowId: string;
	evidenceId: string;
	record: unknown;
}

export function prepareFlowDeskSessionEvidenceWriteIntentV1(
	input: FlowDeskSessionEvidencePrepareInputV1,
): FlowDeskSessionEvidencePrepareResult {
	const workflowResult = validateOpaqueId(input.workflowId, "workflow_id");
	if (!workflowResult.ok) return workflowResult;
	const evidenceIdResult = validateOpaqueId(input.evidenceId, "evidence_id");
	if (!evidenceIdResult.ok) return evidenceIdResult;
	const classification = classifyFlowDeskSessionEvidenceRecord(input.record);
	if (!classification.ok) return invalid(...classification.errors);
	if (!isRecordObject(input.record))
		return invalid("evidence must be an object");
	const shapeResult = validateEvidenceShape(
		input.record,
		classification.evidenceClass,
	);
	if (!shapeResult.ok) return shapeResult;
	const workflowAlignment = ensureWorkflowAlignment(
		input.record,
		input.workflowId,
	);
	if (!workflowAlignment.ok) return workflowAlignment;
	const path = sessionEvidenceRecordPath(
		input.workflowId,
		classification.evidenceClass,
		input.evidenceId,
	);
	const schemaId = EVIDENCE_SCHEMA_BY_CLASS[classification.evidenceClass];
	const tempPath = `${path}.tmp-${schemaId.replace(/[^A-Za-z0-9_.-]/g, "-")}`;
	const writeIntent: FlowDeskSessionEvidenceWriteIntentV1 = {
		operation: "write_json",
		authority: "redacted_session_support",
		workflowId: input.workflowId,
		evidenceId: input.evidenceId,
		evidenceClass: classification.evidenceClass,
		schemaId,
		path,
		tempPath,
		record: JSON.parse(JSON.stringify(input.record)) as Record<string, unknown>,
		fsSafety: "validated_relative_flowdesk_path_only",
		atomicity: { strategy: "temp_then_rename_intent" },
		...disabledEvidenceAuthority,
	};
	return { ok: true, errors: [], writeIntent };
}

function safeJoin(rootDir: string, relativePath: string): string {
	const root = resolve(rootDir);
	const target = resolve(root, relativePath);
	const rootPrefix = root.endsWith(sep) ? root : `${root}${sep}`;
	if (target !== root && !target.startsWith(rootPrefix))
		throw new Error("evidence target escapes root directory");
	return target;
}

function validateSessionEvidenceWriteIntent(
	intent: FlowDeskSessionEvidenceWriteIntentV1,
): ValidationResult {
	const errors: string[] = [];
	if (intent.operation !== "write_json")
		errors.push("session evidence intent operation must be write_json");
	if (intent.authority !== "redacted_session_support")
		errors.push("session evidence intent authority is invalid");
	errors.push(...validateOpaqueId(intent.workflowId, "workflow_id").errors);
	errors.push(...validateOpaqueId(intent.evidenceId, "evidence_id").errors);
	if (
		!(FLOWDESK_SESSION_EVIDENCE_CLASSES as readonly string[]).includes(
			intent.evidenceClass,
		)
	)
		errors.push("session evidence class is invalid");
	const expectedSchema = EVIDENCE_SCHEMA_BY_CLASS[intent.evidenceClass];
	if (intent.schemaId !== expectedSchema)
		errors.push("session evidence schemaId does not match evidenceClass");
	const expectedPath = sessionEvidenceRecordPath(
		intent.workflowId,
		intent.evidenceClass,
		intent.evidenceId,
	);
	if (intent.path !== expectedPath)
		errors.push("session evidence path does not match workflow/class/id");
	const expectedTempPrefix = `${expectedPath}.tmp-`;
	if (!intent.tempPath.startsWith(expectedTempPrefix))
		errors.push("session evidence tempPath does not match target path");
	if (
		!intent.tempPath.includes(expectedSchema.replace(/[^A-Za-z0-9_.-]/g, "-"))
	)
		errors.push("session evidence tempPath does not bind schemaId");
	if (intent.fsSafety !== "validated_relative_flowdesk_path_only")
		errors.push("session evidence fsSafety is invalid");
	if (intent.atomicity?.strategy !== "temp_then_rename_intent")
		errors.push("session evidence atomicity is invalid");
	if (
		intent.realOpenCodeDispatch !== false ||
		intent.actualLaneLaunch !== false ||
		intent.providerCall !== false ||
		intent.runtimeExecution !== false
	)
		errors.push("session evidence intent cannot enable runtime authority");
	const shape = validateEvidenceShape(intent.record, intent.evidenceClass);
	errors.push(...shape.errors);
	const alignment = ensureWorkflowAlignment(intent.record, intent.workflowId);
	errors.push(...alignment.errors);
	return errors.length === 0 ? valid() : invalid(...errors);
}

export function applyFlowDeskSessionEvidenceWriteIntentsV1(
	rootDir: string,
	intents: readonly FlowDeskSessionEvidenceWriteIntentV1[],
): FlowDeskSessionEvidenceApplyResultV1 {
	if (typeof rootDir !== "string" || rootDir.trim().length === 0)
		return {
			...invalid("rootDir is required"),
			writtenPaths: [],
			...disabledEvidenceAuthority,
		};
	const writtenPaths: string[] = [];
	const root = resolve(rootDir);
	try {
		for (const intent of intents) {
			const intentResult = validateSessionEvidenceWriteIntent(intent);
			if (!intentResult.ok)
				return {
					...invalid(...intentResult.errors),
					rootDir: root,
					writtenPaths,
					...disabledEvidenceAuthority,
				};
			const target = safeJoin(root, intent.path);
			const temp = safeJoin(root, intent.tempPath);
			if (dirname(target) !== dirname(temp))
				return {
					...invalid("session evidence tempPath must stay beside target path"),
					rootDir: root,
					writtenPaths,
					...disabledEvidenceAuthority,
				};
		}
		for (const intent of intents) {
			const target = safeJoin(root, intent.path);
			const temp = safeJoin(root, intent.tempPath);
			mkdirSync(dirname(target), { recursive: true });
			writeFileSync(temp, JSON.stringify(intent.record), "utf8");
			renameSync(temp, target);
			writtenPaths.push(intent.path);
		}
		return {
			...valid(),
			rootDir: root,
			writtenPaths,
			...disabledEvidenceAuthority,
		};
	} catch (error) {
		return {
			...invalid(
				error instanceof Error
					? error.message
					: "session evidence write failed",
			),
			rootDir: root,
			writtenPaths,
			...disabledEvidenceAuthority,
		};
	}
}

export interface FlowDeskSessionEvidenceReadOptionsV1 {
	workflowId: string;
	rootDir: string;
	rejectStaleAt?: string;
	expectedProfileRef?: string;
}

export function reloadFlowDeskSessionEvidenceV1(
	options: FlowDeskSessionEvidenceReadOptionsV1,
): FlowDeskSessionEvidenceReloadResultV1 {
	const workflowResult = validateOpaqueId(options.workflowId, "workflow_id");
	if (!workflowResult.ok) {
		return {
			ok: false,
			errors: workflowResult.errors,
			entries: [],
			blocked: [],
			...disabledEvidenceAuthority,
		};
	}
	if (typeof options.rootDir !== "string" || options.rootDir.length === 0) {
		return {
			ok: false,
			errors: ["rootDir is required"],
			entries: [],
			blocked: [],
			...disabledEvidenceAuthority,
		};
	}
	const entries: FlowDeskSessionEvidenceReloadEntryV1[] = [];
	const blocked: FlowDeskSessionEvidenceReloadResultV1["blocked"] = [];
	const errors: string[] = [];
	for (const evidenceClass of FLOWDESK_SESSION_EVIDENCE_CLASSES) {
		const relativeDir = sessionEvidenceDirectoryPath(
			options.workflowId,
			evidenceClass,
		);
		let absoluteDir: string;
		try {
			absoluteDir = safeJoin(options.rootDir, relativeDir);
		} catch (error) {
			errors.push(
				error instanceof Error
					? error.message
					: `evidence ${evidenceClass} root escape`,
			);
			continue;
		}
		if (!existsSync(absoluteDir)) continue;
		const stat = lstatSync(absoluteDir);
		if (stat.isSymbolicLink()) {
			errors.push(`evidence ${evidenceClass} root must not be a symlink`);
			continue;
		}
		if (!stat.isDirectory()) {
			errors.push(`evidence ${evidenceClass} target is not a directory`);
			continue;
		}
		const fileNames = readdirSync(absoluteDir).filter((name) =>
			name.endsWith(".json"),
		);
		for (const fileName of fileNames) {
			const evidenceId = fileName.slice(0, -5);
			const refValidation = validateOpaqueRef(
				evidenceId,
				`${evidenceClass}.evidence_id`,
			);
			if (!refValidation.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: refValidation.errors.join("; "),
					path: `${relativeDir}/${fileName}`,
				});
				continue;
			}
			const expectedRelative = sessionEvidenceRecordPath(
				options.workflowId,
				evidenceClass,
				evidenceId,
			);
			let filePath: string;
			try {
				filePath = safeJoin(options.rootDir, expectedRelative);
			} catch (error) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason:
						error instanceof Error ? error.message : "evidence path escape",
					path: expectedRelative,
				});
				continue;
			}
			let raw: string;
			try {
				raw = readFileSync(filePath, "utf8");
			} catch (error) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason:
						error instanceof Error ? error.message : "evidence read failed",
					path: expectedRelative,
				});
				continue;
			}
			let parsed: unknown;
			try {
				parsed = JSON.parse(raw);
			} catch (error) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason:
						error instanceof Error ? error.message : "evidence parse failed",
					path: expectedRelative,
				});
				continue;
			}
			if (!isRecordObject(parsed)) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: "evidence must be an object",
					path: expectedRelative,
				});
				continue;
			}
			const shape = validateEvidenceShape(parsed, evidenceClass);
			if (!shape.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: shape.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			const alignment = ensureWorkflowAlignment(parsed, options.workflowId);
			if (!alignment.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: alignment.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			const profileAlignment = validateOptionalProfileAlignment(
				parsed,
				options.expectedProfileRef,
			);
			if (!profileAlignment.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: profileAlignment.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			const freshness = validateOptionalTimestampFreshness(
				parsed,
				options.rejectStaleAt,
			);
			if (!freshness.ok) {
				blocked.push({
					evidenceClass,
					evidenceId,
					reason: freshness.errors.join("; "),
					path: expectedRelative,
				});
				continue;
			}
			entries.push({
				evidenceClass,
				evidenceId,
				record: parsed,
				path: expectedRelative,
			});
		}
	}
	const reloadResult: FlowDeskSessionEvidenceReloadResultV1 = {
		ok: errors.length === 0,
		errors,
		entries,
		blocked,
		...disabledEvidenceAuthority,
	};
	return reloadResult;
}

export function summarizeFlowDeskSessionEvidenceInventoryV1(
	workflowId: string,
	reload: FlowDeskSessionEvidenceReloadResultV1,
): FlowDeskSessionEvidenceInventoryV1 {
	return {
		schema_version: "flowdesk.session_evidence_inventory.v1",
		workflow_id: workflowId,
		total_entries: reload.entries.length,
		total_blocked: reload.blocked.length,
		classes: FLOWDESK_SESSION_EVIDENCE_CLASSES.map((evidenceClass) => {
			const blocked = reload.blocked.filter(
				(entry) => entry.evidenceClass === evidenceClass,
			);
			return {
				evidenceClass,
				valid: reload.entries.filter(
					(entry) => entry.evidenceClass === evidenceClass,
				).length,
				blocked: blocked.length,
				...(blocked.length === 0
					? {}
					: { lastBlockedReason: blocked[blocked.length - 1].reason }),
			};
		}),
		...disabledEvidenceAuthority,
	};
}
