# V2 Same-Day Reservation Board Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `/v2` public same-day drum practice room reservation board while preserving all existing V1 pages and admin behavior.

**Architecture:** Add V2-specific pure board and validation helpers, wrap existing Supabase reservation actions with stricter V2 server validation, then build a single client page that renders desktop and mobile board layouts from the same derived tile model. Keep durable data in the existing `reservations` table and use polling instead of adding Supabase Realtime.

**Tech Stack:** Next.js App Router, React client component, TypeScript, Vitest, existing shadcn-style UI primitives, existing Supabase server actions.

---

## File Structure

- Create `src/lib/v2-reservation-board.ts`
  - Owns V2 operating-hour constants, visible slot generation, tile derivation, V2 draft validation, and display helpers.
- Create `src/lib/v2-reservation-board.test.ts`
  - Tests the pure board model and V2 policy without touching Supabase.
- Create `src/lib/v2-reservation-actions.ts`
  - Server action wrapper for V2 create and cancel flows.
  - Reuses `listPublicReservationTimeBlocks`, `createPublicReservation`, and `cancelPublicReservation`.
- Create `src/lib/v2-reservation-actions.test.ts`
  - Tests early validation branches that do not require Supabase.
- Create `src/app/v2/page.tsx`
  - Server route shell for `/v2`.
- Create `src/app/v2/v2-reservation-board.tsx`
  - Client board UI, dialogs, polling, and success/error messages.
- Modify `src/lib/reservation-actions.ts`
  - Add `/v2` to `revalidatePath` calls so V2 refreshes after mutations.

No existing V1 route file should be modified.

---

### Task 1: Pure V2 Board Model

**Files:**
- Create: `src/lib/v2-reservation-board.ts`
- Create: `src/lib/v2-reservation-board.test.ts`

- [ ] **Step 1: Write failing tests for V2 slot and tile behavior**

