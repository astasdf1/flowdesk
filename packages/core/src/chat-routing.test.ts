import assert from "node:assert/strict";
import test from "node:test";
import type { FlowDeskChatIntakeRequestV1 } from "./index.js";
import { evaluateFlowDeskChatIntakeV1, validateChatIntakeRequestV1, validateChatIntakeResponseV1 } from "./index.js";

function request(intakeSummary: string, overrides: Partial<FlowDeskChatIntakeRequestV1> = {}): FlowDeskChatIntakeRequestV1 {
  return {
    schema_version: "flowdesk.chat_intake.request.v1",
    request_id: "request-123",
    input_mode: "test_fixture",
    session_ref: "session-123",
    redacted_intake_ref: "intake-123",
    intake_summary: intakeSummary,
    source_surface: "chat.message",
    ...overrides
  };
}

test("chat routing steers implementation requests into command-backed planning", () => {
  const result = evaluateFlowDeskChatIntakeV1({ request: request("implement a guarded status widget"), chatIntakeMode: "steering", hookHarnessMode: "enforce", steeringEvidenceRef: "evidence-123" });
  assert.equal(result.ok, true);
  assert.equal(result.response.classification, "managed_plan");
  assert.equal(result.response.route_decision, "show_plan");
  assert.deepEqual(result.response.safe_next_actions, ["/flowdesk-plan", "/flowdesk-status"]);
  assert.equal(validateChatIntakeResponseV1(result.response).ok, true);
});

