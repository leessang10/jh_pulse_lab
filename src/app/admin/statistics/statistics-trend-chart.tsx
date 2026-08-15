"use client";

import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardAction, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip } from "@/components/ui/chart";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  formatTrendLabel,
  getTrendBucketStatus,
  type StatisticsMetric,
  type StatisticsTrendBucket,
  type StatisticsUnit,
} from "@/lib/admin-statistics";

type StatisticsTrendChartProps = {
  points: StatisticsTrendBucket[];
  unit: StatisticsUnit;
  metric: StatisticsMetric;
  onMetricChange: (metric: StatisticsMetric) => void;
};

type TrendChartPoint = StatisticsTrendBucket & {
  chartLabel: string;
  completeValue: number | null;
  incompleteValue: number | null;
};

const metricLabels: Record<StatisticsMetric, string> = {
  usageMinutes: "이용시간",
  reservationCount: "예약 건수",
  userCount: "이용자 수",
};

const unitLabels: Record<StatisticsUnit, string> = {
  day: "일",
  week: "주",
  year: "년",
};

function formatMetricValue(value: number, metric: StatisticsMetric) {
  if (metric === "usageMinutes") {
    return `${Number((value / 60).toFixed(1)).toLocaleString("ko-KR")}시간`;
  }

  return `${value.toLocaleString("ko-KR")}${metric === "reservationCount" ? "건" : "명"}`;
}

function TrendTooltip({
  active,
  payload,
  metric,
}: {
  active?: boolean;
  payload?: Array<{ payload: TrendChartPoint }>;
  metric: StatisticsMetric;
}) {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;

  if (!point.isComplete) {
    return (
      <div className="grid min-w-52 gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
        <p className="font-medium text-foreground">{point.chartLabel}</p>
        <p className="font-medium text-foreground">{getTrendBucketStatus(point.isComplete)}</p>
        <div className="flex items-center justify-between gap-4">
          <span className="text-muted-foreground">{metricLabels[metric]}</span>
          <span className="font-mono font-medium tabular-nums text-foreground">
            {formatMetricValue(point[metric], metric)}
          </span>
        </div>
        <p className="leading-relaxed text-muted-foreground">수집 또는 집계가 진행 중인 부분 집계이며, 점선 값은 확정 전 수치입니다.</p>
      </div>
    );
  }

  return (
    <div className="grid min-w-40 gap-1.5 rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground">{point.chartLabel}</p>
      <div className="flex items-center justify-between gap-4">
        <span className="text-muted-foreground">{metricLabels[metric]}</span>
        <span className="font-mono font-medium tabular-nums text-foreground">
          {formatMetricValue(point[metric], metric)}
        </span>
      </div>
    </div>
  );
}

export default function StatisticsTrendChart({
  points,
  unit,
  metric,
  onMetricChange,
}: StatisticsTrendChartProps) {
  const chartData: TrendChartPoint[] = points.map((point) => ({
    ...point,
    chartLabel: formatTrendLabel(point, unit),
    completeValue: point.isComplete ? point[metric] : null,
    incompleteValue: point.isComplete ? null : point[metric],
  }));
  const incompleteLabels = chartData.filter((point) => !point.isComplete).map((point) => point.chartLabel);
  const chartConfig = {
    completeValue: { label: metricLabels[metric], color: "var(--primary)" },
    incompleteValue: { label: "부분 집계", color: "var(--primary)" },
  };

  return (
    <section className="mt-6" aria-labelledby="statistics-trend-title">
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle id="statistics-trend-title">이용 추세</CardTitle>
          <CardDescription>
            선택한 {unitLabels[unit]} 단위의 {metricLabels[metric]} 흐름입니다.
          </CardDescription>
          <CardAction>
            <ToggleGroup
              aria-label="이용 추세 지표"
              value={[metric]}
              onValueChange={(value) => {
                const nextMetric = Array.isArray(value) ? value[0] : value;
                if (nextMetric === "usageMinutes" || nextMetric === "reservationCount" || nextMetric === "userCount") {
                  onMetricChange(nextMetric);
                }
              }}
              variant="outline"
              size="sm"
              spacing={0}
            >
              <ToggleGroupItem value="usageMinutes">이용시간</ToggleGroupItem>
              <ToggleGroupItem value="reservationCount">예약 건수</ToggleGroupItem>
              <ToggleGroupItem value="userCount">이용자 수</ToggleGroupItem>
            </ToggleGroup>
          </CardAction>
        </CardHeader>
        <CardContent>
          {chartData.length === 0 ? (
            <p className="flex min-h-64 items-center justify-center text-sm text-muted-foreground">
              표시할 이용 추세 데이터가 없습니다.
            </p>
          ) : (
            <>
              <ChartContainer config={chartConfig} className="min-h-64 w-full" aria-label={`${metricLabels[metric]} 추세 차트`}>
                <AreaChart data={chartData} margin={{ top: 12, right: 12, left: 0, bottom: 0 }}>
                  <CartesianGrid vertical={false} />
                  <XAxis
                    dataKey="chartLabel"
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    minTickGap={28}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    tickMargin={8}
                    width={56}
                    tickFormatter={(value: number) => formatMetricValue(value, metric)}
                  />
                  <ChartTooltip
                    cursor={{ stroke: "var(--border)", strokeWidth: 1 }}
                    content={<TrendTooltip metric={metric} />}
                  />
                  <Area
                    type="monotone"
                    dataKey="completeValue"
                    name={metricLabels[metric]}
                    stroke="var(--color-completeValue)"
                    fill="var(--color-completeValue)"
                    fillOpacity={0.16}
                    strokeWidth={2}
                    connectNulls={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="incompleteValue"
                    name="부분 집계"
                    stroke="var(--color-incompleteValue)"
                    fill="var(--color-incompleteValue)"
                    fillOpacity={0.06}
                    strokeWidth={2}
                    strokeDasharray="5 4"
                    connectNulls={false}
                  />
                </AreaChart>
              </ChartContainer>
              <p className="mt-3 text-xs text-muted-foreground">
                점선 구간{incompleteLabels.length ? ` (${incompleteLabels.join(", ")})` : ""}은 수집 또는 집계가 진행 중인 부분 집계이므로 확정된 값이 아닙니다.
              </p>
            </>
          )}
        </CardContent>
      </Card>
    </section>
  );
}
