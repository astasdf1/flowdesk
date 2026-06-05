import assert from "node:assert/strict";
import test from "node:test";
import { formatFlowDeskTuiSidebarCompactLines } from "./tui-sidebar-format.js";

test("TUI sidebar compact lines omit completion wake notices and blank reservation", () => {
	const lines = formatFlowDeskTuiSidebarCompactLines({
		usageLines: ["CL Sonnet 90% 5h", "OA 5.5 42% 5h", "GM Pro 80% day"],
		observedLine: "updated 12:34:56",
		statusLine: "cache readable",
		autoNextLines: [],
		subtaskLines: ["Subtasks:", "… 12:30 Repo scan", "✓ 12:31 Review API", "! 12:32 Slow lane"],
	});

	assert.deepEqual(lines, [
		"CL Sonnet 90% 5h",
		"OA 5.5 42% 5h",
		"GM Pro 80% day",
		"updated 12:34:56",
		"cache readable",
		"",
		"Subtasks:",
		"… 12:30 Repo scan",
		"✓ 12:31 Review API",
		"! 12:32 Slow lane",
	]);
	assert.equal(lines.some((line) => line.startsWith("FlowDesk ready")), false);
	assert.equal(lines.filter((line) => line === "").length, 1);
});
