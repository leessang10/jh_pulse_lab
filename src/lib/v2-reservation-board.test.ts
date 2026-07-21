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

const maintenance = {
  kind: "maintenance" as const,
  id: "maintenance-1",
  date: "2026-06-20",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 690,
  createdBy: "admin-1",
  createdAt: "2026-06-20T01:00:00.000Z",
};

describe("v2 reservation board", () => {
  it("uses shared 07:00 to 23:00 operating hours with 30-minute slots", () => {
    expect(V2_DAY_START_MINUTES).toBe(420);
    expect(V2_DAY_END_MINUTES).toBe(1380);
    expect(V2_SLOT_MINUTES).toBe(30);

    const slots = getV2VisibleSlots();
    expect(slots).toHaveLength(32);
    expect(slots[0]).toEqual({ startMinutes: 420, label: "07:00" });
    expect(slots[31]).toEqual({ startMinutes: 1350, label: "22:30" });
  });

  it("marks grace-period, available, and reserved tiles for every active room", () => {
    const rows = buildV2BoardRows({
      date: "2026-06-20",
      reservations: [baseReservation],
      currentTime: { date: "2026-06-20", minutes: 615 },
    });

    const row1000 = rows.find((row) => row.startMinutes === 600)!;
    expect(row1000.timeLabel).toBe("10:00");
    expect(row1000.tiles.map((tile) => tile.state)).toEqual(["available", "available", "available"]);

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

  it("marks maintenance tiles and blocks every overlapping duration", () => {
    const row = buildV2BoardRows({
      date: "2026-06-20",
      reservations: [maintenance],
      currentTime: { date: "2026-06-20", minutes: 590 },
    }).find((candidate) => candidate.startMinutes === 600)!;
    const tile = row.tiles[0];

    expect(tile.state).toBe("maintenance");
    expect(tile.block).toEqual(maintenance);
    expect(getV2DurationOptionsForTile(tile, [maintenance], { date: "2026-06-20", minutes: 590 }))
      .toEqual([
        { minutes: 30, label: "30분", available: false, reason: "점검 시간에는 예약할 수 없습니다." },
        { minutes: 60, label: "1시간", available: false, reason: "점검 시간에는 예약할 수 없습니다." },
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

    const gracePeriodDraft = {
      date: "2026-06-20",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 630,
      name: "Kim",
      password: "1234",
    };

    expect(validateV2ReservationDraft(gracePeriodDraft, [], { date: "2026-06-20", minutes: 620 })).toEqual({
      ok: true,
    });
    expect(validateV2ReservationDraft(gracePeriodDraft, [], { date: "2026-06-20", minutes: 621 })).toEqual({
      ok: false,
      error: "현재 시간 이후만 예약할 수 있습니다.",
    });

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
          startMinutes: 1350,
          endMinutes: 1410,
          name: "Kim",
          password: "1234",
        },
        [],
        { date: "2026-06-20", minutes: 590 },
      ),
    ).toEqual({ ok: false, error: "예약 가능 시간은 07:00부터 23:00까지입니다." });
  });

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
});
