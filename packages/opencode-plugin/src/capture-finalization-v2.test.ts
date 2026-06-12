import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildFlowDeskPluginAdapterOutputObservationV2,
	finalizeFlowDeskPluginAdapterCaptureV2,
	validateFlowDeskPluginAdapterCaptureFinalizationV2,
	validateFlowDeskPluginAdapterOutputObservationV2,
} from "./capture-finalization-v2.js";

describe("finalizeFlowDeskPluginAdapterCaptureV2", () => {
	test("terminal marker plus text captures final text and is synthesis-safe", () => {
		const observation = buildFlowDeskPluginAdapterOutputObservationV2({
			latestText: "final answer",
			terminalMarkerObserved: true,
			terminalReason: "stop",
		});

		const result = finalizeFlowDeskPluginAdapterCaptureV2({ observation });

		assert.equal(result.decision, "final_text_captured");
		assert.equal(result.captured_text, "final answer");
		assert.equal(result.usable_for_synthesis, true);
		assert.equal(result.retry_state, undefined);
		assert.deepEqual(validateFlowDeskPluginAdapterOutputObservationV2(observation), { ok: true, errors: [] });
		assert.deepEqual(validateFlowDeskPluginAdapterCaptureFinalizationV2(result), { ok: true, errors: [] });
	});

	test("terminal marker plus empty body with retry remaining awaits body capture and is not synthesis-safe", () => {
		const observation = buildFlowDeskPluginAdapterOutputObservationV2({
			terminalMarkerObserved: true,
			terminalReason: "stop",
		});

		const result = finalizeFlowDeskPluginAdapterCaptureV2({
			observation,
			attemptCount: 0,
			maxAttempts: 2,
		});

		assert.equal(result.decision, "awaiting_body_capture");
		assert.equal(result.captured_text, undefined);
		assert.equal(result.usable_for_synthesis, false);
		assert.deepEqual(result.retry_state, {
			attempt_count: 0,
			max_attempts: 2,
			next_action: "retry_body_capture",
		});
	});

	test("empty terminal followed by later adapter text captures late final text and is synthesis-safe", () => {
		const emptyTerminal = buildFlowDeskPluginAdapterOutputObservationV2({
			terminalMarkerObserved: true,
			terminalReason: "stop",
		});
		const awaiting = finalizeFlowDeskPluginAdapterCaptureV2({
			observation: emptyTerminal,
			attemptCount: 0,
			maxAttempts: 2,
		});
		const laterText = buildFlowDeskPluginAdapterOutputObservationV2({
			latestText: "late final answer",
			terminalMarkerObserved: false,
		});

		const result = finalizeFlowDeskPluginAdapterCaptureV2({
			observation: laterText,
			previousFinalization: awaiting,
			attemptCount: 1,
			maxAttempts: 2,
		});

		assert.equal(result.decision, "late_final_text_captured");
		assert.equal(result.finalization_state, "additive");
		assert.equal(result.captured_text, "late final answer");
		assert.equal(result.usable_for_synthesis, true);
	});

	test("retry exhausted with step-finish empty body still awaits external timeout or failure", () => {
		const observation = buildFlowDeskPluginAdapterOutputObservationV2({
			terminalMarkerObserved: true,
			terminalReason: "stop",
		});

		const result = finalizeFlowDeskPluginAdapterCaptureV2({
			observation,
			attemptCount: 2,
			maxAttempts: 2,
		});

		assert.equal(result.decision, "awaiting_body_capture");
		assert.equal(result.usable_for_synthesis, false);
		assert.deepEqual(result.retry_state, {
			attempt_count: 2,
			max_attempts: 2,
			next_action: "stop",
		});
	});

	test("tool_trace_only is not synthesis-safe", () => {
		const observation = buildFlowDeskPluginAdapterOutputObservationV2({
			toolTracePartCount: 1,
			messageCount: 1,
		});

		const result = finalizeFlowDeskPluginAdapterCaptureV2({ observation });

		assert.equal(observation.output_kind, "tool_trace_only");
		assert.equal(observation.usable_for_synthesis, false);
		assert.equal(result.decision, "tool_trace_only");
		assert.equal(result.usable_for_synthesis, false);
	});
});

describe("capture finalization v2 validators", () => {
	test("validator rejects authority flags true and opencode_internal_validation_performed true", () => {
		const observation = buildFlowDeskPluginAdapterOutputObservationV2({ latestText: "final" });
		const finalization = finalizeFlowDeskPluginAdapterCaptureV2({ observation });

		const invalidObservation = {
			...observation,
			dispatch_authority_enabled: true,
			provider_call_made: true,
			runtime_execution: true,
			actual_lane_launch: true,
			fallback_authority_enabled: true,
			write_authority_enabled: true,
			opencode_internal_validation_performed: true,
		};
		const invalidFinalization = {
			...finalization,
			dispatch_authority_enabled: true,
			provider_call_made: true,
			runtime_execution: true,
			actual_lane_launch: true,
			fallback_authority_enabled: true,
			write_authority_enabled: true,
			opencode_internal_validation_performed: true,
		};

		const observationValidation = validateFlowDeskPluginAdapterOutputObservationV2(invalidObservation);
		const finalizationValidation = validateFlowDeskPluginAdapterCaptureFinalizationV2(invalidFinalization);

		assert.equal(observationValidation.ok, false);
		assert.equal(finalizationValidation.ok, false);
		assert.equal(observationValidation.errors.length, 7);
		assert.equal(finalizationValidation.errors.length, 7);
		assert.ok(observationValidation.errors.includes("plugin_adapter_output_observation.dispatch_authority_enabled must be false"));
		assert.ok(observationValidation.errors.includes("plugin_adapter_output_observation.opencode_internal_validation_performed must be false"));
		assert.ok(finalizationValidation.errors.includes("plugin_adapter_capture_finalization.dispatch_authority_enabled must be false"));
		assert.ok(finalizationValidation.errors.includes("plugin_adapter_capture_finalization.opencode_internal_validation_performed must be false"));
	});
});
