# 공개 예약 가능 시간 변경 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 모든 공개 예약 화면과 서버 검증의 예약 가능 시간을 `07:00~23:00`으로 통일한다.

**Architecture:** `src/lib/reservations.ts`가 공개 예약 시작·종료 경계와 공통 오류 문구를 소유한다. 기본 예약 가능 시간 계산과 V2 예약판이 이 정책을 가져다 쓰고, 기존 공개 서버 액션은 이미 호출 중인 공통 검증을 통해 운영시간 밖 요청을 조기에 거절한다. 관리자 시간표와 점검 등록이 쓰는 하루 전체 상수는 유지한다.

**Tech Stack:** TypeScript, Next.js, React, Vitest

## Global Constraints

- 공개 예약 시작 경계는 `07:00`이다.
- 공개 예약 종료 경계는 `23:00`이다.
- `22:30~23:00` 30분 예약과 `22:00~23:00` 1시간 예약은 허용한다.
- `07:00` 이전 시작 또는 `23:00` 이후 종료는 거절한다.
- 기본 예약 화면과 V2 화면에 같은 정책과 오류 문구를 적용한다.
- 기존 예약 데이터, 관리자 시간표, 점검 등록 시간은 변경하지 않는다.
- 데이터베이스 제약 조건은 추가하지 않는다.

---

### Task 1: 공통 예약 운영시간 정책

**Files:**
- Modify: `src/lib/reservations.ts`
- Test: `src/lib/reservations.test.ts`
- Test: `src/lib/reservation-actions.test.ts`

**Interfaces:**
- Produces: `BOOKING_START_MINUTES: number`
- Produces: `BOOKING_END_MINUTES: number`
- Produces: `BOOKING_HOURS_MESSAGE: string`
- Updates: `validateReservationDraft(draft): string[]`
- Updates: `validateReservationTimeChange(change): string[]`

- [ ] **Step 1: 공통 경계와 서버 조기 거절 실패 테스트 작성**

`src/lib/reservations.test.ts` import에 아래 상수를 추가한다.

```ts
BOOKING_END_MINUTES,
BOOKING_HOURS_MESSAGE,
BOOKING_START_MINUTES,
```

같은 파일의 `reservation rules` describe에 경계 테스트를 추가한다.

```ts
it("limits public bookings to 07:00 through 23:00", () => {
  expect(BOOKING_START_MINUTES).toBe(420);
  expect(BOOKING_END_MINUTES).toBe(1380);

  const base = {
    date: "2026-07-17",
    roomId: "room-1",
    name: "Lee",
    password: "1234",
  };

  expect(validateReservationDraft({ ...base, startMinutes: 420, endMinutes: 450 })).toEqual([]);
  expect(validateReservationDraft({ ...base, startMinutes: 1320, endMinutes: 1380 })).toEqual([]);
  expect(validateReservationDraft({ ...base, startMinutes: 1350, endMinutes: 1380 })).toEqual([]);
  expect(validateReservationDraft({ ...base, startMinutes: 390, endMinutes: 420 })).toContain(
    BOOKING_HOURS_MESSAGE,
  );
  expect(validateReservationDraft({ ...base, startMinutes: 1350, endMinutes: 1410 })).toContain(
    BOOKING_HOURS_MESSAGE,
  );
});
```

`src/lib/reservation-actions.test.ts`의 describe에 공개 시간 변경 조기 거절 테스트를 추가한다.

```ts
it("rejects time changes outside public booking hours before querying", async () => {
  await expect(
    updatePublicReservationTime(
      "res-1",
      { name: "Lee", password: "1234" },
      {
        date: "2026-07-17",
        roomId: "room-1",
        startMinutes: 1350,
        endMinutes: 1410,
      },
    ),
  ).resolves.toEqual({
    ok: false,
    error: "예약 가능 시간은 07:00부터 23:00까지입니다.",
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm test -- src/lib/reservations.test.ts src/lib/reservation-actions.test.ts
```

Expected: 새 상수가 없고 운영시간 밖 변경이 조기 거절되지 않아 FAIL.

- [ ] **Step 3: 공통 상수와 검증 구현**

`src/lib/reservations.ts`의 시간 상수에 아래 값을 추가한다.

