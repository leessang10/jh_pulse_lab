# 홈 연습실 이름·예약 현황 UI 변경 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 서비스 전체 연습실 이름을 `Pulse Lab 01~03`으로 통일하고 홈 상세 카드의 중복 사용 불가 요약을 간결한 예약 현황 문구로 바꾼다.

**Architecture:** 기존 `ROOMS`를 유일한 연습실 표시 이름 원본으로 유지한다. 홈 상세 중앙 문구와 접근성 라벨은 작은 순수 헬퍼로 분리해 테스트하고, `page.tsx`는 그 결과를 렌더링한다.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS, Vitest

## Global Constraints

- 연습실 ID `room-1`, `room-2`, `room-3`은 바꾸지 않는다.
- 표시 이름만 `Pulse Lab 01`, `Pulse Lab 02`, `Pulse Lab 03`으로 바꾼다.
- 홈 상세 카드 우측 `오늘 사용 불가` 요약 박스는 완전히 삭제한다.
- 원형 중앙은 숫자 없이 `오늘`과 `예약 현황`만 표시한다.
- 예약·점검 구간, 눈금, 구간 라벨과 데이터베이스는 바꾸지 않는다.

---

## 파일 구조

- 수정 `src/lib/reservations.ts`: 서비스 전체 연습실 표시 이름의 단일 원본.
- 수정 `src/lib/reservations.test.ts`: 새 표시 이름과 기존 비활성 연습실 호환성 검증.
- 생성 `src/lib/landing-detail-status.ts`: 홈 상세 중앙 문구와 원형 그래프 접근성 라벨 제공.
- 생성 `src/lib/landing-detail-status.test.ts`: 상세 상태 문구의 회귀 테스트.
- 수정 `src/app/page.tsx`: 우측 요약 박스 삭제 및 상세 상태 헬퍼 적용.

### Task 1: 연습실 이름 전체 통일

**Files:**
- Modify: `src/lib/reservations.test.ts`
- Modify: `src/lib/reservations.ts`

**Interfaces:**
- Consumes: 기존 `Room`, `ROOMS`, `getRoomName(roomId: string): string`.
- Produces: 기존 ID에 새 표시 이름을 연결한 `ROOMS`와 `getRoomName`.

- [ ] **Step 1: 새 이름을 기대하는 실패 테스트 작성**

`src/lib/reservations.test.ts`의 활성 연습실 기대값과 이름 조회 테스트를 아래처럼 바꾼다.

```ts
expect(ROOMS).toEqual([
  { id: "room-1", name: "Pulse Lab 01" },
  { id: "room-2", name: "Pulse Lab 02" },
  { id: "room-3", name: "Pulse Lab 03" },
]);

expect(getRoomName("room-1")).toBe("Pulse Lab 01");
expect(getRoomName("room-2")).toBe("Pulse Lab 02");
expect(getRoomName("room-3")).toBe("Pulse Lab 03");
expect(getRoomName("room-4")).toBe("연습실 4");
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/reservations.test.ts`

Expected: `ROOMS`와 `getRoomName("room-1")`이 기존 한글 이름을 반환해 FAIL.

- [ ] **Step 3: 연습실 원본 이름 변경**

`src/lib/reservations.ts`의 `ROOMS`를 아래처럼 바꾼다.

```ts
export const ROOMS: Room[] = [
  { id: "room-1", name: "Pulse Lab 01" },
  { id: "room-2", name: "Pulse Lab 02" },
  { id: "room-3", name: "Pulse Lab 03" },
];
```

`ROOM_NAMES`의 `room-4` 호환 이름은 그대로 둔다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/reservations.test.ts`

Expected: 해당 테스트 파일 전체 PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/reservations.ts src/lib/reservations.test.ts
git commit -m "feat: 연습실 이름 Pulse Lab으로 통일"
```

### Task 2: 홈 상세 예약 현황 UI 단순화

**Files:**
- Create: `src/lib/landing-detail-status.test.ts`
- Create: `src/lib/landing-detail-status.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Consumes: 상세 화면의 `summary.roomName`.
- Produces: `LANDING_DETAIL_CENTER_LINES`와 `getLandingDetailScheduleAriaLabel(roomName: string): string`.

- [ ] **Step 1: 상세 문구 실패 테스트 작성**

`src/lib/landing-detail-status.test.ts`를 만든다.

```ts
import { describe, expect, it } from "vitest";
import {
  getLandingDetailScheduleAriaLabel,
  LANDING_DETAIL_CENTER_LINES,
} from "./landing-detail-status";

describe("landing detail status", () => {
  it("shows today reservation status without an unavailable-hour total", () => {
    expect(LANDING_DETAIL_CENTER_LINES).toEqual(["오늘", "예약 현황"]);
  });

  it("describes the circular schedule as today's reservation status", () => {
    expect(getLandingDetailScheduleAriaLabel("Pulse Lab 01")).toBe(
      "Pulse Lab 01 오늘 예약 현황을 시계처럼 보여주는 표",
    );
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/landing-detail-status.test.ts`

Expected: `landing-detail-status` 모듈이 없어 FAIL.

- [ ] **Step 3: 최소 문구 헬퍼 구현**

`src/lib/landing-detail-status.ts`를 만든다.

```ts
export const LANDING_DETAIL_CENTER_LINES = ["오늘", "예약 현황"] as const;

export function getLandingDetailScheduleAriaLabel(roomName: string) {
  return `${roomName} 오늘 예약 현황을 시계처럼 보여주는 표`;
}
```

- [ ] **Step 4: 상세 UI에 헬퍼 적용하고 중복 박스 삭제**

`src/app/page.tsx`에 헬퍼를 import한다.

```ts
import {
  getLandingDetailScheduleAriaLabel,
  LANDING_DETAIL_CENTER_LINES,
} from "@/lib/landing-detail-status";
```

`RoomDetailSchedule`의 `hasMaintenance` 계산과 제목 우측의 조건부 배경 요약 `<div>` 전체를 삭제한다. 제목 래퍼는 아래처럼 단순화한다.

```tsx
<div className="min-w-0 text-left">
  <p className="text-xs font-semibold text-muted-foreground">실시간 예약 현황</p>
  <h2 className="truncate text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
    {summary.roomName}
  </h2>
</div>
```

원형 그래프 접근성 라벨을 바꾼다.

```tsx
aria-label={getLandingDetailScheduleAriaLabel(summary.roomName)}
```

중앙 패널을 아래처럼 바꾼다.

```tsx
<div className={getLandingDetailCenterPanelClassName()}>
  <div className="grid gap-1">
    <div className="text-xs font-bold text-muted-foreground">{LANDING_DETAIL_CENTER_LINES[0]}</div>
    <div className="text-base font-bold leading-tight sm:text-lg">{LANDING_DETAIL_CENTER_LINES[1]}</div>
  </div>
</div>
```

- [ ] **Step 5: 상세 문구 테스트 통과 확인**

Run: `npm test -- src/lib/landing-detail-status.test.ts`

Expected: 2 tests PASS.

- [ ] **Step 6: 전체 검증**

Run: `npm test`

Expected: 전체 테스트 PASS.

Run: `npx tsc --noEmit`

Expected: 타입 오류 없이 exit 0.

Run: `npm run build`

Expected: Next.js 프로덕션 빌드 exit 0.

- [ ] **Step 7: 커밋**

```bash
git add src/app/page.tsx src/lib/landing-detail-status.ts src/lib/landing-detail-status.test.ts
git commit -m "feat: 홈 예약 현황 UI 단순화"
```