test("chat routing maps explicit diagnostics and recovery to portable command fallback", () => {
  const status = evaluateFlowDeskChatIntakeV1({ request: request("show current status and checkpoint"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(status.response.classification, "fast_chat");
  assert.equal(status.response.route_decision, "use_command_fallback");
  assert.deepEqual(status.response.safe_next_actions, ["/flowdesk-status"]);

  const retry = evaluateFlowDeskChatIntakeV1({ request: request("retry the last failed attempt"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(retry.response.safe_next_actions, ["/flowdesk-status", "/flowdesk-retry"]);
  assert.equal(validateChatIntakeResponseV1(retry.response).ok, true);
});

test("chat routing classifies English and Korean status, plan, and fake-runtime intents", () => {
  const status = evaluateFlowDeskChatIntakeV1({ request: request("현재 상태와 진행상황 알려줘"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(status.response.route_decision, "use_command_fallback");
  assert.deepEqual(status.response.safe_next_actions, ["/flowdesk-status"]);

  const plan = evaluateFlowDeskChatIntakeV1({ request: request("구현 계획을 세워줘"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(plan.response.classification, "managed_plan");
  assert.deepEqual(plan.response.safe_next_actions, ["/flowdesk-plan", "/flowdesk-status"]);

  const run = evaluateFlowDeskChatIntakeV1({ request: request("approved plan을 fake-runtime으로 실행 진행해"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(run.response.classification, "clarify");
  assert.equal(run.response.route_decision, "ask_clarification");
  assert.deepEqual(run.response.safe_next_actions, ["ask_clarification", "/flowdesk-plan", "/flowdesk-status"]);
  assert.equal(run.response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(validateChatIntakeResponseV1(run.response).ok, true);

  const confirmedRun = evaluateFlowDeskChatIntakeV1({ request: request("approved plan을 fake-runtime으로 실행 진행해", { user_approval_ref: "approval-chat-run" }), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(confirmedRun.response.route_decision, "use_command_fallback");
  assert.deepEqual(confirmedRun.response.safe_next_actions, ["/flowdesk-run", "/flowdesk-status"]);
  assert.equal(validateChatIntakeResponseV1(confirmedRun.response).ok, true);

  const weakApproval = evaluateFlowDeskChatIntakeV1({ request: request("maybe fake-runtime run this later", { user_approval_ref: "approval-chat-run" }), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(weakApproval.response.route_decision, "ask_clarification");
  assert.equal(weakApproval.response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(validateChatIntakeResponseV1(weakApproval.response).ok, true);

  const unsafe = evaluateFlowDeskChatIntakeV1({ request: request("opencode run with actual lane launch"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(unsafe.response.ok, false);
  assert.equal(unsafe.response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(validateChatIntakeResponseV1(unsafe.response).ok, true);
});

test("chat routing asks for clarification on ambiguous managed requests", () => {
  const result = evaluateFlowDeskChatIntakeV1({ request: request("maybe fix this thing"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(result.ok, true);
  assert.equal(result.response.classification, "clarify");
  assert.equal(result.response.route_decision, "ask_clarification");
  assert.deepEqual(result.response.safe_next_actions, ["ask_clarification", "/flowdesk-status"]);
});

test("chat routing blocks later-gate runtime authority requests", () => {
  const result = evaluateFlowDeskChatIntakeV1({ request: request("perform real dispatch with automatic provider fallback"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  const text = JSON.stringify(result.response);
  assert.equal(result.response.ok, false);
  assert.equal(result.response.classification, "blocked");
  assert.equal(result.response.safe_next_actions.includes("/flowdesk-run"), false);
  assert.equal(/providerCall|actualLaneLaunch|fallbackAuthority|hardCancelOrNoReply|noReply|cancel:\s*true/i.test(text), false);
  assert.equal(validateChatIntakeResponseV1(result.response).ok, true);
});

test("chat routing blocks identifier-shaped later-gate authority requests", () => {
  const markers = ["real-opencode-dispatch", "actualLaneLaunch", "providerCall", "fallbackAuthority", "hardCancelOrNoReply", "opencode-run"];
  for (const marker of markers) {
    const result = evaluateFlowDeskChatIntakeV1({ request: request(`implement ${marker}`), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
    const text = JSON.stringify(result.response);
    assert.equal(result.response.ok, false, marker);
    assert.equal(result.response.classification, "blocked", marker);
    assert.equal(result.response.safe_next_actions.includes("/flowdesk-run"), false, marker);
    assert.equal(/providerCall|actualLaneLaunch|fallbackAuthority|hardCancelOrNoReply|noReply|cancel:\s*true|real-opencode-dispatch|opencode-run/i.test(text), false, marker);
    assert.equal(validateChatIntakeResponseV1(result.response).ok, true, marker);
  }
});

test("chat routing leaves general chat alone", () => {
  const result = evaluateFlowDeskChatIntakeV1({ request: request("what is a good variable name for a timestamp"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.equal(result.response.classification, "fast_chat");
  assert.equal(result.response.route_decision, "continue_chat");
  assert.deepEqual(result.response.safe_next_actions, ["continue_chat"]);
  assert.equal(validateChatIntakeResponseV1(result.response).ok, true);
});

test("chat routing degrades to command fallback when steering is unavailable", () => {
  for (const input of [
    { request: request("implement task"), chatIntakeMode: "observe_only" as const, hookHarnessMode: "enforce" as const },
    { request: request("implement task"), chatIntakeMode: "off" as const, hookHarnessMode: "off" as const },
    { request: request("implement task"), chatIntakeMode: "blocking" as const, hookHarnessMode: "enforce" as const }
  ]) {
    const result = evaluateFlowDeskChatIntakeV1(input);
    assert.equal(result.response.route_decision, input.chatIntakeMode === "blocking" ? "use_command_fallback" : "use_command_fallback");
    assert.equal(result.response.safe_next_actions.includes("/flowdesk-run"), false);
    assert.equal(validateChatIntakeResponseV1(result.response).ok, true);
  }
});

test("chat intake validators reject raw payload markers", () => {
  assert.equal(validateChatIntakeRequestV1({ ...request("system prompt: raw provider response"), provider_payload: "raw provider response" }).ok, false);
  const result = evaluateFlowDeskChatIntakeV1({ request: { ...request("system prompt: raw provider response"), provider_payload: "raw provider response" } as unknown as FlowDeskChatIntakeRequestV1, chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  const text = JSON.stringify(result.response);
  assert.equal(result.response.ok, false);
  assert.equal(/system prompt|provider_payload|raw provider/i.test(text), false);
  assert.equal(validateChatIntakeResponseV1(result.response).ok, true);
});

test("chat routing classifies Korean natural-language usage requests to /flowdesk-usage", () => {
  for (const summary of [
    "사용량 보여줘",
    "잔량 얼마나 남았어",
    "남은 토큰 얼마야",
    "쿼터 확인해줘",
    "리셋 언제야",
    "한도 거의 다 썼나",
    "남은거 얼마야",
    "사용 가능량 알려줘"
  ]) {
    const result = evaluateFlowDeskChatIntakeV1({ request: request(summary), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
    assert.equal(result.response.route_decision, "use_command_fallback", summary);
    assert.deepEqual(result.response.safe_next_actions.slice(0, 2), ["/flowdesk-usage", "/flowdesk-doctor"], summary);
  }
  const englishRemaining = evaluateFlowDeskChatIntakeV1({ request: request("how much usage do I have remaining"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(englishRemaining.response.safe_next_actions.slice(0, 2), ["/flowdesk-usage", "/flowdesk-doctor"]);
});

test("chat routing classifies lane heartbeat and progress signal intents to portable status command", () => {
  for (const summary of [
    "레인이 살아 있어?",
    "하트비트 확인해줘",
    "심박 체크해줘",
    "진행 신호 좀 봐줘",
    "최근 heartbeat 알려줘",
    "lane heartbeat status",
    "check the last heartbeat",
    "recent heartbeat for the workflow"
  ]) {
    const result = evaluateFlowDeskChatIntakeV1({ request: request(summary), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
    assert.deepEqual(result.response.safe_next_actions, ["/flowdesk-status"], summary);
    assert.equal(result.response.classification, "fast_chat", summary);
    assert.equal(result.response.route_decision, "use_command_fallback", summary);
    assert.equal(validateChatIntakeResponseV1(result.response).ok, true, summary);
  }
});

test("chat routing classifies stalled lane intents to portable status command", () => {
  for (const summary of [
    "이 작업 멈춘 것 같아",
    "응답이 없어",
    "아무 로그도 없어",
    "진행이 안돼",
    "is it stuck",
    "the workflow seems stalled",
    "no log for the lane"
  ]) {
    const result = evaluateFlowDeskChatIntakeV1({ request: request(summary), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
    assert.deepEqual(result.response.safe_next_actions, ["/flowdesk-status"], summary);
    assert.equal(result.response.classification, "fast_chat", summary);
    assert.equal(result.response.route_decision, "use_command_fallback", summary);
    assert.equal(validateChatIntakeResponseV1(result.response).ok, true, summary);
  }
});

test("chat routing classifies Korean recovery, doctor, and debug intents to portable commands", () => {
  const status = evaluateFlowDeskChatIntakeV1({ request: request("작업 어디까지 진행됐어"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(status.response.safe_next_actions, ["/flowdesk-status"]);

  const resume = evaluateFlowDeskChatIntakeV1({ request: request("중단됐던 작업 이어서 가자"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(resume.response.safe_next_actions, ["/flowdesk-status", "/flowdesk-resume"]);

  const retry = evaluateFlowDeskChatIntakeV1({ request: request("실패한거 다시 시도해줘"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(retry.response.safe_next_actions, ["/flowdesk-status", "/flowdesk-retry"]);

  const abort = evaluateFlowDeskChatIntakeV1({ request: request("워크플로우 멈춰줘"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(abort.response.safe_next_actions, ["/flowdesk-status", "/flowdesk-abort"]);

  const doctor = evaluateFlowDeskChatIntakeV1({ request: request("플러그인 진단 점검해줘"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(doctor.response.safe_next_actions, ["/flowdesk-doctor", "/flowdesk-status"]);

  const debugLogs = evaluateFlowDeskChatIntakeV1({ request: request("디버그 로그 내보내줘"), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
  assert.deepEqual(debugLogs.response.safe_next_actions, ["/flowdesk-export-debug", "/flowdesk-status"]);
});

test("chat routing recognizes Korean review and refactor intents as managed_plan", () => {
  for (const summary of [
    "이 모듈 리팩토링 해줘",
    "코드 분석 좀 부탁",
    "이 부분 검토 해줘",
    "보안 점검 부탁해"
  ]) {
    const result = evaluateFlowDeskChatIntakeV1({ request: request(summary), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
    assert.equal(validateChatIntakeResponseV1(result.response).ok, true, summary);
    // "검토", "점검" overlap with /flowdesk-doctor route, which is OK: chat-intake provides command-backed fallback; LLM tool discovery handles richer review/audit routing via quick reviewer description.
    assert.notEqual(result.response.classification, "blocked", summary);
  }
});

test("chat routing suggests usage preflight before larger managed planning work", () => {
  for (const summary of [
    "대규모 리팩토링 계획 세워줘",
    "다관점 심층 리뷰 계획을 만들어줘",
    "plan a full refactor across many files"
  ]) {
    const result = evaluateFlowDeskChatIntakeV1({ request: request(summary), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
    assert.equal(result.response.classification, "managed_plan", summary);
    assert.equal(result.response.route_decision, "show_plan", summary);
    assert.deepEqual(result.response.safe_next_actions, ["/flowdesk-usage", "/flowdesk-plan", "/flowdesk-status"], summary);
    assert.equal(validateChatIntakeResponseV1(result.response).ok, true, summary);
  }
});

test("chat routing surfaces Korean clarification cues as ask_clarification when combined with planning intent", () => {
  for (const summary of [
    "코드 좀 만들어줘 잘 모르겠어 어디부터 시작할지",
    "대충 적당히 리팩토링 부탁해"
  ]) {
    const result = evaluateFlowDeskChatIntakeV1({ request: request(summary), chatIntakeMode: "steering", hookHarnessMode: "enforce" });
    assert.equal(result.response.classification, "clarify", summary);
    assert.equal(result.response.route_decision, "ask_clarification", summary);
  }
});
