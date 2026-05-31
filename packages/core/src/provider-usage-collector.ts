import { createHash } from "node:crypto";
import * as fs from "node:fs";
import { homedir, userInfo } from "node:os";
import * as path from "node:path";
import type {
  FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1,
  FlowDeskProviderHealthSnapshotV1,
  FlowDeskUsageSnapshotV1,
  ProviderFamily
} from "./release1-contracts.js";

type ConcreteProviderFamily = Exclude<ProviderFamily, "unknown" | "all">;
type CollectorProviderFamily = Extract<ConcreteProviderFamily, "claude" | "openai" | "gemini">;
type UsageUncertainty = "available" | "insufficient" | "unknown" | "stale" | "provider_refused";

export interface FlowDeskProviderUsageCollectorTargetV1 {
  providerFamily: CollectorProviderFamily;
  providerQualifiedModelId: string;
  modelFamily: string;
  usageSnapshotId: string;
  authorityRef: string;
  sourceRef: string;
  conformanceRef: string;
  redactedEvidenceRefs: readonly string[];
  observedAt?: string;
  freshnessTtlMinutes?: number;
}

export interface FlowDeskProviderUsageAcquisitionConfigV1 {
  enabled?: boolean;
  homeDir?: string;
  providers?: readonly CollectorProviderFamily[];
  claudeOAuthUsage?: boolean;
  codexLiveUsage?: boolean;
  geminiOAuthClientId?: string;
  geminiOAuthClientSecret?: string;
  geminiProjectId?: string;
  geminiQuota?: boolean;
}

export interface FlowDeskProviderUsageCollectorOptionsV1 {
  filesystem?: FlowDeskProviderUsageFileSystemV1;
  env?: Record<string, string | undefined>;
  fetch?: FlowDeskProviderUsageFetchV1;
  execFile?: FlowDeskProviderUsageExecFileV1;
  now?: () => number;
}

export interface FlowDeskProviderUsageFileSystemV1 {
  exists(path: string): boolean;
  readFile(path: string): string;
}

export interface FlowDeskProviderUsageFetchResponseV1 {
  ok: boolean;
  status: number;
  text(): Promise<string>;
}

export interface FlowDeskProviderUsageFetchRequestV1 {
  method: "GET" | "POST";
  headers: Record<string, string>;
  body?: string;
}

export type FlowDeskProviderUsageFetchV1 = (url: string, init: FlowDeskProviderUsageFetchRequestV1) => Promise<FlowDeskProviderUsageFetchResponseV1>;
export type FlowDeskProviderUsageExecFileV1 = (file: string, args: string[]) => string;

export interface FlowDeskProviderUsageCollectorBucketSnapshotV1 {
  resetBucket: string;
  remainingPercent: number | null;
  resetAt?: string;
  uncertainty: "available" | "insufficient" | "unknown" | "stale" | "provider_refused";
}

export interface FlowDeskProviderUsageCollectorResultV1 {
  ok: boolean;
  source_kind: "provider_native";
  usageSnapshot: FlowDeskUsageSnapshotV1;
  providerHealthSnapshot: FlowDeskProviderHealthSnapshotV1;
  usageAuthorityEvidence?: FlowDeskManagedDispatchBetaUsageAuthorityEvidenceV1;
  bucketSnapshot?: FlowDeskProviderUsageCollectorBucketSnapshotV1;
  additionalSnapshots?: readonly FlowDeskUsageSnapshotV1[];
  redacted_reason?: string;
}

interface ProviderBucket {
  resetBucket: string;
  remaining: number | null;
  resetAt?: string;
  uncertainty: UsageUncertainty;
}

interface GeminiOAuthCredentials {
  accessToken: string;
  refreshToken: string;
  expiresAt?: number;
  projectId?: string;
}

interface GeminiOAuthClientCredentials {
  clientId: string;
  clientSecret: string;
}

interface ProviderCollection {
  providerFamily: CollectorProviderFamily;
  modelFamily: string;
  authProfileRef?: string;
  authEvidenceRef?: string;
  credentialScopeRef?: string;
  accountBoundaryRef?: string;
  quotaEvidenceRef?: string;
  bucket?: ProviderBucket;
  additionalBuckets?: readonly ProviderBucket[];
  failureClass: FlowDeskProviderHealthSnapshotV1["failure_class"];
  availabilityState: FlowDeskProviderHealthSnapshotV1["availability_state"];
  redactedReason?: string;
}

interface RemainingPercentInput {
  usedPercent?: number | null;
  utilizationPercent?: number | null;
  remainingPercent?: number | null;
  remainingFraction?: number | null;
  remainingAmount?: string | null;
  resetAt?: string | null;
  resetAtUnixSeconds?: number | null;
  resetAfterSeconds?: number | null;
  observedAt?: number;
  expiredResetBehavior?: "stale" | "reset_to_full";
}

interface RemainingPercentResult {
  remaining: number | null;
  used: number | null;
  reset_at?: string;
  uncertainty: UsageUncertainty;
}

const CLAUDE_OAUTH_CLIENT_ID = "9d1c250a-e61b-44d9-88ed-5944d1962f5e";
const CLAUDE_OAUTH_USAGE_URL = "https://api.anthropic.com/api/oauth/usage";
const CLAUDE_OAUTH_REFRESH_URL = "https://platform.claude.com/v1/oauth/token";
const CODEX_DEFAULT_CHATGPT_BASE_URL = "https://chatgpt.com/backend-api";
const CODEX_KEYRING_SERVICE = "Codex Auth";
const GEMINI_TOKEN_ENDPOINT = "https://oauth2.googleapis.com/token";
const GEMINI_CODE_ASSIST_ENDPOINT = "https://cloudcode-pa.googleapis.com/v1internal";

const defaultFilesystem: FlowDeskProviderUsageFileSystemV1 = {
  exists: (filePath) => fs.existsSync(filePath),
  readFile: (filePath) => fs.readFileSync(filePath, "utf-8")
};

