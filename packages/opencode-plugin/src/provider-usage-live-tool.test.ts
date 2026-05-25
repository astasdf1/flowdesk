import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { executeFlowDeskProviderUsageLiveV1 } from "./provider-usage-live-tool.js";

const fixedNow = () => new Date("2026-05-24T00:00:00.000Z");

const validAlertLevels = new Set([
	"ok",
	"warning",
	"critical",
	"exhausted",
	"stale",
	"unknown",
]);

test("provider usage live result includes per-row alertLevel and overall recommendation", async () => {
	const result = await executeFlowDeskProviderUsageLiveV1({
		config: {
			providers: ["claude", "openai", "gemini"],
			homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
		},
		request: { providerFamily: "all" },
		now: fixedNow,
	});
	assert.equal(result.status, "provider_usage_live_collected");
	assert.equal(result.resolvedProviderFamilies.length, 3);
	for (const row of result.providers) {
		assert.equal(typeof row.alertLevel, "string");
		assert.ok(
			validAlertLevels.has(row.alertLevel),
			`unexpected alertLevel: ${row.alertLevel}`,
		);
		assert.equal(typeof row.recommendation, "string");
		assert.ok(row.recommendation.length > 0);
	}
	assert.ok(validAlertLevels.has(result.worstAlertLevel));
	assert.equal(typeof result.overallRecommendation, "string");
	assert.ok(result.overallRecommendation.length > 0);
});

test("provider usage live result blocks before collector when no provider family is configured", async () => {
	const result = await executeFlowDeskProviderUsageLiveV1({
		config: { providers: [] },
		request: { providerFamily: "all" },
		now: fixedNow,
	});
	assert.equal(result.status, "blocked_before_provider_usage_live");
	assert.equal(result.worstAlertLevel, "unknown");
	assert.match(
		result.overallRecommendation,
		/at least one of claude\/openai\/gemini/i,
	);
});

test("provider usage live persistence is opt-in and reports missing durable root before write", async () => {
	const defaultRun = await executeFlowDeskProviderUsageLiveV1({
		config: {
			providers: ["claude", "openai", "gemini"],
			homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
		},
		request: { providerFamily: "all" },
		now: fixedNow,
	});
	assert.equal(defaultRun.snapshotPersistence, undefined);

	const missingRoot = await executeFlowDeskProviderUsageLiveV1({
		config: {
			providers: ["claude", "openai", "gemini"],
			homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
			persistSnapshots: true,
		},
		request: { providerFamily: "all" },
		now: fixedNow,
	});
	assert.ok(missingRoot.snapshotPersistence);
	assert.equal(missingRoot.snapshotPersistence?.requested, true);
	assert.equal(missingRoot.snapshotPersistence?.durableStateRootConfigured, false);
	assert.deepEqual(missingRoot.snapshotPersistence?.persistedEvidenceIds, []);
	assert.match(
		missingRoot.snapshotPersistence?.skippedReasons.join("|") ?? "",
		/no durable state root configured/i,
	);
});

test("provider usage live persistence reports durable root, workflow id, and an acquired/skipped split", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-usage-persist-"));
	try {
		const result = await executeFlowDeskProviderUsageLiveV1({
			config: {
				providers: ["claude", "openai", "gemini"],
				homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
				persistSnapshots: true,
				durableStateRootDir: root,
				persistWorkflowId: "workflow-provider-usage-live",
			},
			request: { providerFamily: "all" },
			now: fixedNow,
		});
		assert.equal(result.status, "provider_usage_live_collected");
		assert.ok(result.snapshotPersistence);
		assert.equal(result.snapshotPersistence?.requested, true);
		assert.equal(
			result.snapshotPersistence?.durableStateRootConfigured,
			true,
		);
		assert.equal(
			result.snapshotPersistence?.workflowId,
			"workflow-provider-usage-live",
		);
		const persisted = result.snapshotPersistence?.persistedEvidenceIds ?? [];
		const skipped = result.snapshotPersistence?.skippedReasons ?? [];
		const allowedReason = /usage authority not acquired|collector result missing/;
		for (const reason of skipped) assert.match(reason, allowedReason);
		const evidenceDir = join(
			root,
			".flowdesk/sessions/workflow-provider-usage-live/evidence/provider-usage-snapshot",
		);
		if (persisted.length > 0) {
			const stat = statSync(evidenceDir);
			assert.equal(stat.isDirectory(), true);
		}
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
