import { describe, expect, it } from "vitest";
import {
  buildTimeRange,
  findReservationConflict,
  formatMinutes,
  getBookingHalfDayTimePoints,
  getBookingDurationOptions,
  getBookableRangeOptions,
  getBookingStartOptions,
  getAvailableTimeSlots,
  getRoomName,
  getRoomTimeSlots,
  getSimpleBookingTimePoints,
  generateTimeSlots,
  isBookingDurationAvailable,
  BOOKING_HALF_DAY_PERIODS,
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

  it("groups 30-minute start points into half-day periods", () => {
    expect(BOOKING_HALF_DAY_PERIODS.map((period) => period.label)).toEqual(["00:00-12:00", "12:00-24:00"]);

    const firstHalf = getBookingHalfDayTimePoints("first-half");
    const secondHalf = getBookingHalfDayTimePoints("second-half");

    expect(firstHalf[0]).toBe(0);
    expect(firstHalf.at(-1)).toBe(690);
    expect(secondHalf[0]).toBe(720);
    expect(secondHalf.at(-1)).toBe(1410);
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

  it("builds start options from the selected duration", () => {
    const options = getBookingStartOptions([baseReservation], {
      date: "2026-05-28",
      roomId: "room-1",
      periodId: "first-half",
      durationMinutes: 60,
    });

    expect(options[0]).toEqual({
      startMinutes: 0,
      endMinutes: 60,
      label: "00:00",
      rangeLabel: "00:00-01:00",
      selectedSlotMinutes: [0, 30],
      isReservedSlot: false,
      hasReservedSlotInRange: false,
      hasUnavailableSlotInRange: false,
      isAvailable: true,
    });
    expect(options.find((option) => option.startMinutes === 570)).toMatchObject({
      label: "09:30",
      rangeLabel: "09:30-10:30",
      selectedSlotMinutes: [570, 600],
      hasReservedSlotInRange: true,
      isAvailable: false,
    });
    expect(options.at(-1)).toEqual({
      startMinutes: 690,
      endMinutes: 750,
      label: "11:30",
      rangeLabel: "11:30-12:30",
      selectedSlotMinutes: [690, 720],
      isReservedSlot: false,
      hasReservedSlotInRange: false,
      hasUnavailableSlotInRange: false,
      isAvailable: true,
    });
  });

  it("marks individual reserved slots separately from invalid starts", () => {
    const options = getBookingStartOptions([baseReservation], {
      date: "2026-05-28",
      roomId: "room-1",
      durationMinutes: 180,
    });

    expect(options.find((option) => option.startMinutes === 600)).toMatchObject({
      label: "10:00",
      isReservedSlot: true,
      hasReservedSlotInRange: true,
      isAvailable: false,
    });
    expect(options.find((option) => option.startMinutes === 1260)).toMatchObject({
      label: "21:00",
      isReservedSlot: false,
      hasReservedSlotInRange: false,
      hasUnavailableSlotInRange: true,
      isAvailable: false,
    });
    expect(options.find((option) => option.startMinutes === 1410)).toMatchObject({
      label: "23:30",
      isReservedSlot: false,
      hasReservedSlotInRange: false,
      isAvailable: false,
    });
  });

  it("blocks a range when any included slot is unavailable for the selected duration", () => {
    const options = getBookingStartOptions([], {
      date: "2026-05-28",
      roomId: "room-1",
      durationMinutes: 60,
    });

    expect(options.find((option) => option.startMinutes === 1380)).toMatchObject({
      label: "23:00",
      selectedSlotMinutes: [1380, 1410],
      hasUnavailableSlotInRange: true,
      isAvailable: false,
    });
    expect(options.find((option) => option.startMinutes === 1350)).toMatchObject({
      label: "22:30",
      selectedSlotMinutes: [1350, 1380],
      hasUnavailableSlotInRange: false,
      isAvailable: true,
    });
  });

  it("lists only directly bookable ranges for a selected duration", () => {
    const options = getBookableRangeOptions([], {
      date: "2026-05-28",
      roomId: "room-1",
      durationMinutes: 60,
    });

    expect(options.find((option) => option.startMinutes === 1350)).toMatchObject({
      label: "22:30-23:30",
      startMinutes: 1350,
      endMinutes: 1410,
    });
    expect(options.some((option) => option.startMinutes === 1380)).toBe(false);
    expect(options.some((option) => option.startMinutes === 1410)).toBe(false);
  });

  it("builds all-day start options when no period is selected", () => {
    const options = getBookingStartOptions([], {
      date: "2026-05-28",
      roomId: "room-1",
      durationMinutes: 180,
    });

    expect(options).toHaveLength(48);
    expect(options[0]).toMatchObject({
      startMinutes: 0,
      label: "00:00",
      rangeLabel: "00:00-03:00",
      isAvailable: true,
    });
    expect(options.at(-1)).toMatchObject({
      startMinutes: 1410,
      label: "23:30",
      rangeLabel: "23:30-26:30",
      hasReservedSlotInRange: false,
      isAvailable: false,
    });
  });

  it("keeps late start slots visible but unavailable when they pass midnight", () => {
    const options = getBookingStartOptions([], {
      date: "2026-05-28",
      roomId: "room-1",
      periodId: "second-half",
      durationMinutes: 180,
    });

    expect(options.at(-1)).toMatchObject({
      startMinutes: 1410,
      endMinutes: 1590,
      label: "23:30",
      rangeLabel: "23:30-26:30",
      isAvailable: false,
    });
    expect(options.find((option) => option.startMinutes === 1260)).toMatchObject({
      label: "21:00",
      rangeLabel: "21:00-24:00",
      selectedSlotMinutes: [1260, 1290, 1320, 1350, 1380, 1410],
      hasReservedSlotInRange: false,
      hasUnavailableSlotInRange: true,
      isAvailable: false,
    });
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

  it("uses Korean classroom labels for public room names", () => {
    expect(getRoomName("room-1")).toBe("강의실 1");
    expect(getRoomName("room-4")).toBe("강의실 4");
  });
});
