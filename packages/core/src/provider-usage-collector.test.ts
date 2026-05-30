import assert from "node:assert/strict";
import test from "node:test";
import type {
  FlowDeskProviderUsageCollectorTargetV1,
  FlowDeskProviderUsageFetchRequestV1,
  FlowDeskProviderUsageFetchResponseV1,
  FlowDeskProviderUsageFetchV1,
  FlowDeskProviderUsageFileSystemV1
} from "./index.js";
import {
  collectManagedDispatchBetaUsageEvidenceV1,
  validateManagedDispatchBetaProviderHealthEvidenceV1,
  validateManagedDispatchBetaUsageAuthorityEvidenceV1,
  validateManagedDispatchBetaUsageEvidenceV1,
  validateProviderHealthSnapshotV1,
  validateUsageSnapshotV1
} from "./index.js";

const observedAt = "2026-05-17T00:00:00.000Z";
const observedAtMs = Date.parse(observedAt);

function target(overrides: Partial<FlowDeskProviderUsageCollectorTargetV1> = {}): FlowDeskProviderUsageCollectorTargetV1 {
  const providerFamily = overrides.providerFamily ?? "claude";
  const modelFamily = overrides.modelFamily ?? (providerFamily === "openai" ? "gpt-5.5" : providerFamily === "gemini" ? "gemini-pro" : "sonnet-4");
  return {
    providerFamily,
    providerQualifiedModelId: `${providerFamily}/${modelFamily}`,
    modelFamily,
    usageSnapshotId: `usage-${providerFamily}-123`,
    authorityRef: `usage-authority-${providerFamily}-123`,
    sourceRef: `usage-source-${providerFamily}-123`,
    conformanceRef: `usage-conformance-${providerFamily}-123`,
    redactedEvidenceRefs: [`redacted-evidence-${providerFamily}-123`],
    observedAt,
    freshnessTtlMinutes: 5,
    ...overrides
  };
}

function memoryFilesystem(files: Record<string, string>): FlowDeskProviderUsageFileSystemV1 {
  return {
    exists: (filePath) => Object.hasOwn(files, filePath),
    readFile: (filePath) => files[filePath] ?? ""
  };
}

function response(body: unknown, ok = true, status = ok ? 200 : 500): FlowDeskProviderUsageFetchResponseV1 {
  return { ok, status, text: async () => JSON.stringify(body) };
}

function assertCollectorEvidenceValid(result: Awaited<ReturnType<typeof collectManagedDispatchBetaUsageEvidenceV1>>): void {
  assert.equal(result.ok, true, result.redacted_reason);
  assert.equal(validateUsageSnapshotV1(result.usageSnapshot).ok, true);
  assert.equal(validateManagedDispatchBetaUsageEvidenceV1(result.usageSnapshot).ok, true);
  assert.equal(validateProviderHealthSnapshotV1(result.providerHealthSnapshot).ok, true);
  assert.equal(validateManagedDispatchBetaProviderHealthEvidenceV1(result.providerHealthSnapshot, { now: observedAtMs }).ok, true);
  assert.ok(result.usageAuthorityEvidence);
  assert.equal(validateManagedDispatchBetaUsageAuthorityEvidenceV1(result.usageAuthorityEvidence, result.usageSnapshot, { now: observedAtMs }).ok, true);
  assert.equal(result.usageSnapshot.dispatchability, "dispatchable");
  assert.equal(result.usageAuthorityEvidence.usage_acquired, true);
  assert.equal(result.usageAuthorityEvidence.source_kind, "provider_native");
}

test("Claude OAuth collector produces provider-native usage authority evidence", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.claude/.credentials.json": JSON.stringify({ claudeAiOauth: { accessToken: "access-token-123", expiresAt: observedAtMs + 120_000 } })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url) => {
    assert.equal(url, "https://api.anthropic.com/api/oauth/usage");
    return response({ five_hour: { utilization: 25, resets_at: "2026-05-17T05:00:00.000Z" }, seven_day: { utilization: 10, resets_at: "2026-05-24T00:00:00.000Z" } });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target(), { enabled: true, homeDir: "/home/test", providers: ["claude"] }, { filesystem, fetch: fetcher, execFile: () => { throw new Error("no keychain in tests"); }, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "claude-5h");
});

