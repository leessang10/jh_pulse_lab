import { describe, expect, it } from "vitest";
import { getLandingDetailScheduleAriaLabel, LANDING_DETAIL_CENTER_LINES } from "./landing-detail-status";

describe("landing detail status", () => {
  it("shows today reservation status without an unavailable-hour total", () => {
    expect(LANDING_DETAIL_CENTER_LINES).toEqual(["오늘", "예약 현황"]);
  });

  it("describes the circular schedule as today's reservation status", () => {
    expect(getLandingDetailScheduleAriaLabel("Pulse Lab 01")).toBe(
      "Pulse Lab 01 오늘 예약 현황을 시계처럼 보여주는 표",
    );
  });
});
