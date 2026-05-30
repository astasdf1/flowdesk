export type FlowDeskAgentTaskCompletionStatusV1 = "final" | "partial";
export type FlowDeskAgentTaskOutputKindV1 =
	| "final_answer"
	| "partial_findings"
	| "process_notes"
	| "tool_trace_only"
	| "empty";

export interface FlowDeskAgentTaskOutputObservationV1 {
	latestText: string | undefined;
	terminalObserved: boolean;
	terminalReason: string | undefined;
	hasRunningTool: boolean;
	textPartCount: number;
	reasoningPartCount: number;
	messageCount: number;
	outputKind: FlowDeskAgentTaskOutputKindV1;
	usableForSynthesis: boolean;
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

function responseData(value: unknown): unknown {
	return isRecord(value) && "data" in value ? value.data : value;
}

export function flowDeskAgentTaskMessageItems(value: unknown): unknown[] {
	const data = responseData(value);
	if (Array.isArray(data)) return data;
	if (!isRecord(data)) return [];
	if (Array.isArray(data.items)) return data.items;
	if (Array.isArray(data.messages)) return data.messages;
	// Gemini candidates wrapper: { candidates: [{ content: { role, parts }, finishReason }] }
	if (Array.isArray(data.candidates)) {
		const msgs: unknown[] = [];
		for (const candidate of data.candidates) {
			if (!isRecord(candidate)) continue;
			const content = isRecord(candidate.content) ? candidate.content : candidate;
			const finishReason = typeof candidate.finishReason === "string" ? candidate.finishReason
				: typeof candidate.finish_reason === "string" ? candidate.finish_reason : undefined;
			msgs.push({ ...content, _finishReason: finishReason });
		}
		return msgs;
	}
	return [];
}

function partText(part: Record<string, unknown>): string | undefined {
	if (typeof part.text === "string") return part.text;
	return typeof part.content === "string" ? part.content : undefined;
}

function isTerminalPart(part: Record<string, unknown>): boolean {
	const type = typeof part.type === "string" ? part.type : "";
	const reason = typeof part.reason === "string" ? part.reason : "";
	return (
		(type === "step-finish" || type === "step_finish" || type === "finish") &&
		(reason === "stop" || reason === "complete" || reason === "completed")
	);
}

/** Check message-level terminal signals (OpenAI finish_reason, Gemini finishReason). */
function isTerminalMessage(msg: Record<string, unknown>): { terminal: boolean; reason: string | undefined } {
	// OpenAI: finish_reason at message or choice level
	const fr = typeof msg.finish_reason === "string" ? msg.finish_reason
		: typeof msg.finishReason === "string" ? msg.finishReason
		: typeof msg._finishReason === "string" ? msg._finishReason : undefined;
	if (fr !== undefined) {
		const normalized = fr.toLowerCase();
		if (normalized === "stop" || normalized === "end_turn" || normalized === "complete" || normalized === "completed") {
			return { terminal: true, reason: fr };
		}
	}
	// OpenAI status field
	if (msg.status === "completed" || msg.status === "complete") {
		return { terminal: true, reason: String(msg.status) };
	}
	return { terminal: false, reason: undefined };
}

function terminalReason(part: Record<string, unknown>): string | undefined {
	return typeof part.reason === "string" ? part.reason : undefined;
}

function partHasRunningTool(part: Record<string, unknown>): boolean {
	if (part.type === "tool" || part.tool !== undefined) {
		const state = isRecord(part.state) ? part.state : undefined;
		return state?.status === "running" || part.status === "running";
	}
	return false;
}

export function classifyFlowDeskAgentTaskOutputKindV1(text: string | undefined): FlowDeskAgentTaskOutputKindV1 {
	const normalized = text?.trim().toLowerCase() ?? "";
	if (normalized.length === 0) return "empty";
	if (normalized.includes("{") && normalized.includes("}")) return "final_answer";
	const processFragments = [
		"i need to",
		"i should",
		"i'll ",
		"i will ",
		"let me",
		"thinking",
		"planning",
		"investigating",
		"clarifying",
		"considering",
		"i’m thinking",
	];
	if (processFragments.some(fragment => normalized.includes(fragment))) return "process_notes";
	const findingFragments = ["finding", "risk", "issue", "recommend", "verdict", "summary", "plan", "fix"];
	if (findingFragments.some(fragment => normalized.includes(fragment))) return "partial_findings";
	return "final_answer";
}

export function observeFlowDeskAgentTaskOutputV1(response: unknown): FlowDeskAgentTaskOutputObservationV1 {
	const items = flowDeskAgentTaskMessageItems(response);
	let latestText: string | undefined;
	let terminalObserved = false;
	let observedTerminalReason: string | undefined;
	let hasRunningTool = false;
	let textPartCount = 0;
	let reasoningPartCount = 0;

	for (const msg of items) {
		const msgRec = isRecord(msg) ? msg : undefined;
		const info = isRecord(msgRec?.info) ? msgRec.info : msgRec;
		const role = info?.role;
		// Accept "assistant" and "model" (Gemini uses "model" for assistant role)
		const isAssistantRole = role === "assistant" || role === "model";

		// Check message-level terminal signals (OpenAI/Gemini)
		if (msgRec !== undefined) {
			const msgTerminal = isTerminalMessage(msgRec);
			if (!msgTerminal.terminal && info !== undefined && info !== msgRec) {
				const infoTerminal = isTerminalMessage(info as Record<string, unknown>);
				if (infoTerminal.terminal) {
					terminalObserved = true;
					observedTerminalReason = infoTerminal.reason;
				}
			} else if (msgTerminal.terminal) {
				terminalObserved = true;
				observedTerminalReason = msgTerminal.reason;
			}
		}

		// Collect parts from msg.parts, msg.info.parts, or msg.content (when content is array of parts)
		let parts: unknown[] = Array.isArray(msgRec?.parts)
			? msgRec!.parts
			: Array.isArray(info?.parts)
				? info!.parts
				: [];
		// OpenAI multi-part content: content is array of part objects
		if (parts.length === 0 && msgRec !== undefined && Array.isArray(msgRec.content)) {
			parts = msgRec.content;
		}

		// Message-level content string (OpenAI Chat Completions: { role: "assistant", content: "..." })
		if (parts.length === 0 && isAssistantRole && msgRec !== undefined && typeof msgRec.content === "string" && msgRec.content.trim().length > 0) {
			latestText = msgRec.content as string;
			textPartCount++;
		}
		// Also check info-level content string
		if (parts.length === 0 && isAssistantRole && info !== undefined && info !== msgRec && typeof info.content === "string" && (info.content as string).trim().length > 0) {
			latestText = info.content as string;
			textPartCount++;
		}

		for (const rawPart of parts) {
			const part = isRecord(rawPart) ? rawPart : undefined;
			if (part === undefined) continue;
			if (isTerminalPart(part)) {
				terminalObserved = true;
				observedTerminalReason = terminalReason(part);
			}
			if (partHasRunningTool(part)) hasRunningTool = true;
			if (part.type === "reasoning") {
				reasoningPartCount++;
				continue;
			}
			if (!isAssistantRole) continue;
			// Accept text, output_text (OpenAI Responses API), or undefined type
			if (part.type !== undefined && part.type !== "text" && part.type !== "output_text") continue;
			const text = partText(part);
			if (typeof text === "string" && text.trim().length > 0) {
				latestText = text;
				textPartCount++;
			}
		}
	}

	const outputKind = classifyFlowDeskAgentTaskOutputKindV1(latestText);
	return {
		latestText,
		terminalObserved,
		terminalReason: observedTerminalReason,
		hasRunningTool,
		textPartCount,
		reasoningPartCount,
		messageCount: items.length,
		outputKind,
		usableForSynthesis: outputKind !== "empty" && outputKind !== "tool_trace_only",
	};
}