test("Claude OAuth collector selects a later bucket when five-hour reset evidence is absent", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.claude/.credentials.json": JSON.stringify({ claudeAiOauth: { accessToken: "access-token-123", expiresAt: observedAtMs + 120_000 } })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async () => response({ five_hour: { utilization: 25, resets_at: null }, seven_day: { utilization: 10, resets_at: "2026-05-24T00:00:00.000Z" } });

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target(), { enabled: true, homeDir: "/home/test", providers: ["claude"] }, { filesystem, fetch: fetcher, execFile: () => { throw new Error("no keychain in tests"); }, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "claude-weekly");
});

test("Codex/OpenAI collector produces provider-native usage authority evidence", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.codex/auth.json": JSON.stringify({ tokens: { access_token: "access-token-123", account_id: "account-123" } })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url, init) => {
    assert.equal(url, "https://chatgpt.com/backend-api/wham/usage");
    assert.equal(init.headers["ChatGPT-Account-Id"], "account-123");
    return response({ rate_limit_status: { rate_limit: { primary_window: { remaining_percent: 80, reset_after_seconds: 3600 } } } });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "openai", providerQualifiedModelId: "openai/gpt-5.5", modelFamily: "gpt-5.5" }), { enabled: true, homeDir: "/home/test", providers: ["openai"] }, { filesystem, fetch: fetcher, execFile: () => { throw new Error("no keychain in tests"); }, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.model_family, "gpt-5.5");
  assert.equal(result.usageSnapshot.reset_bucket, "openai-gpt-5h");
});

test("Codex/OpenAI collector preserves known 0 percent remaining without dispatch authority", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.codex/auth.json": JSON.stringify({ tokens: { access_token: "access-token-123", account_id: "account-123" } })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async () => response({ rate_limit_status: { rate_limit: { primary_window: { remaining_percent: 0, reset_after_seconds: 3600 } } } });

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "openai", providerQualifiedModelId: "openai/gpt-5.5", modelFamily: "gpt-5.5" }), { enabled: true, homeDir: "/home/test", providers: ["openai"] }, { filesystem, fetch: fetcher, execFile: () => { throw new Error("no keychain in tests"); }, now: () => observedAtMs });

  assert.equal(result.ok, false);
  assert.equal(validateUsageSnapshotV1(result.usageSnapshot).ok, true);
  assert.equal(result.usageSnapshot.freshness, "fresh");
  assert.equal(result.usageSnapshot.dispatchability, "non_dispatchable");
  assert.equal(result.usageSnapshot.reset_bucket, "0% openai-gpt-5h");
  assert.deepEqual(result.usageSnapshot.uncertainty_flags, []);
  assert.equal(result.bucketSnapshot?.remainingPercent, 0);
  assert.equal(result.usageAuthorityEvidence, undefined);
});

test("Gemini Code Assist collector classifies pro reset within 24h as daily bucket", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.gemini/oauth_creds.json": JSON.stringify({ refresh_token: "refresh-token-123" })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url, init: FlowDeskProviderUsageFetchRequestV1) => {
    if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "access-token-123" });
    if (url.endsWith(":loadCodeAssist")) return response({ cloudaicompanionProject: "project-123" });
    assert.ok(url.endsWith(":retrieveUserQuota"));
    assert.match(init.body ?? "", /project-123/);
    return response({ buckets: [{ modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.5, resetTime: "2026-05-17T02:49:00.000Z" }] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }), { enabled: true, homeDir: "/home/test", providers: ["gemini"], geminiOAuthClientId: "gemini-client-id-test", geminiOAuthClientSecret: "gemini-client-secret-test" }, { filesystem, fetch: fetcher, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "gemini-pro-daily");
});

