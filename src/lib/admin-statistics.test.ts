import { describe, expect, it } from "vitest";
import {
  adminReservationStatisticsSchema,
  buildStatisticsSearchParams,
  calculateSubscriptionScenario,
  formatStatisticsMinutes,
  getVisibleRanking,
  parseStatisticsQuery,
} from "./admin-statistics";

describe("admin statistics", () => {
  it("normalizes invalid query values", () => {
    expect(parseStatisticsQuery(new URLSearchParams("month=nope&unit=month&metric=x"), "2026-08"))
      .toEqual({ referenceMonth: "2026-08", unit: "day", metric: "usageMinutes" });
  });

  it("does not accept future or impossible reference months", () => {
    expect(parseStatisticsQuery(new URLSearchParams("month=2027-01"), "2026-08").referenceMonth)
      .toBe("2026-08");
    expect(parseStatisticsQuery(new URLSearchParams("month=2026-02-31"), "2026-08").referenceMonth)
      .toBe("2026-08");
  });

  it("writes stable query parameters", () => {
    expect(buildStatisticsSearchParams({ referenceMonth: "2026-07", unit: "year", metric: "userCount" }))
      .toBe("month=2026-07&unit=year&metric=userCount");
  });

  it("shows five members first and ten more each time", () => {
    const ranking = Array.from({ length: 26 }, (_, index) => ({
      name: `회원 ${index + 1}`, usageMinutes: 60, peakMinutes: 0, reservationCount: 1,
    }));
    expect(getVisibleRanking(ranking, 5)).toHaveLength(5);
    expect(getVisibleRanking(ranking, 15)).toHaveLength(15);
    expect(getVisibleRanking(ranking, 35)).toHaveLength(26);
    expect(getVisibleRanking(ranking, 0)).toHaveLength(0);
  });

  it("formats minute totals at hour boundaries", () => {
    expect(formatStatisticsMinutes(0)).toBe("0시간");
    expect(formatStatisticsMinutes(30)).toBe("30분");
    expect(formatStatisticsMinutes(90)).toBe("1시간 30분");
    expect(formatStatisticsMinutes(120)).toBe("2시간");
  });

  it("calculates a clearly labeled revenue scenario", () => {
    expect(calculateSubscriptionScenario({
      ranking: [
        { name: "A", usageMinutes: 600, peakMinutes: 180, reservationCount: 10 },
        { name: "B", usageMinutes: 420, peakMinutes: 60, reservationCount: 7 },
      ],
      includedMinutes: 480,
      peakIncludedMinutes: 120,
      monthlyPrice: 49000,
      conversionRate: 50,
    })).toEqual({
      eligibleUsers: 1,
      usersExceedingPeakAllowance: 1,
      scenarioSubscribers: 1,
      scenarioRevenue: 49000,
    });
  });

  it("uses inclusive allowance boundaries and a zero conversion rate", () => {
    expect(calculateSubscriptionScenario({
      ranking: [
        { name: "경계", usageMinutes: 480, peakMinutes: 120, reservationCount: 1 },
      ],
      includedMinutes: 480,
      peakIncludedMinutes: 120,
      monthlyPrice: 49000,
      conversionRate: 0,
    })).toEqual({
      eligibleUsers: 1,
      usersExceedingPeakAllowance: 0,
      scenarioSubscribers: 0,
      scenarioRevenue: 0,
    });
  });

  it("rejects RPC statistics outside the documented numeric ranges", () => {
    const base = {
      coverageStart: "2026-06-17",
      summary: {
        current: { usageMinutes: 0, reservationCount: 0, userCount: 0, cancelledCount: 0 },
        previous: { usageMinutes: 0, reservationCount: 0, userCount: 0, cancelledCount: 0 },
        comparisonAvailable: false,
      },
      trend: [],
      ranking: [],
      peakTimes: [],
    };
    expect(adminReservationStatisticsSchema.safeParse(base).success).toBe(true);
    expect(adminReservationStatisticsSchema.safeParse({
      ...base,
      summary: { ...base.summary, current: { ...base.summary.current, usageMinutes: -1 } },
    }).success).toBe(false);
    expect(adminReservationStatisticsSchema.safeParse({
      ...base,
      peakTimes: [{ weekday: 8, startMinutes: null, endMinutes: null, occupancyRate: 0, hasData: false }],
    }).success).toBe(false);
    expect(adminReservationStatisticsSchema.safeParse({
      ...base,
      peakTimes: [{ weekday: 1, startMinutes: null, endMinutes: null, occupancyRate: 101, hasData: false }],
    }).success).toBe(false);
  });
});