export async function collectManagedDispatchBetaUsageEvidenceV1(
  target: FlowDeskProviderUsageCollectorTargetV1,
  acquisition: FlowDeskProviderUsageAcquisitionConfigV1 | undefined,
  options: FlowDeskProviderUsageCollectorOptionsV1 = {}
): Promise<FlowDeskProviderUsageCollectorResultV1> {
  const observedAtMs = options.now?.() ?? Date.now();
  const observedAt = target.observedAt ?? new Date(observedAtMs).toISOString();
  const ttlMinutes = target.freshnessTtlMinutes ?? 5;
  const collection = acquisition?.enabled === true && (acquisition.providers === undefined || acquisition.providers.includes(target.providerFamily))
    ? await collectProvider(target.providerFamily, acquisition, options, observedAtMs)
    : refusedCollection(target.providerFamily, target.modelFamily, "provider usage acquisition is disabled");

  const bucket = collection.bucket;
  const resetAt = bucket?.resetAt;
  const remaining = bucket?.remaining ?? null;
  const usageKnown = bucket !== undefined && remaining !== null && resetAt !== undefined && bucket.uncertainty === "available";
  const usageOk = usageKnown && remaining > 0;
  const usageSnapshot: FlowDeskUsageSnapshotV1 = usageKnown
    ? {
      schema_version: "flowdesk.usage_snapshot.v1",
      snapshot_id: target.usageSnapshotId,
      provider_family: target.providerFamily,
      model_family: target.modelFamily,
      freshness: "fresh",
      freshness_ttl: ttlMinutes,
      reset_time: resetAt,
      reset_bucket: remaining === 0 ? `0% ${bucket.resetBucket}` : bucket.resetBucket,
      dispatchability: usageOk ? "dispatchable" : "non_dispatchable",
      uncertainty_flags: [],
      source_ref: target.sourceRef
    }
    : unknownUsageSnapshot(target, collection, ttlMinutes);

  const providerHealthSnapshot: FlowDeskProviderHealthSnapshotV1 = {
    schema_version: "flowdesk.provider_health_snapshot.v1",
    snapshot_id: `health-${target.usageSnapshotId}`,
    provider_family: target.providerFamily,
    model_family: target.modelFamily,
    observed_at: observedAt,
    freshness: usageOk ? "fresh" : "unknown",
    freshness_ttl: usageOk ? ttlMinutes : 0,
    source_surface: "usage_collector",
    availability_state: usageOk ? "healthy" : collection.availabilityState,
    failure_class: usageOk ? "none" : collection.failureClass,
    telemetry_ref: `telemetry-${target.usageSnapshotId}`,
    dispatchability: usageOk ? "dispatchable" : "non_dispatchable",
    source_ref: target.sourceRef,
    safe_remediation: usageOk ? "Usage collector acquired fresh auth-bound usage evidence." : "Refresh provider auth and usage evidence before managed dispatch."
  };

  const bucketSnapshot: FlowDeskProviderUsageCollectorBucketSnapshotV1 | undefined = bucket !== undefined
    ? {
      resetBucket: bucket.resetBucket,
      remainingPercent: bucket.remaining,
      ...(bucket.resetAt !== undefined ? { resetAt: bucket.resetAt } : {}),
      uncertainty: bucket.uncertainty
    }
    : undefined;

  const additionalSnapshots: FlowDeskUsageSnapshotV1[] = [];
  for (const addBucket of collection.additionalBuckets ?? []) {
    const addResetAt = addBucket.resetAt;
    const addRemaining = addBucket.remaining;
    const addKnown = addRemaining !== null && addResetAt !== undefined && addBucket.uncertainty === "available";
    const addOk = addKnown && addRemaining > 0;
    additionalSnapshots.push(addKnown
      ? {
          schema_version: "flowdesk.usage_snapshot.v1",
          snapshot_id: `${target.usageSnapshotId}-${addBucket.resetBucket}`,
          provider_family: target.providerFamily,
          model_family: target.modelFamily,
          freshness: "fresh",
          freshness_ttl: ttlMinutes,
          reset_time: addResetAt,
          reset_bucket: addBucket.remaining !== null ? `${addBucket.remaining}% ${addBucket.resetBucket}` : addBucket.resetBucket,
          dispatchability: addOk ? "dispatchable" : "non_dispatchable",
          uncertainty_flags: [],
          source_ref: target.sourceRef,
        }
      : unknownUsageSnapshot(
          { ...target, usageSnapshotId: `${target.usageSnapshotId}-${addBucket.resetBucket}` },
          { ...collection, bucket: addBucket },
          ttlMinutes,
        ));
  }

  if (!usageOk || collection.authProfileRef === undefined || collection.authEvidenceRef === undefined || collection.credentialScopeRef === undefined || collection.accountBoundaryRef === undefined || collection.quotaEvidenceRef === undefined) {
    return {
      ok: false,
      source_kind: "provider_native",
      usageSnapshot,
      providerHealthSnapshot,
      ...(bucketSnapshot !== undefined ? { bucketSnapshot } : {}),
      ...(additionalSnapshots.length > 0 ? { additionalSnapshots } : {}),
      redacted_reason: collection.redactedReason ?? "usage evidence is unavailable"
    };
  }

  return {
    ok: true,
    source_kind: "provider_native",
    usageSnapshot,
    providerHealthSnapshot,
    ...(bucketSnapshot !== undefined ? { bucketSnapshot } : {}),
    ...(additionalSnapshots.length > 0 ? { additionalSnapshots } : {}),
    usageAuthorityEvidence: {
      schema_version: "flowdesk.managed_dispatch_beta.usage_authority_evidence.v1",
      authority_ref: target.authorityRef,
      usage_snapshot_ref: usageSnapshot.snapshot_id,
      provider_family: target.providerFamily,
      provider_qualified_model_id: target.providerQualifiedModelId,
      model_family: target.modelFamily,
      source_kind: "provider_native",
      source_version_ref: `collector-${target.providerFamily}-v1`,
      auth_profile_ref: collection.authProfileRef,
      auth_evidence_ref: collection.authEvidenceRef,
      credential_scope_ref: collection.credentialScopeRef,
      account_boundary_ref: collection.accountBoundaryRef,
      quota_evidence_ref: collection.quotaEvidenceRef,
      usage_acquired: true,
      reset_time: usageSnapshot.reset_time,
      reset_bucket: usageSnapshot.reset_bucket,
      source_ref: usageSnapshot.source_ref,
      conformance_ref: target.conformanceRef,
      redacted_evidence_refs: [...target.redactedEvidenceRefs],
      trusted: true,
      observed_at: observedAt,
      expires_at: new Date(Date.parse(observedAt) + ttlMinutes * 60_000).toISOString()
    }
  };
}