test("Gemini Code Assist collector classifies pro reset beyond 24h as weekly bucket", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.gemini/oauth_creds.json": JSON.stringify({ refresh_token: "refresh-token-123" })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url) => {
    if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "access-token-123" });
    if (url.endsWith(":loadCodeAssist")) return response({ cloudaicompanionProject: "project-123" });
    return response({ buckets: [{ modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.5, resetTime: "2026-05-23T00:00:00.000Z" }] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }), { enabled: true, homeDir: "/home/test", providers: ["gemini"], geminiOAuthClientId: "gemini-client-id-test", geminiOAuthClientSecret: "gemini-client-secret-test" }, { filesystem, fetch: fetcher, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "gemini-pro-weekly");
});

test("Gemini Code Assist collector selects strictest bucket across pro 5h and pro weekly entries", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.gemini/oauth_creds.json": JSON.stringify({ refresh_token: "refresh-token-123" })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url) => {
    if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "access-token-123" });
    if (url.endsWith(":loadCodeAssist")) return response({ cloudaicompanionProject: "project-123" });
    return response({ buckets: [
      { modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.8, resetTime: "2026-05-17T02:49:00.000Z" },
      { modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.2, resetTime: "2026-05-23T00:00:00.000Z" }
    ] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }), { enabled: true, homeDir: "/home/test", providers: ["gemini"], geminiOAuthClientId: "gemini-client-id-test", geminiOAuthClientSecret: "gemini-client-secret-test" }, { filesystem, fetch: fetcher, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "gemini-pro-weekly");
});

test("Gemini Code Assist collector skips non-REQUESTS token type buckets", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.gemini/oauth_creds.json": JSON.stringify({ refresh_token: "refresh-token-123" })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url) => {
    if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "access-token-123" });
    if (url.endsWith(":loadCodeAssist")) return response({ cloudaicompanionProject: "project-123" });
    return response({ buckets: [
      { modelId: "gemini-2.5-pro", tokenType: "TOKENS", remainingFraction: 0.05, resetTime: "2026-05-17T02:49:00.000Z" },
      { modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.5, resetTime: "2026-05-17T02:49:00.000Z" }
    ] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }), { enabled: true, homeDir: "/home/test", providers: ["gemini"], geminiOAuthClientId: "gemini-client-id-test", geminiOAuthClientSecret: "gemini-client-secret-test" }, { filesystem, fetch: fetcher, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "gemini-pro-daily");
});

test("Gemini Code Assist collector preserves pro flash and flash-lite buckets separately", async () => {
  const filesystem = memoryFilesystem({
    "/home/test/.gemini/oauth_creds.json": JSON.stringify({ refresh_token: "refresh-token-123" })
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url) => {
    if (url === "https://oauth2.googleapis.com/token") return response({ access_token: "access-token-123" });
    if (url.endsWith(":loadCodeAssist")) return response({ cloudaicompanionProject: "project-123" });
    return response({ buckets: [
      { modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0, resetTime: "2026-05-17T02:49:00.000Z" },
      { modelId: "gemini-2.5-flash", tokenType: "REQUESTS", remainingFraction: 0.8, resetTime: "2026-05-18T00:00:00.000Z" },
      { modelId: "gemini-2.5-flash-lite", tokenType: "REQUESTS", remainingFraction: 0.9, resetTime: "2026-05-18T00:00:00.000Z" }
    ] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }), { enabled: true, homeDir: "/home/test", providers: ["gemini"], geminiOAuthClientId: "gemini-client-id-test", geminiOAuthClientSecret: "gemini-client-secret-test" }, { filesystem, fetch: fetcher, now: () => observedAtMs });

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "gemini-flash-daily");
  assert.deepEqual(result.additionalSnapshots?.map((snapshot) => snapshot.reset_bucket), ["0% gemini-pro-daily", "90% gemini-flash-lite-daily"]);
});

