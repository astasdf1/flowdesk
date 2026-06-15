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
export * from "./agent-registry.js";
export * from "./approval-classifier.js";
export * from "./audit.js";
export * from "./authority-promotion.js";
export * from "./bootstrap-foundation.js";
export * from "./chat-control-authority.js";
export * from "./chat-hook-authority-probe.js";
export * from "./chat-routing.js";
export * from "./command-manifest.js";
export * from "./compaction-runner.js";
export * from "./connector-gateway.js";
export * from "./config-policy.js";
export * from "./connector-profile.js";
export * from "./controlled-conformance-doc-write.js";
export * from "./controlled-redacted-audit-export-write.js";
export * from "./controlled-workspace-file-write.js";
export * from "./core-completion-safety-contracts.js";
export * from "./dispatch-attempt-manifest.js";
export * from "./dispatch-idempotency.js";
export * from "./external-auth-policy.js";
export * from "./fake-runtime.js";
export * from "./fake-remote-connector-adapter.js";
export * from "./fallback-decision.js";
export * from "./fallback-regate-plan.js";
export * from "./fds1-schema-probe-result.js";
export * from "./guard-boundary.js";
export * from "./guarded-dry-run.js";
export * from "./hook-harness.js";
export * from "./lane-heartbeat.js";
export * from "./lane-lifecycle-record.js";
export * from "./pending-abort.js";
export * from "./lane-observability.js";
export * from "./lane-stall-projection.js";
export * from "./managed-dispatch-bundle-evaluator.js";
export * from "./managed-dispatch-exposure-authorization.js";
export * from "./managed-dispatch-evidence-shape.js";
export * from "./model-availability-cache.js";
export * from "./operational-intelligence.js";
export * from "./plan.js";
export * from "./planning-evidence-common.js";
export * from "./pre-dispatch-audit-record.js";
export * from "./production-approval-source.js";
export * from "./observed-runtime-echo.js";
export * from "./plugin-verification-boundary.js";
export * from "./plugin-satisfiable-preparation.js";
export * from "./production-enablement.js";
export * from "./production-verification.js";
export * from "./provider-failures.js";
export * from "./provider-usage-collector.js";
export * from "./provider-evidence-writer.js";
export * from "./redaction.js";
export * from "./release1-contracts.js";
export * from "./remote-write-connector-gate.js";
export * from "./retry.js";
export * from "./retry-plan.js";
export * from "./reviewer-lane-conformance.js";
export * from "./runtime-lane-productization.js";
export * from "./sanitized-auth-capture.js";
export * from "./schema-artifacts.js";
export * from "./schema-registry.js";
export * from "./sdk-adapter-capability-smoke.js";
export * from "./schemas/index.js";
export * from "./session-evidence.js";
export * from "./state-paths.js";
export * from "./state-store.js";
export * from "./status.js";
export * from "./task-agent-assignment.js";
export * from "./task-graph.js";
export * from "./task-model-selection.js";
export * from "./task-result.js";
export * from "./tool-contract-fixtures.js";
export * from "./top-tier-reviewer-lane-probe.js";
export * from "./usage-aware-model-resolver.js";
export * from "./usage-health.js";
export * from "./shared/jcs.js";
export * from "./validators.js";
export * from "./validators/github-connector-production-publish.js";
export * from "./workflow-dispatch-plan.js";
export * from "./workflow-authoring-result.js";
export * from "./workflow-synthesis.js";
