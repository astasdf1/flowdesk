import assert from "node:assert/strict";
import {
	mkdirSync,
	mkdtempSync,
	readFileSync,
	rmSync,
	statSync,
	writeFileSync,
} from "node:fs";
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
		assert.ok(row.providerHealth);
		assert.equal(typeof row.providerHealth?.snapshotRef, "string");
		assert.equal(typeof row.providerHealth?.sourceSurface, "string");
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
		assert.ok(result.sidebarCachePersistence);
		assert.equal(result.sidebarCachePersistence?.persisted, true);
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
		const allowedReason = /usage authority not acquired|collector result missing|provider health snapshot not persisted/;
		for (const reason of skipped) assert.match(reason, allowedReason);
		const evidenceDir = join(
			root,
			".flowdesk/sessions/workflow-provider-usage-live/evidence/provider-usage-snapshot",
		);
		if (persisted.some((id) => id.startsWith("provider-usage-snapshot-"))) {
			const stat = statSync(evidenceDir);
			assert.equal(stat.isDirectory(), true);
		}
		if (persisted.some((id) => id.startsWith("provider-health-snapshot-"))) {
			const healthEvidenceDir = join(
				root,
				".flowdesk/sessions/workflow-provider-usage-live/evidence/provider-health-snapshot",
			);
			const stat = statSync(healthEvidenceDir);
			assert.equal(stat.isDirectory(), true);
		}
		const sidebarCache = JSON.parse(
			readFileSync(join(root, ".flowdesk/ui/provider-usage-sidebar.json"), "utf8"),
		) as Record<string, unknown>;
		assert.equal(sidebarCache.schema_version, "flowdesk.provider_usage_sidebar_cache.v1");
		assert.equal(Array.isArray(sidebarCache.providers), true);
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
		assert.equal(result.providers[0]?.providerHealth?.freshness, "fresh");
		assert.equal(result.providers[0]?.providerHealth?.dispatchability, "dispatchable");
		assert.match(
			result.providers[0]?.recommendation ?? "",
			/Reused a fresh durable usage snapshot/i,
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("provider usage live preserves sidebar cache percent when reusing bucket-label snapshot", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-usage-sidebar-reuse-"));
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
				reset_bucket: "claude-5h",
				dispatchability: "dispatchable",
				uncertainty_flags: [],
				source_ref: "usage-live-source-claude-20260524T000000000Z",
			},
		});
		assert.equal(prepared.ok, true);
		assert.ok(prepared.writeIntent);
		assert.equal(
			applyFlowDeskSessionEvidenceWriteIntentsV1(root, [prepared.writeIntent]).ok,
			true,
		);

		const uiDir = join(root, ".flowdesk/ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
					observed_at: "2026-05-24T00:00:00.000Z",
					expires_at: "2026-05-24T00:05:00.000Z",
					providers: [
						{
							providerFamily: "claude",
							connected: true,
							dispatchability: "dispatchable",
							freshness: "fresh",
							resetBucket: "claude-5h",
							resetTime: "2026-05-24T05:00:00.000Z",
							remainingPercent: 77,
							alertLevel: "ok",
							usageSnapshotRef: "usage-live-claude-20260524T000000000Z",
							uncertaintyFlags: [],
						},
					],
					authority: {
						realOpenCodeDispatch: false,
						providerCall: false,
						runtimeExecution: false,
						actualLaneLaunch: false,
						fallbackAuthority: false,
						hardCancelOrNoReplyAuthority: false,
					},
				},
				null,
				2,
			)}\n`,
			"utf8",
		);

		const result = await executeFlowDeskProviderUsageLiveV1({
			config: {
				providers: ["claude"],
				homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
				durableStateRootDir: root,
				persistSidebarCache: true,
				persistWorkflowId: "workflow-provider-usage-live",
			},
			request: { providerFamily: "claude" },
			now: fixedNow,
		});

		assert.deepEqual(result.snapshotReuse?.reusedEvidenceIds, [
			"provider-usage-snapshot-claude-20260524T000000000Z",
		]);
		assert.equal(result.providers[0]?.remainingPercent, 77);
		assert.equal(result.providers[0]?.alertLevel, "ok");
		assert.match(result.providers[0]?.recommendation ?? "", /preserved 77\.0%/i);
		const rewritten = JSON.parse(
			readFileSync(join(uiDir, "provider-usage-sidebar.json"), "utf8"),
		) as { providers?: Array<{ remainingPercent?: unknown; alertLevel?: unknown }> };
		assert.equal(rewritten.providers?.[0]?.remainingPercent, 77);
		assert.equal(rewritten.providers?.[0]?.alertLevel, "ok");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("provider usage live preserves fresh sidebar row when refresh fails", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-usage-sidebar-failure-"));
	try {
		const uiDir = join(root, ".flowdesk/ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
					observed_at: "2026-05-24T00:00:00.000Z",
					expires_at: "2026-05-24T00:05:00.000Z",
					providers: [
						{
							providerFamily: "openai",
							connected: true,
							dispatchability: "dispatchable",
							freshness: "fresh",
							resetBucket: "openai-gpt-5h",
							resetTime: "2026-05-24T05:00:00.000Z",
							remainingPercent: 64,
							alertLevel: "ok",
							modelFamily: "gpt-5",
							usageSnapshotRef: "usage-live-openai-20260524T000000000Z",
							uncertaintyFlags: [],
						},
					],
					authority: {
						realOpenCodeDispatch: false,
						providerCall: false,
						runtimeExecution: false,
						actualLaneLaunch: false,
						fallbackAuthority: false,
						hardCancelOrNoReplyAuthority: false,
					},
				},
				null,
				2,
			)}\n`,
			"utf8",
		);

		const result = await executeFlowDeskProviderUsageLiveV1({
			config: {
				providers: ["openai"],
				homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
				durableStateRootDir: root,
				persistSidebarCache: true,
				persistWorkflowId: "workflow-provider-usage-live",
			},
			request: { providerFamily: "openai" },
			now: fixedNow,
		});

		assert.equal(result.providers[0]?.dispatchability, "dispatchable");
		assert.equal(result.providers[0]?.freshness, "fresh");
		assert.equal(result.providers[0]?.remainingPercent, 64);
		assert.equal(
			result.providers[0]?.usageSnapshotRef,
			"usage-live-openai-20260524T000000000Z",
		);
		assert.match(result.providers[0]?.recommendation ?? "", /kept the previous fresh usage snapshot/i);
		const rewritten = JSON.parse(
			readFileSync(join(uiDir, "provider-usage-sidebar.json"), "utf8"),
		) as { providers?: Array<{ dispatchability?: unknown; remainingPercent?: unknown; usageSnapshotRef?: unknown }> };
		assert.equal(rewritten.providers?.[0]?.dispatchability, "dispatchable");
		assert.equal(rewritten.providers?.[0]?.remainingPercent, 64);
		assert.equal(
			rewritten.providers?.[0]?.usageSnapshotRef,
			"usage-live-openai-20260524T000000000Z",
		);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("provider usage live preserves fresh sidebar bucket when primary row refresh fails", async () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-provider-usage-sidebar-bucket-"));
	try {
		const uiDir = join(root, ".flowdesk/ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
					observed_at: "2026-05-24T00:00:00.000Z",
					expires_at: "2026-05-24T00:05:00.000Z",
					providers: [
						{
							providerFamily: "openai",
							connected: false,
							dispatchability: "non_dispatchable",
							freshness: "unknown",
							resetBucket: "unknown",
							resetTime: "unknown",
							remainingPercent: null,
							alertLevel: "unknown",
							modelFamily: "gpt-5",
							usageSnapshotRef: "usage-live-openai-failed-20260524T000000000Z",
							uncertaintyFlags: ["unknown"],
							buckets: [
								{
									resetBucket: "openai-weekly",
									resetTime: "2026-05-31T10:05:59.000Z",
									remainingPercent: 34,
									freshness: "fresh",
									dispatchability: "dispatchable",
									connected: true,
									usageSnapshotRef: "usage-live-openai-20260524T000000000Z",
								},
							],
						},
					],
					authority: {
						realOpenCodeDispatch: false,
						providerCall: false,
						runtimeExecution: false,
						actualLaneLaunch: false,
						fallbackAuthority: false,
						hardCancelOrNoReplyAuthority: false,
					},
				},
				null,
				2,
			)}\n`,
			"utf8",
		);

		const result = await executeFlowDeskProviderUsageLiveV1({
			config: {
				providers: ["openai"],
				homeDir: "/tmp/flowdesk-no-such-dir-for-tests",
				durableStateRootDir: root,
				persistSidebarCache: true,
				persistWorkflowId: "workflow-provider-usage-live",
			},
			request: { providerFamily: "openai" },
			now: fixedNow,
		});

		assert.equal(result.providers[0]?.dispatchability, "dispatchable");
		assert.equal(result.providers[0]?.freshness, "fresh");
		assert.equal(result.providers[0]?.resetBucket, "openai-weekly");
		assert.equal(result.providers[0]?.remainingPercent, 34);
		assert.equal(
			result.providers[0]?.usageSnapshotRef,
			"usage-live-openai-20260524T000000000Z",
		);
		const rewritten = JSON.parse(
			readFileSync(join(uiDir, "provider-usage-sidebar.json"), "utf8"),
		) as { providers?: Array<{ resetBucket?: unknown; remainingPercent?: unknown }> };
		assert.equal(rewritten.providers?.[0]?.resetBucket, "openai-weekly");
		assert.equal(rewritten.providers?.[0]?.remainingPercent, 34);
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
