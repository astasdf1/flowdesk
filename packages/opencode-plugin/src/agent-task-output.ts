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
	return Array.isArray(data.messages) ? data.messages : [];
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
		const parts = Array.isArray(msgRec?.parts)
			? msgRec.parts
			: Array.isArray(info?.parts)
				? info.parts
				: [];
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
			if (role !== "assistant") continue;
			if (part.type !== undefined && part.type !== "text") continue;
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
