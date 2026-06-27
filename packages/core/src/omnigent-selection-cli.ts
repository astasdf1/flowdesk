import { readFileSync } from "node:fs";
import { selectFlowDeskOmnigentAgentModelV1, validateFlowDeskOmnigentSelectionV1 } from "./omnigent-selection.js";

function readStdin(): string {
	return readFileSync(0, "utf8");
}

function main(): void {
	let request: unknown;
	try {
		request = JSON.parse(readStdin());
	} catch {
		request = null;
	}
	const selection = selectFlowDeskOmnigentAgentModelV1(request && typeof request === "object" && !Array.isArray(request) ? request : null);
	const validation = validateFlowDeskOmnigentSelectionV1(selection);
	if (!validation.ok) {
		process.stdout.write(JSON.stringify({ ...selection, selection_status: "blocked", blocked_labels: ["ts_cli_invalid_response"], reason_codes: ["malformed_request_blocked"] }));
		process.stdout.write("\n");
		process.exitCode = 1;
		return;
	}
	process.stdout.write(JSON.stringify(selection));
	process.stdout.write("\n");
}

main();
