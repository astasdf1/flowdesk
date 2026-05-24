import {
	type FlowDeskProductionApprovalSourceV1,
	type FlowDeskRuntimeLaneLaunchPlanV1,
	type FlowDeskSessionEvidenceReloadResultV1,
	type FlowDeskTopTierReviewPerspective,
	type FlowDeskTopTierReviewVerdictV1,
	reloadFlowDeskSessionEvidenceV1,
} from "@flowdesk/core";
import { recordFlowDeskLaneHeartbeatV1 } from "./lane-heartbeat-writer.js";
import {
	type FlowDeskManagedDispatchBetaOpenCodeClientV1,
	launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1,
	materializeFlowDeskObservedReviewerVerdictEvidenceV1,
	materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1,
	materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1,
	observeInjectedSdkReviewerVerdictV1,
	prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1,
	prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1,
} from "./managed-dispatch-adapter.js";

export interface FlowDeskRuntimeReviewerExecutionExpectationV1 {
	launchPlanEvidenceId: string;
	lanePlanRef: string;
	bindingRef: string;
	perspective: string;
	promptText: string;
	runningLifecycleEvidenceId: string;
	completeLifecycleEvidenceId: string;
	reviewerVerdictEvidenceId: string;
	outputRef: string;
	runtimeEchoRef: string;
	telemetryRef: string;
	title?: string;
}

