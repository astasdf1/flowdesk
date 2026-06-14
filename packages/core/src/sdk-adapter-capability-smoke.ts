import {
	invalid,
	type ValidationResult,
	valid,
	validateNoForbiddenRawPayloads,
	validateOpaqueId,
	validateOpaqueRef,
} from "./validators.js";

export interface FlowDeskSdkAdapterCapabilitySmokeV1 {
	schema_version: "flowdesk.sdk_adapter_capability_smoke.v1";
	workflow_id: string;
	attempt_id: string;
	opencode_version_ref: string;
	adapter_profile_ref: string;
	prompt_method_available: boolean;
	promptAsync_method_available: boolean;
	provider_family_mapping_valid: boolean;
	missing_method_blocked: boolean;
	absent_client_blocked: boolean;
	capability_smoke_passed: boolean;
	observed_at: string;
	dispatch_authority_enabled: false;
	providerCall: false;
	actualLaneLaunch: false;
	runtimeExecution: false;
}

export interface FlowDeskSdkAdapterCapabilitySmokeInputV1 {
	workflowId: string;
	attemptId: string;
	opencodeVersionRef: string;
	adapterProfileRef: string;
	client?: unknown;
	providerFamilyToOpenCodeProviderId?: Readonly<Record<string, unknown>>;
	observedAt?: string;
}

const DEFAULT_PROVIDER_FAMILY_TO_OPENCODE_PROVIDER_ID = {
	claude: "anthropic",
	openai: "openai",
	gemini: "google",
} as const;

const ALLOWED_OPENCODE_PROVIDER_IDS = new Set([
	"anthropic",
	"openai",
	"google",
]);

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function sessionSurface(value: unknown): Record<string, unknown> | undefined {
	const record = isRecord(value) ? value : undefined;
	return isRecord(record?.session) ? record.session : undefined;
}

function providerFamilyMappingValid(mapping: Readonly<Record<string, unknown>>): boolean {
	return Object.entries(DEFAULT_PROVIDER_FAMILY_TO_OPENCODE_PROVIDER_ID).every(
		([family, expectedProviderId]) =>
			mapping[family] === expectedProviderId &&
			ALLOWED_OPENCODE_PROVIDER_IDS.has(expectedProviderId),
	);
}

export function evaluateSdkAdapterCapabilitySmokeV1(
	input: FlowDeskSdkAdapterCapabilitySmokeInputV1,
): FlowDeskSdkAdapterCapabilitySmokeV1 {
	const session = sessionSurface(input.client);
	const promptMethodAvailable = typeof session?.prompt === "function";
	const promptAsyncMethodAvailable = typeof session?.promptAsync === "function";
	const absentClientBlocked = session === undefined;
	const missingMethodBlocked =
		!absentClientBlocked && !promptMethodAvailable && !promptAsyncMethodAvailable;
	const mappingValid = providerFamilyMappingValid(
		input.providerFamilyToOpenCodeProviderId ??
			DEFAULT_PROVIDER_FAMILY_TO_OPENCODE_PROVIDER_ID,
	);
	const capabilitySmokePassed =
		!absentClientBlocked &&
		!missingMethodBlocked &&
		(promptMethodAvailable || promptAsyncMethodAvailable) &&
		mappingValid;

	return {
		schema_version: "flowdesk.sdk_adapter_capability_smoke.v1",
		workflow_id: input.workflowId,
		attempt_id: input.attemptId,
		opencode_version_ref: input.opencodeVersionRef,
		adapter_profile_ref: input.adapterProfileRef,
		prompt_method_available: promptMethodAvailable,
		promptAsync_method_available: promptAsyncMethodAvailable,
		provider_family_mapping_valid: mappingValid,
		missing_method_blocked: missingMethodBlocked,
		absent_client_blocked: absentClientBlocked,
		capability_smoke_passed: capabilitySmokePassed,
		observed_at: input.observedAt ?? new Date().toISOString(),
		dispatch_authority_enabled: false,
		providerCall: false,
		actualLaneLaunch: false,
		runtimeExecution: false,
	};
}

export function validateFlowDeskSdkAdapterCapabilitySmokeV1(
	value: unknown,
): ValidationResult {
	if (!isRecord(value))
		return invalid("sdk adapter capability smoke record must be an object");
	const record = value as Partial<FlowDeskSdkAdapterCapabilitySmokeV1>;
	const errors: string[] = [];
	const allowed = new Set([
		"schema_version",
		"workflow_id",
		"attempt_id",
		"opencode_version_ref",
		"adapter_profile_ref",
		"prompt_method_available",
		"promptAsync_method_available",
		"provider_family_mapping_valid",
		"missing_method_blocked",
		"absent_client_blocked",
		"capability_smoke_passed",
		"observed_at",
		"dispatch_authority_enabled",
		"providerCall",
		"actualLaneLaunch",
		"runtimeExecution",
	]);
	for (const key of Object.keys(record))
		if (!allowed.has(key)) errors.push(`unknown properties: ${key}`);
	if (record.schema_version !== "flowdesk.sdk_adapter_capability_smoke.v1")
		errors.push("sdk adapter capability smoke schema_version is invalid");
	errors.push(...validateOpaqueId(record.workflow_id, "workflow_id").errors);
	errors.push(...validateOpaqueId(record.attempt_id, "attempt_id").errors);
	errors.push(
		...validateOpaqueRef(record.opencode_version_ref, "opencode_version_ref")
			.errors,
	);
	errors.push(
		...validateOpaqueRef(record.adapter_profile_ref, "adapter_profile_ref")
			.errors,
	);
	for (const field of [
		"prompt_method_available",
		"promptAsync_method_available",
		"provider_family_mapping_valid",
		"missing_method_blocked",
		"absent_client_blocked",
		"capability_smoke_passed",
	] as const) {
		if (typeof record[field] !== "boolean")
			errors.push(`${field} must be a boolean`);
	}
	if (
		typeof record.observed_at !== "string" ||
		!Number.isFinite(Date.parse(record.observed_at))
	)
		errors.push("observed_at must be a parseable timestamp");
	if (
		record.dispatch_authority_enabled !== false ||
		record.providerCall !== false ||
		record.actualLaneLaunch !== false ||
		record.runtimeExecution !== false
	)
		errors.push("sdk adapter capability smoke cannot enable runtime authority");
	if (record.absent_client_blocked === true && record.capability_smoke_passed === true)
		errors.push("absent client cannot pass capability smoke");
	if (record.missing_method_blocked === true && record.capability_smoke_passed === true)
		errors.push("missing prompt method cannot pass capability smoke");
	if (
		record.provider_family_mapping_valid === false &&
		record.capability_smoke_passed === true
	)
		errors.push("invalid provider family mapping cannot pass capability smoke");
	errors.push(
		...validateNoForbiddenRawPayloads(
			record,
			"sdk_adapter_capability_smoke_record",
		).errors,
	);
	return errors.length === 0 ? valid() : invalid(...errors);
}
