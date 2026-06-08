import { describe, expect, it } from "vitest";
import { getLandingRoomTileClassName, getLandingRoomTileSlotClassName } from "./landing-room-tile";

describe("landing room tile", () => {
  it("uses the same inset ring thickness for selected and hover states", () => {
    expect(getLandingRoomTileClassName(true)).toContain("ring-2 ring-primary/60 ring-inset");
    expect(getLandingRoomTileClassName(false)).toContain("hover:ring-2 hover:ring-primary/60 hover:ring-inset");
  });

  it("uses a darker accent for booked mini donut slots while keeping empty slots soft", () => {
    expect(getLandingRoomTileSlotClassName({ hasBookings: true, isBooked: true })).toBe(
      "fill-none stroke-pulse-accent",
    );
    expect(getLandingRoomTileSlotClassName({ hasBookings: false, isBooked: false })).toBe(
      "fill-none stroke-pulse-accent-soft",
    );
  });
});