```ts
export const SLOT_MINUTES = 30;
export const DAY_END_MINUTES = 24 * 60;
export const BOOKING_START_MINUTES = 7 * 60;
export const BOOKING_END_MINUTES = 23 * 60;
export const BOOKING_HOURS_MESSAGE = "예약 가능 시간은 07:00부터 23:00까지입니다.";
export const MAX_BOOKING_DURATION_MINUTES = 60;
```

`validateReservationTimeFields`에서 날짜·연습실·그리드 검사 다음에 공개 예약 경계를 검사한다. 기존 `00:00~24:00` 무결성 검사도 유지한다.

```ts
if (draft.startMinutes < 0 || draft.endMinutes > DAY_END_MINUTES) {
  errors.push("예약 시간은 00:00부터 24:00 사이여야 합니다.");
}
if (draft.startMinutes < BOOKING_START_MINUTES || draft.endMinutes > BOOKING_END_MINUTES) {
  errors.push(BOOKING_HOURS_MESSAGE);
}
```

- [ ] **Step 4: 공통 정책 테스트 통과 확인**

Run:

```bash
npm test -- src/lib/reservations.test.ts src/lib/reservation-actions.test.ts
```

Expected: PASS.

- [ ] **Step 5: 공통 정책 커밋**

```bash
git add src/lib/reservations.ts src/lib/reservations.test.ts src/lib/reservation-actions.test.ts
git commit -m "feat: 공개 예약 운영시간 정책 추가"
```

### Task 2: 기본 예약 선택지와 최종 선택 검증

**Files:**
- Modify: `src/lib/booking-availability.ts`
- Test: `src/lib/booking-availability.test.ts`

**Interfaces:**
- Consumes: `BOOKING_START_MINUTES`, `BOOKING_END_MINUTES`, `BOOKING_HOURS_MESSAGE`
- Updates: `getBookingAvailability(...)`
- Updates: `selectBookableRange(...)`
- Updates: `validateBookableDraftTime(...)`

- [ ] **Step 1: 예약 선택지와 직접 요청 실패 테스트 작성**

`src/lib/booking-availability.test.ts`에서 기존 `keeps ranges ending at midnight bookable and later ranges hidden` 테스트를 아래 테스트로 교체한다.

```ts
it("offers only ranges inside 07:00 through 23:00", () => {
  const thirtyMinutes = getBookingAvailability([], {
    date: "2026-07-17",
    roomId: "room-1",
    durationMinutes: 30,
  });
  const oneHour = getBookingAvailability([], {
    date: "2026-07-17",
    roomId: "room-1",
    durationMinutes: 60,
  });

  expect(thirtyMinutes.rangeOptions[0]).toEqual({
    startMinutes: 420,
    endMinutes: 450,
    label: "07:00-07:30",
  });
  expect(thirtyMinutes.rangeOptions.at(-1)).toEqual({
    startMinutes: 1350,
    endMinutes: 1380,
    label: "22:30-23:00",
  });
  expect(oneHour.rangeOptions.at(-1)).toEqual({
    startMinutes: 1320,
    endMinutes: 1380,
    label: "22:00-23:00",
  });
});
```

직접 선택과 최종 검증의 운영시간 차단 테스트를 추가한다.

```ts
it("rejects stale or direct selections outside booking hours", () => {
  const option = {
    startMinutes: 1350,
    endMinutes: 1410,
    label: "22:30-23:30",
  };

  expect(
    selectBookableRange([], {
      date: "2026-07-17",
      roomId: "room-1",
      option,
    }),
  ).toEqual({
    ok: false,
    error: "예약 가능 시간은 07:00부터 23:00까지입니다.",
  });
  expect(
    validateBookableDraftTime([], {
      date: "2026-07-17",
      roomId: "room-1",
      startMinutes: option.startMinutes,
      endMinutes: option.endMinutes,
    }),
  ).toEqual({
    ok: false,
    error: "예약 가능 시간은 07:00부터 23:00까지입니다.",
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm test -- src/lib/booking-availability.test.ts
```

Expected: `00:00` 이후 선택지가 남아 있고 직접 운영시간 밖 요청을 허용해 FAIL.

- [ ] **Step 3: 기본 예약 가능 시간 계산 구현**

