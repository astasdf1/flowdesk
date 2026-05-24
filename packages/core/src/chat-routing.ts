import type {
  ChatIntakeModeV1,
  FlowDeskChatIntakeRequestV1,
  FlowDeskChatIntakeResponseV1,
  HookHarnessModeV1,
  OpaqueRef,
  SafeNextAction
} from "./release1-contracts.js";
import type { ValidationResult } from "./validators.js";
import { invalid, valid, validateChatIntakeRequestV1, validateChatIntakeResponseV1, validateOpaqueRef } from "./validators.js";

export interface FlowDeskChatRoutingInputV1 {
  request: FlowDeskChatIntakeRequestV1;
  chatIntakeMode?: ChatIntakeModeV1 | "blocking";
  hookHarnessMode?: HookHarnessModeV1;
  steeringEvidenceRef?: OpaqueRef;
  redactedIntakeRef?: OpaqueRef;
  planningDocumentAvailable?: boolean;
}

export interface FlowDeskChatRoutingEvaluationV1 extends ValidationResult {
  response: FlowDeskChatIntakeResponseV1;
}

const fallbackActions = ["/flowdesk-doctor", "/flowdesk-status", "/flowdesk-export-debug"] as const;
const unsafeLaterGatePattern = /\b(real[\s_-]*(?:opencode[\s_-]*)?dispatch|realOpenCodeDispatch|actual[\s_-]*lane[\s_-]*launch|actualLaneLaunch|provider[\s_-]*(?:call|request|api)|providerCall|automatic[\s_-]*(?:fallback|reselection)|automaticFallbackOrReselection|fallback[\s_-]*(?:provider|model|authority)|fallbackAuthority|reselect(?:ion)?|hard[\s_-]*(?:cancel|stop|no[\s_-]*reply)|hardCancelOrNoReply|noReply|no[\s_-]*reply|cancel:\s*true|stop:\s*true|opencode[\s_-]*run)\b/i;
const planningPattern = /\b(implement|add|build|create|fix|change|refactor|test|write|plan|debug|investigate|review|improve|audit|critique|assess|evaluate|analyze|inspect)\b|(?:계획|구현|만들|개발|수정|버그|개선|리팩토|테스트|작성|조사|분석|리뷰|검토|점검|진단|평가)/i;
const executionLikePattern = /\b(?:run|execute|start|kick[\s_-]*off|launch)\b.{0,50}\b(?:fake[\s_-]*runtime|guarded[\s_-]*dry[\s_-]*run|dry[\s_-]*run|plan|workflow)\b|\b(?:fake[\s_-]*runtime|guarded[\s_-]*dry[\s_-]*run|dry[\s_-]*run)\b|(?:실행|진행(?:해|하))|(?:(?:fake[\s_-]*runtime|guarded[\s_-]*dry[\s_-]*run|dry[\s_-]*run|페이크|드라이런|계획|플랜|workflow|워크플로(?:우)?).{0,40}(?:돌려(?:줘|봐)?|시작\s*(?:해|하|시켜)|런(?:해|시켜)))|(?:(?:돌려(?:줘|봐)?|시작\s*(?:해|하|시켜)|런(?:해|시켜)).{0,40}(?:fake[\s_-]*runtime|guarded[\s_-]*dry[\s_-]*run|dry[\s_-]*run|페이크|드라이런|계획|플랜|workflow|워크플로(?:우)?))/i;
const explicitApprovalPattern = /\b(?:approve(?:d)?|confirm(?:ed)?|yes|proceed|go ahead|ok(?:ay)?|sure|sounds good)\b|(?:승인|확인|동의|좋아|네|예|오케이|진행\s*(?:해|하|하세요)|실행\s*(?:해|하|하세요)|그렇게\s*해|해주세요)/i;
const clarificationPattern = /\b(maybe|not sure|unclear|something|stuff|thing|help me with it|continue this|kinda|sort of|whatever)\b|(?:잘\s*모르(?:겠|겠어)|애매|뭐였|뭔가|어떻게\s*해(?:야)?|뭐\s*해야|아무거나|적당히|대충)/i;
const proactiveUsagePreflightPattern = /\b(?:large|big|long|multi[\s_-]*step|multi[\s_-]*perspective|multi[\s_-]*model|extensive|whole|entire|full[\s_-]*(?:pass|review|refactor)|many files|agentic loop|autonomous|refactor|migration|audit|review)\b|(?:큰\s*작업|대규모|장시간|오래\s*걸|전체|전부|다관점|다각도|멀티\s*(?:모델|관점)|여러\s*관점|리팩토링|마이그레이션|긴\s*작업|전체\s*완료|끝까지|심층\s*(?:리뷰|검토|분석))/i;
const continuousWorkPattern = /\b(?:continue\s+(?:if\s+you\s+have\s+next\s+steps|until\s+blocked|with\s+the\s+(?:plan|design)|the\s+(?:whole|entire)\s+(?:plan|design)|working)|keep\s+(?:going|working)|work\s+through\s+the\s+(?:whole\s+)?(?:plan|design)|proceed\s+(?:with\s+)?(?:the\s+)?(?:whole|entire)?\s*(?:plan|design)|do\s+not\s+stop\s+until\s+blocked|don'?t\s+stop\s+until\s+blocked)\b|(?:계획\s*(?:전체|전부)?\s*(?:진행|계속|이어)|전체\s*(?:계획|설계|설계문서)\s*(?:진행|계속|기반)|설계\s*(?:문서)?\s*(?:기반|대로)\s*(?:계속|진행)|막히기\s*전까지|막히기전까지|막히지\s*않으면\s*(?:계속|진행)|계속\s*(?:진행|작업|이어|해줘)|전부\s*계속|다\s*끝날\s*때까지|다음\s*작업\s*(?:등록|이어)|끊기지\s*않게)/i;

const commandRoutes: readonly (readonly [RegExp, readonly SafeNextAction[]])[] = [
  [/\b(?:show|current|check|get|what(?:'s| is)|how(?:'s| is) (?:it|things))\b.{0,40}\b(?:status|progress|state|checkpoint|workflow|lane|attempt|heartbeat)\b|\bflowdesk-status\b|\b(?:is\s+(?:it|this|that)\s+stuck|seems?\s+stuck|stalled|no\s+log|no\s+update|no\s+response|frozen|hung|hanging|silent|heartbeat\s+(?:status|check)|recent\s+heartbeat|lane\s+heartbeat|last\s+heartbeat)\b|(?:상태|진행\s*상황|진행\s*상태|어디까지|어디 까지|어디쯤|현재\s*상태|현재\s*진행|작업\s*상태|작업\s*어디까지|workflow\s*상태|멈췄|멈춘\s*것\s*같|멈춘\s*거\s*같|응답이\s*없|아무\s*로그도\s*없|로그가\s*없|진행이\s*안돼|진행이\s*안\s*돼|꼼짝\s*안|먹통|하트\s*비트|하트비트|심장\s*박동|심박|진행\s*신호|진행\s*표시|레인\s*상태|레인\s*진행|살아\s*있|최근\s*heartbeat|마지막\s*heartbeat)/i, ["/flowdesk-status"]],
  [/\b(usage|quota|limit|rate[\s_-]*limit|reset(?:s)?|remaining|budget|credits?|tokens? left|how (?:much|many) (?:tokens?|requests?|usage|left|remaining))\b|(?:사용량|잔량|남은\s*(?:사용량|토큰|요청|쿼터|크레딧|예산)|남은(?:거|것)?\s*얼마|얼마\s*남(?:았|아|아서)|쿼터|한도|리셋|사용\s*가능량|쓸\s*수\s*있|토큰\s*남은|크레딧)/i, ["/flowdesk-usage", "/flowdesk-doctor"]],
  [/\b(doctor|diagnos(?:e|tic)|compatibility|health[\s_-]*check|sanity[\s_-]*check)\b|(?:진단|점검|건강\s*상태|설정\s*확인|환경\s*확인|호환성)/i, ["/flowdesk-doctor"]],
  [/\b(resume|continue from checkpoint|pick up where|continue (?:the )?workflow)\b|(?:이어\s*(?:서|가)|재개|중단(?:된|했던)\s*거|체크포인트|이어가)/i, ["/flowdesk-status", "/flowdesk-resume"]],
  [/\b(retry|try again|run again|do over)\b|(?:다시\s*(?:해|시도|돌려|실행)|재시도|또\s*해)/i, ["/flowdesk-status", "/flowdesk-retry"]],
  [/\b(abort|cancel workflow|stop workflow|kill (?:the )?(?:workflow|run))\b|(?:중단|취소|멈춰|그만|작업\s*취소|워크플로(?:우)?\s*(?:중단|취소|멈춰))/i, ["/flowdesk-status", "/flowdesk-abort"]],
  [/\b(debug export|export debug|debug bundle|logs?|debug info|export logs?)\b|(?:디버그(?:\s*(?:내보내|덤프|번들|로그))?|로그\s*(?:내보내|덤프|export)?|버그\s*정보|문제\s*정보)/i, ["/flowdesk-export-debug", "/flowdesk-status"]]
];

function uniqueActions(actions: readonly SafeNextAction[]): SafeNextAction[] {
  return [...new Set(actions)].slice(0, 8);
}

function redactedIntakeRef(input: FlowDeskChatRoutingInputV1): OpaqueRef {
  const candidates = [input.redactedIntakeRef, input.request.redacted_intake_ref, input.request.session_ref, input.request.workflow_id, `intake-${input.request.request_id}`];
  const candidate = candidates.find((value) => validateOpaqueRef(value, "redacted_intake_ref").ok);
  return candidate ?? "intake-redacted";
}

function disabledResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
    user_message: "FlowDesk chat steering is unavailable; use portable commands for safe fallback.",
    classification: "fast_chat",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback"
  };
}

function blockedResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: false,
    status: "blocked",
    safe_next_actions: [...fallbackActions],
    user_message: "FlowDesk blocked this chat route because it requires capabilities outside Release 1 command-backed steering.",
    classification: "blocked",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback",
    error: {
      category: "policy",
      safe_remediation: "Use Release 1 portable commands and diagnostics; later-gate runtime authority remains disabled."
    }
  };
}

function schemaFailedResponse(): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: false,
    status: "blocked",
    safe_next_actions: ["/flowdesk-doctor", "/flowdesk-status"],
    user_message: "FlowDesk chat intake failed closed before routing.",
    classification: "blocked",
    redacted_intake_ref: "intake-redacted",
    route_decision: "use_command_fallback",
    error: {
      category: "schema",
      safe_remediation: "Retry with a redacted summary or use a portable FlowDesk command."
    }
  };
}

function commandFallbackResponse(input: FlowDeskChatRoutingInputV1, actions: readonly SafeNextAction[]): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "diagnostic_only",
    safe_next_actions: uniqueActions([...actions, "/flowdesk-status"]),
    user_message: "FlowDesk routed this chat request to a command-backed Release 1 flow.",
    classification: "fast_chat",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback"
  };
}

function managedPlanResponse(input: FlowDeskChatRoutingInputV1, usagePreflight = false): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "ready",
    safe_next_actions: usagePreflight ? ["/flowdesk-usage", "/flowdesk-plan", "/flowdesk-status"] : ["/flowdesk-plan", "/flowdesk-status"],
    user_message: usagePreflight
      ? "FlowDesk should check provider usage before steering this larger request into a guarded command-backed planning flow."
      : "FlowDesk can steer this request into a guarded command-backed planning flow.",
    classification: "managed_plan",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "show_plan"
  };
}

function executionConfirmationResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "needs_clarification",
    safe_next_actions: ["ask_clarification", "/flowdesk-plan", "/flowdesk-status"],
    user_message: "FlowDesk needs explicit confirmation and a ready plan before steering an execution-like request.",
    classification: "clarify",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "ask_clarification"
  };
}

function confirmedExecutionResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "ready",
    safe_next_actions: ["/flowdesk-run", "/flowdesk-status"],
    user_message: "FlowDesk accepted typed confirmation and routed this request to a command-backed Release 1 run.",
    classification: "fast_chat",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback"
  };
}

function continuousWorkResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "ready",
    safe_next_actions: ["/flowdesk-resume", "/flowdesk-status"],
    user_message: "FlowDesk can continue this plan-backed workflow until the next blocker or clarification point.",
    classification: "managed_plan",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "use_command_fallback"
  };
}

function continuousWorkNeedsPlanResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "needs_clarification",
    safe_next_actions: ["ask_clarification", "/flowdesk-status"],
    user_message: "FlowDesk needs an existing plan or design document before continuing work autonomously.",
    classification: "clarify",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "ask_clarification"
  };
}

function hasTypedExecutionApproval(input: FlowDeskChatRoutingInputV1, summary: string): boolean {
  return input.request.user_approval_ref !== undefined && explicitApprovalPattern.test(summary);
}

function clarifyResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "needs_clarification",
    safe_next_actions: ["ask_clarification", "/flowdesk-status"],
    user_message: "FlowDesk needs a clearer goal before steering this chat request into a command-backed flow.",
    classification: "clarify",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "ask_clarification"
  };
}

function continueChatResponse(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  return {
    schema_version: "flowdesk.chat_intake.response.v1",
    ok: true,
    status: "ready",
    safe_next_actions: ["continue_chat"],
    user_message: "FlowDesk did not take over this general chat request.",
    classification: "fast_chat",
    redacted_intake_ref: redactedIntakeRef(input),
    route_decision: "continue_chat"
  };
}

export function buildFlowDeskChatIntakeResponseV1(input: FlowDeskChatRoutingInputV1): FlowDeskChatIntakeResponseV1 {
  if (!validateChatIntakeRequestV1(input.request).ok) return schemaFailedResponse();
  if (input.chatIntakeMode === "blocking") return blockedResponse(input);
  if (input.chatIntakeMode !== undefined && input.chatIntakeMode !== "steering") return disabledResponse(input);
  if (input.hookHarnessMode === "off" || input.hookHarnessMode === "observe") return disabledResponse(input);

  const summary = input.request.intake_summary;
  if (unsafeLaterGatePattern.test(summary)) return blockedResponse(input);
  if (continuousWorkPattern.test(summary)) return input.planningDocumentAvailable === true ? continuousWorkResponse(input) : continuousWorkNeedsPlanResponse(input);
  if (executionLikePattern.test(summary)) return hasTypedExecutionApproval(input, summary) ? confirmedExecutionResponse(input) : executionConfirmationResponse(input);
  const command = commandRoutes.find(([pattern]) => pattern.test(summary));
  if (command !== undefined) return commandFallbackResponse(input, command[1]);
  if (planningPattern.test(summary)) return clarificationPattern.test(summary) ? clarifyResponse(input) : managedPlanResponse(input, proactiveUsagePreflightPattern.test(summary));
  return continueChatResponse(input);
}

export function evaluateFlowDeskChatIntakeV1(input: FlowDeskChatRoutingInputV1): FlowDeskChatRoutingEvaluationV1 {
  const response = buildFlowDeskChatIntakeResponseV1(input);
  const responseResult = validateChatIntakeResponseV1(response);
  if (!responseResult.ok) return { ...invalid(...responseResult.errors), response };
  return { ...valid(), response };
}