Create `src/lib/v2-reservation-board.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import type { ReservationTimeBlock } from "./reservations";
import {
  V2_DAY_END_MINUTES,
  V2_DAY_START_MINUTES,
  V2_SLOT_MINUTES,
  buildV2BoardRows,
  getV2DurationOptionsForTile,
  getV2VisibleSlots,
  validateV2ReservationDraft,
} from "./v2-reservation-board";

const baseReservation: ReservationTimeBlock = {
  id: "res-1",
  date: "2026-06-20",
  roomId: "room-2",
  startMinutes: 630,
  endMinutes: 690,
  name: "홍길동",
  status: "confirmed",
  createdAt: "2026-06-20T01:00:00.000Z",
};

describe("v2 reservation board", () => {
  it("uses fixed 10:00 to 22:00 operating hours with 30-minute slots", () => {
    expect(V2_DAY_START_MINUTES).toBe(600);
    expect(V2_DAY_END_MINUTES).toBe(1320);
    expect(V2_SLOT_MINUTES).toBe(30);

    const slots = getV2VisibleSlots();
    expect(slots).toHaveLength(24);
    expect(slots[0]).toEqual({ startMinutes: 600, label: "10:00" });
    expect(slots[23]).toEqual({ startMinutes: 1290, label: "21:30" });
  });

  it("marks past, available, and reserved tiles for every active room", () => {
    const rows = buildV2BoardRows({
      date: "2026-06-20",
      reservations: [baseReservation],
      currentTime: { date: "2026-06-20", minutes: 615 },
    });

    expect(rows[0].timeLabel).toBe("10:00");
    expect(rows[0].tiles.map((tile) => tile.state)).toEqual(["past", "past", "past"]);

    const row1030 = rows.find((row) => row.startMinutes === 630)!;
    expect(row1030.tiles.map((tile) => ({ roomId: tile.room.id, state: tile.state, name: tile.reservation?.name }))).toEqual([
      { roomId: "room-1", state: "available", name: undefined },
      { roomId: "room-2", state: "reserved", name: "홍길동" },
      { roomId: "room-3", state: "available", name: undefined },
    ]);
  });

  it("prevents a 60-minute booking when the second slot is already reserved", () => {
    const tile = buildV2BoardRows({
      date: "2026-06-20",
      reservations: [baseReservation],
      currentTime: { date: "2026-06-20", minutes: 590 },
    })
      .find((row) => row.startMinutes === 600)!
      .tiles.find((candidate) => candidate.room.id === "room-2")!;

    expect(getV2DurationOptionsForTile(tile, [baseReservation], { date: "2026-06-20", minutes: 590 })).toEqual([
      { minutes: 30, label: "30분", available: true },
      { minutes: 60, label: "1시간", available: false, reason: "이미 예약된 시간입니다." },
    ]);
  });

  it("rejects non-today, past, invalid duration, and outside-hours drafts", () => {
    expect(
      validateV2ReservationDraft(
        {
          date: "2026-06-19",
          roomId: "room-1",
          startMinutes: 600,
          endMinutes: 630,
          name: "Kim",
          password: "1234",
        },
        [],
        { date: "2026-06-20", minutes: 590 },
      ),
    ).toEqual({ ok: false, error: "오늘 예약만 가능합니다." });

    expect(
      validateV2ReservationDraft(
        {
          date: "2026-06-20",
          roomId: "room-1",
          startMinutes: 600,
          endMinutes: 630,
          name: "Kim",
          password: "1234",
        },
        [],
        { date: "2026-06-20", minutes: 600 },
      ),
    ).toEqual({ ok: false, error: "현재 시간 이후만 예약할 수 있습니다." });

    expect(
      validateV2ReservationDraft(
        {
          date: "2026-06-20",
          roomId: "room-1",
          startMinutes: 600,
          endMinutes: 690,
          name: "Kim",
          password: "1234",
        },
        [],
        { date: "2026-06-20", minutes: 590 },
      ),
    ).toEqual({ ok: false, error: "이용시간은 30분 또는 1시간만 가능합니다." });

    expect(
      validateV2ReservationDraft(
        {
          date: "2026-06-20",
          roomId: "room-1",
          startMinutes: 1290,
          endMinutes: 1350,
          name: "Kim",
          password: "1234",
        },
        [],
        { date: "2026-06-20", minutes: 590 },
      ),
    ).toEqual({ ok: false, error: "운영시간은 10:00부터 22:00까지입니다." });
  });
});
```

- [ ] **Step 2: Run the new test and confirm it fails**

Run:

```bash
npm test -- src/lib/v2-reservation-board.test.ts
```

Expected: FAIL because `src/lib/v2-reservation-board.ts` does not exist.

- [ ] **Step 3: Implement the V2 board model**

Create `src/lib/v2-reservation-board.ts`:

