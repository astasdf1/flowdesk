# FlowDesk OpenCode Plugin — Safety Rules

**적용 범위**: FlowDesk OpenCode 플러그인 개발에만 적용된다.
Omnigent 통합 개발 시에는 [../omnigent/OMNIGENT_SAFETY_RULES.md](../omnigent/OMNIGENT_SAFETY_RULES.md)를 참조한다.

---

## Safety Rules

1. **No external orchestrator runtime dependency.**
   OMO runtime, prompt, config schema, agent, skill, task file, team runtime,
   또는 source dependency를 사용하지 않는다.

2. **No nested `opencode run`.**
   일반 plugin-managed workflow에서 중첩된 `opencode run`을 사용하지 않는다.

3. **Mandatory FlowDesk-owned lane boundary (Product Architecture).**
   FlowDesk 플러그인과 기본 coordinator(flowdesk-main)는 관리된 workflow에
   raw OpenCode subagent/session path(`task` tool)를 사용해서는 안 된다.
   모든 위임된 FlowDesk 작업은 FlowDesk 소유 도구(예: `flowdesk_agent_task_run`)를
   통해 실행되어야 한다.
   **이 규칙은 FlowDesk product runtime과 coordinator에만 적용된다.**
   이 저장소에서 작업하는 Developer agent는 컴파일, 테스트, 검색 등 병렬 개발 작업에
   일반 `task` subagent를 자유롭게 사용할 수 있다.

4. **No privileged action without FlowDesk Guard approval.**
   FlowDesk Guard 승인 또는 특정 Guard-approved non-dispatch permission 없이
   privileged action을 수행하지 않는다.

5. **No default managed dispatch without full gate evidence.**
   FlowDesk plugin-satisfiable gate가 다음 모든 항목에 대한 실제 증거를 갖출 때까지
   기본 managed dispatch를 수행하지 않는다:
   configured authorization, fresh usage/provider-health, policy/auth sanitization,
   configured verification, consumed Guard/user approval, durable pre-dispatch audit,
   idempotency/reservation, intended SDK dispatch path.
   OpenCode platform-internal facts(runtime execution mode, internal telemetry,
   lane conformance, account-scope usage authority)는 plugin verification boundary
   밖에 있으며 completion criteria가 아니다. FlowDesk는 관찰 가능할 때
   non-gating diagnostics로 표시한다.

6. **No managed provider/model fallback without gate proof.**
   나중 gate가 다음을 증명할 때까지 managed provider/model fallback 또는 재선택을
   수행하지 않는다: fresh provider-native usage, fresh provider health,
   SDK adapter capability를 통한 runtime compatibility, policy eligibility,
   durable pre-dispatch audit, new attempt id, 새 binding에 대한 명시적 Guard 승인.

7. **No hard chat cancellation authority.**
   first-class OpenCode boundary가 증명될 때까지 hard chat cancellation 또는
   no-reply authority를 주장하지 않는다.
   Release 1 chat UX는 command-backed workflow로 라우팅되어야 한다.

8. **Hook harness enforcement은 dispatch를 승인하지 않는다.**
   Hook harness enforcement는 안전하지 않은 시도를 거부, 재작성 또는 라우팅할 수 있지만,
   dispatch를 절대 승인하지 않으며 off 모드는 Guard를 우회하지 않는다.

9. **Event telemetry는 Guard authority가 아니다.**
   Event telemetry는 harness 조정을 지원하지만 Guard authority, dispatch authorization,
   durable audit completion, 또는 단독 runtime echo evidence가 아니다.

10. **Debug and audit outputs must be redacted-first.**
    디버그 및 감사 출력은 반드시 redacted-first여야 한다.

11. **Heavy workflow authoring belongs in bounded lanes.**
    Heavy workflow authoring은 conformance 및 release gate가 허용하는
    bounded FlowDesk-owned lane에 속한다.
    Release 1에서 실제 lane launch가 안전한 것으로 증명되지 않은 경우,
    lane 기록 및 요약은 fake-runtime, degraded, 또는 command-backed일 수 있다.
    Main-agent output은 routing, compact summaries, Guard handoff,
    safe next actions로 제한되어야 한다.

12. **Chat/message mutation은 steering only다.**
    Chat/message mutation은 conformance가 blocking intake를 증명하지 않는 한
    steering only다.
    FlowDesk가 prompt mutation만으로 일반 assistant/provider turn을
    완전히 처리, 억제 또는 대체했다고 주장하지 않는다.

13. **Interface-first for cross-cutting features.**
    authority/gates, durable evidence schemas, provider/model selection,
    OI/GitHub data flows, status/doctor/debug, runtime/watchdog/session control,
    chat/message hooks/TUI, 또는 docs/conformance에 걸친 변경은 구현 전에
    contracts, evidence, authority boundaries, module boundaries,
    integration points, acceptance criteria를 정의하는 design/interface artifact가
    필요하다. 구현은 focused lane으로 분할되어야 한다.