test("provider usage collector fails closed when acquisition or auth evidence is unavailable", async () => {
  const disabled = await collectManagedDispatchBetaUsageEvidenceV1(target(), { enabled: false }, { now: () => observedAtMs });
  assert.equal(disabled.ok, false);
  assert.equal(validateUsageSnapshotV1(disabled.usageSnapshot).ok, true);
  assert.equal(validateProviderHealthSnapshotV1(disabled.providerHealthSnapshot).ok, true);
  assert.equal(disabled.usageSnapshot.dispatchability, "non_dispatchable");
  assert.equal(disabled.usageSnapshot.uncertainty_flags.includes("unknown"), true);
  assert.equal(disabled.usageAuthorityEvidence, undefined);

  const missingAuth = await collectManagedDispatchBetaUsageEvidenceV1(target({ providerFamily: "openai", providerQualifiedModelId: "openai/gpt-5.5", modelFamily: "gpt-5.5" }), { enabled: true, homeDir: "/home/test", providers: ["openai"] }, { filesystem: memoryFilesystem({}), fetch: async () => response({}), now: () => observedAtMs });
  assert.equal(missingAuth.ok, false);
  assert.equal(missingAuth.usageSnapshot.dispatchability, "non_dispatchable");
  assert.equal(missingAuth.providerHealthSnapshot.failure_class, "auth_missing");
});

test("Gemini Code Assist collector uses cached access_token when not expired without requiring client id/secret", async () => {
  const observedAtMs = Date.parse("2026-05-24T00:00:00.000Z");
  const futureExpiry = observedAtMs + 30 * 60_000;
  const filesystem = memoryFilesystem({
    "/home/test/.gemini/oauth_creds.json": JSON.stringify({
      access_token: "cached-access-token-still-valid",
      refresh_token: "refresh-token-test",
      expiry_date: futureExpiry,
      token_type: "Bearer",
    }),
  });
  let tokenRefreshCalls = 0;
  let firstAuthHeader = "";
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url, init: FlowDeskProviderUsageFetchRequestV1) => {
    if (url === "https://oauth2.googleapis.com/token") {
      tokenRefreshCalls += 1;
      return response({ access_token: "new-access-token" });
    }
    if (url.endsWith(":loadCodeAssist")) {
      firstAuthHeader = init.headers.Authorization ?? "";
      return response({ cloudaicompanionProject: "project-cached" });
    }
    return response({ buckets: [{ modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.5, resetTime: "2026-05-24T02:00:00.000Z" }] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(
    target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }),
    { enabled: true, homeDir: "/home/test", providers: ["gemini"] },
    { filesystem, fetch: fetcher, now: () => observedAtMs },
  );

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "gemini-pro-daily");
  assert.equal(tokenRefreshCalls, 0, "no refresh call should be made when cached token is still valid");
  assert.equal(firstAuthHeader, "Bearer cached-access-token-still-valid");
});

test("Gemini Code Assist collector uses OpenCode google OAuth auth when logged in", async () => {
  const observedAtMs = Date.parse("2026-05-24T00:00:00.000Z");
  const futureExpiry = observedAtMs + 30 * 60_000;
  const filesystem = memoryFilesystem({
    "/home/test/.local/share/opencode/auth.json": JSON.stringify({
      google: {
        type: "oauth",
        access: "opencode-access-token-still-valid",
        refresh: "opencode-refresh-token|configured-project|managed-project",
        expires: futureExpiry,
      },
    }),
  });
  let firstAuthHeader = "";
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url, init: FlowDeskProviderUsageFetchRequestV1) => {
    if (url === "https://oauth2.googleapis.com/token") throw new Error("token refresh should not run");
    if (url.endsWith(":loadCodeAssist")) {
      firstAuthHeader = init.headers.Authorization ?? "";
      assert.match(init.body ?? "", /configured-project/);
      return response({ cloudaicompanionProject: "managed-project" });
    }
    assert.match(init.body ?? "", /configured-project/);
    return response({ buckets: [{ modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.5, resetTime: "2026-05-24T02:00:00.000Z" }] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(
    target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }),
    { enabled: true, homeDir: "/home/test", providers: ["gemini"] },
    { filesystem, fetch: fetcher, now: () => observedAtMs },
  );

  assertCollectorEvidenceValid(result);
  assert.equal(result.usageSnapshot.reset_bucket, "gemini-pro-daily");
  assert.equal(firstAuthHeader, "Bearer opencode-access-token-still-valid");
});