```ts
import { findReservationConflict } from "@/lib/booking-availability";
import {
  ACTIVE_ROOM_IDS,
  BOOKING_DURATION_OPTIONS,
  ROOMS,
  SLOT_MINUTES,
  formatMinutes,
  type ReservationDraft,
  type ReservationTimeBlock,
  type Room,
} from "@/lib/reservations";
import type { BookingCurrentTime } from "@/lib/booking-availability";

export const V2_DAY_START_MINUTES = 10 * 60;
export const V2_DAY_END_MINUTES = 22 * 60;
export const V2_SLOT_MINUTES = SLOT_MINUTES;

export const V2_TODAY_ONLY_MESSAGE = "오늘 예약만 가능합니다.";
export const V2_PAST_TIME_MESSAGE = "현재 시간 이후만 예약할 수 있습니다.";
export const V2_OPERATING_HOURS_MESSAGE = "운영시간은 10:00부터 22:00까지입니다.";
export const V2_DURATION_MESSAGE = "이용시간은 30분 또는 1시간만 가능합니다.";
export const V2_CONFLICT_MESSAGE = "이미 예약된 시간입니다.";

export type V2TileState = "past" | "available" | "reserved" | "unavailable";

export type V2BoardTile = {
  key: string;
  date: string;
  room: Room;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  state: V2TileState;
  reservation?: ReservationTimeBlock;
};

export type V2BoardRow = {
  startMinutes: number;
  timeLabel: string;
  tiles: V2BoardTile[];
};

export type V2DurationOption = {
  minutes: 30 | 60;
  label: string;
  available: boolean;
  reason?: string;
};

export function getV2VisibleSlots() {
  return Array.from({ length: (V2_DAY_END_MINUTES - V2_DAY_START_MINUTES) / V2_SLOT_MINUTES }, (_, index) => {
    const startMinutes = V2_DAY_START_MINUTES + index * V2_SLOT_MINUTES;
    return { startMinutes, label: formatMinutes(startMinutes) };
  });
}

export function buildV2BoardRows(options: {
  date: string;
  reservations: ReservationTimeBlock[];
  currentTime: BookingCurrentTime;
}): V2BoardRow[] {
  return getV2VisibleSlots().map((slot) => ({
    startMinutes: slot.startMinutes,
    timeLabel: slot.label,
    tiles: ROOMS.map((room) => buildV2BoardTile({ ...options, room, startMinutes: slot.startMinutes })),
  }));
}

function buildV2BoardTile(options: {
  date: string;
  room: Room;
  startMinutes: number;
  reservations: ReservationTimeBlock[];
  currentTime: BookingCurrentTime;
}): V2BoardTile {
  const endMinutes = options.startMinutes + V2_SLOT_MINUTES;
  const reservation = options.reservations.find(
    (candidate) =>
      candidate.date === options.date &&
      candidate.roomId === options.room.id &&
      candidate.status !== "cancelled" &&
      options.startMinutes < candidate.endMinutes &&
      candidate.startMinutes < endMinutes,
  );

  const state: V2TileState = reservation
    ? "reserved"
    : isV2PastStart(options.date, options.startMinutes, options.currentTime)
      ? "past"
      : "available";

  return {
    key: `${options.startMinutes}-${options.room.id}`,
    date: options.date,
    room: options.room,
    startMinutes: options.startMinutes,
    endMinutes,
    timeLabel: formatMinutes(options.startMinutes),
    state,
    reservation,
  };
}

export function getV2DurationOptionsForTile(
  tile: Pick<V2BoardTile, "date" | "room" | "startMinutes">,
  reservations: ReservationTimeBlock[],
  currentTime: BookingCurrentTime,
): V2DurationOption[] {
  return BOOKING_DURATION_OPTIONS.map((option) => {
    const minutes = option.minutes as 30 | 60;
    const validation = validateV2ReservationTime(
      {
        date: tile.date,
        roomId: tile.room.id,
        startMinutes: tile.startMinutes,
        endMinutes: tile.startMinutes + minutes,
      },
      reservations,
      currentTime,
    );

    return validation.ok
      ? { minutes, label: option.label, available: true }
      : { minutes, label: option.label, available: false, reason: validation.error };
  });
}

export function validateV2ReservationDraft(
  draft: ReservationDraft,
  reservations: ReservationTimeBlock[],
  currentTime: BookingCurrentTime,
): { ok: true } | { ok: false; error: string } {
  if (!draft.name.trim()) return { ok: false, error: "예약자 이름을 입력해 주세요." };
  if (!/^\\d{4}$/.test(draft.password)) return { ok: false, error: "비밀번호는 숫자 4자리로 입력해 주세요." };

  return validateV2ReservationTime(draft, reservations, currentTime);
}

export function validateV2ReservationTime(
  draft: Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">,
  reservations: ReservationTimeBlock[],
  currentTime: BookingCurrentTime,
): { ok: true } | { ok: false; error: string } {
  const duration = draft.endMinutes - draft.startMinutes;

  if (draft.date !== currentTime.date) return { ok: false, error: V2_TODAY_ONLY_MESSAGE };
  if (!ACTIVE_ROOM_IDS.includes(draft.roomId)) return { ok: false, error: "연습실을 선택해 주세요." };
  if (draft.startMinutes % V2_SLOT_MINUTES !== 0 || draft.endMinutes % V2_SLOT_MINUTES !== 0) {
    return { ok: false, error: "시작 시간과 종료 시간은 30분 단위여야 합니다." };
  }
  if (duration !== 30 && duration !== 60) return { ok: false, error: V2_DURATION_MESSAGE };
  if (draft.startMinutes < V2_DAY_START_MINUTES || draft.endMinutes > V2_DAY_END_MINUTES) {
    return { ok: false, error: V2_OPERATING_HOURS_MESSAGE };
  }
  if (isV2PastStart(draft.date, draft.startMinutes, currentTime)) return { ok: false, error: V2_PAST_TIME_MESSAGE };
  if (findReservationConflict(reservations, draft)) return { ok: false, error: V2_CONFLICT_MESSAGE };

  return { ok: true };
}

export function getV2ReservationRangeLabel(startMinutes: number, endMinutes: number) {
  return `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`;
}

function isV2PastStart(date: string, startMinutes: number, currentTime: BookingCurrentTime) {
  if (date < currentTime.date) return true;
  if (date > currentTime.date) return false;
  return startMinutes <= currentTime.minutes;
}
```

