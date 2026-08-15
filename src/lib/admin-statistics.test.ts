import { describe, expect, it } from "vitest";
import {
  adminReservationStatisticsSchema,
  buildStatisticsSummaryView,
  buildStatisticsSearchParams,
  canOpenStatisticsSimulator,
  calculateSubscriptionScenarioFromHours,
  calculateSubscriptionScenario,
  formatPeakWindow,
  formatScenarioSubscribers,
  formatTrendLabel,
  formatStatisticsMinutes,
  getNextRankingLimit,
  getTrendBucketStatus,
  getVisibleRanking,
  mergeStatisticsQuery,
  parseStatisticsQuery,
  selectCurrentStatisticsResponse,
} from "./admin-statistics";

describe("admin statistics", () => {
  it("builds one-decimal summary values and hides comparisons without enough previous data", () => {
    expect(buildStatisticsSummaryView({
      current: { usageMinutes: 19_170, reservationCount: 1_000, userCount: 26, cancelledCount: 126 },
      previous: { usageMinutes: 0, reservationCount: 0, userCount: 0, cancelledCount: 0 },
      comparisonAvailable: false,
    })).toEqual({
      totalUsage: { value: "319.5시간", comparison: "이전 월 데이터가 충분하지 않습니다." },
      reservationCount: { value: "1,000건", comparison: "이전 월 데이터가 충분하지 않습니다." },
      userCount: { value: "26명", comparison: "이전 월 데이터가 충분하지 않습니다." },
      averageUsage: { value: "12.3시간", comparison: "이전 월 데이터가 충분하지 않습니다." },
      cancellationRate: { value: "12.6%", comparison: "이전 월 데이터가 충분하지 않습니다." },
      isEmpty: false,
    });
  });

  it("shows zero average and cancellation rate when there are no reservations", () => {
    expect(buildStatisticsSummaryView({
      current: { usageMinutes: 0, reservationCount: 0, userCount: 0, cancelledCount: 0 },
      previous: { usageMinutes: 120, reservationCount: 2, userCount: 1, cancelledCount: 1 },
      comparisonAvailable: true,
    })).toMatchObject({
      averageUsage: { value: "0시간" },
      cancellationRate: { value: "0%" },
      isEmpty: true,
    });
  });

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

  it("keeps consecutive query changes instead of dropping the first change", () => {
    const initial = { referenceMonth: "2026-07", unit: "day" as const, metric: "usageMinutes" as const };
    const afterMonth = mergeStatisticsQuery(initial, { referenceMonth: "2026-06" });

    expect(mergeStatisticsQuery(afterMonth, { unit: "week" })).toEqual({
      referenceMonth: "2026-06",
      unit: "week",
      metric: "usageMinutes",
    });
  });

  it("exposes a response only when its month and unit match the current request", () => {
    const response = {
      key: { referenceMonth: "2026-07", unit: "day" as const },
      statistics: { marker: "7월" },
      error: "이전 오류입니다.",
      isReady: true,
    };

    expect(selectCurrentStatisticsResponse(response, response.key)).toMatchObject({
      statistics: { marker: "7월" },
      error: "이전 오류입니다.",
      isReady: true,
    });
    expect(selectCurrentStatisticsResponse(response, { referenceMonth: "2026-08", unit: "day" }))
      .toEqual({ statistics: null, error: null, isReady: false });
    expect(selectCurrentStatisticsResponse(response, { referenceMonth: "2026-07", unit: "week" }))
      .toEqual({ statistics: null, error: null, isReady: false });
  });

  it.each([
    { name: "로딩", isReady: false, hasError: false, reservationCount: 3, rankingCount: 1, expected: false },
    { name: "오류", isReady: true, hasError: true, reservationCount: 3, rankingCount: 1, expected: false },
    { name: "빈 성공", isReady: true, hasError: false, reservationCount: 0, rankingCount: 0, expected: false },
    { name: "빈 순위", isReady: true, hasError: false, reservationCount: 3, rankingCount: 0, expected: false },
    { name: "정상 성공", isReady: true, hasError: false, reservationCount: 3, rankingCount: 1, expected: true },
  ])("allows the simulator only for $name statistics", ({ expected, name: _name, ...input }) => {
    expect(canOpenStatisticsSimulator(input)).toBe(expected);
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

  it("formats trend labels for daily, weekly, and monthly buckets", () => {
    const point = {
      key: "2026-07-01",
      startDate: "2026-07-01",
      endDate: "2026-07-06",
      usageMinutes: 0,
      reservationCount: 0,
      userCount: 0,
      status: "complete" as const,
    };

    expect(formatTrendLabel(point, "day")).toBe("7/1");
    expect(formatTrendLabel(point, "week")).toBe("7/1~7/5");
    expect(formatTrendLabel(point, "year")).toBe("7월");
  });

  it("adds ten ranking rows without exceeding the available entries", () => {
    expect(getNextRankingLimit(5, 26)).toBe(15);
    expect(getNextRankingLimit(25, 26)).toBe(26);
  });

  it("labels every trend bucket status explicitly", () => {
    expect(getTrendBucketStatus("noData")).toBe("데이터 없음");
    expect(getTrendBucketStatus("partial")).toBe("부분 집계");
    expect(getTrendBucketStatus("complete")).toBe("집계 완료");
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
      scenarioSubscribers: 0.5,
      scenarioRevenue: 24500,
      eligiblePeakUsageRate: 30,
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
      eligiblePeakUsageRate: 25,
    });
  });

  it("formats expected subscribers with at most two decimal places", () => {
    expect(formatScenarioSubscribers(0.5)).toBe("0.5명");
    expect(formatScenarioSubscribers(1.234)).toBe("1.23명");
    expect(formatScenarioSubscribers(2)).toBe("2명");
  });

  it("keeps expected subscribers fractional and rounds only revenue to won", () => {
    expect(calculateSubscriptionScenario({
      ranking: [{ name: "한 명", usageMinutes: 480, peakMinutes: 0, reservationCount: 1 }],
      includedMinutes: 480,
      peakIncludedMinutes: 120,
      monthlyPrice: 49_000,
      conversionRate: 50,
    })).toMatchObject({
      eligibleUsers: 1,
      scenarioSubscribers: 0.5,
      scenarioRevenue: 24_500,
    });
  });

  it("counts members over the selected peak allowance", () => {
    const input = {
      ranking: [{ name: "회원", usageMinutes: 480, peakMinutes: 60, reservationCount: 1 }],
      includedMinutes: 480,
      monthlyPrice: 49_000,
      conversionRate: 50,
    };

    expect(calculateSubscriptionScenario({ ...input, peakIncludedMinutes: 59 }).usersExceedingPeakAllowance).toBe(1);
    expect(calculateSubscriptionScenario({ ...input, peakIncludedMinutes: 60 }).usersExceedingPeakAllowance).toBe(0);
  });

  it("formats a peak window with its occupancy rate", () => {
    expect(formatPeakWindow({ startMinutes: 1140, endMinutes: 1260, occupancyRate: 50 }))
      .toBe("19:00~21:00 · 50%");
  });

  it("converts simulator hour inputs to minutes before calculating the scenario", () => {
    expect(calculateSubscriptionScenarioFromHours({
      ranking: [
        { name: "대상", usageMinutes: 480, peakMinutes: 120, reservationCount: 4 },
        { name: "미대상", usageMinutes: 479, peakMinutes: 0, reservationCount: 3 },
      ],
      includedHours: 8,
      peakIncludedHours: 2,
      monthlyPrice: 49_000,
      conversionRate: 50,
    })).toMatchObject({
      eligibleUsers: 1,
      scenarioSubscribers: 0.5,
      scenarioRevenue: 24_500,
      eligiblePeakUsageRate: 25,
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

  it("enforces nullable numbers only for no-data trend buckets", () => {
    const base = {
      key: "2026-07-01",
      startDate: "2026-07-01",
      endDate: "2026-07-02",
    };

    expect(adminReservationStatisticsSchema.shape.trend.element.safeParse({
      ...base,
      usageMinutes: null,
      reservationCount: null,
      userCount: null,
      status: "noData",
    }).success).toBe(true);
    expect(adminReservationStatisticsSchema.shape.trend.element.safeParse({
      ...base,
      usageMinutes: null,
      reservationCount: null,
      userCount: null,
      status: "complete",
    }).success).toBe(false);
  });
});
