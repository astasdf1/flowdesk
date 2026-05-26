# FlowDesk Stall Recovery — 독립 설계 V10 (Final)

> **작성 배경**: V9 다관점 리뷰(2026-05-26)에서 `changes_required` 판정.
> V9는 정책적(Policy) 관점에서는 안전성을 입증(Pass)했으나, 구현 관점에서 스키마/상태머신의 공백이 발견됨.
> V10은 ADR Sidecar 스키마 및 HMAC 서명 알고리즘 구체화, Warning Tombstone 모델 도입, 
> P6 권한 경계 명확화, 그리고 테스트 계획 보강을 통해 **Implementation-ready** 상태를 완성한다.

---

## 1. 컴포넌트 설계 (V10)

### P0 — 스키마 선행 마이그레이션 (사전 작업)

실제 로직 구현 전, 스키마와 증거 클래스를 등록한다.

1. **`lane_lifecycle_record.v1` 확장**:
   - `spawned_by?: "flowdesk" | "user" | "external"` 필드 추가.
   - 디렉토리 fsync 실패 식별을 위해 `durability?: "best_effort_no_dir_fsync"` 필드 추가.

2. **신규 증거 클래스 및 스키마 등록**:

**`pending_abort_warning.v1` 스키마 (Tombstone 지원)**:
- 파일 삭제 대신 상태를 변경(Tombstone)하여 `cancel_state_unknown` 문제를 해결.
```typescript
interface FlowDeskPendingAbortWarningV1 {
  schema_version: "flowdesk.pending_abort_warning.v1"
  warning_id: string
  workflow_id: string
  lane_id: string
  warning_issued_at: string   // ISO timestamp
  expires_at: string          // warning_issued_at + preAbortWarningMs
  cancel_command: string      // "/flowdesk-abort <lane_id> cancel"
  status: "pending" | "cancelled" | "executed" | "tombstoned" // Tombstone 모델
  dispatch_authority_enabled: false
}
```

**`pending_abort_cancel.v1` 스키마 명세**:
```typescript
interface FlowDeskPendingAbortCancelV1 {
  schema_version: "flowdesk.pending_abort_cancel.v1"
  cancel_id: string
  warning_id_ref: string
  workflow_id: string
  lane_id: string
  cancelled_at: string
  cancel_reason: string       // "user_requested_via_command"
  cancel_actor: "user"        // Release 1에서는 "user"만 허용
  dispatch_authority_enabled: false
}
```

---

### P1 — `with-timeout.ts` (타입 안전성)

```typescript
export class FlowDeskTimeoutError extends Error {
  constructor(public readonly operationName: string, public readonly timeoutMs: number) {
    super(`FlowDesk: "${operationName}" timed out after ${timeoutMs}ms`)
    this.name = "FlowDeskTimeoutError"
  }
}

export async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  operationName: string,
): Promise<T> {
  let handle: ReturnType<typeof setTimeout> | undefined
  // late rejection suppression (early rejection은 보존)
  void promise.catch(() => undefined)
  const timeout = new Promise<never>((_, reject) => {
    handle = setTimeout(() => reject(new FlowDeskTimeoutError(operationName, timeoutMs)), timeoutMs)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    if (handle !== undefined) clearTimeout(handle)
  }
}
```

---

### P2 — SDK 스파이크 및 ADR Guard Sign-off (HMAC 상세 명세)

**ADR Guard Sign-off 무결성 보장 (HMAC & Canonical JSON)**:
- 파일 경로 명시: `docs/adr/0002-sdk-surface-verification.guard_sign_off.json`.
- **스키마 및 서명 방식**:
```typescript
interface FlowDeskGuardSignOffV1 {
  schema_version: "flowdesk.guard_sign_off.v1"
  sign_off_id: string
  created_at: string
  target_markdown_sha256: string  // ADR 마크다운 본문의 SHA-256 (CRLF 정규화)
  p6_safe: boolean                // P6 auto-abort 안전 여부
  nonce: string                   // Replay 방지
  expires_at?: string             // 서명 만료일
  hmac_sha256: string             // 아래 Payload에 대한 서명
  dispatch_authority_enabled: false
}
```
- **Canonicalization**: `hmac_sha256` 검증 시 해당 필드를 제외한 객체를 **RFC 8785 Canonical JSON** 알고리즘으로 직렬화한 후 `FLOWDESK_GUARD_HMAC_KEY`로 SHA-256 HMAC을 계산하여 비교.
- **Fail-closed**: HMAC 불일치, 마크다운 본문 SHA-256 불일치 시 `isAutoAbortEnabled()`는 즉시 `false`를 반환.

