import type {
  FlowDeskTopTierReviewerLaneProbeOutcome,
  FlowDeskTopTierReviewerLaneProbeRequestV1,
  FlowDeskTopTierReviewerLaneProbeResultV1
} from "./release1-contracts.js";
import { validateTopTierReviewerLaneProbeRequestV1 } from "./validators.js";

export interface FlowDeskTopTierReviewerLaneProbeEvaluatorContextV1 {
  observedAt?: string;
  forceFailure?: {
    label: string;
    missingEvidence: "auth" | "usage" | "quota" | "provider_health" | "runtime_echo" | "telemetry";
  };
}

const DEFAULT_OBSERVED_AT = "2026-05-19T00:00:00.000Z";

function probeResult(
  request: FlowDeskTopTierReviewerLaneProbeRequestV1,
  outcome: FlowDeskTopTierReviewerLaneProbeOutcome,
  options: { observedAt: string; failureLabel?: string; evidenceRefs: readonly string[] }
): FlowDeskTopTierReviewerLaneProbeResultV1 {
  const safeNextActions = outcome === "probe_pass"
    ? (["/flowdesk-status"] as const)
    : (["/flowdesk-doctor", "/flowdesk-status"] as const);
  const result: FlowDeskTopTierReviewerLaneProbeResultV1 = {
    schema_version: "flowdesk.top_tier_reviewer_lane_probe.result.v1",
    probe_id: request.probe_id,
    channel: request.channel,
    outcome,
    observed_at: options.observedAt,
    evidence_refs: [...options.evidenceRefs],
    safe_next_actions: [...safeNextActions],
    dispatch_authority_enabled: false,
    provider_call_made: false,
    lane_launch_made: false
  };
  if (options.failureLabel !== undefined) result.failure_label = options.failureLabel;
  return result;
}

export function evaluateFlowDeskTopTierReviewerLaneProbeV1(
  request: unknown,
  context: FlowDeskTopTierReviewerLaneProbeEvaluatorContextV1 = {}
): FlowDeskTopTierReviewerLaneProbeResultV1 {
  const validation = validateTopTierReviewerLaneProbeRequestV1(request);
  const observedAt = context.observedAt ?? DEFAULT_OBSERVED_AT;
  if (!validation.ok) {
    return probeResult(
      {
        schema_version: "flowdesk.top_tier_reviewer_lane_probe.request.v1",
        probe_id: "probe-invalid",
        binding_ref: "binding-invalid",
        lane_plan_ref: "lane-plan-invalid",
        channel: "subtask_true_command_lane",
        agent_id: "reviewer",
        provider_qualified_model_id: "claude/claude-opus-4-5",
        perspective: "policy_security",
        auth_evidence_ref: "auth-invalid",
        usage_evidence_ref: "usage-invalid",
        quota_evidence_ref: "quota-invalid",
        provider_health_ref: "health-invalid",
        runtime_echo_ref: "echo-invalid",
        telemetry_ref: "telemetry-invalid",
        policy_pack_eligibility_ref: "policy-invalid",
        redaction_version: "redaction-v1",
        fake_runtime: true,
        dispatch_authority_enabled: false
      },
      "probe_invalid",
      {
        observedAt,
        failureLabel: validation.errors.slice(0, 3).join("; ").slice(0, 200) || "invalid probe request",
        evidenceRefs: []
      }
    );
  }

  const typedRequest = request as FlowDeskTopTierReviewerLaneProbeRequestV1;
  const evidenceMap: Record<NonNullable<FlowDeskTopTierReviewerLaneProbeEvaluatorContextV1["forceFailure"]>["missingEvidence"], string> = {
    auth: typedRequest.auth_evidence_ref,
    usage: typedRequest.usage_evidence_ref,
    quota: typedRequest.quota_evidence_ref,
    provider_health: typedRequest.provider_health_ref,
    runtime_echo: typedRequest.runtime_echo_ref,
    telemetry: typedRequest.telemetry_ref
  };
  if (context.forceFailure !== undefined) {
    const filtered = Object.entries(evidenceMap)
      .filter(([key]) => key !== context.forceFailure!.missingEvidence)
      .map(([, ref]) => ref);
    return probeResult(typedRequest, "probe_fail_closed", {
      observedAt,
      failureLabel: context.forceFailure.label,
      evidenceRefs: filtered
    });
  }
  return probeResult(typedRequest, "probe_pass", {
    observedAt,
    evidenceRefs: Object.values(evidenceMap)
  });
}