- [ ] **Step 4: Run the focused test**

Run:

```bash
npm test -- src/lib/v2-reservation-board.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit Task 1**

```bash
git add src/lib/v2-reservation-board.ts src/lib/v2-reservation-board.test.ts
git commit -m "feat: V2 예약 현황판 정책 모델 추가"
```

---

### Task 2: V2 Server Actions

**Files:**
- Create: `src/lib/v2-reservation-actions.ts`
- Create: `src/lib/v2-reservation-actions.test.ts`
- Modify: `src/lib/reservation-actions.ts`

- [ ] **Step 1: Write failing tests for early V2 action validation**

Create `src/lib/v2-reservation-actions.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { createV2PublicReservation, cancelV2PublicReservation } from "./v2-reservation-actions";

describe("v2 reservation actions", () => {
  it("rejects non-today reservation drafts before writing", async () => {
    await expect(
      createV2PublicReservation(
        {
          date: "2026-06-19",
          roomId: "room-1",
          startMinutes: 600,
          endMinutes: 630,
          name: "Kim",
          password: "1234",
        },
        { date: "2026-06-20", minutes: 590 },
      ),
    ).resolves.toEqual({ ok: false, error: "오늘 예약만 가능합니다." });
  });

  it("rejects invalid cancellation input before querying", async () => {
    await expect(cancelV2PublicReservation({ reservationId: "", name: "Kim", password: "1234" })).resolves.toEqual({
      ok: false,
      error: "예약 정보를 찾을 수 없습니다.",
    });

    await expect(cancelV2PublicReservation({ reservationId: "res-1", name: "Kim", password: "123" })).resolves.toEqual({
      ok: false,
      error: "비밀번호는 숫자 4자리로 입력해 주세요.",
    });
  });
});
```

- [ ] **Step 2: Run the action test and confirm it fails**

Run:

```bash
npm test -- src/lib/v2-reservation-actions.test.ts
```

Expected: FAIL because `src/lib/v2-reservation-actions.ts` does not exist.

- [ ] **Step 3: Implement V2 server actions**

Create `src/lib/v2-reservation-actions.ts`:

```ts
"use server";

import {
  cancelPublicReservation,
  createPublicReservation,
  listPublicReservationTimeBlocks,
  type ReservationActionResult,
} from "@/lib/reservation-actions";
import { validateReservationLookup } from "@/lib/reservation-credentials";
import type { BookingCurrentTime } from "@/lib/booking-availability";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import type { Reservation, ReservationDraft } from "@/lib/reservations";
import { validateV2ReservationDraft } from "@/lib/v2-reservation-board";

const V2_RESERVATION_NOT_FOUND_MESSAGE = "예약 정보를 찾을 수 없습니다.";

export async function createV2PublicReservation(
  draft: ReservationDraft,
  currentTime: BookingCurrentTime = getCurrentKoreaBookingTime(),
): Promise<ReservationActionResult<Reservation>> {
  const current = await listPublicReservationTimeBlocks(currentTime.date);
  if (!current.ok) return current;

  const validation = validateV2ReservationDraft(draft, current.data, currentTime);
  if (!validation.ok) return validation;

  return createPublicReservation(draft);
}

