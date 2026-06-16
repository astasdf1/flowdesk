import assert from "node:assert/strict";
import { describe, test } from "node:test";
import {
	buildFlowDeskSessionFinalizationObservation,
	evaluateFlowDeskSessionFinalizationEvidence,
	type FlowDeskSessionFinalTextKind,
} from "./session-finalization-evidence.js";

const authorityFlags = {
	dispatch_authority_enabled: false,
	provider_call_made: false,
	runtime_execution: false,
	actual_lane_launch: false,
	fallback_authority_enabled: false,
	write_authority_enabled: false,
} as const;

describe("evaluateFlowDeskSessionFinalizationEvidence", () => {
	test("marks safe_capture_ready only when text, allowed kind, idle, no running tools, and confidence is not low", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			observedTextRef: "text-ref-final-answer",
			observedTextCharCount: 12,
			finalTextKind: "assistant_final_text",
			sessionIdleState: "confirmed_idle",
			runningToolsState: "none_running_confirmed",
			confidence: "medium",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "safe_capture_ready");
		assert.equal(result.block_reason, "none");
		assert.equal(result.observed_text_ref, "text-ref-final-answer");
		assert.equal(result.observed_text_char_count, 12);
		assert.equal("latest_final_text" in result.observation, false);
		assert.equal("captured_text" in result, false);
		assert.equal(result.safe_capture_ready, true);
		assert.equal(result.usable_for_synthesis, true);
		assert.equal(result.requires_review, false);
		assert.equal(result.opencode_internal_validation_performed, false);
		assert.deepEqual(
			{
				dispatch_authority_enabled: result.dispatch_authority_enabled,
				provider_call_made: result.provider_call_made,
				runtime_execution: result.runtime_execution,
				actual_lane_launch: result.actual_lane_launch,
				fallback_authority_enabled: result.fallback_authority_enabled,
				write_authority_enabled: result.write_authority_enabled,
			},
			authorityFlags,
		);
	});

	test("empty step-finish remains awaiting_body_capture with blocked_text_absent and never captures", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			stepFinishObserved: true,
			sessionIdleState: "confirmed_idle",
			runningToolsState: "none_running_confirmed",
			confidence: "high",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "awaiting_body_capture");
		assert.equal(result.block_reason, "blocked_text_absent");
		assert.equal(result.observed_text_ref, undefined);
		assert.equal(result.observed_text_char_count, undefined);
		assert.equal(result.safe_capture_ready, false);
		assert.equal(result.usable_for_synthesis, false);
	});

	test("idle without text never captures", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			sessionIdleState: "confirmed_idle",
			runningToolsState: "none_running_confirmed",
			confidence: "high",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "blocked_text_absent");
		assert.equal(result.block_reason, "blocked_text_absent");
		assert.equal(result.observed_text_ref, undefined);
		assert.equal(result.observed_text_char_count, undefined);
		assert.equal(result.safe_capture_ready, false);
	});

	test("text with running tools blocks capture", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			observedTextRef: "text-ref-maybe-final-answer",
			sessionIdleState: "confirmed_idle",
			runningToolsState: "tools_running",
			confidence: "high",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "blocked_running_tools");
		assert.equal(result.block_reason, "running_tools_present");
		assert.equal(result.observed_text_ref, undefined);
		assert.equal(result.observed_text_char_count, undefined);
		assert.equal(result.safe_capture_ready, false);
		assert.equal(result.usable_for_synthesis, false);
	});

	test("legacy running tool state still blocks capture", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			observedTextRef: "text-ref-legacy-running-tools",
			sessionIdleState: "confirmed_idle",
			runningToolsState: "running_confirmed",
			confidence: "high",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "blocked_running_tools");
		assert.equal(result.block_reason, "running_tools_present");
		assert.equal(result.safe_capture_ready, false);
	});

	test("none_confirmed alias remains safe for backward-compatible evaluator inputs", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			observedTextRef: "text-ref-alias-none-confirmed",
			sessionIdleState: "confirmed_idle",
			runningToolsState: "none_confirmed",
			confidence: "high",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "safe_capture_ready");
		assert.equal(result.safe_capture_ready, true);
	});

	test("unknown tool state fails closed and requires review", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			observedTextCharCount: 20,
			sessionIdleState: "confirmed_idle",
			runningToolsState: "unknown",
			confidence: "high",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "requires_review");
		assert.equal(result.block_reason, "tool_state_unknown");
		assert.equal(result.requires_review, true);
		assert.equal(result.safe_capture_ready, false);
		assert.equal(result.observed_text_ref, undefined);
		assert.equal(result.observed_text_char_count, undefined);
	});

	test("low confidence blocks otherwise valid final text", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			observedTextRef: "text-ref-final-answer",
			sessionIdleState: "confirmed_idle",
			runningToolsState: "none_running_confirmed",
			confidence: "low",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "requires_review");
		assert.equal(result.block_reason, "confidence_low");
		assert.equal(result.safe_capture_ready, false);
	});

	test("process notes, tool trace only, and empty kinds are not auto-synthesis-safe", () => {
		const cases: Array<{ kind: FlowDeskSessionFinalTextKind; textRef?: string; charCount?: number }> = [
			{ kind: "process_notes", textRef: "text-ref-process-note" },
			{ kind: "tool_trace_only", charCount: 16 },
			{ kind: "empty" },
		];

		for (const { kind, textRef, charCount } of cases) {
			const observation = buildFlowDeskSessionFinalizationObservation({
				observedTextRef: textRef,
				observedTextCharCount: charCount,
				finalTextKind: kind,
				sessionIdleState: "confirmed_idle",
				runningToolsState: "none_running_confirmed",
				confidence: "high",
				stepFinishObserved: kind === "empty",
			});

			const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

			assert.equal(result.safe_capture_ready, false, kind);
			assert.equal(result.usable_for_synthesis, false, kind);
			assert.equal(result.observed_text_ref, undefined, kind);
			assert.equal(result.observed_text_char_count, undefined, kind);
			if (kind === "empty") {
				assert.equal(result.decision, "awaiting_body_capture");
				assert.equal(result.block_reason, "blocked_text_absent");
			} else {
				assert.equal(result.decision, "requires_review");
				assert.equal(result.block_reason, "unsupported_final_text_kind");
			}
		}
	});

	test("positive char count without ref is enough to prove text presence without storing raw text", () => {
		const observation = buildFlowDeskSessionFinalizationObservation({
			observedTextCharCount: 42,
			sessionIdleState: "confirmed_idle",
			runningToolsState: "none_running_confirmed",
			confidence: "high",
		});

		const result = evaluateFlowDeskSessionFinalizationEvidence(observation);

		assert.equal(result.decision, "safe_capture_ready");
		assert.equal(result.observed_text_ref, undefined);
		assert.equal(result.observed_text_char_count, 42);
		assert.equal(JSON.stringify(result).includes("latest_final_text"), false);
		assert.equal(JSON.stringify(result).includes("captured_text"), false);
	});
});
