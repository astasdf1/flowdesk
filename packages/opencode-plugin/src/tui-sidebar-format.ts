export function formatFlowDeskTuiSidebarCompactLines(input: {
	usageLines: readonly string[];
	observedLine: string;
	statusLine: string;
	autoNextLines: readonly string[];
	subtaskLines: readonly string[];
}): readonly string[] {
	const lines: string[] = [];
	for (const line of input.usageLines) lines.push(line);
	lines.push(input.observedLine);
	lines.push(input.statusLine);
	if (input.autoNextLines.length > 0 || input.subtaskLines.length > 0) lines.push("");
	for (const line of input.autoNextLines) lines.push(line);
	for (const line of input.subtaskLines) lines.push(line);
	return lines;
}
