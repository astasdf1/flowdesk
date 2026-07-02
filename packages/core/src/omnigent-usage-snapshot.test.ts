import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import type { FlowDeskProviderUsageCollectorResultV1 } from "./provider-usage-collector.js";
import { buildFlowDeskOmnigentUsageBridgeRowV1, buildFlowDeskOmnigentUsageBridgeSnapshotV1 } from "./index.js";

function resultWithBucket(bucket: FlowDeskProviderUsageCollectorResultV1["bucketSnapshot"]): FlowDeskProviderUsageCollectorResultV1 {
	return { ok: true, source_kind: "provider_native", usageSnapshot: {} as never, providerHealthSnapshot: {} as never, bucketSnapshot: bucket };
}

test("bridge row maps remaining thresholds to the live-tool alert levels", () => {
	assert.deepEqual(buildFlowDeskOmnigentUsageBridgeRowV1(resultWithBucket({ resetBucket: "5h", remainingPercent: 0, uncertainty: "available" })), { alert_level: "exhausted", remaining_percent: 0 });
	assert.deepEqual(buildFlowDeskOmnigentUsageBridgeRowV1(resultWithBucket({ resetBucket: "5h", remainingPercent: 10, uncertainty: "available" })).alert_level, "critical");
	assert.deepEqual(buildFlowDeskOmnigentUsageBridgeRowV1(resultWithBucket({ resetBucket: "5h", remainingPercent: 30, uncertainty: "available" })).alert_level, "warning");
	assert.deepEqual(buildFlowDeskOmnigentUsageBridgeRowV1(resultWithBucket({ resetBucket: "5h", remainingPercent: 31, uncertainty: "available" })).alert_level, "ok");
});

test("bridge row clamps out-of-range remaining and keeps reset_time bounded", () => {
	const row = buildFlowDeskOmnigentUsageBridgeRowV1(resultWithBucket({ resetBucket: "5h", remainingPercent: 140, resetAt: `2026-07-02T05:00:00.000Z${"x".repeat(200)}`, uncertainty: "available" }));
	assert.equal(row.remaining_percent, 100);
	assert.ok(row.reset_time !== undefined && row.reset_time.length <= 120);
});

test("bridge row degrades stale/refused/missing without fabricating numbers", () => {
	assert.deepEqual(buildFlowDeskOmnigentUsageBridgeRowV1(resultWithBucket({ resetBucket: "5h", remainingPercent: 55, resetAt: "2026-07-02T05:00:00.000Z", uncertainty: "stale" })), { alert_level: "stale", reset_time: "2026-07-02T05:00:00.000Z" });
	assert.deepEqual(buildFlowDeskOmnigentUsageBridgeRowV1(resultWithBucket({ resetBucket: "5h", remainingPercent: null, uncertainty: "provider_refused" })), { alert_level: "unknown" });
	assert.deepEqual(buildFlowDeskOmnigentUsageBridgeRowV1(undefined), { alert_level: "unknown" });
});

test("bridge snapshot matches the shared cross-language fixture", () => {
	const snapshot = buildFlowDeskOmnigentUsageBridgeSnapshotV1(
		[
			{ family: "claude", result: resultWithBucket({ resetBucket: "5h", remainingPercent: 0, resetAt: "2026-07-02T09:00:00.000Z", uncertainty: "available" }) },
			{ family: "openai", result: resultWithBucket({ resetBucket: "5h", remainingPercent: 82, resetAt: "2026-07-02T05:00:00.000Z", uncertainty: "available" }) },
			{ family: "gemini", result: undefined },
		],
		{ capturedAt: "2026-07-02T04:00:00.000Z" },
	);
	const fixture = JSON.parse(readFileSync("packages/omnigent-tool/tests/fixtures/omnigent_usage_bridge_snapshot_example.json", "utf8")) as unknown;
	assert.deepEqual(snapshot, fixture);
});

test("bridge snapshot emits only Python-allowlisted keys", () => {
	const snapshot = buildFlowDeskOmnigentUsageBridgeSnapshotV1(
		[{ family: "claude", result: resultWithBucket({ resetBucket: "5h", remainingPercent: 42, resetAt: "2026-07-02T05:00:00.000Z", uncertainty: "available" }) }],
		{ capturedAt: "2026-07-02T04:00:00.000Z" },
	);
	const topLevelAllowlist = new Set(["schema_version", "captured_at", "observed_at", "source", "providers", "claude", "openai", "gemini"]);
	for (const key of Object.keys(snapshot)) assert.ok(topLevelAllowlist.has(key), key);
	const rowAllowlist = new Set(["provider_family", "alert_level", "alertLevel", "remaining_percent", "remainingPercent", "reset_time", "resetTime", "reset_at", "resetAt", "bucket_label", "status", "dispatchable", "non_dispatchable"]);
	for (const key of Object.keys(snapshot.claude ?? {})) assert.ok(rowAllowlist.has(key), key);
});
