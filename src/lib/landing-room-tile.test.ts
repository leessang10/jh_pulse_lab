import { describe, expect, it } from "vitest";
import { getLandingRoomTileClassName, getLandingRoomTileSlotClassName } from "./landing-room-tile";

describe("landing room tile", () => {
  it("uses the brighter reservation accent for selected and hover states", () => {
    expect(getLandingRoomTileClassName(true)).toContain(
      "border-reservation-accent bg-reservation-accent-soft/55 ring-2 ring-reservation-accent/35 ring-inset",
    );
    expect(getLandingRoomTileClassName(false)).toContain(
      "hover:border-reservation-accent/60 hover:bg-reservation-accent-soft/45 hover:ring-2 hover:ring-reservation-accent/25 hover:ring-inset",
    );
  });

  it("uses a darker accent for booked mini donut slots while keeping empty slots soft", () => {
    expect(getLandingRoomTileSlotClassName({ hasBookings: true, isBooked: true })).toBe(
      "fill-none stroke-reservation-accent",
    );
    expect(getLandingRoomTileSlotClassName({ hasBookings: false, isBooked: false })).toBe(
      "fill-none stroke-reservation-accent-soft",
    );
  });
});