const disabledAuthority = {
	productionRegistrationEligible: false,
	dispatchApprovalEligible: false,
	realOpenCodeDispatch: false,
	actualLaneLaunch: false,
	providerCall: false,
	runtimeExecution: false,
	fallbackAuthority: false,
	hardCancelOrNoReplyAuthority: false,
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function runtimeReviewerExecutionExpectationFromValue(
	value: unknown,
): FlowDeskRuntimeReviewerExecutionExpectationV1 | undefined {
	if (!isRecord(value)) return undefined;
	const required = [
		"launchPlanEvidenceId",
		"lanePlanRef",
		"bindingRef",
		"perspective",
		"promptText",
		"runningLifecycleEvidenceId",
		"completeLifecycleEvidenceId",
		"reviewerVerdictEvidenceId",
		"outputRef",
		"runtimeEchoRef",
		"telemetryRef",
	] as const;
	if (
		required.some(
			(key) => typeof value[key] !== "string" || value[key].trim().length === 0,
		)
	)
		return undefined;
	return {
		launchPlanEvidenceId: value.launchPlanEvidenceId as string,
		lanePlanRef: value.lanePlanRef as string,
		bindingRef: value.bindingRef as string,
		perspective: value.perspective as string,
		promptText: value.promptText as string,
		runningLifecycleEvidenceId: value.runningLifecycleEvidenceId as string,
		completeLifecycleEvidenceId: value.completeLifecycleEvidenceId as string,
		reviewerVerdictEvidenceId: value.reviewerVerdictEvidenceId as string,
		outputRef: value.outputRef as string,
		runtimeEchoRef: value.runtimeEchoRef as string,
		telemetryRef: value.telemetryRef as string,
		...(typeof value.title === "string" && value.title.trim().length > 0
			? { title: value.title }
			: {}),
	};
}

export function runtimeReviewerExecutionExpectationsFromValue(
	value: unknown,
): FlowDeskRuntimeReviewerExecutionExpectationV1[] | undefined {
	if (!Array.isArray(value) || value.length === 0) return undefined;
	const expectations = value.map(runtimeReviewerExecutionExpectationFromValue);
	return expectations.every(
		(expectation): expectation is FlowDeskRuntimeReviewerExecutionExpectationV1 =>
			expectation !== undefined,
	)
		? expectations
		: undefined;
}

function runtimeLaunchPlanFromReloadedEvidence(input: {
	reloadedEvidence: FlowDeskSessionEvidenceReloadResultV1;
	evidenceId: string;
}): FlowDeskRuntimeLaneLaunchPlanV1 | undefined {
	const entry = input.reloadedEvidence.entries.find(
		(candidate) =>
			candidate.evidenceClass === "runtime_lane_launch_plan" &&
			candidate.evidenceId === input.evidenceId,
	);
	return entry?.record as unknown as FlowDeskRuntimeLaneLaunchPlanV1 | undefined;
}

export function redactedRuntimeReviewerExecutionBlocked(reason: string) {
	return {
		adapterProfile: "runtime_reviewer_execution_bridge",
		status: "blocked_before_runtime_reviewer_execution",
		launchAttempted: false,
		writeAttempted: false,
		evidenceReloaded: false,
		redactedBlockReason: reason,
		safeNextActions: ["/flowdesk-status"],
		authority: { ...disabledAuthority, toolAuthority: false },
	};
}

export async function executeFlowDeskRuntimeReviewerExecutionBridgeV1(input: {
	client: FlowDeskManagedDispatchBetaOpenCodeClientV1;
	rootDir: string;
	request: Record<string, unknown>;
}): Promise<Record<string, unknown>> {
	const workflowId =
		typeof input.request.workflowId === "string"
			? input.request.workflowId
			: undefined;
	const attemptId =
		typeof input.request.attemptId === "string"
			? input.request.attemptId
			: undefined;
	const parentSessionId =
		typeof input.request.parentSessionId === "string"
			? input.request.parentSessionId
			: undefined;
	const observedAt =
		typeof input.request.observedAt === "string"
			? input.request.observedAt
			: new Date().toISOString();
	const expectations = runtimeReviewerExecutionExpectationsFromValue(
		input.request.verdictExpectations,
	);
	const consumedApproval = isRecord(input.request.consumedReviewerFanoutApproval)
		? (input.request
				.consumedReviewerFanoutApproval as unknown as FlowDeskProductionApprovalSourceV1)
		: undefined;
	if (
		workflowId === undefined ||
		attemptId === undefined ||
		parentSessionId === undefined ||
		expectations === undefined ||
		input.request.allowActualLaneLaunch !== true ||
		consumedApproval === undefined
	)
		return redactedRuntimeReviewerExecutionBlocked(
			"Runtime reviewer execution requires workflowId, attemptId, parentSessionId, allowActualLaneLaunch=true, consumedReviewerFanoutApproval, and verdictExpectations.",
		);
	const reloadedBefore = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.rootDir,
	});
	if (!reloadedBefore.ok || reloadedBefore.blocked.length > 0)
		return redactedRuntimeReviewerExecutionBlocked(
			"runtime reviewer execution evidence reload failed",
		);
	const verdicts: FlowDeskTopTierReviewVerdictV1[] = [];
	const lanes: Record<string, unknown>[] = [];
	let launchAttempted = false;
	let writeAttempted = false;
	for (const expectation of expectations) {
		const launchPlan = runtimeLaunchPlanFromReloadedEvidence({
			reloadedEvidence: reloadedBefore,
			evidenceId: expectation.launchPlanEvidenceId,
		});
		if (launchPlan === undefined) {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: "missing_launch_plan",
				redactedBlockReason: "runtime launch plan evidence is missing",
			});
			continue;
		}
		launchAttempted = true;
		const launchResult = await launchFlowDeskInjectedSdkRuntimeLaneFromPlanV1({
			client: input.client,
			launchPlan,
			request: {
				allowActualLaneLaunch: true,
				parentSessionId,
				promptText: expectation.promptText,
				dispatchMethod: "prompt",
				...(expectation.title === undefined
					? {}
					: { title: expectation.title }),
			},
		});
		const runningLifecycle =
			materializeFlowDeskRuntimeLaneLaunchLifecycleEvidenceV1({
				rootDir: input.rootDir,
				launchPlan,
				launchResult,
				evidenceId: expectation.runningLifecycleEvidenceId,
				observedAt,
			});
		writeAttempted = writeAttempted || runningLifecycle.writeAttempted;
		if (launchResult.status === "lane_launch_started") {
			const laneId = launchPlan.lane_id ?? "";
			const parentSessionRef = launchPlan.parent_session_ref ?? "";
			const agentRef = launchPlan.agent_ref ?? "";
			const providerQualifiedModelId =
				launchPlan.provider_qualified_model_id ?? "";
			if (
				laneId.length > 0 &&
				parentSessionRef.length > 0 &&
				agentRef.length > 0 &&
				providerQualifiedModelId.length > 0
			) {
				const heartbeat = recordFlowDeskLaneHeartbeatV1({
					rootDir: input.rootDir,
					workflowId,
					attemptId,
					laneId,
					parentSessionRef,
					agentRef,
					providerQualifiedModelId,
					state: "running",
					observedAt,
					progressSummaryLabel: `reviewer lane ${expectation.perspective} launch heartbeat`,
				});
				writeAttempted = writeAttempted || heartbeat.writeAttempted;
			}
		}
		if (launchResult.status !== "lane_launch_started") {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				redactedBlockReason: "runtime lane launch did not start",
			});
			continue;
		}
		const childSessionId = launchResult.childSessionRef?.startsWith("ses-")
			? launchResult.childSessionRef.slice("ses-".length)
			: undefined;
		if (childSessionId === undefined) {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				redactedBlockReason: "runtime lane launch did not return a child session ref",
			});
			continue;
		}
		const observation = await observeInjectedSdkReviewerVerdictV1({
			client: input.client,
			request: {
				sessionId: childSessionId,
				workflowId,
				lanePlanRef: expectation.lanePlanRef,
				bindingRef: expectation.bindingRef,
				perspective:
					expectation.perspective as FlowDeskTopTierReviewPerspective,
			},
		});
		if (observation.status !== "verdict_observed") {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				observationStatus: observation.status,
				redactedBlockReason: "typed reviewer verdict was not observed",
			});
			continue;
		}
		const observedVerdict = observation.verdict;
		if (observedVerdict === undefined) {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				observationStatus: observation.status,
				redactedBlockReason:
					"typed reviewer verdict observation did not include a verdict record",
			});
			continue;
		}
		const verdictMaterialization =
			materializeFlowDeskObservedReviewerVerdictEvidenceV1({
				rootDir: input.rootDir,
				observation,
				evidenceId: expectation.reviewerVerdictEvidenceId,
			});
		const completeLifecycle =
			materializeFlowDeskRuntimeLaneCompleteLifecycleEvidenceV1({
				rootDir: input.rootDir,
				launchPlan,
				launchResult,
				verdictObservation: observation,
				evidenceId: expectation.completeLifecycleEvidenceId,
				observedAt,
				outputRef: expectation.outputRef,
				runtimeEchoRef: expectation.runtimeEchoRef,
				telemetryRef: expectation.telemetryRef,
			});
		writeAttempted = true;
		if (
			verdictMaterialization.status !== "verdict_evidence_recorded" ||
			completeLifecycle.status !== "lane_lifecycle_recorded"
		) {
			lanes.push({
				launchPlanEvidenceId: expectation.launchPlanEvidenceId,
				perspective: expectation.perspective,
				launchStatus: launchResult.status,
				runningLifecycle: runningLifecycle.lifecycleState,
				observationStatus: observation.status,
				verdictMaterializationStatus: verdictMaterialization.status,
				completeLifecycle: completeLifecycle.lifecycleState,
				redactedBlockReason:
					"runtime reviewer durable evidence materialization failed",
			});
			continue;
		}
		verdicts.push(observedVerdict);
		lanes.push({
			launchPlanEvidenceId: expectation.launchPlanEvidenceId,
			perspective: expectation.perspective,
			launchStatus: launchResult.status,
			runningLifecycle: runningLifecycle.lifecycleState,
			observationStatus: observation.status,
			verdictMaterializationStatus: verdictMaterialization.status,
			completeLifecycle: completeLifecycle.lifecycleState,
			verdictId: observation.verdictId,
		});
	}
	const acceptance = prepareFlowDeskReviewerTypedVerdictAcceptanceAdapterV1({
		workflowId,
		attemptId,
		verdicts,
		consumedApproval,
	});
	const reloadedAfter = reloadFlowDeskSessionEvidenceV1({
		workflowId,
		rootDir: input.rootDir,
	});
	const durableLinkage = prepareFlowDeskDurableReviewerVerdictLinkageAdapterV1({
		workflowId,
		attemptId,
		verdicts,
		consumedApproval,
		reloadedEvidence: reloadedAfter,
	});
	return {
		adapterProfile: "runtime_reviewer_execution_bridge",
		status:
			durableLinkage.status === "durable_verdicts_accepted"
				? "runtime_reviewer_execution_completed"
				: "runtime_reviewer_execution_incomplete",
		launchAttempted,
		writeAttempted,
		evidenceReloaded: reloadedAfter.ok,
		workflowId,
		attemptId,
		laneCount: lanes.length,
		lanes,
		acceptanceStatus: acceptance.status,
		acceptedPerspectives: acceptance.acceptedPerspectives,
		durableLinkageStatus: durableLinkage.status,
		linkedVerdictCount: durableLinkage.linkedVerdictIds.length,
		linkedLifecycleCount: durableLinkage.linkedLifecycleRefs.length,
		blockedCount: reloadedAfter.blocked.length,
		safeNextActions: ["/flowdesk-status"],
		authority: {
			...durableLinkage.authority,
			toolAuthority: false,
		},
	};
}