---

### P3 — stallAlert Timeout Wrapping (Discriminated Union + Exhaustive Check)

```typescript
type StallAlertResult =
  | { status: "ok"; data: FlowDeskChatMessageStallSummaryV1 }
  | { status: "unavailable" }
  | { status: "error" }
  | { status: "none" }

const ALLOWED_ERROR_NAMES = new Set(["FlowDeskDiskError", "FlowDeskStateError"])

// Exhaustive Check Helper
function assertNever(x: never): never {
  throw new Error("Unexpected object: " + x)
}

async function collectStallAlertResult(
  stallAlert: FlowDeskChatMessageStallAlertOptionsV1,
  clock: FlowDeskLocalClockV1,
  deps: { statusLiveImpl?: typeof executeFlowDeskStatusLiveV1 } = {},
): Promise<StallAlertResult> {
  const statusLiveImpl = deps.statusLiveImpl ?? executeFlowDeskStatusLiveV1
  try {
    const observedAt = (typeof clock === "function" ? clock() : clock).toISOString()
    const result = await withTimeout(
      statusLiveImpl({ config: buildStatusLiveConfig(stallAlert), now: () => new Date(observedAt) }),
      stallAlert.statusLiveTimeoutMs ?? 8_000,
      "executeFlowDeskStatusLiveV1",
    )
    const summary = buildStallSummary(result, stallAlert)
    return summary !== undefined ? { status: "ok", data: summary } : { status: "none" }
  } catch (error) {
    if (error instanceof FlowDeskTimeoutError) return { status: "unavailable" }
    
    const errorName = error instanceof Error ? error.name : "UnknownError"
    const safeName = ALLOWED_ERROR_NAMES.has(errorName) ? errorName : "UnknownError"
    process.stderr.write(`[flowdesk] collectStallAlertResult error: ${safeName}\n`)
    return { status: "error" }
  }
}
```

---

### P4 — Lane Abort Tool (Ownership, Legacy Sunset & Fsync Fallback)

**Workflow Reserved Prefixes 목록**:
- `/flowdesk-abort` 및 P6 진입점에 한하여 아래 4개의 예약된 Prefix만 허용하며, 불일치 시 거부한다.
  1. `workflow-quick-reviewer-`
  2. `workflow-quick-fallback-`
  3. `workflow-stall-recovery-`
  4. `workflow-provider-usage-`

**레거시 소유권(Legacy Ownership) 수동 취소 및 Sunset Gate**:
- `spawned_by`가 없는 기존 레거시 레코드에 대한 수동 `/flowdesk-abort`는 **Release 2 진입 전까지만(Sunset Gate)** 허용한다.
- Out-of-band confirmation 강제: 사용자는 반드시 `/flowdesk-abort <lane_id> --confirm <lane_id>` 명령어를 통해 lane_id를 수동으로 입력해야 한다.

**디렉토리 fsync 예외 처리 (Durability Marker)**:
- `fs.open` -> write -> `fs.fsync` -> `fs.close` 후 parent directory `fs.fsync` 수행.
- 디렉토리 fsync 실패(EPERM/ENOTSUP) 시 에러를 던지지 않되, 증거 파일에 **`durability: "best_effort_no_dir_fsync"`** 마커를 반드시 추가하고 write-then-read 검증.

---

### P5 — Session Health Check

```typescript
export type FlowDeskSdkSessionHealthV1 =
  | { status: "api_responsive" }
  | { status: "api_timeout"; reason: string }
  | { status: "unknown"; reason: string }
```
- `session.messages()`를 통한 응답 확인. 단독 판정 금지. P6 보조 신호.

