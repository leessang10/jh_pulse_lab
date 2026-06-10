import { describe, expect, it } from "vitest";
import type { Reservation, ReservationDraft, ReservationTimeBlock } from "./reservations";
import * as bookingAvailability from "./booking-availability";
import {
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
      "BOOKING_RANGE_CONFLICT_MESSAGE",
      "findReservationConflict",
      "getBookingAvailability",
      "getReservationsCoveringTimeBlock",
      "selectBookableRange",
      "validateBookableDraftTime",
    ]);
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
      "1시간 30분",
      "2시간",
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

  it("keeps ranges ending at midnight bookable and later ranges hidden", () => {
    const availability = getBookingAvailability([], {
      date: "2026-06-05",
      roomId: "room-1",
      durationMinutes: 60,
    });

    expect(availability.rangeOptions).toContainEqual({
      startMinutes: 1380,
      endMinutes: 1440,
      label: "23:00-24:00",
    });
    expect(availability.rangeOptions.some((option) => option.startMinutes === 1410)).toBe(false);
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
