export type FlowDeskSessionMessagesProbeTransportV1 = "structured_path_id" | "legacy_session_id";

export type FlowDeskSessionMessagesProbeResultV1 =
	| {
		status: "ok";
		transport: FlowDeskSessionMessagesProbeTransportV1;
		response: unknown;
	}
	| {
		status: "unavailable";
		reason: "sdk_messages_not_available";
	}
	| {
		status: "failed";
		reason: "legacy_messages_api_error";
	};

export type FlowDeskReadOnlySessionMessagesClientV1 = {
	session?: {
		messages?: (options: {
			sessionID?: string;
			path?: { id: string };
			query?: { directory?: string };
		}) => unknown | Promise<unknown>;
	};
};

export interface FlowDeskReadOnlySessionMessagesProbeOptionsV1 {
	query?: { directory?: string };
	fallbackOnEmptyMessages?: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseData(value: unknown): unknown {
	return isRecord(value) && "data" in value ? value.data : value;
}

function isSdkMessagesErrorResponse(value: unknown): boolean {
	const record = isRecord(value) ? value : undefined;
	const data = responseData(value);
	const dataRecord = isRecord(data) ? data : undefined;
	return record?.error !== undefined || dataRecord?.error !== undefined;
}

function messageArray(value: unknown): unknown[] | undefined {
	const data = responseData(value);
	if (Array.isArray(data)) return data;
	const record = isRecord(data) ? data : undefined;
	if (Array.isArray(record?.messages)) return record.messages;
	if (Array.isArray(record?.items)) return record.items;
	return undefined;
}

function isEmptyMessagesResponse(value: unknown): boolean {
	const messages = messageArray(value);
	return messages !== undefined && messages.length === 0;
}

/**
 * Read-only OpenCode session.messages probe. OpenCode 1.17.5 expects the
 * structured `{ path: { id } }` shape; older SDK paths may still require the
 * legacy `{ sessionID }` shape. This helper always tries structured first,
 * falls back to legacy only after a structured throw/error response, and never
 * throws raw SDK errors to callers.
 */
export async function probeReadOnlySdkSessionMessagesV1(
	client: FlowDeskReadOnlySessionMessagesClientV1,
	sessionId: string,
	options: FlowDeskReadOnlySessionMessagesProbeOptionsV1 = {},
): Promise<FlowDeskSessionMessagesProbeResultV1> {
	const method = client.session?.messages;
	if (typeof method !== "function" || client.session === undefined) {
		return { status: "unavailable", reason: "sdk_messages_not_available" };
	}

	try {
		const structuredResponse = await method.call(client.session, { path: { id: sessionId }, ...(options.query === undefined ? {} : { query: options.query }) });
		if (!isSdkMessagesErrorResponse(structuredResponse) && (options.fallbackOnEmptyMessages !== true || !isEmptyMessagesResponse(structuredResponse))) {
			return {
				status: "ok",
				transport: "structured_path_id",
				response: structuredResponse,
			};
		}
	} catch {
		// Structured shape unavailable; bounded legacy fallback below.
	}

	try {
		const legacyResponse = await method.call(client.session, { sessionID: sessionId, ...(options.query === undefined ? {} : { query: options.query }) });
		if (!isSdkMessagesErrorResponse(legacyResponse)) {
			return {
				status: "ok",
				transport: "legacy_session_id",
				response: legacyResponse,
			};
		}
		return { status: "failed", reason: "legacy_messages_api_error" };
	} catch {
		return { status: "failed", reason: "legacy_messages_api_error" };
	}
}
