export type FlowDeskApprovalClassificationV1 = "explicit_approval" | "weak_ambiguous_approval" | "denial_cancel" | "no_approval";

export type FlowDeskApprovalReasonCodeV1 =
  | "explicit_english_approval_phrase"
  | "explicit_korean_approval_phrase"
  | "weak_english_approval_phrase"
  | "weak_korean_approval_phrase"
  | "ambiguous_english_modifier"
  | "ambiguous_korean_modifier"
  | "english_denial_or_cancel"
  | "korean_denial_or_cancel"
  | "empty_or_whitespace"
  | "no_approval_signal";

export interface FlowDeskApprovalClassifierResultV1 {
  classification: FlowDeskApprovalClassificationV1;
  reason_codes: FlowDeskApprovalReasonCodeV1[];
}

const englishDenialOrCancelPattern = /\b(?:no|nope|do\s+not|don'?t|deny|denied|reject(?:ed)?|cancel|abort|stop|hold\s+off|not\s+now|never\s+mind|nevermind)\b/i;
const koreanDenialOrCancelPattern = /(?:아니|아냐|안\s*(?:돼|해|합니다|할래)|하지\s*마|하지마|거절|취소|중단|멈춰|그만|보류|나중에|승인\s*안|동의\s*안)/i;

const ambiguousEnglishPattern = /\b(?:maybe|perhaps|probably|i\s+guess|i\s+think|not\s+sure|unsure|if\s+you\s+want|up\s+to\s+you|kinda|kind\s+of|sort\s+of|looks?\s+fine|seems?\s+fine|fine\s+maybe)\b/i;
const ambiguousKoreanPattern = /(?:아마|어쩌면|잘\s*모르|모르겠|애매|괜찮(?:을|겠)?\s*것\s*같|될\s*것\s*같|맞는지|해도\s*되나|네가\s*알아서|알아서)/i;

const explicitEnglishApprovalPattern = /\b(?:approve(?:d)?|confirmed?|i\s+confirm|i\s+approve|yes[,\s]+(?:proceed|continue|run|execute|go\s+ahead)|proceed|go\s+ahead|continue\s+with\s+it|run\s+it|execute\s+it)\b/i;
const explicitKoreanApprovalPattern = /(?:승인(?:해|합니다|했|됨)?|확인(?:해|합니다|했|됨)?|동의(?:해|합니다|했|됨)?|진행\s*(?:해|하|하세요|합니다)|실행\s*(?:해|하|하세요|합니다)|계속\s*(?:해|하|하세요)|그렇게\s*해|그대로\s*진행)/i;

const weakEnglishApprovalPattern = /\b(?:yes|yep|yeah|ok(?:ay)?|sure|fine|sounds\s+good|looks\s+good|lgtm)\b/i;
const weakKoreanApprovalPattern = /(?:^|[\s,.!?])(?:네|예|응|좋아|오케이|ㅇㅋ|괜찮아|좋습니다)(?:$|[\s,.!?])/i;

function addIf(reasonCodes: FlowDeskApprovalReasonCodeV1[], condition: boolean, reasonCode: FlowDeskApprovalReasonCodeV1): void {
  if (condition) reasonCodes.push(reasonCode);
}

export function classifyFlowDeskApprovalTextV1(text: string): FlowDeskApprovalClassifierResultV1 {
  const normalized = text.trim();
  if (normalized.length === 0) {
    return { classification: "no_approval", reason_codes: ["empty_or_whitespace"] };
  }

  const reason_codes: FlowDeskApprovalReasonCodeV1[] = [];
  addIf(reason_codes, englishDenialOrCancelPattern.test(normalized), "english_denial_or_cancel");
  addIf(reason_codes, koreanDenialOrCancelPattern.test(normalized), "korean_denial_or_cancel");
  if (reason_codes.some((reasonCode) => reasonCode === "english_denial_or_cancel" || reasonCode === "korean_denial_or_cancel")) {
    return { classification: "denial_cancel", reason_codes };
  }

  addIf(reason_codes, ambiguousEnglishPattern.test(normalized), "ambiguous_english_modifier");
  addIf(reason_codes, ambiguousKoreanPattern.test(normalized), "ambiguous_korean_modifier");
  addIf(reason_codes, explicitEnglishApprovalPattern.test(normalized), "explicit_english_approval_phrase");
  addIf(reason_codes, explicitKoreanApprovalPattern.test(normalized), "explicit_korean_approval_phrase");
  addIf(reason_codes, weakEnglishApprovalPattern.test(normalized), "weak_english_approval_phrase");
  addIf(reason_codes, weakKoreanApprovalPattern.test(normalized), "weak_korean_approval_phrase");

  const hasAmbiguity = reason_codes.some((reasonCode) => reasonCode === "ambiguous_english_modifier" || reasonCode === "ambiguous_korean_modifier");
  const hasExplicitApproval = reason_codes.some((reasonCode) => reasonCode === "explicit_english_approval_phrase" || reasonCode === "explicit_korean_approval_phrase");
  const hasWeakApproval = reason_codes.some((reasonCode) => reasonCode === "weak_english_approval_phrase" || reasonCode === "weak_korean_approval_phrase");

  if (hasAmbiguity && (hasExplicitApproval || hasWeakApproval)) return { classification: "weak_ambiguous_approval", reason_codes };
  if (hasExplicitApproval) return { classification: "explicit_approval", reason_codes };
  if (hasWeakApproval || hasAmbiguity) return { classification: "weak_ambiguous_approval", reason_codes };

  return { classification: "no_approval", reason_codes: ["no_approval_signal"] };
}
