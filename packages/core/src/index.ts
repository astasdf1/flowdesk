export const flowdeskCorePackageName = "@flowdesk/core" as const;

export const flowdeskRelease1Scope = [
	"guarded-command-backed-workflows",
	"dry-run",
	"fake-runtime",
	"redacted-audit-debug",
	"no-real-dispatch",
] as const;

export const flowdeskNoRealDispatchBoundary = {
	releaseGate: "release1-general-use-mvp",
	realOpenCodeDispatch: "disabled",
	providerModelFallback: "disabled",
	hardChatCancelOrNoReply: "disabled",
	cliSubprocessDispatch: "disabled",
} as const;

export function describeFlowDeskCoreScaffold(): string {
	return `${flowdeskCorePackageName}: ${flowdeskNoRealDispatchBoundary.releaseGate}`;
}

export function canUseRealDispatchInRelease1(): false {
	return false;
}

export * from "./agent-profiles.js";
export * from "./audit.js";
export * from "./authority-promotion.js";
export * from "./bootstrap-foundation.js";
export * from "./chat-hook-authority-probe.js";
export * from "./chat-routing.js";
export * from "./command-manifest.js";
export * from "./config-policy.js";
export * from "./dispatch-attempt-manifest.js";
export * from "./external-auth-policy.js";
export * from "./fake-runtime.js";
export * from "./fallback-decision.js";
export * from "./fds1-schema-probe-result.js";
export * from "./guard-boundary.js";
export * from "./guarded-dry-run.js";
export * from "./hook-harness.js";
export * from "./lane-lifecycle-record.js";
export * from "./lane-observability.js";
export * from "./model-availability-cache.js";
export * from "./operational-intelligence.js";
export * from "./plan.js";
export * from "./production-approval-source.js";
export * from "./production-enablement.js";
export * from "./production-verification.js";
export * from "./provider-failures.js";
export * from "./provider-usage-collector.js";
export * from "./redaction.js";
export * from "./release1-contracts.js";
export * from "./retry.js";
export * from "./reviewer-lane-conformance.js";
export * from "./sanitized-auth-capture.js";
export * from "./schema-artifacts.js";
export * from "./schema-registry.js";
export * from "./session-evidence.js";
export * from "./state-paths.js";
export * from "./state-store.js";
export * from "./status.js";
export * from "./tool-contract-fixtures.js";
export * from "./top-tier-reviewer-lane-probe.js";
export * from "./usage-health.js";
export * from "./validators.js";
