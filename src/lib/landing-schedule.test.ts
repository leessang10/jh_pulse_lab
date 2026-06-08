import { describe, expect, it } from "vitest";
import type { Reservation } from "./reservations";
import {
  LANDING_RESERVATION_SEGMENT_COLORS,
  getLandingRoomScheduleSummaries,
  getLandingScheduleSlots,
} from "./landing-schedule";

const reservation: Reservation = {
  id: "res-1",
  date: "2026-06-02",
  roomId: "room-2",
  startMinutes: 570,
  endMinutes: 630,
  name: "민수",
  phone: "",
  status: "confirmed",
  createdAt: "2026-06-02T00:00:00.000Z",
};

describe("landing schedule", () => {
  it("uses a vivid reservation segment palette that matches the primary green accent", () => {
    expect(LANDING_RESERVATION_SEGMENT_COLORS).toEqual([
      "#ef6f7f",
      "#f08a45",
      "#e6b13f",
      "#0f9f8f",
      "#42a5db",
      "#9b7cf2",
    ]);
  });

  it("builds 48 half-hour slots across a full day", () => {
    const slots = getLandingScheduleSlots([], "2026-06-02");

    expect(slots).toHaveLength(48);
    expect(slots[0]).toMatchObject({
      startMinutes: 0,
      endMinutes: 30,
      label: "00:00",
      isBooked: false,
      bookedByLabel: "비어 있어요",
    });
    expect(slots[47]).toMatchObject({
      startMinutes: 1410,
      endMinutes: 1440,
      label: "23:30",
    });
  });

  it("shows who booked each covered 30-minute slot", () => {
    const slots = getLandingScheduleSlots([reservation], "2026-06-02");

    expect(slots.find((slot) => slot.startMinutes === 540)).toMatchObject({
      isBooked: false,
      bookedByLabel: "비어 있어요",
    });
    expect(slots.find((slot) => slot.startMinutes === 570)).toMatchObject({
      isBooked: true,
      bookedByLabel: "민수님 · 강의실 2",
    });
    expect(slots.find((slot) => slot.startMinutes === 600)).toMatchObject({
      isBooked: true,
      bookedByLabel: "민수님 · 강의실 2",
    });
  });

  it("ignores cancelled and other-date reservations", () => {
    const slots = getLandingScheduleSlots(
      [
        { ...reservation, id: "cancelled", status: "cancelled" },
        { ...reservation, id: "other-date", date: "2026-06-03" },
      ],
      "2026-06-02",
    );

    expect(slots.some((slot) => slot.isBooked)).toBe(false);
  });

  it("summarizes multiple simultaneous reservations", () => {
    const slots = getLandingScheduleSlots(
      [
        reservation,
        { ...reservation, id: "res-2", roomId: "room-3", name: "지현" },
        { ...reservation, id: "res-3", roomId: "room-4", name: "" },
      ],
      "2026-06-02",
    );

    expect(slots.find((slot) => slot.startMinutes === 570)).toMatchObject({
      reservationCount: 3,
      bookedByLabel: "민수님 외 2명",
    });
  });

  it("filters detailed slots to one selected active room", () => {
    const slots = getLandingScheduleSlots(
      [
        { ...reservation, id: "room-1-res", roomId: "room-1", name: "서연" },
        reservation,
      ],
      "2026-06-02",
      { roomId: "room-2" },
    );

    expect(slots.find((slot) => slot.startMinutes === 570)).toMatchObject({
      reservationCount: 1,
      bookedByLabel: "민수님 · 강의실 2",
    });
  });

  it("builds active room summaries and excludes hidden room reservations", () => {
    const summaries = getLandingRoomScheduleSummaries(
      [
        reservation,
        { ...reservation, id: "room-4-res", roomId: "room-4", name: "숨김" },
      ],
      "2026-06-02",
    );

    expect(summaries.map((summary) => summary.roomId)).toEqual(["room-1", "room-2", "room-3"]);
    expect(summaries.find((summary) => summary.roomId === "room-2")).toMatchObject({
      roomName: "강의실 2",
      bookedSlotCount: 2,
      bookedMinutes: 60,
      bookedHourLabel: "1",
      bookedDurationLabel: "1시간",
      reservationSegments: [
        {
          reservationId: "res-1",
          startMinutes: 570,
          endMinutes: 630,
          nameLabel: "민수",
          rangeLabel: "09:30-10:30",
        },
      ],
      totalSlotCount: 48,
      bookedPercent: 4,
      nextBookedSlot: {
        startMinutes: 570,
        rangeLabel: "09:30-10:00",
      },
    });
    expect(summaries.find((summary) => summary.roomId === "room-1")).toMatchObject({
      bookedSlotCount: 0,
      nextBookedSlot: null,
    });
  });

  it("summarizes booked time as hours instead of half-hour slot count", () => {
    const twoHourReservation: Reservation = {
      ...reservation,
      roomId: "room-1",
      startMinutes: 60,
      endMinutes: 180,
    };
    const summaries = getLandingRoomScheduleSummaries([twoHourReservation], "2026-06-02");

    expect(summaries.find((summary) => summary.roomId === "room-1")).toMatchObject({
      bookedSlotCount: 4,
      bookedMinutes: 120,
      bookedHourLabel: "2",
      bookedDurationLabel: "2시간",
    });
  });

  it("cycles reservation segment colors in red orange yellow green blue purple order", () => {
    const summaries = getLandingRoomScheduleSummaries(
      [
        { ...reservation, id: "res-a", roomId: "room-1", startMinutes: 0, endMinutes: 30, name: "가" },
        { ...reservation, id: "res-b", roomId: "room-1", startMinutes: 30, endMinutes: 60, name: "나" },
        { ...reservation, id: "res-c", roomId: "room-1", startMinutes: 60, endMinutes: 90, name: "다" },
        { ...reservation, id: "res-d", roomId: "room-1", startMinutes: 90, endMinutes: 120, name: "라" },
        { ...reservation, id: "res-e", roomId: "room-1", startMinutes: 120, endMinutes: 150, name: "마" },
        { ...reservation, id: "res-f", roomId: "room-1", startMinutes: 150, endMinutes: 180, name: "바" },
        { ...reservation, id: "res-g", roomId: "room-1", startMinutes: 180, endMinutes: 210, name: "사" },
      ],
      "2026-06-02",
    );
    const segments = summaries.find((summary) => summary.roomId === "room-1")?.reservationSegments ?? [];

    expect(segments).toHaveLength(7);
    expect(segments[0]).toMatchObject({
      nameLabel: "가",
      rangeLabel: "00:00-00:30",
    });
    expect(segments.map((segment) => segment.color)).toEqual([
      "#ef6f7f",
      "#f08a45",
      "#e6b13f",
      "#0f9f8f",
      "#42a5db",
      "#9b7cf2",
      "#ef6f7f",
    ]);
  });
});
