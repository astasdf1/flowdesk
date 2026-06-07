import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import {
	decodeFlowDeskRoutingAdvisoryLedgerJsonlV1,
	type FlowDeskRoutingAdvisoryLedgerEntryV1,
} from "@flowdesk/core";

/**
 * Load the routing advisory ledger from disk.
 * Advisory-only reader.
 */
export function loadRoutingAdvisoryLedgerV1(rootDir: string): FlowDeskRoutingAdvisoryLedgerEntryV1[] {
	const ledgerPath = join(rootDir, ".flowdesk", "oi", "routing-advisory.jsonl");
	if (!existsSync(ledgerPath)) return [];
	
	try {
		const jsonl = readFileSync(ledgerPath, "utf8");
		const decode = decodeFlowDeskRoutingAdvisoryLedgerJsonlV1(jsonl);
		return decode.ok && decode.entries ? decode.entries : [];
	} catch {
		return [];
	}
}