export async function cancelV2PublicReservation(input: {
  reservationId: string;
  name: string;
  password: string;
}): Promise<ReservationActionResult<Reservation>> {
  if (!input.reservationId) return { ok: false, error: V2_RESERVATION_NOT_FOUND_MESSAGE };

  const validationErrors = validateReservationLookup({ name: input.name, password: input.password });
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  return cancelPublicReservation(input.reservationId, {
    name: input.name,
    password: input.password,
  });
}
```

- [ ] **Step 4: Add `/v2` revalidation to existing mutations**

Modify each successful mutation branch in `src/lib/reservation-actions.ts` that currently revalidates `/`, `/reservation`, `/reservations`, and `/admin`.

Add:

```ts
revalidatePath("/v2");
```

The affected functions are:

- `createPublicReservation`
- `cancelPublicReservation`
- `updatePublicReservationTime`
- `updateAdminReservationStatus`
- `deleteAdminReservation`

- [ ] **Step 5: Run focused action tests**

Run:

```bash
npm test -- src/lib/v2-reservation-actions.test.ts src/lib/reservation-actions.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add src/lib/v2-reservation-actions.ts src/lib/v2-reservation-actions.test.ts src/lib/reservation-actions.ts
git commit -m "feat: V2 예약 서버 검증 액션 추가"
```

---

### Task 3: V2 Route Shell and Client Board Skeleton

**Files:**
- Create: `src/app/v2/page.tsx`
- Create: `src/app/v2/v2-reservation-board.tsx`

- [ ] **Step 1: Create the route shell**

Create `src/app/v2/page.tsx`:

```tsx
import { formatKoreaDate, todayKoreaValue } from "@/lib/korea-date";
import { V2ReservationBoard } from "./v2-reservation-board";

export default function V2Page() {
  const today = todayKoreaValue();

  return (
    <main className="min-h-screen bg-background text-foreground">
      <div className="mx-auto grid w-full max-w-7xl gap-5 px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-col gap-1 border-b border-border pb-4">
          <p className="text-base font-semibold text-primary">{formatKoreaDate(today)}</p>
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">드럼 연습실 예약</h1>
        </header>
        <V2ReservationBoard today={today} todayLabel={formatKoreaDate(today)} />
      </div>
    </main>
  );
}
```

- [ ] **Step 2: Create the board skeleton with loading and polling**

Create `src/app/v2/v2-reservation-board.tsx` with the initial data-loading shell:

```tsx
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { listPublicReservationTimeBlocks } from "@/lib/reservation-actions";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import type { ReservationTimeBlock } from "@/lib/reservations";
import { buildV2BoardRows } from "@/lib/v2-reservation-board";

type V2ReservationBoardProps = {
  today: string;
  todayLabel: string;
};

