import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import { persistProviderUsageHealthEvidenceV1 } from "./provider-evidence-writer.js";
import { reloadFlowDeskSessionEvidenceV1 } from "./session-evidence.js";

function withTempRoot<T>(run: (rootDir: string) => T): T {
	const rootDir = mkdtempSync(path.join(tmpdir(), "flowdesk-provider-evidence-"));
	try {
		return run(rootDir);
	} finally {
		rmSync(rootDir, { recursive: true, force: true });
	}
}

function baseInput(rootDir: string) {
	return {
		workflowId: "workflow-provider-evidence-1",
		attemptId: "attempt-provider-evidence-1",
		providerFamily: "claude" as const,
		remainingPercent: 88,
		alertLevel: "ok" as const,
		resetTime: "2026-06-15T12:00:00.000Z",
		dispatchability: "dispatchable" as const,
		snapshotRef: "provider-snapshot-1",
		observedAt: "2026-06-15T10:00:00.000Z",
		rootDir,
	};
}

test("valid fresh dispatchable evidence writes both records and reloads correctly", () => {
	withTempRoot((rootDir) => {
		const result = persistProviderUsageHealthEvidenceV1(baseInput(rootDir));
		assert.equal(result.ok, true, result.errors.join("\n"));

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-provider-evidence-1", rootDir });
		assert.equal(reloaded.ok, true, reloaded.errors.join("\n"));
		assert.equal(reloaded.entries.some((entry) => entry.evidenceClass === "provider_usage_snapshot" && entry.evidenceId === result.usageEvidenceId), true);
		assert.equal(reloaded.entries.some((entry) => entry.evidenceClass === "provider_health_snapshot" && entry.evidenceId === result.healthEvidenceId), true);

		const health = reloaded.entries.find((entry) => entry.evidenceId === result.healthEvidenceId)?.record as Record<string, unknown> | undefined;
		assert.equal(health?.dispatchability, "dispatchable");
	});
});

test("stale/exhausted evidence writes health record with dispatchable=false", () => {
	withTempRoot((rootDir) => {
		const result = persistProviderUsageHealthEvidenceV1({
			...baseInput(rootDir),
			alertLevel: "stale",
			snapshotRef: "provider-snapshot-stale",
		});
		assert.equal(result.ok, true, result.errors.join("\n"));

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-provider-evidence-1", rootDir });
		const health = reloaded.entries.find((entry) => entry.evidenceId === result.healthEvidenceId)?.record as Record<string, unknown> | undefined;
		assert.equal(health?.dispatchability, "non_dispatchable");
	});
});

test("authority flags always false", () => {
	withTempRoot((rootDir) => {
		const result = persistProviderUsageHealthEvidenceV1({
			...baseInput(rootDir),
			alertLevel: "exhausted",
			remainingPercent: 0,
			snapshotRef: "provider-snapshot-exhausted",
		});
		assert.equal(result.ok, true, result.errors.join("\n"));

		const reloaded = reloadFlowDeskSessionEvidenceV1({ workflowId: "workflow-provider-evidence-1", rootDir });
		const records = reloaded.entries
			.filter((entry) => entry.evidenceId === result.usageEvidenceId || entry.evidenceId === result.healthEvidenceId)
			.map((entry) => entry.record as Record<string, unknown>);
		assert.equal(records.length, 2);
		for (const record of records) {
			// usage/health snapshot schema does not carry authority flags — absence is the correct boundary
			assert.equal(record.dispatch_authority_enabled, undefined);
			assert.equal(record.providerCall, undefined);
			assert.equal(record.actualLaneLaunch, undefined);
			assert.equal(record.runtimeExecution, undefined);
		}
	});
});