async function collectProvider(providerFamily: CollectorProviderFamily, acquisition: FlowDeskProviderUsageAcquisitionConfigV1, options: FlowDeskProviderUsageCollectorOptionsV1, observedAt: number): Promise<ProviderCollection> {
  if (providerFamily === "claude") return collectClaudeUsage(acquisition, options, observedAt);
  if (providerFamily === "openai") return collectCodexUsage(acquisition, options, observedAt);
  return collectGeminiUsage(acquisition, options, observedAt);
}

async function collectClaudeUsage(acquisition: FlowDeskProviderUsageAcquisitionConfigV1, options: FlowDeskProviderUsageCollectorOptionsV1, observedAt: number): Promise<ProviderCollection> {
  const defaults = () => [bucket("claude-5h", "%", null, undefined, "unknown"), bucket("claude-weekly", "%", null, undefined, "unknown")];
  if (acquisition.claudeOAuthUsage === false) return refusedCollection("claude", "claude", "claude oauth usage is disabled");
  const fetcher = options.fetch ?? (globalThis as { fetch?: FlowDeskProviderUsageFetchV1 }).fetch;
  if (!fetcher) return refusedCollection("claude", "claude", "fetch is unavailable");
  const homeDir = normalizeHomeDir(acquisition.homeDir, options.env);
  const filesystem = options.filesystem ?? defaultFilesystem;
  const creds = await readClaudeOAuthCredentials(homeDir, filesystem, options);
  if (!creds?.accessToken) return refusedCollection("claude", "claude", "claude auth evidence is missing");
  const accessToken = await resolveClaudeAccessToken(creds, fetcher, observedAt);
  if (!accessToken) return refusedCollection("claude", "claude", "claude auth refresh failed");
  try {
    const response = await fetcher(CLAUDE_OAUTH_USAGE_URL, {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, "anthropic-beta": "oauth-2025-04-20", "Content-Type": "application/json" }
    });
    if (!response.ok) return refusedCollection("claude", "claude", "claude usage endpoint refused");
    const payload = JSON.parse(await response.text()) as unknown;
    const buckets = claudeOAuthBuckets(payload, observedAt, defaults());
    const primaryBucket = firstDispatchableBucket(buckets) ?? buckets[0] ?? defaults()[0];
    const additionalBuckets = buckets.filter((b) => b !== primaryBucket);
    const collection = availableCollection("claude", "claude", "claude-oauth", "claude-oauth", primaryBucket);
    return { ...collection, additionalBuckets };
  } catch {
    return refusedCollection("claude", "claude", "claude usage collection failed");
  }
}