export function V2ReservationBoard({ today, todayLabel }: V2ReservationBoardProps) {
  const [reservations, setReservations] = useState<ReservationTimeBlock[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await listPublicReservationTimeBlocks(today);
    if (!result.ok) {
      setError(result.error);
      setReservations([]);
      setIsReady(true);
      return;
    }

    setError(null);
    setReservations(result.data);
    setIsReady(true);
  }, [today]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => window.clearInterval(id);
  }, [refresh]);

  const rows = useMemo(
    () =>
      buildV2BoardRows({
        date: today,
        reservations,
        currentTime: getCurrentKoreaBookingTime(),
      }),
    [reservations, today],
  );

  return (
    <section className="grid gap-4" aria-label={`${todayLabel} 예약 현황`}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm font-semibold text-muted-foreground">
          {error ? error : !isReady ? "예약 현황을 불러오는 중입니다." : isPending ? "예약 현황을 새로고침 중입니다." : "오늘 예약 현황입니다."}
        </p>
      </div>
      <pre className="sr-only">{JSON.stringify(rows)}</pre>
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        V2 예약 현황판 UI를 연결하는 중입니다.
      </div>
    </section>
  );
}
```

- [ ] **Step 3: Run build to catch route import errors**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 4: Commit Task 3**

```bash
git add src/app/v2/page.tsx src/app/v2/v2-reservation-board.tsx
git commit -m "feat: V2 예약 페이지 라우트 추가"
```

---

### Task 4: Desktop and Mobile Board UI

**Files:**
- Modify: `src/app/v2/v2-reservation-board.tsx`

- [ ] **Step 1: Replace placeholder with desktop and mobile board renderers**

In `src/app/v2/v2-reservation-board.tsx`, add imports:

```tsx
import { cn } from "@/lib/utils";
import { getV2ReservationRangeLabel, type V2BoardTile } from "@/lib/v2-reservation-board";
```

Add these helper functions and components below `V2ReservationBoard`:

```tsx
function DesktopBoard({
  rows,
  onTileClick,
}: {
  rows: ReturnType<typeof buildV2BoardRows>;
  onTileClick: (tile: V2BoardTile) => void;
}) {
  const rooms = rows[0]?.tiles.map((tile) => tile.room) ?? [];

  return (
    <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
      <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] border-b border-border bg-muted/60">
        <div className="px-3 py-3 text-sm font-bold text-muted-foreground">시간</div>
        {rooms.map((room) => (
          <div key={room.id} className="border-l border-border px-3 py-3 text-center text-base font-bold">
            {room.name}
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div key={row.startMinutes} className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] border-b border-border last:border-b-0">
          <div className="grid min-h-16 place-items-center bg-muted/30 px-3 text-base font-bold">{row.timeLabel}</div>
          {row.tiles.map((tile) => (
            <div key={tile.key} className="border-l border-border p-2">
              <TileButton tile={tile} onClick={onTileClick} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileBoard({
  rows,
  onTileClick,
}: {
  rows: ReturnType<typeof buildV2BoardRows>;
  onTileClick: (tile: V2BoardTile) => void;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <section key={row.startMinutes} className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-3 text-xl font-bold">{row.timeLabel}</h2>
          <div className="grid gap-2">
            {row.tiles.map((tile) => (
              <TileButton key={tile.key} tile={tile} onClick={onTileClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TileButton({ tile, onClick }: { tile: V2BoardTile; onClick: (tile: V2BoardTile) => void }) {
  const disabled = tile.state === "past" || tile.state === "unavailable";
  const label =
    tile.state === "reserved"
      ? `${tile.reservation?.name ?? "예약됨"} ${getV2ReservationRangeLabel(tile.reservation?.startMinutes ?? tile.startMinutes, tile.reservation?.endMinutes ?? tile.endMinutes)}`
      : tile.state === "past"
        ? "종료"
        : "예약 가능";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(tile)}
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-base font-bold transition active:translate-y-px disabled:pointer-events-none",
        tile.state === "available" && "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
        tile.state === "reserved" && "border-slate-300 bg-slate-100 text-slate-950 hover:bg-slate-200",
        tile.state === "past" && "border-border bg-muted/50 text-muted-foreground opacity-65",
        tile.state === "unavailable" && "border-border bg-muted/50 text-muted-foreground opacity-65",
      )}
    >
      <span className="md:hidden">{tile.room.name}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}
```

Inside the `return`, replace the placeholder `<pre>` and dashed placeholder with:

```tsx
{!isReady ? (
  <BoardSkeleton />
) : (
  <>
    <DesktopBoard rows={rows} onTileClick={() => {}} />
    <MobileBoard rows={rows} onTileClick={() => {}} />
  </>
)}
```

Add:

```tsx
function BoardSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-16 rounded-lg border border-border bg-muted/50" />
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Commit Task 4**

```bash
git add src/app/v2/v2-reservation-board.tsx
git commit -m "feat: V2 예약 현황판 반응형 UI 추가"
```

---

### Task 5: Booking and Cancellation Dialogs

**Files:**
- Modify: `src/app/v2/v2-reservation-board.tsx`

- [ ] **Step 1: Add dialog imports and state**

Add imports:

```tsx
import { useMemo, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createV2PublicReservation, cancelV2PublicReservation } from "@/lib/v2-reservation-actions";
import { getV2DurationOptionsForTile, validateV2ReservationDraft } from "@/lib/v2-reservation-board";
```

Inside `V2ReservationBoard`, add state:

```tsx
const [selectedTile, setSelectedTile] = useState<V2BoardTile | null>(null);
const [name, setName] = useState("");
const [password, setPassword] = useState("");
const [durationMinutes, setDurationMinutes] = useState<30 | 60>(30);
const [dialogError, setDialogError] = useState<string | null>(null);
const [isSubmitting, startSubmitTransition] = useTransition();
```

Add derived values:

```tsx
const durationOptions = selectedTile?.state === "available"
  ? getV2DurationOptionsForTile(selectedTile, reservations, getCurrentKoreaBookingTime())
  : [];
const selectedReservation = selectedTile?.reservation;
```

- [ ] **Step 2: Wire tile click behavior**

Add:

```tsx
function openTile(tile: V2BoardTile) {
  if (tile.state !== "available" && tile.state !== "reserved") return;
  setSelectedTile(tile);
  setName(tile.reservation?.name ?? "");
  setPassword("");
  setDurationMinutes(30);
  setDialogError(null);
}

function closeDialog() {
  setSelectedTile(null);
  setPassword("");
  setDialogError(null);
}
```

Change board renderers to:

```tsx
<DesktopBoard rows={rows} onTileClick={openTile} />
<MobileBoard rows={rows} onTileClick={openTile} />
```

- [ ] **Step 3: Add submit handlers**

Add:

```tsx
function submitBooking() {
  if (!selectedTile || selectedTile.state !== "available") return;

  const draft = {
    date: today,
    roomId: selectedTile.room.id,
    startMinutes: selectedTile.startMinutes,
    endMinutes: selectedTile.startMinutes + durationMinutes,
    name,
    password,
  };

  const validation = validateV2ReservationDraft(draft, reservations, getCurrentKoreaBookingTime());
  if (!validation.ok) {
    setDialogError(validation.error);
    return;
  }

  startSubmitTransition(async () => {
    const result = await createV2PublicReservation(draft);
    if (!result.ok) {
      setDialogError(result.error);
      await refresh();
      return;
    }

    toast.success("예약이 완료되었습니다.");
    closeDialog();
    await refresh();
  });
}

function submitCancellation() {
  if (!selectedTile?.reservation) return;

  startSubmitTransition(async () => {
    const result = await cancelV2PublicReservation({
      reservationId: selectedTile.reservation!.id,
      name: selectedTile.reservation!.name,
      password,
    });

    if (!result.ok) {
      setDialogError(result.error);
      return;
    }

    toast.success("예약을 취소했습니다.");
    closeDialog();
    await refresh();
  });
}
```

- [ ] **Step 4: Render booking and cancellation dialogs**

Add this before the closing `</section>`:

```tsx
<Dialog open={Boolean(selectedTile)} onOpenChange={(open) => !open && closeDialog()}>
  <DialogContent className="max-w-md">
    {selectedTile?.state === "available" ? (
      <>
        <DialogHeader>
          <DialogTitle>예약하기</DialogTitle>
          <DialogDescription>
            {selectedTile.room.name} {selectedTile.timeLabel} 시작
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <label className="grid gap-2 text-sm font-semibold">
            이름
            <Input className="h-12 text-base" value={name} onChange={(event) => setName(event.target.value)} />
          </label>
          <label className="grid gap-2 text-sm font-semibold">
            비밀번호
            <Input
              className="h-12 text-base"
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          <div className="grid gap-2">
            <span className="text-sm font-semibold">이용시간</span>
            <div className="grid grid-cols-2 gap-2">
              {durationOptions.map((option) => (
                <Button
                  key={option.minutes}
                  type="button"
                  variant={durationMinutes === option.minutes ? "default" : "outline"}
                  className="h-12"
                  disabled={!option.available}
                  onClick={() => setDurationMinutes(option.minutes)}
                >
                  {option.label}
                </Button>
              ))}
            </div>
          </div>
          {dialogError ? <p className="rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">{dialogError}</p> : null}
        </div>
        <DialogFooter>
          <Button className="h-12 w-full sm:w-auto" onClick={submitBooking} disabled={isSubmitting}>
            예약하기
          </Button>
        </DialogFooter>
      </>
    ) : selectedReservation ? (
      <>
        <DialogHeader>
          <DialogTitle>예약 정보</DialogTitle>
          <DialogDescription>
            {selectedReservation.name}님의 {selectedTile?.room.name} 예약입니다.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="rounded-lg border border-border bg-muted/50 p-4 text-base font-bold">
            {selectedTile?.room.name} {getV2ReservationRangeLabel(selectedReservation.startMinutes, selectedReservation.endMinutes)}
          </div>
          <label className="grid gap-2 text-sm font-semibold">
            비밀번호
            <Input
              className="h-12 text-base"
              inputMode="numeric"
              maxLength={4}
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </label>
          {dialogError ? <p className="rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">{dialogError}</p> : null}
        </div>
        <DialogFooter>
          <Button className="h-12 w-full sm:w-auto" variant="destructive" onClick={submitCancellation} disabled={isSubmitting}>
            예약 취소
          </Button>
        </DialogFooter>
      </>
    ) : null}
  </DialogContent>
</Dialog>
```

- [ ] **Step 5: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add src/app/v2/v2-reservation-board.tsx
git commit -m "feat: V2 예약 생성 및 취소 모달 추가"
```

---

### Task 6: Full Verification

**Files:**
- No required code changes unless verification exposes defects.

- [ ] **Step 1: Run the full test suite**

Run:

```bash
npm test
```

Expected: PASS.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start the dev server**

Run:

```bash
npm run dev
```

Expected: local Next server starts and prints a localhost URL.

- [ ] **Step 4: Inspect `/v2` in the browser**

Open the local URL at `/v2`.

Verify:

- Header shows `드럼 연습실 예약`.
- Today's date is visible.
- Desktop width shows a time-by-room grid.
- Mobile width shows time-group cards.
- Every visible button is at least 44px tall.
- Past slots are disabled.
- Available slots are clearly green-tinted.
- Reserved slots show the reserver name.
- Booking dialog opens from an available tile.
- Cancellation dialog opens from a reserved tile.

- [ ] **Step 5: Verify live reservation behavior**

Using the local app connected to Supabase:

1. Create a reservation from `/v2`.
2. Confirm the tile changes to reserved after success.
3. Try to create a duplicate booking for the same room and time.
4. Confirm the UI shows `이미 예약된 시간입니다.` or the existing conflict message.
5. Try cancellation with a wrong password.
6. Confirm the dialog shows a password mismatch or not-found message.
7. Cancel with the correct password.
8. Confirm the tile becomes available again after refresh.

- [ ] **Step 6: Final commit if verification fixes were needed**

If any verification defects required changes:

```bash
git add src/app/v2 src/lib/v2-reservation-board.ts src/lib/v2-reservation-actions.ts src/lib/reservation-actions.ts
git commit -m "fix: V2 예약 현황판 검증 보완"
```

---

## Self-Review

Spec coverage:

- `/v2` only: Task 3.
- Existing pages preserved: file structure and tasks avoid V1 route edits.
- Fixed 10:00-22:00 operating hours: Task 1.
- 30-minute and 60-minute booking policy: Task 1 and Task 5.
- Desktop grid and mobile card layout: Task 4.
- Booking modal: Task 5.
- Cancellation modal: Task 5.
- Server validation: Task 1 and Task 2.
- Polling refresh: Task 3.
- Admin V2 and settings exclusions: file structure excludes admin route and schema changes.

Placeholder scan:

- The plan avoids unfinished-marker text and undefined future placeholders.
- Each task includes target files, code, commands, and expected outcomes.

Type consistency:

- `V2BoardTile`, `V2BoardRow`, and `V2DurationOption` are defined in Task 1 and reused in later tasks.
- `createV2PublicReservation` and `cancelV2PublicReservation` are defined in Task 2 and imported in Task 5.
- The route imports `V2ReservationBoard` from the local client component in Task 3.
