import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import {
	formatFlowDeskTuiUsageSnapshotCompactLines,
	loadFlowDeskTuiUsageSnapshotViewV1,
} from "./tui-usage-snapshot.js";

function writeSnapshot(root: string, workflowId: string, family: string, stamp: string, record: Record<string, unknown>) {
	const dir = join(root, ".flowdesk", "sessions", workflowId, "evidence", "provider-usage-snapshot");
	mkdirSync(dir, { recursive: true });
	writeFileSync(
		join(dir, `provider-usage-snapshot-${family}-${stamp}.json`),
		`${JSON.stringify(
			{
				schema_version: "flowdesk.usage_snapshot.v1",
				snapshot_id: `usage-live-${family}-${stamp}`,
				provider_family: family,
				model_family: family === "openai" ? "gpt-5" : family === "gemini" ? "gemini-pro" : "sonnet-4",
				freshness: "fresh",
				freshness_ttl: 5,
				reset_bucket: `${family}-5h`,
				reset_time: "2026-05-27T03:00:00.000Z",
				dispatchability: "dispatchable",
				uncertainty_flags: [],
				source_ref: `usage-live-source-${family}-${stamp}`,
				...record,
			},
			null,
			2,
		)}\n`,
		"utf8",
	);
}

function formatLocalTimeForTest(value: string, label: "5h" | "1w" | "day"): string {
	const parsed = Date.parse(value);
	if (!Number.isFinite(parsed)) return value;
	const date = new Date(parsed);
	const hh = String(date.getHours()).padStart(2, "0");
	const mm = String(date.getMinutes()).padStart(2, "0");
	if (label === "5h") return `${hh}:${mm}`;
	const month = String(date.getMonth() + 1).padStart(2, "0");
	const day = String(date.getDate()).padStart(2, "0");
	return `${month}-${day} ${hh}:${mm}`;
}

