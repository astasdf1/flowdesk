import assert from "node:assert/strict";
import test from "node:test";
import { classifyFlowDeskApprovalTextV1 } from "./index.js";

test("approval classifier recognizes explicit English and Korean approvals", () => {
  for (const text of ["I approve, proceed", "confirmed, go ahead", "승인합니다 진행해", "확인했어 그대로 진행"]) {
    const result = classifyFlowDeskApprovalTextV1(text);
    assert.equal(result.classification, "explicit_approval", text);
    assert.notEqual(result.reason_codes.length, 0, text);
  }
});

test("approval classifier separates weak or ambiguous approvals", () => {
  for (const text of ["sure, sounds good", "maybe go ahead", "좋아", "아마 괜찮을 것 같아"]) {
    const result = classifyFlowDeskApprovalTextV1(text);
    assert.equal(result.classification, "weak_ambiguous_approval", text);
    assert.notEqual(result.reason_codes.length, 0, text);
  }
});

test("approval classifier gives denial/cancel precedence", () => {
  for (const text of ["no, do not proceed", "cancel that approval", "아니 취소해", "진행하지 마"]) {
    const result = classifyFlowDeskApprovalTextV1(text);
    assert.equal(result.classification, "denial_cancel", text);
    assert.notEqual(result.reason_codes.length, 0, text);
  }
});

test("approval classifier returns no approval for unrelated text", () => {
  for (const text of ["what is the status", "please explain the plan", "상태 알려줘", "계획 설명해줘", "오늘 날씨 어때"]) {
    const result = classifyFlowDeskApprovalTextV1(text);
    assert.equal(result.classification, "no_approval", text);
    assert.deepEqual(result.reason_codes, ["no_approval_signal"], text);
  }
});
