export const FLOWDESK_OMNIGENT_TRACE_VERIFICATION_SCHEMA_VERSION_V1 = "flowdesk.omnigent_trace_verification.v1" as const;

export type FlowDeskOmnigentTraceVerificationStatusV1 = "pass" | "fail";
export type FlowDeskOmnigentTraceIssueSeverityV1 = "error" | "warning";

export interface FlowDeskOmnigentTraceIssueV1 {
	severity: FlowDeskOmnigentTraceIssueSeverityV1;
	code: string;
	[key: string]: unknown;
}

export interface FlowDeskOmnigentTraceVerificationV1 {
	schema_version: typeof FLOWDESK_OMNIGENT_TRACE_VERIFICATION_SCHEMA_VERSION_V1;
	status: FlowDeskOmnigentTraceVerificationStatusV1;
	selection_count: number;
	dispatch_count: number;
	error_count: number;
	warning_count: number;
	issues: FlowDeskOmnigentTraceIssueV1[];
	authority: "verification_only";
}

export function validateFlowDeskOmnigentTraceVerificationV1(value: unknown): { ok: boolean; errors: string[] } {
	const errors: string[] = [];
	if (!value || typeof value !== "object" || Array.isArray(value)) return { ok: false, errors: ["trace verification must be an object"] };
	const record = value as Record<string, unknown>;
	if (record.schema_version !== FLOWDESK_OMNIGENT_TRACE_VERIFICATION_SCHEMA_VERSION_V1) errors.push("schema_version must be flowdesk.omnigent_trace_verification.v1");
	if (record.authority !== "verification_only") errors.push("authority must be verification_only");
	if (record.status !== "pass" && record.status !== "fail") errors.push("status must be pass or fail");
	for (const field of ["selection_count", "dispatch_count", "error_count", "warning_count"]) {
		if (!Number.isInteger(record[field]) || Number(record[field]) < 0) errors.push(`${field} must be a non-negative integer`);
	}
	if (!Array.isArray(record.issues)) {
		errors.push("issues must be an array");
	} else {
		let observedErrors = 0;
		let observedWarnings = 0;
		for (const issue of record.issues) {
			if (!issue || typeof issue !== "object" || Array.isArray(issue)) {
				errors.push("issue must be an object");
				continue;
			}
			const entry = issue as Record<string, unknown>;
			if (entry.severity === "error") observedErrors += 1;
			else if (entry.severity === "warning") observedWarnings += 1;
			else errors.push("issue severity must be error or warning");
			if (typeof entry.code !== "string" || !/^[a-z0-9_]{1,80}$/.test(entry.code)) errors.push("issue code must be a bounded safe label");
			if (Object.values(entry).some((value) => typeof value === "string" && forbiddenRawMarker(value))) errors.push("issue contains forbidden raw marker");
		}
		if (Number.isInteger(record.error_count) && record.error_count !== observedErrors) errors.push("error_count must match issues");
		if (Number.isInteger(record.warning_count) && record.warning_count !== observedWarnings) errors.push("warning_count must match issues");
	}
	if (record.status === "pass" && record.error_count !== 0) errors.push("pass status requires zero errors");
	if (record.status === "fail" && record.error_count === 0) errors.push("fail status requires at least one error");
	return { ok: errors.length === 0, errors };
}

function forbiddenRawMarker(value: string): boolean {
	return /SECRET|BEGIN|TOKEN|API_KEY|oauth_creds|auth\.json|raw prompt/i.test(value);
}
