import { describe, expect, it } from "vitest";
import {
  buildTimeRange,
  findReservationConflict,
  formatMinutes,
  getBookingDurationOptions,
  getBookingPeriodTimePoints,
  getAvailableTimeSlots,
  getRoomTimeSlots,
  getSimpleBookingTimePoints,
  generateTimeSlots,
  isBookingDurationAvailable,
  BOOKING_PERIODS,
  validateReservationDraft,
  type Reservation,
} from "./reservations";

const baseReservation: Reservation = {
  id: "res-1",
  date: "2026-05-28",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 660,
  name: "Lee",
  phone: "010-0000-0000",
  status: "confirmed",
  createdAt: "2026-05-28T00:00:00.000Z",
};

describe("reservation rules", () => {
  it("formats minutes as 24-hour time", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(570)).toBe("09:30");
    expect(formatMinutes(1440)).toBe("24:00");
  });

  it("generates 30-minute start slots across the whole day", () => {
    const slots = generateTimeSlots();

    expect(slots).toHaveLength(48);
    expect(slots[0]).toEqual({ value: 0, label: "00:00" });
    expect(slots[47]).toEqual({ value: 1410, label: "23:30" });
  });

  it("lists one-hour available slots for a room and date", () => {
    const cancelled: Reservation = {
      ...baseReservation,
      id: "res-cancelled",
      startMinutes: 720,
      endMinutes: 780,
      status: "cancelled",
    };
    const otherRoom: Reservation = { ...baseReservation, id: "res-other-room", roomId: "room-2" };

    const slots = getAvailableTimeSlots([baseReservation, cancelled, otherRoom], {
      date: "2026-05-28",
      roomId: "room-1",
    });

    expect(slots).not.toContainEqual({ startMinutes: 600, endMinutes: 660, label: "10:00-11:00" });
    expect(slots).toContainEqual({ startMinutes: 540, endMinutes: 600, label: "09:00-10:00" });
    expect(slots).toContainEqual({ startMinutes: 720, endMinutes: 780, label: "12:00-13:00" });
  });

  it("lists all simple room slots with availability", () => {
    const slots = getRoomTimeSlots([baseReservation], {
      date: "2026-05-28",
      roomId: "room-1",
    });

    expect(slots[0]).toEqual({
      startMinutes: 540,
      endMinutes: 600,
      label: "09:00-10:00",
      isAvailable: true,
    });
    expect(slots[1]).toEqual({
      startMinutes: 600,
      endMinutes: 660,
      label: "10:00-11:00",
      isAvailable: false,
    });
  });

  it("lists simple booking time points including the final endpoint", () => {
    const points = getSimpleBookingTimePoints();

    expect(points[0]).toBe(540);
    expect(points.at(-1)).toBe(1320);
  });

  it("groups 30-minute start points by booking period", () => {
    expect(BOOKING_PERIODS.map((period) => period.label)).toEqual(["오전", "오후", "저녁", "심야"]);

    const morning = getBookingPeriodTimePoints("morning");
    const night = getBookingPeriodTimePoints("night");

    expect(morning[0]).toBe(360);
    expect(morning.at(-1)).toBe(690);
    expect(night[0]).toBe(0);
    expect(night.at(-1)).toBe(330);
  });

  it("returns practical booking duration options", () => {
    expect(getBookingDurationOptions()).toEqual([
      { minutes: 30, label: "30분" },
      { minutes: 60, label: "1시간" },
      { minutes: 90, label: "1시간 30분" },
      { minutes: 120, label: "2시간" },
      { minutes: 150, label: "2시간 30분" },
      { minutes: 180, label: "3시간" },
    ]);
  });

  it("checks whether a duration is available from a selected start time", () => {
    expect(
      isBookingDurationAvailable([baseReservation], {
        date: "2026-05-28",
        roomId: "room-1",
        startMinutes: 540,
        durationMinutes: 60,
      }),
    ).toBe(true);

    expect(
      isBookingDurationAvailable([baseReservation], {
        date: "2026-05-28",
        roomId: "room-1",
        startMinutes: 570,
        durationMinutes: 60,
      }),
    ).toBe(false);

    expect(
      isBookingDurationAvailable([], {
        date: "2026-05-28",
        roomId: "room-1",
        startMinutes: 1380,
        durationMinutes: 120,
      }),
    ).toBe(false);
  });

  it("builds a sorted range from two clicked times", () => {
    expect(buildTimeRange(660, 840)).toEqual({
      startMinutes: 660,
      endMinutes: 840,
      label: "11:00-14:00",
    });
    expect(buildTimeRange(840, 660)).toEqual({
      startMinutes: 660,
      endMinutes: 840,
      label: "11:00-14:00",
    });
    expect(buildTimeRange(660, 660)).toBeNull();
  });

  it("finds conflicting reservations in the same room and date", () => {
    const conflict = findReservationConflict([baseReservation], {
      date: "2026-05-28",
      roomId: "room-1",
      startMinutes: 630,
      endMinutes: 690,
    });

    expect(conflict?.id).toBe("res-1");
  });

  it("ignores cancelled reservations and different rooms", () => {
    const cancelled: Reservation = { ...baseReservation, status: "cancelled" };
    const otherRoom: Reservation = { ...baseReservation, id: "res-2", roomId: "room-2" };

    expect(
      findReservationConflict([cancelled, otherRoom], {
        date: "2026-05-28",
        roomId: "room-1",
        startMinutes: 630,
        endMinutes: 690,
      }),
    ).toBeNull();
  });

  it("validates reservation drafts", () => {
    expect(
      validateReservationDraft({
        date: "2026-05-28",
        roomId: "room-1",
        startMinutes: 600,
        endMinutes: 660,
        name: "Lee",
        phone: "010-0000-0000",
      }),
    ).toEqual([]);

    expect(
      validateReservationDraft({
        date: "",
        roomId: "room-9",
        startMinutes: 605,
        endMinutes: 600,
        name: "",
        phone: "",
      }),
    ).toEqual([
      "날짜를 선택해 주세요.",
      "강의실을 선택해 주세요.",
      "시작 시간과 종료 시간은 30분 단위여야 합니다.",
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      "예약자 이름을 입력해 주세요.",
      "연락처를 입력해 주세요.",
    ]);
  });
});