`src/lib/booking-availability.ts`의 reservations import에 공통 정책을 추가한다.

```ts
BOOKING_END_MINUTES,
BOOKING_HOURS_MESSAGE,
BOOKING_START_MINUTES,
```

모듈 내부에 아래 헬퍼를 추가한다. export하지 않아 기존 공개 인터페이스를 유지한다.

```ts
function isWithinBookingHours(startMinutes: number, endMinutes: number) {
  return startMinutes >= BOOKING_START_MINUTES && endMinutes <= BOOKING_END_MINUTES;
}
```

`isBookingDurationAvailable`의 기존 하루 경계 검사 다음에 공통 경계 검사를 추가한다.

```ts
if (!isWithinBookingHours(options.startMinutes, endMinutes)) return false;
```

`selectBookableRange`의 과거 시간 검사보다 먼저 아래 검사를 추가한다.

```ts
if (!isWithinBookingHours(options.option.startMinutes, options.option.endMinutes)) {
  return { ok: false, error: BOOKING_HOURS_MESSAGE };
}
```

`validateBookableDraftTime`의 과거 시간 검사보다 먼저 아래 검사를 추가한다.

```ts
if (!isWithinBookingHours(draft.startMinutes, draft.endMinutes)) {
  return { ok: false, error: BOOKING_HOURS_MESSAGE };
}
```

- [ ] **Step 4: 기본 예약 가능 시간 테스트 통과 확인**

Run:

```bash
npm test -- src/lib/booking-availability.test.ts
```

Expected: PASS.

- [ ] **Step 5: 기본 예약 정책 커밋**

```bash
git add src/lib/booking-availability.ts src/lib/booking-availability.test.ts
git commit -m "feat: 기본 예약 시간을 운영시간으로 제한"
```

### Task 3: V2 예약판 운영시간 통일

**Files:**
- Modify: `src/lib/v2-reservation-board.ts`
- Test: `src/lib/v2-reservation-board.test.ts`
- Test: `src/lib/v2-reservation-actions.test.ts`

**Interfaces:**
- Consumes: `BOOKING_START_MINUTES`, `BOOKING_END_MINUTES`, `BOOKING_HOURS_MESSAGE`
- Preserves: `V2_DAY_START_MINUTES`, `V2_DAY_END_MINUTES`, `V2_OPERATING_HOURS_MESSAGE`
- Updates: `getV2VisibleSlots()`
- Updates: `validateV2ReservationDraft(...)`

- [ ] **Step 1: V2 표시 범위와 경계 실패 테스트 작성**

`src/lib/v2-reservation-board.test.ts`의 첫 테스트를 아래 내용으로 교체한다.

```ts
it("uses shared 07:00 to 23:00 operating hours with 30-minute slots", () => {
  expect(V2_DAY_START_MINUTES).toBe(420);
  expect(V2_DAY_END_MINUTES).toBe(1380);
  expect(V2_SLOT_MINUTES).toBe(30);

  const slots = getV2VisibleSlots();
  expect(slots).toHaveLength(32);
  expect(slots[0]).toEqual({ startMinutes: 420, label: "07:00" });
  expect(slots[31]).toEqual({ startMinutes: 1350, label: "22:30" });
});
```

`marks grace-period...` 테스트의 첫 행 검증을 `10:00` 행 검색으로 바꾼다.

```ts
const row1000 = rows.find((row) => row.startMinutes === 600)!;
expect(row1000.timeLabel).toBe("10:00");
expect(row1000.tiles.map((tile) => tile.state)).toEqual(["available", "available", "available"]);
```

`marks maintenance tiles...` 테스트의 행 선택을 아래처럼 바꾼다.

```ts
const row = buildV2BoardRows({
  date: "2026-06-20",
  reservations: [maintenance],
  currentTime: { date: "2026-06-20", minutes: 590 },
}).find((candidate) => candidate.startMinutes === 600)!;
```

기존 outside-hours 검증의 draft를 `1350~1410`으로 바꾸고 기대 문구를 공통 문구로 바꾼다.

