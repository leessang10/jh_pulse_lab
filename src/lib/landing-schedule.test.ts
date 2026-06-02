import { describe, expect, it } from "vitest";
import type { Reservation } from "./reservations";
import { getLandingScheduleSlots } from "./landing-schedule";

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
});