---

### P6 — Guarded Auto-Abort (Hook-only State Machine & P6 Authority)

#### P6 권한 경계 (Authority Boundary)
- **P6는 FlowDesk 내부의 Evidence(Lifecycle)만 Abort 상태로 업데이트한다.**
- Release 1의 제약사항("hard chat cancellation/no-reply authority 금지")을 준수하기 위해, 실제 SDK 세션 취소(`client.session.abort()`)는 자동 실행하지 않는다. 실제 SDK 중단을 위해서는 별도의 Guard 승인(Release 2)이 필요하다.

#### P6 강제 비활성화 게이트
```typescript
function isAutoAbortEnabled(config, rootDir): boolean {
  if (!config.autoAbortOnStall) return false
  const spikeSignOff = loadSdkSpikeGuardSignOff(rootDir)
  if (!spikeSignOff || !verifyGuardSignOffHmac(spikeSignOff) || spikeSignOff.p6_safe !== true) {
    return false // Fail-closed
  }
  return true
}
```

#### Confirmed Stall 결정 행렬
**stall_confirmed** = `(A) AND (C) AND (D_explicit)`

| (A) | (C) | (D_explicit) | (B) API | P2 ADR | 결과 |
|-----|-----|--------------|---------|--------|------|
| ✅ | ✅ | ✅ | `api_timeout` | `p6_safe=true` | **pending warning 발급 (opt-in)** |
| ✅ | ✅ | ✅ | `api_timeout` | 없음 / false | **수동 권고** |
| ✅ | ✅ | ✅ | `api_responsive`| any | **수동 권고** |
| ✅ | ✅ | ✅ | `unknown` | any | **수동 권고** |
| ✅ | ✅ | ❌ (Legacy) | any | any | P4 수동 abort만 (Out-of-band) |
| ✅ | ❌ | any | any | any | 조치 없음 |
| ❌ | any | any | any | any | 조치 없음 |

#### P6 Hook-only 자동 취소 상태머신
1. **경고 발급**: 조건 만족 시 `pending_abort_warning`(status: "pending") evidence 작성 후 안내 카드 노출.
2. **다음 Hook 발화 시 평가**:
   - `status === "pending"` 확인 (tombstone 패턴).
   - `now >= expires_at` 만료 확인.
   - 명시적인 Cancel 레코드(`pending_abort_cancel`) 부재 확인.
   - Stall reconfirmation (여전히 조건 A, C, D가 유지되는지 재확인).
3. **실행**: 위 조건을 만족하면 `validateAndAbortLane`을 멱등성 있게 호출하고, warning 상태를 `"executed"`로 변경. 취소 시 `"cancelled"`로 변경.

---

## 2. 테스트 전략 (보강)

### Unit (`node:test` 기반)
- `assertNever`를 통한 Exhaustive Type Check 컴파일 타임 검증.
- `withTimeout`의 early/late rejection 검증 시 `node:test`의 `mock.timers.enable()` 사용, `microtask` 플러시 명시.
- `verifyGuardSignOffHmac`에 대한 HMAC 검증 실패, Markdown 해시 불일치, 만료된 nonce에 대한 `Fail-closed` 테스트.
- `isAutoAbortEnabled`에서 환경변수(`FLOWDESK_GUARD_HMAC_KEY`) 폴백이 Production 환경에서는 거부되는 테스트.

---

## 3. 구현 순서

1. **P0 (사전)**: `spawned_by`, `pending_abort_warning` (Tombstone 포함), `pending_abort_cancel` 스키마 마이그레이션.
2. **P1 (기반)**: `withTimeout` 타입 안전성 강화.
3. **P2 (스파이크)**: SDK 동작 검증, JSON Sidecar ADR 서명 및 HMAC 키 프로비저닝 메커니즘 구축.
4. **P3/P4 (1단계 구현)**: StallAlertResult exhaustive switch 도입, Prefix 검증 및 P4 ownership 기반 abort 툴 (fsync Directory fallback 포함).
5. **P5/P6 (2단계 구현)**: P5 API Health Check 구현 및 Guard Sign-off 기반 P6 Auto-Abort 적용.