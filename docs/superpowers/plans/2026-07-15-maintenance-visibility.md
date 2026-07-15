# 점검 시간 표기 가시성 개선 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 메인 원형 시간표에서 점검을 불투명 앰버색으로 구분하고 24시간 점검을 완전한 원환으로 표시한다.

**Architecture:** 공통 SVG 경로 함수가 360도 원환을 직접 지원하게 하고, 랜딩 일정 뷰 모델에 점검 종류와 전용 색상 토큰을 전달한다. 메인 화면은 뷰 모델만 사용해 상세 원환, 작은 원형 슬롯, 상태 문구를 렌더링한다.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS v4, SVG, Vitest

## Global Constraints

- 일반 예약 색상 팔레트와 예약 기능은 변경하지 않는다.
- 점검 색상은 면 `#f6d879`, 테두리 `#b7791f`, 글자 `#5b3a00`을 사용한다.
- 점검 면은 `opacity: 1`로 렌더링한다.
- Supabase 스키마, 서버 액션, 관리자 화면, V2 화면은 변경하지 않는다.

---

### Task 1: 360도 원환 SVG 경로 지원

**Files:**
- Modify: `src/lib/svg-geometry.ts`
- Test: `src/lib/svg-geometry.test.ts`

**Interfaces:**
- Consumes: `getStableAnnularSectorPath({ center, endAngleDegrees, innerRadius, outerRadius, startAngleDegrees })`
- Produces: 360도 구간에서 외곽 180도 arc 2개와 안쪽 180도 arc 2개로 닫힌 원환 경로

- [ ] **Step 1: 360도 원환 실패 테스트 작성**

```ts
it("builds a complete annular path for a full 360 degree range", () => {
  const path = getStableAnnularSectorPath({
    center: 180,
    startAngleDegrees: 0,
    endAngleDegrees: 360,
    innerRadius: 58,
    outerRadius: 166,
  });

  expect(path.match(/A 166 166/g)).toHaveLength(2);
  expect(path.match(/A 58 58/g)).toHaveLength(2);
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/svg-geometry.test.ts`

Expected: FAIL. 현재 경로는 외곽 arc와 안쪽 arc를 각각 하나만 만든다.

- [ ] **Step 3: 최소 구현**

`endAngleDegrees - startAngleDegrees >= 360`이면 시작점, 180도 중간점, 360도 끝점을 계산한다. 외곽은 sweep `1`, 안쪽은 sweep `0`인 arc를 각각 두 개 연결하고 닫는다. 360도 미만인 기존 경로는 그대로 유지한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/svg-geometry.test.ts`

Expected: PASS. 기존 부분 원환 테스트와 새 360도 테스트가 모두 통과한다.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/svg-geometry.ts src/lib/svg-geometry.test.ts
git commit -m "fix: 24시간 원형 시간표 경로 수정"
```

---

### Task 2: 점검 전용 색상과 상태 문구 적용

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/lib/visual-tokens.ts`
- Modify: `src/lib/landing-schedule.ts`
- Test: `src/lib/landing-schedule.test.ts`
- Modify: `src/lib/landing-room-tile.ts`
- Test: `src/lib/landing-room-tile.test.ts`
- Modify: `src/app/page.tsx`

**Interfaces:**
- Produces tokens: `MAINTENANCE_SEGMENT_FILL_TOKEN`, `MAINTENANCE_SEGMENT_BORDER_TOKEN`, `MAINTENANCE_SEGMENT_FOREGROUND_TOKEN`
- Extends: `LandingReservationSegment` with `kind`, `borderColor`, `foregroundColor`
- Extends: `LandingScheduleSlot` with `hasMaintenance`
- Extends: `getLandingRoomTileSlotClassName({ hasBookings, isBooked, isMaintenance })`

- [ ] **Step 1: 점검 세그먼트와 작은 원 슬롯 실패 테스트 작성**

`src/lib/landing-schedule.test.ts`에서 점검 세그먼트가 아래 속성을 갖는지 검증한다.

```ts
expect(summary.reservationSegments[0]).toMatchObject({
  kind: "maintenance",
  color: "var(--maintenance-fill)",
  borderColor: "var(--maintenance-border)",
  foregroundColor: "var(--maintenance-foreground)",
});
expect(summary.slots[0]).toMatchObject({ hasMaintenance: true });
```

일반 예약 세그먼트는 `kind: "reservation"`이고 기존 색상 순번을 유지하는지 검증한다. `src/lib/landing-room-tile.test.ts`에서는 `isMaintenance: true`일 때 `stroke-maintenance-border`를 반환하는지 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/landing-schedule.test.ts src/lib/landing-room-tile.test.ts`

Expected: FAIL. 현재 뷰 모델과 슬롯 클래스에는 점검 전용 속성이 없다.

- [ ] **Step 3: 점검 토큰과 뷰 모델 최소 구현**

`src/app/globals.css`에 점검 색상 CSS 변수를 추가하고 `@theme inline`에 Tailwind 색상으로 연결한다. `src/lib/visual-tokens.ts`는 세 CSS 변수 문자열을 export한다. `src/lib/landing-schedule.ts`는 점검 블록에 고정 점검 토큰을, 일반 예약에 기존 순환 색상과 예약 테두리 토큰을 설정한다. 슬롯에는 점검 블록 포함 여부를 `hasMaintenance`로 기록한다.

- [ ] **Step 4: 작은 원형 시간표 클래스 구현**

`getLandingRoomTileSlotClassName`이 `isMaintenance`를 받게 하고, 점검이면 예약 여부보다 먼저 `fill-none stroke-maintenance-border`를 반환한다. 기존 예약과 빈 슬롯 반환값은 유지한다.

- [ ] **Step 5: 단위 테스트 통과 확인**

Run: `npm test -- src/lib/landing-schedule.test.ts src/lib/landing-room-tile.test.ts`

Expected: PASS.

- [ ] **Step 6: 메인 화면 렌더링 적용**

`src/app/page.tsx`에서 상세 세그먼트의 `fill`, `stroke`, 라벨 `color`를 뷰 모델에서 읽는다. 점검 세그먼트만 `opacity={1}`이고 일반 예약은 기존 `0.95`를 유지한다. 작은 원형 슬롯은 `slot.hasMaintenance`를 클래스 헬퍼에 전달한다. 문구는 `오늘 사용 불가`, `사용 불가 시간`으로 바꾸고 접근성 라벨도 같은 의미로 맞춘다.

- [ ] **Step 7: 관련 테스트와 빌드 확인**

Run: `npm test -- src/lib/svg-geometry.test.ts src/lib/landing-schedule.test.ts src/lib/landing-room-tile.test.ts src/lib/landing-detail-schedule.test.ts`

Expected: PASS.

Run: `npm test`

Expected: 전체 테스트 PASS.

Run: `npm run build`

Expected: 프로덕션 빌드 성공.

- [ ] **Step 8: 모바일 화면 확인**

실제 `00:00-24:00` 점검 데이터가 있는 메인 화면에서 상세 원환 전체가 앰버색으로 채워지고, 작은 원형 슬롯도 앰버색이며, 변경한 문구가 보이는지 확인한다.

- [ ] **Step 9: 커밋**

```bash
git add src/app/globals.css src/lib/visual-tokens.ts src/lib/landing-schedule.ts src/lib/landing-schedule.test.ts src/lib/landing-room-tile.ts src/lib/landing-room-tile.test.ts src/app/page.tsx
git commit -m "fix: 점검 시간 표기 가시성 개선"
```
