import assert from "node:assert/strict";
import test from "node:test";
import { isProviderUsageSidebarCacheStale } from "./server.js";

// Bug B regression: the chat-message hook and 3-minute background refresh used to test only the
// top-level `observed_at`. Because the writer always bumps `observed_at` on every refresh, the
// trigger considered the cache "fresh" indefinitely and never re-fetched, leaving an expired
// per-bucket `expires_at` (e.g. an old 5h bucket) visible in the sidebar. The helper now flags the
// cache as stale when ANY nested bucket's `expires_at` has passed.

const maxAgeMs = 3 * 60_000;

test("isProviderUsageSidebarCacheStale: fresh observed_at and all buckets in future → not stale", () => {
	const nowMs = Date.parse("2026-06-08T22:00:00.000Z");
	const stale = isProviderUsageSidebarCacheStale(
		{
			observed_at: "2026-06-08T21:59:00.000Z",
			providers: [
				{
					providerFamily: "openai",
					buckets: [
						{ resetBucket: "openai-gpt-5h", expires_at: "2026-06-08T22:05:00.000Z" },
						{ resetBucket: "openai-weekly", expires_at: "2026-06-15T10:00:00.000Z" },
					],
				},
			],
		},
		nowMs,
		maxAgeMs,
	);
	assert.equal(stale, false);
});

test("isProviderUsageSidebarCacheStale: fresh observed_at but expired per-bucket → stale", () => {
	const nowMs = Date.parse("2026-06-08T22:00:00.000Z");
	const stale = isProviderUsageSidebarCacheStale(
		{
			observed_at: "2026-06-08T21:59:30.000Z", // top-level still fresh
			providers: [
				{
					providerFamily: "openai",
					buckets: [
						// Expired 5h bucket — the bug A carry-forward scenario from PROGRESS_SNAPSHOT.
						{ resetBucket: "openai-gpt-5h", expires_at: "2026-06-08T14:10:14.000Z" },
						{ resetBucket: "openai-weekly", expires_at: "2026-06-15T10:00:00.000Z" },
					],
				},
			],
		},
		nowMs,
		maxAgeMs,
	);
	assert.equal(stale, true);
});

test("isProviderUsageSidebarCacheStale: top-level observed_at older than maxAge → stale", () => {
	const nowMs = Date.parse("2026-06-08T22:00:00.000Z");
	const stale = isProviderUsageSidebarCacheStale(
		{
			observed_at: "2026-06-08T21:50:00.000Z", // 10 minutes old > 3-minute maxAge
			providers: [
				{
					providerFamily: "claude",
					buckets: [
						{ resetBucket: "claude-5h", expires_at: "2026-06-08T22:05:00.000Z" },
					],
				},
			],
		},
		nowMs,
		maxAgeMs,
	);
	assert.equal(stale, true);
});

test("isProviderUsageSidebarCacheStale: missing observed_at → stale", () => {
	const nowMs = Date.parse("2026-06-08T22:00:00.000Z");
	const stale = isProviderUsageSidebarCacheStale({ providers: [] }, nowMs, maxAgeMs);
	assert.equal(stale, true);
});

test("isProviderUsageSidebarCacheStale: malformed bucket entries do not throw and are ignored", () => {
	const nowMs = Date.parse("2026-06-08T22:00:00.000Z");
	const stale = isProviderUsageSidebarCacheStale(
		{
			observed_at: "2026-06-08T21:59:00.000Z",
			providers: [
				{ providerFamily: "claude" }, // no buckets
				{ providerFamily: "openai", buckets: "not-an-array" },
				{
					providerFamily: "gemini",
					buckets: [
						null,
						{}, // bucket without expires_at
						{ resetBucket: "gemini-pro-daily", expires_at: "not-a-date" },
						{ resetBucket: "gemini-flash-daily", expires_at: "2026-06-09T00:00:00.000Z" },
					],
				},
			],
		},
		nowMs,
		maxAgeMs,
	);
	assert.equal(stale, false);
});

test("isProviderUsageSidebarCacheStale: per-bucket expires_at exactly equal to now → stale (boundary)", () => {
	const nowMs = Date.parse("2026-06-08T22:00:00.000Z");
	const stale = isProviderUsageSidebarCacheStale(
		{
			observed_at: "2026-06-08T21:59:30.000Z",
			providers: [
				{
					providerFamily: "claude",
					buckets: [
						{ resetBucket: "claude-5h", expires_at: "2026-06-08T22:00:00.000Z" },
					],
				},
			],
		},
		nowMs,
		maxAgeMs,
	);
	assert.equal(stale, true);
});
