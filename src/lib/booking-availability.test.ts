import { describe, expect, it } from "vitest";
import type { Reservation, ReservationDraft, ReservationTimeBlock } from "./reservations";
import * as bookingAvailability from "./booking-availability";
import {
  MAINTENANCE_CONFLICT_MESSAGE,
  findScheduleConflict,
  getBookingAvailability,
  getReservationsCoveringTimeBlock,
  selectBookableRange,
  validateBookableDraftTime,
} from "./booking-availability";

const baseReservation: Reservation = {
  id: "res-1",
  date: "2026-06-05",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 660,
  name: "Lee",
  status: "confirmed",
  createdAt: "2026-06-05T00:00:00.000Z",
};

describe("booking availability", () => {
  it("keeps legacy slot helpers out of the module interface", () => {
    expect(Object.keys(bookingAvailability).sort()).toEqual([
      "BOOKING_DRAFT_CONFLICT_MESSAGE",
      "BOOKING_PAST_TIME_MESSAGE",
      "BOOKING_RANGE_CONFLICT_MESSAGE",
      "MAINTENANCE_CONFLICT_MESSAGE",
      "findReservationConflict",
      "findScheduleConflict",
      "getBookingAvailability",
      "getReservationsCoveringTimeBlock",
      "selectBookableRange",
      "validateBookableDraftTime",
    ]);
  });

  it("blocks maintenance ranges with the maintenance-specific message", () => {
    const maintenance = {
      kind: "maintenance" as const,
      id: "maintenance-1",
      date: "2026-06-05",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 780,
      createdBy: "admin-1",
      createdAt: "2026-06-05T00:00:00.000Z",
    };
    const draft = {
      date: "2026-06-05",
      roomId: "room-1",
      startMinutes: 660,
      endMinutes: 720,
    };

    expect(findScheduleConflict([maintenance], draft)).toEqual(maintenance);
    expect(validateBookableDraftTime([maintenance], draft)).toEqual({
      ok: false,
      error: MAINTENANCE_CONFLICT_MESSAGE,
    });
    expect(
      selectBookableRange([maintenance], {
        date: draft.date,
        roomId: draft.roomId,
        option: { startMinutes: 660, endMinutes: 720, label: "11:00-12:00" },
      }),
    ).toEqual({ ok: false, error: MAINTENANCE_CONFLICT_MESSAGE });
  });

  it("checks public time blocks without contact fields", () => {
    const publicTimeBlock: ReservationTimeBlock = {
      id: "public-block-1",
      date: "2026-06-05",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      name: "Lee",
      status: "confirmed",
      createdAt: "2026-06-05T00:00:00.000Z",
    };

    expect(
      selectBookableRange([publicTimeBlock], {
        date: "2026-06-05",
        roomId: "room-1",
        option: {
          startMinutes: 630,
          endMinutes: 690,
          label: "10:30-11:30",
        },
      }),
    ).toEqual({
      ok: false,
      error: "이미 예약된 시간이 포함되어 있습니다.",
    });
  });

  it("returns the booking choices a public reservation screen needs", () => {
    const availability = getBookingAvailability([baseReservation], {
      date: "2026-06-05",
      roomId: "room-1",
      durationMinutes: 60,
    });

    expect(availability.durationOptions.map((option) => option.label)).toEqual([
      "30분",
      "1시간",
    ]);
    expect(availability.rangeOptions).toContainEqual({
      startMinutes: 540,
      endMinutes: 600,
      label: "09:00-10:00",
    });
    expect(availability.rangeOptions.some((option) => option.startMinutes === 570)).toBe(false);
  });

  it("can ignore the reservation being edited when building change options", () => {
    const availability = getBookingAvailability([baseReservation], {
      date: "2026-06-05",
      roomId: "room-1",
      durationMinutes: 60,
      ignoredReservationId: "res-1",
    });

    expect(availability.rangeOptions).toContainEqual({
      startMinutes: 600,
      endMinutes: 660,
      label: "10:00-11:00",
    });
  });

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

  it("keeps same-day starts available through the 20-minute grace period", () => {
    const availability = getBookingAvailability([], {
      date: "2026-06-05",
      roomId: "room-1",
      durationMinutes: 60,
      currentTime: { date: "2026-06-05", minutes: 615 },
    });

    expect(availability.rangeOptions).toContainEqual({
      startMinutes: 600,
      endMinutes: 660,
      label: "10:00-11:00",
    });
    expect(availability.rangeOptions).toContainEqual({
      startMinutes: 630,
      endMinutes: 690,
      label: "10:30-11:30",
    });
  });

  it("hides same-day starts after the 20-minute grace period", () => {
    const availability = getBookingAvailability([], {
      date: "2026-06-05",
      roomId: "room-1",
      durationMinutes: 60,
      currentTime: { date: "2026-06-05", minutes: 621 },
    });

    expect(availability.rangeOptions.some((option) => option.startMinutes === 600)).toBe(false);
  });

  it("turns a range option into selected booking time only when it is still available", () => {
    const available = selectBookableRange([], {
      date: "2026-06-05",
      roomId: "room-1",
      option: {
        startMinutes: 540,
        endMinutes: 600,
        label: "09:00-10:00",
      },
    });

    expect(available).toEqual({
      ok: true,
      selectedTime: {
        startMinutes: 540,
        endMinutes: 600,
        label: "09:00-10:00",
      },
    });

    const stale = selectBookableRange([baseReservation], {
      date: "2026-06-05",
      roomId: "room-1",
      option: {
        startMinutes: 630,
        endMinutes: 690,
        label: "10:30-11:30",
      },
    });

    expect(stale).toEqual({
      ok: false,
      error: "이미 예약된 시간이 포함되어 있습니다.",
    });
  });

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

  it("validates final draft availability through the same conflict policy", () => {
    const draft: ReservationDraft = {
      date: "2026-06-05",
      roomId: "room-1",
      startMinutes: 630,
      endMinutes: 690,
      name: "Kim",
      password: "1234",
    };

    expect(validateBookableDraftTime([baseReservation], draft)).toEqual({
      ok: false,
      error: "이미 예약된 시간입니다.",
    });
    expect(validateBookableDraftTime([baseReservation], draft, "res-1")).toEqual({ ok: true });
    expect(validateBookableDraftTime([], draft)).toEqual({ ok: true });
  });

  it("validates final drafts with the same 20-minute grace period", () => {
    const draft: ReservationDraft = {
      date: "2026-06-05",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      name: "Kim",
      password: "1234",
    };

    expect(validateBookableDraftTime([], draft, undefined, { date: "2026-06-05", minutes: 620 })).toEqual({
      ok: true,
    });
    expect(validateBookableDraftTime([], draft, undefined, { date: "2026-06-05", minutes: 621 })).toEqual({
      ok: false,
      error: "현재 시간 이전은 예약할 수 없습니다.",
    });
  });

  it("finds active reservations covering a visible schedule block across rooms", () => {
    const reservations = [
      baseReservation,
      { ...baseReservation, id: "res-2", roomId: "room-2" },
      { ...baseReservation, id: "cancelled", status: "cancelled" as const },
      { ...baseReservation, id: "other-date", date: "2026-06-06" },
    ];

    expect(
      getReservationsCoveringTimeBlock(reservations, {
        date: "2026-06-05",
        startMinutes: 630,
        endMinutes: 660,
      }).map((reservation) => reservation.id),
    ).toEqual(["res-1", "res-2"]);
  });
});