```ts
expect(
  validateV2ReservationDraft(
    {
      date: "2026-06-20",
      roomId: "room-1",
      startMinutes: 1350,
      endMinutes: 1410,
      name: "Kim",
      password: "1234",
    },
    [],
    { date: "2026-06-20", minutes: 590 },
  ),
).toEqual({ ok: false, error: "예약 가능 시간은 07:00부터 23:00까지입니다." });
```

마감 경계 허용 테스트를 추가한다.

```ts
it("allows bookings that end exactly at 23:00", () => {
  const currentTime = { date: "2026-06-20", minutes: 590 };
  const base = {
    date: "2026-06-20",
    roomId: "room-1",
    name: "Kim",
    password: "1234",
  };

  expect(
    validateV2ReservationDraft({ ...base, startMinutes: 1350, endMinutes: 1380 }, [], currentTime),
  ).toEqual({ ok: true });
  expect(
    validateV2ReservationDraft({ ...base, startMinutes: 1320, endMinutes: 1380 }, [], currentTime),
  ).toEqual({ ok: true });
});
```

`src/lib/v2-reservation-actions.test.ts`에 운영시간 밖 조기 거절 테스트를 추가한다.

```ts
it("rejects drafts outside shared booking hours before querying", async () => {
  await expect(
    createV2PublicReservation(
      {
        date: "2026-06-20",
        roomId: "room-1",
        startMinutes: 1350,
        endMinutes: 1410,
        name: "Kim",
        password: "1234",
      },
      { date: "2026-06-20", minutes: 590 },
    ),
  ).resolves.toEqual({
    ok: false,
    error: "예약 가능 시간은 07:00부터 23:00까지입니다.",
  });
});
```

- [ ] **Step 2: 실패 확인**

Run:

```bash
npm test -- src/lib/v2-reservation-board.test.ts src/lib/v2-reservation-actions.test.ts
```

Expected: V2가 여전히 `10:00~22:00`을 사용해 FAIL.

- [ ] **Step 3: V2를 공통 운영시간에 연결**

`src/lib/v2-reservation-board.ts`의 reservations import에 아래 공통 정책을 추가한다.

```ts
BOOKING_END_MINUTES,
BOOKING_HOURS_MESSAGE,
BOOKING_START_MINUTES,
```

V2 전용 범위와 문구를 공통 값의 별칭으로 바꾼다.

```ts
export const V2_DAY_START_MINUTES = BOOKING_START_MINUTES;
export const V2_DAY_END_MINUTES = BOOKING_END_MINUTES;
export const V2_SLOT_MINUTES = SLOT_MINUTES;

export const V2_TODAY_ONLY_MESSAGE = "오늘 예약만 가능합니다.";
export const V2_PAST_TIME_MESSAGE = "현재 시간 이후만 예약할 수 있습니다.";
export const V2_OPERATING_HOURS_MESSAGE = BOOKING_HOURS_MESSAGE;
```

기존 `validateV2ReservationTime`의 범위 비교는 V2 별칭을 그대로 사용하므로 추가 변경하지 않는다.

- [ ] **Step 4: V2 운영시간 테스트 통과 확인**

Run:

```bash
npm test -- src/lib/v2-reservation-board.test.ts src/lib/v2-reservation-actions.test.ts
```

Expected: PASS.

- [ ] **Step 5: V2 정책 커밋**

```bash
git add src/lib/v2-reservation-board.ts src/lib/v2-reservation-board.test.ts src/lib/v2-reservation-actions.test.ts
git commit -m "feat: V2 예약 시간을 공통 운영시간으로 통일"
```

### Task 4: 전체 회귀 검증

**Files:**
- Verify: `src/lib/**/*.test.ts`
- Verify: Next.js production build

**Interfaces:**
- Verifies: 공개 예약 생성·변경, 기본 예약 선택지, V2 예약판, 관리자·점검 기존 동작

- [ ] **Step 1: 전체 단위 테스트 실행**

Run:

```bash
npm test
```

Expected: 모든 테스트 PASS, 실패 0개.

- [ ] **Step 2: 프로덕션 빌드 실행**

Run:

```bash
npm run build
```

Expected: exit code 0.

- [ ] **Step 3: 변경 범위 확인**

Run:

```bash
git status --short
git diff --check HEAD~3
```

Expected: 계획한 소스·테스트 외의 미커밋 변경이 없고 whitespace 오류가 없다.
