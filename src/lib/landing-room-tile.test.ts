import { describe, expect, it } from "vitest";
import { getLandingRoomTileClassName, getLandingRoomTileSlotClassName } from "./landing-room-tile";

describe("landing room tile", () => {
  it("uses the same inset ring thickness for selected and hover states", () => {
    expect(getLandingRoomTileClassName(true)).toContain("ring-2 ring-primary/50 ring-inset");
    expect(getLandingRoomTileClassName(false)).toContain("hover:ring-2 hover:ring-primary/40 hover:ring-inset");
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