test("Gemini Code Assist collector refreshes OpenCode OAuth using cached opencode-gemini-auth client", async () => {
  const observedAtMs = Date.parse("2026-05-24T00:00:00.000Z");
  const pastExpiry = observedAtMs - 60_000;
  const filesystem = memoryFilesystem({
    "/home/test/.local/share/opencode/auth.json": JSON.stringify({
      google: {
        type: "oauth",
        access: "expired-opencode-access-token",
        refresh: "opencode-refresh-token|configured-project|managed-project",
        expires: pastExpiry,
      },
    }),
    "/home/test/.cache/opencode/packages/opencode-gemini-auth@latest/node_modules/opencode-gemini-auth/dist/index.js": 'var GEMINI_CLIENT_ID = "client-from-package"; var GEMINI_CLIENT_SECRET = "secret-from-package";',
  });
  let tokenRefreshBody = "";
  let firstAuthHeader = "";
  const fetcher: FlowDeskProviderUsageFetchV1 = async (url, init: FlowDeskProviderUsageFetchRequestV1) => {
    if (url === "https://oauth2.googleapis.com/token") {
      tokenRefreshBody = init.body ?? "";
      return response({ access_token: "refreshed-access-token" });
    }
    if (url.endsWith(":loadCodeAssist")) {
      firstAuthHeader = init.headers.Authorization ?? "";
      return response({ cloudaicompanionProject: "managed-project" });
    }
    return response({ buckets: [{ modelId: "gemini-2.5-pro", tokenType: "REQUESTS", remainingFraction: 0.5, resetTime: "2026-05-24T02:00:00.000Z" }] });
  };

  const result = await collectManagedDispatchBetaUsageEvidenceV1(
    target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }),
    { enabled: true, homeDir: "/home/test", providers: ["gemini"] },
    { filesystem, fetch: fetcher, now: () => observedAtMs },
  );

  assertCollectorEvidenceValid(result);
  assert.match(tokenRefreshBody, /client_id=client-from-package/);
  assert.match(tokenRefreshBody, /client_secret=secret-from-package/);
  assert.match(tokenRefreshBody, /refresh_token=opencode-refresh-token/);
  assert.equal(firstAuthHeader, "Bearer refreshed-access-token");
});

test("Gemini Code Assist collector falls closed when cached token is expired and no client id/secret is configured", async () => {
  const observedAtMs = Date.parse("2026-05-24T00:00:00.000Z");
  const pastExpiry = observedAtMs - 60_000;
  const filesystem = memoryFilesystem({
    "/home/test/.gemini/oauth_creds.json": JSON.stringify({
      access_token: "expired-access-token",
      refresh_token: "refresh-token-test",
      expiry_date: pastExpiry,
      token_type: "Bearer",
    }),
  });
  const fetcher: FlowDeskProviderUsageFetchV1 = async () => response({});

  const result = await collectManagedDispatchBetaUsageEvidenceV1(
    target({ providerFamily: "gemini", providerQualifiedModelId: "gemini/gemini-pro", modelFamily: "gemini-pro" }),
    { enabled: true, homeDir: "/home/test", providers: ["gemini"] },
    { filesystem, fetch: fetcher, now: () => observedAtMs },
  );

  assert.equal(result.ok, false);
  assert.match(
    String(result.redacted_reason),
    /cached access token is expired/,
  );
});
