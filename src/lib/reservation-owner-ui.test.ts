import { describe, expect, it } from "vitest";
import type { Reservation } from "./reservations";
import {
  canMutatePublicReservation,
  formatReservationCancellationMessage,
  replaceReservationInList,
} from "./reservation-owner-ui";

const reservation: Reservation = {
  id: "res-1",
  date: "2026-06-05",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 660,
  name: "Lee",
  status: "pending",
  createdAt: "2026-06-05T00:00:00.000Z",
};

describe("reservation owner UI helpers", () => {
  it("disables public owner actions after a reservation is cancelled", () => {
    expect(canMutatePublicReservation("pending")).toBe(true);
    expect(canMutatePublicReservation("confirmed")).toBe(true);
    expect(canMutatePublicReservation("cancelled")).toBe(false);
  });

  it("replaces a changed reservation in the current lookup result list", () => {
    const updated = { ...reservation, startMinutes: 660, endMinutes: 720 };

    expect(replaceReservationInList([reservation], updated)).toEqual([updated]);
  });

  it("formats a clear cancellation confirmation message with the reservation date and start time", () => {
    expect(
      formatReservationCancellationMessage({
        ...reservation,
        date: "2026-06-17",
        startMinutes: 840,
      }),
    ).toBe("2026.06.17 오후 2:00 예약이 취소되었습니다.");
  });
});
