import { describe, expect, it } from "vitest";
import { getCurrentKoreaBookingTime, isBeforeKoreaToday } from "./korea-date";

describe("Korean date helpers", () => {
  it("detects dates before the current day in Korea", () => {
    const now = new Date("2026-05-28T15:30:00.000Z");

    expect(isBeforeKoreaToday("2026-05-28", now)).toBe(true);
    expect(isBeforeKoreaToday("2026-05-29", now)).toBe(false);
    expect(isBeforeKoreaToday("2026-05-30", now)).toBe(false);
  });

  it("returns the current Korean booking date and minutes", () => {
    const now = new Date("2026-05-28T15:30:00.000Z");

    expect(getCurrentKoreaBookingTime(now)).toEqual({
      date: "2026-05-29",
      minutes: 30,
    });
  });
});
