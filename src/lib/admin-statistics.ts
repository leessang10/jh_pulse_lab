import { z } from "zod";

export const statisticsUnits = ["day", "week", "year"] as const;
export const statisticsMetrics = ["usageMinutes", "reservationCount", "userCount"] as const;

export type StatisticsUnit = (typeof statisticsUnits)[number];
export type StatisticsMetric = (typeof statisticsMetrics)[number];

const nonNegativeInteger = z.number().int().nonnegative();
const dateString = z.string().date();

export const statisticsSummaryMetricSchema = z.object({
  usageMinutes: nonNegativeInteger,
  reservationCount: nonNegativeInteger,
  userCount: nonNegativeInteger,
  cancelledCount: nonNegativeInteger,
});

export const statisticsTrendBucketSchema = z.object({
  key: z.string(),
  startDate: dateString,
  endDate: dateString,
  usageMinutes: nonNegativeInteger,
  reservationCount: nonNegativeInteger,
  userCount: nonNegativeInteger,
  isComplete: z.boolean(),
});

export const statisticsRankingEntrySchema = z.object({
  name: z.string(),
  usageMinutes: nonNegativeInteger,
  peakMinutes: nonNegativeInteger,
  reservationCount: nonNegativeInteger,
});

export const statisticsPeakTimeSchema = z.object({
  weekday: z.number().int().min(1).max(7),
  startMinutes: nonNegativeInteger.nullable(),
  endMinutes: nonNegativeInteger.nullable(),
  occupancyRate: z.number().min(0).max(100),
  hasData: z.boolean(),
});

export const adminReservationStatisticsSchema = z.object({
  coverageStart: dateString.nullable(),
  summary: z.object({
    current: statisticsSummaryMetricSchema,
    previous: statisticsSummaryMetricSchema,
    comparisonAvailable: z.boolean(),
  }),
  trend: z.array(statisticsTrendBucketSchema),
  ranking: z.array(statisticsRankingEntrySchema),
  peakTimes: z.array(statisticsPeakTimeSchema),
});

/** RPC가 반환하는 관리자 예약 통계 전체 계약이다. */
export type AdminReservationStatistics = z.infer<typeof adminReservationStatisticsSchema>;
export type StatisticsSummaryMetric = z.infer<typeof statisticsSummaryMetricSchema>;
export type StatisticsTrendBucket = z.infer<typeof statisticsTrendBucketSchema>;
export type StatisticsRankingEntry = z.infer<typeof statisticsRankingEntrySchema>;
export type StatisticsPeakTime = z.infer<typeof statisticsPeakTimeSchema>;

// 서버 액션에서 의미가 드러나는 이름으로도 사용할 수 있게 내보낸다.
export const statisticsResponseSchema = adminReservationStatisticsSchema;
export const adminStatisticsSchema = adminReservationStatisticsSchema;

export type StatisticsQuery = {
  referenceMonth: string;
  unit: StatisticsUnit;
  metric: StatisticsMetric;
};

function isReferenceMonth(value: string | null | undefined, currentMonth: string): value is string {
  if (!value || !/^\d{4}-(0[1-9]|1[0-2])$/.test(value)) return false;
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(currentMonth)) return false;
  return value <= currentMonth;
}

function includesValue<T extends string>(values: readonly T[], value: string | null): value is T {
  return value !== null && values.includes(value as T);
}

export function parseStatisticsQuery(params: URLSearchParams, currentMonth: string): StatisticsQuery {
  const month = params.get("month");
  const unit = params.get("unit");
  const metric = params.get("metric");

  return {
    referenceMonth: isReferenceMonth(month, currentMonth) ? month : currentMonth,
    unit: includesValue(statisticsUnits, unit) ? unit : "day",
    metric: includesValue(statisticsMetrics, metric) ? metric : "usageMinutes",
  };
}

export function buildStatisticsSearchParams(query: Pick<StatisticsQuery, "referenceMonth" | "unit" | "metric">) {
  const params = new URLSearchParams();
  params.set("month", query.referenceMonth);
  params.set("unit", query.unit);
  params.set("metric", query.metric);
  return params.toString();
}

export function formatStatisticsMinutes(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  if (safeMinutes === 0) return "0시간";

  const hours = Math.floor(safeMinutes / 60);
  const remainingMinutes = safeMinutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}시간`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}분`);

  return parts.join(" ");
}

export function getVisibleRanking(ranking: StatisticsRankingEntry[], limit = 5) {
  return ranking.slice(0, Math.max(0, limit));
}

export function calculateSubscriptionScenario(input: {
  ranking: StatisticsRankingEntry[];
  includedMinutes: number;
  peakIncludedMinutes: number;
  monthlyPrice: number;
  conversionRate: number;
}) {
  const eligible = input.ranking.filter((entry) => entry.usageMinutes >= input.includedMinutes);
  const eligibleUsers = eligible.length;
  const usersExceedingPeakAllowance = eligible.filter(
    (entry) => entry.peakMinutes > input.peakIncludedMinutes,
  ).length;
  const scenarioSubscribers = Math.round((eligibleUsers * input.conversionRate) / 100);

  return {
    eligibleUsers,
    usersExceedingPeakAllowance,
    scenarioSubscribers,
    scenarioRevenue: scenarioSubscribers * input.monthlyPrice,
  };
}