async function collectCodexUsage(acquisition: FlowDeskProviderUsageAcquisitionConfigV1, options: FlowDeskProviderUsageCollectorOptionsV1, observedAt: number): Promise<ProviderCollection> {
  const exactModelFamily = "gpt-5.5";
  if (acquisition.codexLiveUsage === false) return refusedCollection("openai", exactModelFamily, "codex live usage is disabled");
  const fetcher = options.fetch ?? (globalThis as { fetch?: FlowDeskProviderUsageFetchV1 }).fetch;
  if (!fetcher) return refusedCollection("openai", exactModelFamily, "fetch is unavailable");
  const homeDir = normalizeHomeDir(acquisition.homeDir, options.env);
  const filesystem = options.filesystem ?? defaultFilesystem;
  const configDirs = codexConfigDirs(homeDir, options.env);
  const credentials = readCodexCredentials(configDirs, filesystem, options);
  if (!credentials) return refusedCollection("openai", exactModelFamily, "codex auth evidence is missing");
  const tokens = isRecord(credentials.auth.tokens) ? credentials.auth.tokens : undefined;
  const accessToken = tokens ? stringField(tokens, "access_token") : "";
  if (!accessToken) return refusedCollection("openai", exactModelFamily, "codex access token is missing");
  const accountId = tokens ? firstNonEmpty(stringField(tokens, "account_id"), stringField(credentials.auth, "account_id")) : stringField(credentials.auth, "account_id");
  try {
    const response = await fetcher(codexUsageUrl(resolveCodexBaseUrl(credentials.configDir, filesystem)), {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}`, Accept: "application/json", ...(accountId ? { "ChatGPT-Account-Id": accountId } : {}), "User-Agent": "codex-cli" }
    });
    if (!response.ok) return refusedCollection("openai", exactModelFamily, "codex usage endpoint refused");
    const buckets = codexLiveBuckets(JSON.parse(await response.text()), observedAt);
    const primaryBucket = firstDispatchableBucket(buckets) ?? buckets[0] ?? bucket("openai-gpt-5h", "%", null, undefined, "unknown");
    const additionalBuckets = buckets.filter((b) => b !== primaryBucket);
    const collection = availableCollection("openai", exactModelFamily, "codex-live", firstNonEmpty(accountId, "codex-account"), primaryBucket);
    return { ...collection, additionalBuckets };
  } catch {
    return refusedCollection("openai", exactModelFamily, "codex usage collection failed");
  }
}

async function collectGeminiUsage(acquisition: FlowDeskProviderUsageAcquisitionConfigV1, options: FlowDeskProviderUsageCollectorOptionsV1, observedAt: number): Promise<ProviderCollection> {
  if (acquisition.geminiQuota === false) return refusedCollection("gemini", "gemini", "gemini quota is disabled");
  const fetcher = options.fetch ?? (globalThis as { fetch?: FlowDeskProviderUsageFetchV1 }).fetch;
  if (!fetcher) return refusedCollection("gemini", "gemini", "fetch is unavailable");
  const homeDir = normalizeHomeDir(acquisition.homeDir, options.env);
  const filesystem = options.filesystem ?? defaultFilesystem;
  const openCodeCreds = readOpenCodeGeminiOAuthCredentials(homeDir, options.env, filesystem);
  const credsPath = geminiCredentialPaths(homeDir, options.env).find((candidate) => filesystem.exists(candidate));
  if (!credsPath && !openCodeCreds) return refusedCollection("gemini", "gemini", "gemini auth evidence is missing");
  try {
    const geminiCliCreds = credsPath ? readGeminiCliOAuthCredentials(credsPath, filesystem) : null;
    const selectedCreds = selectGeminiOAuthCredentials(openCodeCreds, geminiCliCreds, observedAt);
    if (!selectedCreds) return refusedCollection("gemini", "gemini", "gemini auth evidence is missing");
    const refreshToken = selectedCreds.refreshToken;
    const cachedAccessToken = selectedCreds.accessToken;
    const cachedExpiryMs = selectedCreds.expiresAt ?? NaN;
    const cachedTokenStillValid = cachedAccessToken !== "" && Number.isFinite(cachedExpiryMs) && cachedExpiryMs > observedAt + 5 * 60_000;
    const env = options.env ?? {};
    const inferredClient = readOpenCodeGeminiAuthOAuthClient(homeDir, env, filesystem);
    const clientId = firstNonEmpty(acquisition.geminiOAuthClientId, env.FLOWDESK_GEMINI_OAUTH_CLIENT_ID, inferredClient?.clientId);
    const clientSecret = firstNonEmpty(acquisition.geminiOAuthClientSecret, env.FLOWDESK_GEMINI_OAUTH_CLIENT_SECRET, inferredClient?.clientSecret);
    let accessToken = "";
    if (cachedTokenStillValid) {
      accessToken = cachedAccessToken;
    } else if (refreshToken && clientId && clientSecret) {
      try {
        accessToken = await refreshGeminiAccessToken(refreshToken, clientId, clientSecret, fetcher);
      } catch {
        accessToken = "";
      }
    }
    if (!accessToken) {
      if (!refreshToken) return refusedCollection("gemini", "gemini", "gemini refresh token is missing");
      if (!clientId || !clientSecret) return refusedCollection("gemini", "gemini", "gemini oauth client evidence is missing and cached access token is expired");
      return refusedCollection("gemini", "gemini", "gemini token refresh failed");
    }
    let projectId = firstNonEmpty(env.GOOGLE_CLOUD_PROJECT, env.GOOGLE_CLOUD_PROJECT_ID, acquisition.geminiProjectId, selectedCreds.projectId);
    const details = await codeAssistPost("loadCodeAssist", { cloudaicompanionProject: projectId, metadata: { ideType: "IDE_UNSPECIFIED", platform: "PLATFORM_UNSPECIFIED", pluginType: "GEMINI", duetProject: projectId } }, accessToken, fetcher);
    projectId = firstNonEmpty(projectId, stringField(details, "cloudaicompanionProject"));
    if (!projectId) return refusedCollection("gemini", "gemini", "gemini project boundary is missing");
    const quota = await codeAssistPost("retrieveUserQuota", { project: projectId }, accessToken, fetcher);
    const buckets = geminiQuotaBuckets(quota, observedAt);
    const primaryBucket = firstDispatchableBucket(buckets) ?? firstKnownBucket(buckets) ?? buckets[0] ?? bucket("gemini-unknown-5h", "%", null, undefined, "unknown");
    const additionalBuckets = buckets.filter((b) => b !== primaryBucket);
    const collection = availableCollection("gemini", "gemini", "gemini-code-assist", projectId, primaryBucket);
    return { ...collection, additionalBuckets };
  } catch {
    return refusedCollection("gemini", "gemini", "gemini usage collection failed");
  }
}

function readGeminiCliOAuthCredentials(credsPath: string, filesystem: FlowDeskProviderUsageFileSystemV1): GeminiOAuthCredentials | null {
  try {
    const creds = JSON.parse(filesystem.readFile(credsPath)) as unknown;
    const record = isRecord(creds) ? creds : {};
    const refreshToken = stringField(record, "refresh_token");
    const accessToken = stringField(record, "access_token");
    const expiryRaw = record.expiry_date;
    const expiresAt = typeof expiryRaw === "number" ? expiryRaw : typeof expiryRaw === "string" ? Number.parseInt(expiryRaw, 10) : undefined;
    if (!refreshToken && !accessToken) return null;
    return { accessToken, refreshToken, ...(expiresAt === undefined || !Number.isFinite(expiresAt) ? {} : { expiresAt }) };
  } catch {
    return null;
  }
}

function readOpenCodeGeminiOAuthCredentials(homeDir: string, env: Record<string, string | undefined> | undefined, filesystem: FlowDeskProviderUsageFileSystemV1): GeminiOAuthCredentials | null {
  const fromEnv = authRecordFromOpenCodeAuthContent(env?.OPENCODE_AUTH_CONTENT);
  if (fromEnv) return fromEnv;
  for (const authPath of openCodeAuthPaths(homeDir, env)) {
    if (!filesystem.exists(authPath)) continue;
    try {
      const parsed = JSON.parse(filesystem.readFile(authPath)) as unknown;
      const fromFile = authRecordFromOpenCodeAuthDatabase(parsed);
      if (fromFile) return fromFile;
    } catch {}
  }
  return null;
}

function authRecordFromOpenCodeAuthContent(value: string | undefined): GeminiOAuthCredentials | null {
  if (!value) return null;
  try {
    return authRecordFromOpenCodeAuthDatabase(JSON.parse(value) as unknown);
  } catch {
    return null;
  }
}

function authRecordFromOpenCodeAuthDatabase(value: unknown): GeminiOAuthCredentials | null {
  if (!isRecord(value)) return null;
  return openCodeGeminiAuthRecordToCredentials(value.google) ?? openCodeGeminiAuthRecordToCredentials(value.gemini);
}

function openCodeGeminiAuthRecordToCredentials(value: unknown): GeminiOAuthCredentials | null {
  if (!isRecord(value) || value.type !== "oauth") return null;
  const accessToken = stringField(value, "access");
  const expiresAt = numberField(value, "expires");
  const refresh = stringField(value, "refresh");
  const [refreshToken = "", projectId = "", managedProjectId = ""] = refresh.split("|", 3);
  if (!refreshToken && !accessToken) return null;
  return { accessToken, refreshToken, ...(expiresAt === undefined ? {} : { expiresAt }), ...(firstNonEmpty(projectId, managedProjectId) ? { projectId: firstNonEmpty(projectId, managedProjectId) } : {}) };
}

function selectGeminiOAuthCredentials(openCodeCreds: GeminiOAuthCredentials | null, geminiCliCreds: GeminiOAuthCredentials | null, observedAt: number): GeminiOAuthCredentials | null {
  const candidates = [openCodeCreds, geminiCliCreds].filter((candidate): candidate is GeminiOAuthCredentials => candidate !== null);
  const fresh = candidates.find((candidate) => candidate.accessToken && candidate.expiresAt !== undefined && candidate.expiresAt > observedAt + 5 * 60_000);
  return fresh ?? candidates.find((candidate) => candidate.refreshToken) ?? candidates[0] ?? null;
}

function readOpenCodeGeminiAuthOAuthClient(homeDir: string, env: Record<string, string | undefined>, filesystem: FlowDeskProviderUsageFileSystemV1): GeminiOAuthClientCredentials | null {
  for (const candidate of openCodeGeminiAuthPackageEntrypoints(homeDir, env)) {
    if (!filesystem.exists(candidate)) continue;
    try {
      const source = filesystem.readFile(candidate);
      const clientId = source.match(/GEMINI_CLIENT_ID\s*=\s*["']([^"']+)["']/)?.[1] ?? "";
      const clientSecret = source.match(/GEMINI_CLIENT_SECRET\s*=\s*["']([^"']+)["']/)?.[1] ?? "";
      if (clientId && clientSecret) return { clientId, clientSecret };
    } catch {}
  }
  return null;
}

function availableCollection(providerFamily: CollectorProviderFamily, modelFamily: string, authProfile: string, accountBoundary: string, providerBucket: ProviderBucket): ProviderCollection {
  if (providerBucket.remaining === null || providerBucket.remaining <= 0 || providerBucket.uncertainty !== "available") {
    return { providerFamily, modelFamily, bucket: providerBucket, failureClass: "rate_limited", availabilityState: "unavailable", redactedReason: "usage is not available" };
  }
  return {
    providerFamily,
    modelFamily,
    authProfileRef: safeRef("auth-profile", providerFamily, authProfile),
    authEvidenceRef: safeRef("auth-evidence", providerFamily, authProfile),
    credentialScopeRef: safeRef("principal-scope", providerFamily, authProfile),
    accountBoundaryRef: safeRef("account-boundary", providerFamily, accountBoundary),
    quotaEvidenceRef: safeRef("quota-evidence", providerFamily, providerBucket.resetBucket, String(providerBucket.remaining), providerBucket.resetAt ?? "unknown"),
    bucket: providerBucket,
    failureClass: "none",
    availabilityState: "healthy"
  };
}

function refusedCollection(providerFamily: CollectorProviderFamily, modelFamily: string, redactedReason: string): ProviderCollection {
  return { providerFamily, modelFamily, failureClass: "auth_missing", availabilityState: "unavailable", redactedReason };
}

function unknownUsageSnapshot(target: FlowDeskProviderUsageCollectorTargetV1, collection: ProviderCollection, ttlMinutes: number): FlowDeskUsageSnapshotV1 {
  const uncertainty = collection.bucket?.uncertainty === "stale" ? "stale" : collection.bucket?.uncertainty === "provider_refused" ? "refused" : "unknown";
  return {
    schema_version: "flowdesk.usage_snapshot.v1",
    snapshot_id: target.usageSnapshotId,
    provider_family: target.providerFamily,
    model_family: target.modelFamily,
    freshness: uncertainty === "stale" ? "stale" : "unknown",
    freshness_ttl: uncertainty === "stale" ? ttlMinutes : 0,
    reset_time: collection.bucket?.resetAt ?? "unknown",
    reset_bucket: collection.bucket?.resetBucket ?? "unknown",
    dispatchability: "non_dispatchable",
    uncertainty_flags: [uncertainty],
    source_ref: target.sourceRef
  };
}

function claudeOAuthBuckets(payload: unknown, observedAt: number, defaults: ProviderBucket[]): ProviderBucket[] {
  const record = isRecord(payload) ? payload : {};
  return [
    claudeUsageBucket("claude-5h", defaults[0], record.five_hour, observedAt),
    claudeUsageBucket("claude-weekly", defaults[1], record.seven_day, observedAt)
  ];
}

function claudeUsageBucket(resetBucket: string, defaultBucket: ProviderBucket | undefined, value: unknown, observedAt: number): ProviderBucket {
  const rawBucket = isRecord(value) ? value : undefined;
  if (!rawBucket || !defaultBucket) return defaultBucket ?? bucket(resetBucket, "%", null, undefined, "unknown");
  const calculated = calculateRemainingUsagePercent({ utilizationPercent: numberField(rawBucket, "utilization"), resetAt: stringField(rawBucket, "resets_at"), observedAt, expiredResetBehavior: "reset_to_full" });
  return bucket(resetBucket, "%", calculated.remaining, calculated.reset_at, calculated.uncertainty);
}

function codexLiveBuckets(payload: unknown, observedAt: number): ProviderBucket[] {
  const record = isRecord(payload) ? payload : {};
  const rateLimitPayload = isRecord(record.rate_limit_status) ? record.rate_limit_status : record;
  const details = firstRecord(rateLimitPayload.rate_limit, record.rate_limit);
  const primary = firstRecord(details?.primary_window, details?.primary, details);
  const secondary = isRecord(details?.secondary_window) ? details.secondary_window : undefined;
  const primaryBucket = codexRateLimitBucket("openai-gpt-5h", primary, observedAt);
  const secondaryBucket = secondary !== undefined ? codexRateLimitBucket("openai-weekly", secondary, observedAt) : undefined;
  return secondaryBucket !== undefined ? [primaryBucket, secondaryBucket] : [primaryBucket];
}

function codexRateLimitBucket(resetBucket: string, rateLimit: Record<string, unknown> | undefined, observedAt: number): ProviderBucket {
  if (!rateLimit) return bucket(resetBucket, "%", null, undefined, "unknown");
  const reportedRemainingPercent = numberField(rateLimit, "remaining_percent") ?? numberField(rateLimit, "remainingPercent");
  const usedPercent = numberField(rateLimit, "used_percent") ?? numberField(rateLimit, "usedPercent");
  const resetUnix = numberField(rateLimit, "reset_at") ?? numberField(rateLimit, "resets_at") ?? numberField(rateLimit, "resetsAt");
  const resetAfterSeconds = numberField(rateLimit, "reset_after_seconds") ?? numberField(rateLimit, "resetAfterSeconds");
  const calculated = calculateRemainingUsagePercent({ remainingPercent: reportedRemainingPercent, usedPercent, resetAtUnixSeconds: resetUnix, resetAfterSeconds, observedAt, expiredResetBehavior: "stale" });
  return bucket(resetBucket, "%", calculated.remaining, calculated.reset_at, calculated.uncertainty);
}

function geminiQuotaBuckets(quota: Record<string, unknown>, observedAt: number): ProviderBucket[] {
  const quotaBuckets = Array.isArray(quota.buckets) ? quota.buckets.filter(isRecord) : [];
  const selectedByBucket = new Map<string, ProviderBucket>();
  for (const quotaBucket of quotaBuckets) {
    const tokenType = stringField(quotaBucket, "tokenType");
    if (tokenType && tokenType !== "REQUESTS") continue;

    const modelId = stringField(quotaBucket, "modelId").toLowerCase();
    let resetBucket = "";
    if (modelId.includes("flash-lite") || modelId.includes("flash_lite")) {
      resetBucket = "gemini-flash-lite-daily";
    } else if (modelId.includes("flash")) {
      resetBucket = "gemini-flash-daily";
    } else if (modelId.includes("pro")) {
      const resetTimeStr = stringField(quotaBucket, "resetTime");
      const resetMs = resetTimeStr ? Date.parse(resetTimeStr) : NaN;
      if (Number.isFinite(resetMs) && (resetMs - observedAt) > 24 * 60 * 60 * 1000) {
        resetBucket = "gemini-pro-weekly";
      } else {
        resetBucket = "gemini-pro-daily";
      }
    }

    if (!resetBucket) continue;
    const remainingPercent = calculateRemainingUsagePercent({ remainingFraction: numberField(quotaBucket, "remainingFraction"), remainingAmount: stringField(quotaBucket, "remainingAmount"), resetAt: stringField(quotaBucket, "resetTime"), observedAt, expiredResetBehavior: "reset_to_full" });
    const candidate = bucket(resetBucket, "%", remainingPercent.remaining, remainingPercent.reset_at, remainingPercent.uncertainty);
    const existing = selectedByBucket.get(resetBucket);
    if (existing === undefined || existing.remaining === null || (candidate.remaining !== null && candidate.remaining < existing.remaining)) selectedByBucket.set(resetBucket, candidate);
  }
  const buckets = [...selectedByBucket.values()].sort((a, b) => geminiBucketRank(a.resetBucket) - geminiBucketRank(b.resetBucket));
  return buckets.length > 0 ? buckets : [bucket("gemini-unknown-5h", "%", null, undefined, "unknown")];
}

function geminiBucketRank(resetBucket: string): number {
  if (resetBucket === "gemini-pro-daily") return 0;
  if (resetBucket === "gemini-pro-weekly") return 1;
  if (resetBucket === "gemini-flash-daily") return 2;
  if (resetBucket === "gemini-flash-lite-daily") return 3;
  return 99;
}

function firstDispatchableBucket(buckets: ProviderBucket[]): ProviderBucket | undefined {
  return buckets
    .filter((candidate) => candidate.remaining !== null && candidate.remaining > 0 && candidate.resetAt !== undefined && candidate.uncertainty === "available")
    .sort((a, b) => (a.remaining ?? Number.POSITIVE_INFINITY) - (b.remaining ?? Number.POSITIVE_INFINITY))[0];
}

function firstKnownBucket(buckets: ProviderBucket[]): ProviderBucket | undefined {
  return buckets.find((candidate) => candidate.remaining !== null && candidate.resetAt !== undefined && candidate.uncertainty === "available");
}

async function readClaudeOAuthCredentials(homeDir: string, filesystem: FlowDeskProviderUsageFileSystemV1, options: FlowDeskProviderUsageCollectorOptionsV1): Promise<{ accessToken: string; refreshToken?: string; expiresAt?: number } | null> {
  const keychainCreds = readClaudeKeychainCredentials(options);
  if (keychainCreds) return keychainCreds;
  const credentialsPath = claudeConfigDirs(homeDir, options.env).map((configDir) => path.join(configDir, ".credentials.json")).find((candidate) => filesystem.exists(candidate));
  if (!credentialsPath) return null;
  try {
    return normalizeClaudeCredentials(JSON.parse(filesystem.readFile(credentialsPath)) as unknown);
  } catch {
    return null;
  }
}

function readClaudeKeychainCredentials(options: FlowDeskProviderUsageCollectorOptionsV1): { accessToken: string; refreshToken?: string; expiresAt?: number } | null {
  const credentialCommand = options.execFile;
  if (!credentialCommand) return null;
  const service = claudeKeychainServiceName(options.env);
  const candidateAccounts: Array<string | undefined> = [];
  try {
    const username = userInfo().username?.trim();
    if (username) candidateAccounts.push(username);
  } catch {}
  candidateAccounts.push(undefined);
  for (const account of candidateAccounts) {
    try {
      const args = account ? ["find-generic-password", "-s", service, "-a", account, "-w"] : ["find-generic-password", "-s", service, "-w"];
      const creds = normalizeClaudeCredentials(JSON.parse(credentialCommand("/usr/bin/security", args)) as unknown);
      if (creds) return creds;
    } catch {}
  }
  return null;
}

function normalizeClaudeCredentials(value: unknown): { accessToken: string; refreshToken?: string; expiresAt?: number } | null {
  if (!isRecord(value)) return null;
  const nested = isRecord(value.claudeAiOauth) ? value.claudeAiOauth : value;
  const accessToken = firstNonEmpty(stringField(nested, "accessToken"), stringField(nested, "access_token"));
  if (!accessToken) return null;
  const refreshToken = firstNonEmpty(stringField(nested, "refreshToken"), stringField(nested, "refresh_token"));
  const expiresAt = numberField(nested, "expiresAt") ?? numberField(nested, "expires_at");
  return { accessToken, ...(refreshToken ? { refreshToken } : {}), ...(expiresAt === undefined ? {} : { expiresAt }) };
}

async function resolveClaudeAccessToken(creds: { accessToken: string; refreshToken?: string; expiresAt?: number }, fetcher: FlowDeskProviderUsageFetchV1, observedAt: number): Promise<string | null> {
  const expiresAt = creds.expiresAt === undefined || creds.expiresAt > 10_000_000_000 ? creds.expiresAt : creds.expiresAt * 1000;
  if (expiresAt === undefined || expiresAt > observedAt + 60_000) return creds.accessToken;
  if (!creds.refreshToken) return null;
  const form = new URLSearchParams({ grant_type: "refresh_token", refresh_token: creds.refreshToken, client_id: CLAUDE_OAUTH_CLIENT_ID });
  const response = await fetcher(CLAUDE_OAUTH_REFRESH_URL, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  if (!response.ok) return null;
  const parsed = JSON.parse(await response.text()) as unknown;
  return isRecord(parsed) ? firstNonEmpty(stringField(parsed, "access_token"), stringField(parsed, "accessToken")) || null : null;
}

function readCodexCredentials(configDirs: string[], filesystem: FlowDeskProviderUsageFileSystemV1, options: FlowDeskProviderUsageCollectorOptionsV1): { auth: Record<string, unknown>; configDir: string } | null {
  for (const configDir of configDirs) {
    const authPath = path.join(configDir, "auth.json");
    if (!filesystem.exists(authPath)) continue;
    try {
      const auth = JSON.parse(filesystem.readFile(authPath)) as unknown;
      if (isRecord(auth)) return { auth, configDir };
    } catch {}
  }
  const credentialCommand = options.execFile;
  const configDir = configDirs[0];
  if (!configDir || !credentialCommand) return null;
  try {
    const auth = JSON.parse(credentialCommand("/usr/bin/security", ["find-generic-password", "-s", CODEX_KEYRING_SERVICE, "-a", codexKeyringAccount(configDir), "-w"])) as unknown;
    if (isRecord(auth)) return { auth, configDir };
  } catch {}
  return null;
}

function resolveCodexBaseUrl(configDir: string, filesystem: FlowDeskProviderUsageFileSystemV1): string {
  const configPath = path.join(configDir, "config.toml");
  if (!filesystem.exists(configPath)) return CODEX_DEFAULT_CHATGPT_BASE_URL;
  const match = filesystem.readFile(configPath).match(/^\s*chatgpt_base_url\s*=\s*["']([^"']+)["']/m);
  if (!match?.[1]) return CODEX_DEFAULT_CHATGPT_BASE_URL;
  const base = match[1].replace(/\/+$/, "");
  return base.endsWith("/backend-api") ? base : `${base}/backend-api`;
}

function codexUsageUrl(baseUrl: string): string {
  return baseUrl.includes("/backend-api") ? `${baseUrl}/wham/usage` : `${baseUrl}/api/codex/usage`;
}

async function refreshGeminiAccessToken(refreshToken: string, clientId: string, clientSecret: string, fetcher: FlowDeskProviderUsageFetchV1): Promise<string> {
  const form = new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" });
  const response = await fetcher(GEMINI_TOKEN_ENDPOINT, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() });
  if (!response.ok) throw new Error(`Gemini token refresh failed: ${response.status}`);
  const parsed = JSON.parse(await response.text()) as unknown;
  const accessToken = isRecord(parsed) ? stringField(parsed, "access_token") : "";
  if (!accessToken) throw new Error("Gemini token refresh returned no access token");
  return accessToken;
}

async function codeAssistPost(method: string, body: Record<string, unknown>, accessToken: string, fetcher: FlowDeskProviderUsageFetchV1): Promise<Record<string, unknown>> {
  const response = await fetcher(`${GEMINI_CODE_ASSIST_ENDPOINT}:${method}`, { method: "POST", headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
  if (!response.ok) throw new Error(`Gemini ${method} failed: ${response.status}`);
  const parsed = JSON.parse(await response.text()) as unknown;
  return isRecord(parsed) ? parsed : {};
}

function calculateRemainingUsagePercent(input: RemainingPercentInput): RemainingPercentResult {
  const observedAt = input.observedAt ?? Date.now();
  const resetAt = resolveResetAt(input, observedAt);
  const expiredBehavior = input.expiredResetBehavior ?? "stale";
  if (resetAt && Date.parse(resetAt) <= observedAt) return expiredBehavior === "reset_to_full" ? availableResult(100, 0, resetAt) : { remaining: null, used: null, reset_at: resetAt, uncertainty: "stale" };
  const directRemaining = firstFinite(input.remainingPercent, percentFromFraction(input.remainingFraction), percentFromRemainingAmount(input.remainingAmount));
  if (directRemaining !== null) {
    const remaining = clampPercent(directRemaining);
    return availableResult(remaining, 100 - remaining, resetAt);
  }
  const used = firstFinite(input.usedPercent, input.utilizationPercent);
  if (used !== null) {
    const usedPercent = clampPercent(used);
    return availableResult(100 - usedPercent, usedPercent, resetAt);
  }
  return { remaining: null, used: null, ...(resetAt ? { reset_at: resetAt } : {}), uncertainty: "unknown" };
}

function availableResult(remaining: number, used: number, resetAt: string | undefined): RemainingPercentResult {
  return { remaining, used, ...(resetAt ? { reset_at: resetAt } : {}), uncertainty: "available" };
}

function resolveResetAt(input: RemainingPercentInput, observedAt: number): string | undefined {
  if (typeof input.resetAt === "string" && input.resetAt.trim() !== "") {
    const parsed = Date.parse(input.resetAt);
    return Number.isFinite(parsed) ? new Date(parsed).toISOString() : undefined;
  }
  if (typeof input.resetAtUnixSeconds === "number" && Number.isFinite(input.resetAtUnixSeconds) && input.resetAtUnixSeconds > 0) return new Date(input.resetAtUnixSeconds * 1000).toISOString();
  if (typeof input.resetAfterSeconds === "number" && Number.isFinite(input.resetAfterSeconds) && input.resetAfterSeconds > 0) return new Date(observedAt + input.resetAfterSeconds * 1000).toISOString();
  return undefined;
}

function bucket(resetBucket: string, unit: string, remaining: number | null, resetAt: string | undefined, uncertainty: UsageUncertainty): ProviderBucket {
  void unit;
  return { resetBucket, remaining, ...(resetAt ? { resetAt } : {}), uncertainty };
}

function claudeConfigDirs(homeDir: string, env: Record<string, string | undefined> | undefined): string[] {
  return uniqueNonEmpty([env?.CLAUDE_CONFIG_DIR, path.join(homeDir, ".claude")]);
}

function codexConfigDirs(homeDir: string, env: Record<string, string | undefined> | undefined): string[] {
  return uniqueNonEmpty([env?.CODEX_HOME, path.join(homeDir, ".codex")]);
}

function geminiCredentialPaths(homeDir: string, env: Record<string, string | undefined> | undefined): string[] {
  const geminiHome = env?.GEMINI_CLI_HOME;
  return uniqueNonEmpty([geminiHome ? path.join(geminiHome, ".gemini", "oauth_creds.json") : undefined, geminiHome ? path.join(geminiHome, "oauth_creds.json") : undefined, path.join(homeDir, ".gemini", "oauth_creds.json")]);
}

function openCodeAuthPaths(homeDir: string, env: Record<string, string | undefined> | undefined): string[] {
  const dataHome = firstNonEmpty(env?.OPENCODE_DATA_DIR, env?.XDG_DATA_HOME ? path.join(env.XDG_DATA_HOME, "opencode") : undefined, path.join(homeDir, ".local", "share", "opencode"));
  return uniqueNonEmpty([dataHome ? path.join(dataHome, "auth.json") : undefined]);
}

function openCodeGeminiAuthPackageEntrypoints(homeDir: string, env: Record<string, string | undefined> | undefined): string[] {
  // Consider every plausible OpenCode cache home, not only the env-derived one.
  // The MCP/tool-host process can be launched with a different (or missing)
  // OPENCODE_CACHE_DIR/XDG_CACHE_HOME than the active plugin, so always include
  // the home-relative default in addition to the configured cache home. This
  // keeps the public OAuth client metadata inference robust to env drift
  // without storing any client secret in FlowDesk source.
  const cacheHomes = uniqueNonEmpty([
    env?.OPENCODE_CACHE_DIR,
    env?.XDG_CACHE_HOME ? path.join(env.XDG_CACHE_HOME, "opencode") : undefined,
    path.join(homeDir, ".cache", "opencode"),
  ]);
  const relativeEntrypoints = [
    path.join("packages", "opencode-gemini-auth@latest", "node_modules", "opencode-gemini-auth", "dist", "index.js"),
    path.join("packages", "opencode-gemini-auth@latest", "dist", "index.js"),
    path.join("packages", "opencode-gemini-auth", "node_modules", "opencode-gemini-auth", "dist", "index.js"),
    path.join("node_modules", "opencode-gemini-auth", "dist", "index.js"),
  ];
  const candidates: string[] = [];
  for (const cacheHome of cacheHomes) {
    for (const relative of relativeEntrypoints) {
      candidates.push(path.join(cacheHome, relative));
    }
  }
  // Also try the local OpenCode config install location, where the user can have
  // opencode-gemini-auth installed as a normal dependency.
  const configHome = firstNonEmpty(env?.OPENCODE_CONFIG_DIR, path.join(homeDir, ".config", "opencode"));
  if (configHome) {
    candidates.push(path.join(configHome, "node_modules", "opencode-gemini-auth", "dist", "index.js"));
  }
  return uniqueNonEmpty(candidates);
}

function claudeKeychainServiceName(env: Record<string, string | undefined> | undefined): string {
  const configDir = env?.CLAUDE_CONFIG_DIR;
  const defaultService = configDir ? `Claude Code-credentials-${createHash("sha256").update(configDir).digest("hex").slice(0, 8)}` : "Claude Code-credentials";
  return firstNonEmpty(env?.CLAUDE_CODE_KEYCHAIN_SERVICE, env?.CLAUDE_KEYCHAIN_SERVICE) || defaultService;
}

function normalizeHomeDir(configuredHome: string | undefined, env: Record<string, string | undefined> | undefined): string {
  return firstNonEmpty(configuredHome, env?.HOME, env?.USERPROFILE) || homedir();
}

function codexKeyringAccount(configDir: string): string {
  return `cli|${createHash("sha256").update(configDir).digest("hex").slice(0, 16)}`;
}

function safeRef(prefix: string, ...parts: string[]): string {
  return `${prefix}-${createHash("sha256").update(parts.join("\u001f")).digest("hex").slice(0, 16)}`;
}

function percentFromFraction(value: number | null | undefined): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value * 100 : null;
}

function percentFromRemainingAmount(raw: string | null | undefined): number | null {
  const value = raw?.trim().toLowerCase();
  if (!value) return null;
  if (value.endsWith("%")) {
    const parsed = Number.parseFloat(value.slice(0, -1));
    return Number.isFinite(parsed) ? parsed : null;
  }
  if (value.includes("/")) {
    const [left, right] = value.split("/", 2).map((part) => Number.parseFloat(part.trim()));
    return Number.isFinite(left) && Number.isFinite(right) && right > 0 ? (left / right) * 100 : null;
  }
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return parsed > 1 ? parsed : parsed * 100;
}

function firstFinite(...values: Array<number | null | undefined>): number | null {
  return values.find((value) => typeof value === "number" && Number.isFinite(value)) ?? null;
}

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value));
}

function firstNonEmpty(...values: Array<string | undefined>): string {
  return values.find((value) => typeof value === "string" && value.trim() !== "")?.trim() ?? "";
}

function stringField(record: Record<string, unknown> | undefined, field: string): string {
  const value = record?.[field];
  return typeof value === "string" ? value.trim() : "";
}

function numberField(record: Record<string, unknown> | undefined, field: string): number | undefined {
  const value = record?.[field];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function firstRecord(...values: unknown[]): Record<string, unknown> | undefined {
  return values.find(isRecord);
}

function uniqueNonEmpty(values: Array<string | undefined>): string[] {
  return [...new Set(values.filter((value): value is string => typeof value === "string" && value.trim() !== "").map((value) => value.trim()))];
}
