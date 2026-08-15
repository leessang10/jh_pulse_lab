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

const statisticsTrendBucketBase = {
  key: z.string(),
  startDate: dateString,
  endDate: dateString,
};

export const statisticsTrendBucketSchema = z.discriminatedUnion("status", [
  z.object({
    ...statisticsTrendBucketBase,
    usageMinutes: z.null(),
    reservationCount: z.null(),
    userCount: z.null(),
    status: z.literal("noData"),
  }),
  z.object({
    ...statisticsTrendBucketBase,
    usageMinutes: nonNegativeInteger,
    reservationCount: nonNegativeInteger,
    userCount: nonNegativeInteger,
    status: z.literal("partial"),
  }),
  z.object({
    ...statisticsTrendBucketBase,
    usageMinutes: nonNegativeInteger,
    reservationCount: nonNegativeInteger,
    userCount: nonNegativeInteger,
    status: z.literal("complete"),
  }),
]);

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

export type StatisticsRequestKey = Pick<StatisticsQuery, "referenceMonth" | "unit">;

type KeyedStatisticsResponse<T> = {
  key: StatisticsRequestKey;
  statistics: T | null;
  error: string | null;
  isReady: boolean;
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

/** URL 변경을 연속으로 적용할 때 직전 변경까지 보존한다. */
export function mergeStatisticsQuery(current: StatisticsQuery, next: Partial<StatisticsQuery>): StatisticsQuery {
  return { ...current, ...next };
}

function isSameStatisticsRequestKey(left: StatisticsRequestKey, right: StatisticsRequestKey) {
  return left.referenceMonth === right.referenceMonth && left.unit === right.unit;
}

/** 현재 월·단위와 일치하지 않는 이전 응답을 화면에서 숨긴다. */
export function selectCurrentStatisticsResponse<T>(
  response: KeyedStatisticsResponse<T> | null,
  currentKey: StatisticsRequestKey,
) {
  if (!response || !isSameStatisticsRequestKey(response.key, currentKey)) {
    return { statistics: null, error: null, isReady: false };
  }

  return {
    statistics: response.statistics,
    error: response.error,
    isReady: response.isReady,
  };
}

/** 준비된 실제 이용 데이터가 있을 때만 시뮬레이터를 연다. */
export function canOpenStatisticsSimulator(input: {
  isReady: boolean;
  hasError: boolean;
  reservationCount: number;
  rankingCount: number;
}) {
  return input.isReady
    && !input.hasError
    && input.reservationCount > 0
    && input.rankingCount > 0;
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

export type StatisticsSummaryView = {
  totalUsage: StatisticsSummaryValue;
  reservationCount: StatisticsSummaryValue;
  userCount: StatisticsSummaryValue;
  averageUsage: StatisticsSummaryValue;
  cancellationRate: StatisticsSummaryValue;
  isEmpty: boolean;
};

type StatisticsSummaryValue = {
  value: string;
  comparison: string;
};

type StatisticsSummaryInput = {
  current: StatisticsSummaryMetric;
  previous: StatisticsSummaryMetric;
  comparisonAvailable: boolean;
};

const INSUFFICIENT_COMPARISON_MESSAGE = "이전 월 데이터가 충분하지 않습니다.";

function formatStatisticsHours(minutes: number) {
  const hours = Math.max(0, minutes) / 60;
  if (hours === 0) return "0시간";
  return `${Number(hours.toFixed(1)).toLocaleString("ko-KR")}시간`;
}

function formatStatisticsPercent(value: number) {
  const safeValue = Math.max(0, value);
  if (safeValue === 0) return "0%";
  return `${Number(safeValue.toFixed(1)).toLocaleString("ko-KR")}%`;
}

function formatComparison(current: number, previous: number, available: boolean) {
  if (!available) return INSUFFICIENT_COMPARISON_MESSAGE;
  if (previous === 0) return current === 0 ? "이전 월과 변동이 없습니다." : "이전 월은 0이어서 비교할 수 없습니다.";

  const change = ((current - previous) / previous) * 100;
  if (change === 0) return "이전 월과 변동이 없습니다.";
  return `이전 월 대비 ${Math.abs(Number(change.toFixed(1))).toLocaleString("ko-KR")}% ${change > 0 ? "증가했습니다." : "감소했습니다."}`;
}

/** KPI 카드가 바로 표시할 값과 이전 월 비교 문구를 만든다. */
export function buildStatisticsSummaryView(input: StatisticsSummaryInput): StatisticsSummaryView {
  const currentAverage = input.current.userCount === 0 ? 0 : input.current.usageMinutes / input.current.userCount;
  const previousAverage = input.previous.userCount === 0 ? 0 : input.previous.usageMinutes / input.previous.userCount;
  const currentCancellationRate = input.current.reservationCount === 0
    ? 0
    : (input.current.cancelledCount / input.current.reservationCount) * 100;
  const previousCancellationRate = input.previous.reservationCount === 0
    ? 0
    : (input.previous.cancelledCount / input.previous.reservationCount) * 100;

  return {
    totalUsage: {
      value: formatStatisticsHours(input.current.usageMinutes),
      comparison: formatComparison(input.current.usageMinutes, input.previous.usageMinutes, input.comparisonAvailable),
    },
    reservationCount: {
      value: `${input.current.reservationCount.toLocaleString("ko-KR")}건`,
      comparison: formatComparison(input.current.reservationCount, input.previous.reservationCount, input.comparisonAvailable),
    },
    userCount: {
      value: `${input.current.userCount.toLocaleString("ko-KR")}명`,
      comparison: formatComparison(input.current.userCount, input.previous.userCount, input.comparisonAvailable),
    },
    averageUsage: {
      value: formatStatisticsHours(currentAverage),
      comparison: formatComparison(currentAverage, previousAverage, input.comparisonAvailable),
    },
    cancellationRate: {
      value: formatStatisticsPercent(currentCancellationRate),
      comparison: formatComparison(currentCancellationRate, previousCancellationRate, input.comparisonAvailable),
    },
    isEmpty: input.current.reservationCount === 0,
  };
}

export function getVisibleRanking(ranking: StatisticsRankingEntry[], limit = 5) {
  return ranking.slice(0, Math.max(0, limit));
}

function formatTrendDate(date: string) {
  const [, month, day] = date.split("-");
  return `${Number(month)}/${Number(day)}`;
}

function subtractTrendDay(date: string) {
  const [year, month, day] = date.split("-").map(Number);
  const value = new Date(Date.UTC(year, month - 1, day));
  value.setUTCDate(value.getUTCDate() - 1);
  return value.toISOString().slice(0, 10);
}

/** 선택한 추세 단위에 맞는 X축과 툴팁 기간 라벨을 만든다. */
export function formatTrendLabel(point: StatisticsTrendBucket, unit: StatisticsUnit) {
  if (unit === "year") return `${Number(point.startDate.slice(5, 7))}월`;
  if (unit === "week") return `${formatTrendDate(point.startDate)}~${formatTrendDate(subtractTrendDay(point.endDate))}`;
  return formatTrendDate(point.startDate);
}

/** 추세 버킷의 수집·집계 상태를 표시한다. */
export function getTrendBucketStatus(status: StatisticsTrendBucket["status"]) {
  if (status === "noData") return "데이터 없음";
  return status === "partial" ? "부분 집계" : "집계 완료";
}

/** 회원 순위는 첫 5명 뒤에 한 번에 10명씩 더 표시한다. */
export function getNextRankingLimit(currentLimit: number, totalEntries: number) {
  return Math.min(Math.max(0, totalEntries), Math.max(0, currentLimit) + 10);
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
  const eligibleUsageMinutes = eligible.reduce((total, entry) => total + entry.usageMinutes, 0);
  const eligiblePeakMinutes = eligible.reduce((total, entry) => total + entry.peakMinutes, 0);
  const usersExceedingPeakAllowance = eligible.filter(
    (entry) => entry.peakMinutes > input.peakIncludedMinutes,
  ).length;
  const scenarioSubscribers = (eligibleUsers * input.conversionRate) / 100;

  return {
    eligibleUsers,
    usersExceedingPeakAllowance,
    scenarioSubscribers,
    scenarioRevenue: Math.round(scenarioSubscribers * input.monthlyPrice),
    eligiblePeakUsageRate: eligibleUsageMinutes === 0 ? 0 : Number(((eligiblePeakMinutes / eligibleUsageMinutes) * 100).toFixed(1)),
  };
}

/** 기대 가입자 수를 정수 또는 최대 소수 둘째 자리로 표시한다. */
export function formatScenarioSubscribers(value: number) {
  return `${Number(value.toFixed(2)).toLocaleString("ko-KR", { maximumFractionDigits: 2 })}명`;
}

function formatClockTime(minutes: number) {
  const safeMinutes = Math.max(0, Math.round(minutes));
  return `${String(Math.floor(safeMinutes / 60)).padStart(2, "0")}:${String(safeMinutes % 60).padStart(2, "0")}`;
}

/** 피크 시간대와 평균 점유율을 차트와 툴팁에서 공통으로 표시한다. */
export function formatPeakWindow(input: Pick<StatisticsPeakTime, "startMinutes" | "endMinutes" | "occupancyRate">) {
  return `${formatClockTime(input.startMinutes ?? 0)}~${formatClockTime(input.endMinutes ?? 0)} · ${Number(input.occupancyRate.toFixed(1)).toLocaleString("ko-KR")}%`;
}

/** 정기권 모달의 시간 단위 입력을 기존 분 단위 시나리오 계산으로 변환한다. */
export function calculateSubscriptionScenarioFromHours(input: {
  ranking: StatisticsRankingEntry[];
  includedHours: number;
  peakIncludedHours: number;
  monthlyPrice: number;
  conversionRate: number;
}) {
  return calculateSubscriptionScenario({
    ranking: input.ranking,
    includedMinutes: Math.round(input.includedHours * 60),
    peakIncludedMinutes: Math.round(input.peakIncludedHours * 60),
    monthlyPrice: input.monthlyPrice,
    conversionRate: input.conversionRate,
  });
}