test("TUI usage snapshot view renders connected provider rows from durable snapshots", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-usage-view-"));
	try {
		const workflowId = "workflow-provider-usage-live";
		writeSnapshot(root, workflowId, "claude", "20260527T010000000Z", {
			reset_bucket: "94% claude-5h",
		});
		writeSnapshot(root, workflowId, "openai", "20260527T010100000Z", {
			reset_bucket: "90% openai-gpt-5h",
		});
		const view = loadFlowDeskTuiUsageSnapshotViewV1({
			rootDir: root,
			workflowId,
			now: () => new Date("2026-05-27T01:10:00.000Z"),
		});
		assert.equal(view.status, "loaded");
		const claude = view.providers.find((provider) => provider.providerFamily === "claude");
		const openai = view.providers.find((provider) => provider.providerFamily === "openai");
		const gemini = view.providers.find((provider) => provider.providerFamily === "gemini");
		assert.equal(claude?.connected, true);
		assert.equal(claude?.remainingPercent, 94);
		assert.equal(claude?.alertLevel, "ok");
		assert.equal(openai?.connected, true);
		assert.equal(openai?.remainingPercent, 90);
		assert.equal(gemini?.connected, false);
		assert.equal(gemini?.alertLevel, "unknown");
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI usage snapshot view prefers sidebar cache with remaining percent", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-sidebar-cache-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
					observed_at: "2026-05-27T01:00:00.000Z",
					expires_at: "2026-05-27T01:05:00.000Z",
					providers: [
						{
							providerFamily: "claude",
							connected: true,
							dispatchability: "dispatchable",
							freshness: "fresh",
							resetTime: "2026-05-27T03:00:00.000Z",
							remainingPercent: 94,
							alertLevel: "ok",
						},
						{
							providerFamily: "gemini",
							connected: false,
							dispatchability: "non_dispatchable",
							freshness: "unknown",
							remainingPercent: null,
							alertLevel: "unknown",
						},
					],
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
		const view = loadFlowDeskTuiUsageSnapshotViewV1({
			rootDir: root,
			now: () => new Date("2026-05-27T01:02:00.000Z"),
		});
		assert.equal(view.status, "loaded");
		const claude = view.providers.find((provider) => provider.providerFamily === "claude");
		const gemini = view.providers.find((provider) => provider.providerFamily === "gemini");
		assert.equal(claude?.connected, true);
		assert.equal(claude?.remainingPercent, 94);
		assert.equal(claude?.alertLevel, "ok");
		assert.equal(gemini?.connected, false);
		assert.equal(gemini?.remainingPercent, null);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI usage snapshot compact lines show latest 5h and 1w durable buckets", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-usage-compact-"));
	try {
		const workflowId = "workflow-provider-usage-live";
		writeSnapshot(root, workflowId, "claude", "20260527T010000000Z", {
			freshness: "stale",
			reset_bucket: "10% claude-5h",
			reset_time: "2026-05-27T18:00:00.000Z",
		});
		writeSnapshot(root, workflowId, "claude", "20260527T011000000Z", {
			reset_bucket: "77% claude-5h",
			reset_time: "2026-05-27T03:20:00.000Z",
		});
		writeSnapshot(root, workflowId, "claude", "20260527T011100000Z", {
			reset_bucket: "34% claude-weekly",
			reset_time: "2026-06-03T12:00:00.000Z",
		});
		writeSnapshot(root, workflowId, "openai", "20260527T011200000Z", {
			reset_bucket: "87% openai-gpt-5h",
			reset_time: "2026-05-27T15:26:00.000Z",
		});
		writeSnapshot(root, workflowId, "openai", "20260527T011300000Z", {
			reset_bucket: "98% openai-weekly",
			reset_time: "2026-06-03T15:26:00.000Z",
		});
		const view = loadFlowDeskTuiUsageSnapshotViewV1({
			rootDir: root,
			workflowId,
			now: () => new Date("2026-05-27T01:15:00.000Z"),
		});
		assert.equal(view.status, "loaded");
		const actual = formatFlowDeskTuiUsageSnapshotCompactLines(view);
		assert.equal(actual.length, 3);
		assert.ok(actual[0].includes("CL") && actual[0].includes("Sonnet") && actual[0].includes("34%") && actual[0].includes("1w"));
		assert.ok(actual[1].includes("OA") && actual[1].includes("5.5") && actual[1].includes("87%") && actual[1].includes("5h"));
		assert.ok(actual[2].includes("GM") && actual[2].includes("✗"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI usage snapshot compact lines read fresh sidebar cache buckets", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-sidebar-compact-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
					observed_at: "2026-05-27T01:00:00.000Z",
					expires_at: "2026-05-27T01:05:00.000Z",
					providers: [
						{
							providerFamily: "claude",
							connected: true,
							dispatchability: "dispatchable",
							freshness: "fresh",
							remainingPercent: 34,
							alertLevel: "ok",
							buckets: [
								{
									resetBucket: "claude-5h",
									resetTime: "2026-05-27T03:20:00.000Z",
									remainingPercent: 77,
									freshness: "fresh",
									dispatchability: "dispatchable",
									connected: true,
								},
								{
									resetBucket: "claude-weekly",
									resetTime: "2026-06-03T12:00:00.000Z",
									remainingPercent: 34,
									freshness: "fresh",
									dispatchability: "dispatchable",
									connected: true,
								},
							],
						},
					],
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
		const view = loadFlowDeskTuiUsageSnapshotViewV1({
			rootDir: root,
			now: () => new Date("2026-05-27T01:02:00.000Z"),
		});
		// Lower of 5h (77%) and 1w (34%) → shows 1w 34%
		const line0 = formatFlowDeskTuiUsageSnapshotCompactLines(view)[0];
		assert.ok(line0.includes("CL") && line0.includes("Sonnet") && line0.includes("34%") && line0.includes("1w"));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI compact lines choose representative bucket by period-normalized quota health without changing display format", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-sidebar-qhs-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify(
				{
					schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
					observed_at: "2026-05-27T01:00:00.000Z",
					expires_at: "2026-05-27T01:05:00.000Z",
					providers: [
						{
							providerFamily: "claude",
							connected: true,
							dispatchability: "dispatchable",
							freshness: "fresh",
							remainingPercent: 20,
							alertLevel: "warning",
							buckets: [
								{
									resetBucket: "claude-5h",
									resetTime: "2026-05-27T01:12:00.000Z",
									remainingPercent: 20,
									freshness: "fresh",
									dispatchability: "dispatchable",
									connected: true,
								},
								{
									resetBucket: "claude-weekly",
									resetTime: "2026-06-02T01:02:00.000Z",
									remainingPercent: 30,
									freshness: "fresh",
									dispatchability: "dispatchable",
									connected: true,
								},
							],
						},
					],
				},
				null,
				2,
			)}\n`,
			"utf8",
		);
		const view = loadFlowDeskTuiUsageSnapshotViewV1({
			rootDir: root,
			now: () => new Date("2026-05-27T01:02:00.000Z"),
		});
		const line0 = formatFlowDeskTuiUsageSnapshotCompactLines(view)[0];
		assert.ok(line0.includes("CL") && line0.includes("Sonnet"));
		assert.ok(line0.includes("30%") && line0.includes("1w"), line0);
		assert.match(line0, /^CL Sonnet\s+30% \(1w, r /);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI usage snapshot compact lines show Gemini pro flash and flash-lite buckets even when pro is exhausted", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-gemini-buckets-"));
	try {
		const uiDir = join(root, ".flowdesk", "ui");
		mkdirSync(uiDir, { recursive: true });
		writeFileSync(
			join(uiDir, "provider-usage-sidebar.json"),
			`${JSON.stringify({
				schema_version: "flowdesk.provider_usage_sidebar_cache.v1",
				observed_at: "2026-05-27T01:00:00.000Z",
				expires_at: "2026-05-27T01:05:00.000Z",
				providers: [{
					providerFamily: "gemini",
					connected: false,
					dispatchability: "non_dispatchable",
					freshness: "fresh",
					remainingPercent: 0,
					alertLevel: "exhausted",
					buckets: [
						{ resetBucket: "0% gemini-pro-daily", resetTime: "2026-05-27T03:00:00.000Z", remainingPercent: 0, freshness: "fresh", dispatchability: "non_dispatchable", connected: false },
						{ resetBucket: "80% gemini-flash-daily", resetTime: "2026-05-28T00:00:00.000Z", remainingPercent: 80, freshness: "fresh", dispatchability: "dispatchable", connected: true },
						{ resetBucket: "90% gemini-flash-lite-daily", resetTime: "2026-05-28T00:00:00.000Z", remainingPercent: 90, freshness: "fresh", dispatchability: "dispatchable", connected: true },
					],
				}],
			}, null, 2)}\n`,
			"utf8",
		);
		const lines = formatFlowDeskTuiUsageSnapshotCompactLines(loadFlowDeskTuiUsageSnapshotViewV1({ rootDir: root, now: () => new Date("2026-05-27T01:02:00.000Z") }));
		assert.ok(lines.some(l => l.includes("Pro") && l.includes("0%") && l.includes("day")));
		assert.ok(lines.some(l => l.includes("Flash") && l.includes("80%") && l.includes("day")));
		assert.ok(lines.some(l => l.includes("Lite") && l.includes("90%") && l.includes("day")));
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});

test("TUI usage snapshot view fails closed when cache is unavailable", () => {
	const root = mkdtempSync(join(tmpdir(), "flowdesk-tui-usage-missing-"));
	try {
		const view = loadFlowDeskTuiUsageSnapshotViewV1({ rootDir: root });
		assert.equal(view.status, "blocked");
		assert.equal(view.providers.length, 3);
		assert.equal(view.providers.every((provider) => provider.connected === false), true);
		assert.deepEqual(view.safeNextActions, ["/flowdesk-usage", "/flowdesk-status", "/flowdesk-doctor"]);
	} finally {
		rmSync(root, { recursive: true, force: true });
	}
});
