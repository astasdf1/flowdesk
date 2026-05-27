import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { loadFlowDeskTuiUsageSnapshotViewV1 } from "./tui-usage-snapshot.js";

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
			now: () => new Date("2026-05-27T01:10:00.000Z"),
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
