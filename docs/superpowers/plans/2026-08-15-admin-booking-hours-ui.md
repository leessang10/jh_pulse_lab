# 관리자 예약 시간 UI 축소 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 시간표와 점검 시간 선택에는 `07:00~23:00`만 표시하고 메인 원형 시간표의 24시간 표시는 유지한다.

**Architecture:** `src/lib/admin-timetable.ts`가 공통 예약 경계 상수로 관리자 표시용 시간 목록을 만든다. 관리자 시간표 행과 점검 선택 UI가 이 목록을 함께 사용하며, 하루 전체 슬롯 생성 로직은 건드리지 않는다.

**Tech Stack:** TypeScript, React, Next.js App Router, Vitest

## Global Constraints

- 관리자 시간표 행은 `07:00`부터 `22:30`까지 표시한다.
- 점검 시작 시간은 `07:00~22:30`, 종료 시간은 `07:30~23:00`만 표시한다.
- 메인 원형 시간표의 48개 30분 슬롯은 유지한다.
- 서버 검증, 데이터베이스, 기존 예약·점검 데이터는 변경하지 않는다.

---

### Task 1: 관리자 시간표 행을 운영시간으로 제한

**Files:**
- Modify: `src/lib/admin-timetable.ts:1-38`
- Test: `src/lib/admin-timetable.test.ts:17-29`

**Interfaces:**
- Consumes: `BOOKING_START_MINUTES`, `BOOKING_END_MINUTES`, `SLOT_MINUTES`
- Produces: 기존 `buildAdminTimetableRows(options): AdminTimetableRow[]` 계약을 유지하되 32개 운영시간 행만 반환

- [ ] **Step 1: 실패 테스트 작성**

```ts
it("builds operating-hour rows with one tile per active room", () => {
  const rows = buildAdminTimetableRows({
    date: "2026-06-20",
    reservations: [baseReservation],
  });

  expect(rows).toHaveLength(32);
  expect(rows[0].timeLabel).toBe("07:00");
  expect(rows[31].timeLabel).toBe("22:30");
  expect(rows[0].tiles.map((tile) => tile.room.id)).toEqual(["room-1", "room-2", "room-3"]);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts`

Expected: 행 개수가 48이라서 `toHaveLength(32)` 실패

- [ ] **Step 3: 최소 구현**

```ts
return Array.from(
  { length: (BOOKING_END_MINUTES - BOOKING_START_MINUTES) / SLOT_MINUTES },
  (_, index) => {
    const startMinutes = BOOKING_START_MINUTES + index * SLOT_MINUTES;

    return {
      startMinutes,
      timeLabel: formatMinutes(startMinutes),
      tiles: ROOMS.map((room) => buildAdminTimetableTile({ ...options, room, startMinutes })),
    };
  },
);
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/admin-timetable.ts src/lib/admin-timetable.test.ts
git commit -m "feat: 관리자 시간표를 예약 운영시간으로 제한"
```

### Task 2: 점검 시간 선택지를 운영시간으로 제한

**Files:**
- Modify: `src/lib/admin-timetable.ts:18-38`
- Modify: `src/app/admin/timetables/page.tsx:31-78`
- Test: `src/lib/admin-timetable.test.ts`

**Interfaces:**
- Produces: `getAdminMaintenanceTimeOptions(): { startOptions: Array<{ value: number; label: string }>; endOptions: number[] }`
- Consumes: 관리자 점검 등록 폼이 `startOptions`, `endOptions`를 그대로 순회

- [ ] **Step 1: 실패 테스트 작성**

```ts
it("builds maintenance selectors inside operating hours", () => {
  const { startOptions, endOptions } = getAdminMaintenanceTimeOptions();

  expect(startOptions).toHaveLength(32);
  expect(startOptions[0]).toEqual({ value: 420, label: "07:00" });
  expect(startOptions[31]).toEqual({ value: 1350, label: "22:30" });
  expect(endOptions).toHaveLength(32);
  expect(endOptions[0]).toBe(450);
  expect(endOptions[31]).toBe(1380);
});
```

- [ ] **Step 2: 실패 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts`

Expected: `getAdminMaintenanceTimeOptions`가 없어서 실패

- [ ] **Step 3: 최소 구현**

```ts
export function getAdminMaintenanceTimeOptions() {
  const startOptions = Array.from(
    { length: (BOOKING_END_MINUTES - BOOKING_START_MINUTES) / SLOT_MINUTES },
    (_, index) => {
      const value = BOOKING_START_MINUTES + index * SLOT_MINUTES;
      return { value, label: formatMinutes(value) };
    },
  );

  return {
    startOptions,
    endOptions: startOptions.map((option) => option.value + SLOT_MINUTES),
  };
}
```

관리자 페이지에서는 `generateTimeSlots()`와 하루 전체 종료 목록 대신 아래 값을 사용한다.

```ts
const { startOptions, endOptions } = getAdminMaintenanceTimeOptions();
```

- [ ] **Step 4: 통과 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts`

Expected: PASS

- [ ] **Step 5: 커밋**

```bash
git add src/lib/admin-timetable.ts src/lib/admin-timetable.test.ts src/app/admin/timetables/page.tsx
git commit -m "feat: 점검 시간 선택지를 운영시간으로 제한"
```

### Task 3: 회귀 검증

**Files:**
- Verify: `src/lib/landing-schedule.test.ts`
- Verify: 전체 프로젝트

**Interfaces:**
- Consumes: 기존 `getLandingScheduleSlots()`의 48개 원형 시간표 슬롯 계약
- Produces: 변경 없음

- [ ] **Step 1: 원형 시간표 회귀 테스트 실행**

Run: `npm test -- src/lib/landing-schedule.test.ts`

Expected: 48개 하루 전체 슬롯 테스트 PASS

- [ ] **Step 2: 전체 테스트 실행**

Run: `npm test`

Expected: PASS

- [ ] **Step 3: 프로덕션 빌드 실행**

Run: `npm run build`

Expected: 빌드 성공

- [ ] **Step 4: 변경 상태 확인**

Run: `git status --short && git log -5 --oneline`

Expected: 계획 문서 외 미커밋 변경 없음, 구현 커밋 2개 확인
