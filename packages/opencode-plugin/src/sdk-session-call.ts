export type FlowDeskSdkSessionCallOptionsV1<TBody = unknown> = {
	path?: { id: string };
	sessionID?: string;
	query?: { directory?: string };
	body?: TBody;
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseData(value: unknown): unknown {
	return isRecord(value) && "data" in value ? value.data : value;
}

export function flowDeskSdkSessionPathOptionsV1<TBody = unknown>(input: {
	sessionId: string;
	directory?: string;
	body?: TBody;
}): FlowDeskSdkSessionCallOptionsV1<TBody> {
	return {
		path: { id: input.sessionId },
		...(input.directory === undefined ? {} : { query: { directory: input.directory } }),
		...(input.body === undefined ? {} : { body: input.body }),
	};
}

export function flowDeskSdkSessionLegacyOptionsV1<TBody = unknown>(input: {
	sessionId: string;
	directory?: string;
	body?: TBody;
}): FlowDeskSdkSessionCallOptionsV1<TBody> {
	return {
		sessionID: input.sessionId,
		...(input.directory === undefined ? {} : { query: { directory: input.directory } }),
		...(input.body === undefined ? {} : { body: input.body }),
	};
}

export function isFlowDeskSdkErrorResponseV1(value: unknown): boolean {
	const record = isRecord(value) ? value : undefined;
	const data = responseData(value);
	const dataRecord = isRecord(data) ? data : undefined;
	return record?.error !== undefined || dataRecord?.error !== undefined;
}

/**
 * OpenCode 1.17.x session APIs expect structured `{ path: { id } }` session
 * routes. Keep legacy `{ sessionID }` only as a bounded fallback for older SDK
 * surfaces. This helper intentionally does not log or reformat raw SDK errors;
 * callers must catch and return redacted FlowDesk statuses when both attempts
 * fail.
 */
export async function callFlowDeskSdkWithLegacyFallbackV1(
	method: (options: unknown) => unknown | Promise<unknown>,
	thisArg: unknown,
	currentOptions: unknown,
	legacyOptions: unknown,
): Promise<unknown> {
	let current: unknown;
	try {
		current = await method.call(thisArg, currentOptions);
	} catch {
		return method.call(thisArg, legacyOptions);
	}
	if (!isFlowDeskSdkErrorResponseV1(current)) return current;
	return method.call(thisArg, legacyOptions);
}
