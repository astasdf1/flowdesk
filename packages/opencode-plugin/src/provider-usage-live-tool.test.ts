import assert from "node:assert/strict";
import { mkdtempSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	applyFlowDeskSessionEvidenceWriteIntentsV1,
	prepareFlowDeskSessionEvidenceWriteIntentV1,
} from "@flowdesk/core";
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

test("provider usage live reuses a fresh durable snapshot before collecting provider usage", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-usage-reuse-"));
	try {
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: "workflow-provider-usage-live",
			evidenceId: "provider-usage-snapshot-claude-20260524T000000000Z",
			record: {
				schema_version: "flowdesk.usage_snapshot.v1",
				snapshot_id: "usage-live-claude-20260524T000000000Z",
				provider_family: "claude",
				model_family: "sonnet-4",
				freshness: "fresh",
				freshness_ttl: 5,
				reset_time: "2026-05-24T05:00:00.000Z",
				reset_bucket: "80% until reset",
				dispatchability: "dispatchable",
				uncertainty_flags: [],
				source_ref: "usage-live-source-claude-20260524T000000000Z",
			},
		});
		assert.equal(prepared.ok, true);
		assert.ok(prepared.writeIntent);
		const applied = applyFlowDeskSessionEvidenceWriteIntentsV1(root, [
			prepared.writeIntent,
		]);
		assert.equal(applied.ok, true);

		const result = await executeFlowDeskProviderUsageLiveV1({
			config: {
				providers: ["claude"],
				homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
				durableStateRootDir: root,
				persistWorkflowId: "workflow-provider-usage-live",
			},
			request: { providerFamily: "claude" },
			now: fixedNow,
		});

		assert.equal(result.status, "provider_usage_live_collected");
		assert.deepEqual(result.snapshotReuse?.reusedEvidenceIds, [
			"provider-usage-snapshot-claude-20260524T000000000Z",
		]);
		assert.equal(result.providers.length, 1);
		assert.equal(result.providers[0]?.providerFamily, "claude");
		assert.equal(
			result.providers[0]?.usageSnapshotRef,
			"usage-live-claude-20260524T000000000Z",
		);
		assert.equal(result.providers[0]?.remainingPercent, 80);
		assert.equal(result.providers[0]?.alertLevel, "ok");
		assert.match(
			result.providers[0]?.recommendation ?? "",
			/Reused a fresh durable usage snapshot/i,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("provider usage live ignores expired durable snapshots", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-usage-expired-"));
	try {
		const prepared = prepareFlowDeskSessionEvidenceWriteIntentV1({
			workflowId: "workflow-provider-usage-live",
			evidenceId: "provider-usage-snapshot-claude-20260523T235000000Z",
			record: {
				schema_version: "flowdesk.usage_snapshot.v1",
				snapshot_id: "usage-live-claude-20260523T235000000Z",
				provider_family: "claude",
				model_family: "sonnet-4",
				freshness: "fresh",
				freshness_ttl: 5,
				reset_time: "2026-05-24T05:00:00.000Z",
				reset_bucket: "80% until reset",
				dispatchability: "dispatchable",
				uncertainty_flags: [],
				source_ref: "usage-live-source-claude-20260523T235000000Z",
			},
		});
		assert.equal(prepared.ok, true);
		assert.ok(prepared.writeIntent);
		assert.equal(
			applyFlowDeskSessionEvidenceWriteIntentsV1(root, [prepared.writeIntent]).ok,
			true,
		);

		const result = await executeFlowDeskProviderUsageLiveV1({
			config: {
				providers: ["claude"],
				homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
				durableStateRootDir: root,
				persistWorkflowId: "workflow-provider-usage-live",
			},
			request: { providerFamily: "claude" },
			now: fixedNow,
		});

		assert.deepEqual(result.snapshotReuse?.reusedEvidenceIds, []);
		assert.match(
			result.snapshotReuse?.skippedReasons.join("|") ?? "",
			/no fresh durable usage snapshot within TTL/i,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
