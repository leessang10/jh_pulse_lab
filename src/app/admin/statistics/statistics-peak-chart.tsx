"use client";

import type { TooltipContentProps } from "recharts";
import { Bar, BarChart, CartesianGrid, LabelList, Tooltip, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, type ChartConfig } from "@/components/ui/chart";
import { formatPeakWindow, type StatisticsPeakTime } from "@/lib/admin-statistics";

type StatisticsPeakChartProps = {
  peakTimes: StatisticsPeakTime[];
  referenceMonth: string;
};

type PeakChartDatum = {
  weekday: number;
  weekdayLabel: string;
  range: [number, number];
  label: string;
  peak: StatisticsPeakTime;
};

const weekdayLabels = ["월요일", "화요일", "수요일", "목요일", "금요일", "토요일", "일요일"];
const chartConfig = {
  range: { label: "피크 시간", color: "var(--primary)" },
} satisfies ChartConfig;

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-");
  return `${year}년 ${Number(month)}월`;
}

function formatHourTick(minutes: number) {
  return `${String(Math.floor(minutes / 60)).padStart(2, "0")}:00`;
}

function PeakTooltip({ active, payload }: TooltipContentProps) {
  const point = payload?.[0]?.payload as PeakChartDatum | undefined;
  if (!active || !point?.peak.hasData) return null;

  return (
    <div className="rounded-lg border border-border bg-background px-3 py-2 text-xs shadow-xl">
      <p className="font-medium text-foreground">{point.weekdayLabel}</p>
      <p className="mt-1 font-mono tabular-nums text-muted-foreground">{formatPeakWindow(point.peak)}</p>
    </div>
  );
}

/** 월~일별 가장 붐빈 연속 2시간을 범위 막대로 보여준다. */
export default function StatisticsPeakChart({ peakTimes, referenceMonth }: StatisticsPeakChartProps) {
  const peaksByWeekday = new Map(peakTimes.map((peak) => [peak.weekday, peak]));
  const chartData: PeakChartDatum[] = weekdayLabels.map((weekdayLabel, index) => {
    const peak = peaksByWeekday.get(index + 1) ?? {
      weekday: index + 1,
      startMinutes: null,
      endMinutes: null,
      occupancyRate: 0,
      hasData: false,
    };
    const hasRange = peak.hasData && peak.startMinutes !== null && peak.endMinutes !== null;

    return {
      weekday: index + 1,
      weekdayLabel,
      range: hasRange ? [peak.startMinutes ?? 420, peak.endMinutes ?? 420] : [420, 420],
      label: hasRange ? formatPeakWindow(peak) : "예약 데이터가 없습니다.",
      peak,
    };
  });

  return (
    <section className="mt-6" aria-labelledby="statistics-peak-title">
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle id="statistics-peak-title">요일별 피크 시간</CardTitle>
          <CardDescription>{formatReferenceMonth(referenceMonth)} 기준, 예약이 가장 몰린 연속 2시간과 평균 점유율입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          <ChartContainer config={chartConfig} className="h-[21rem] min-h-[21rem] w-full" aria-label="요일별 피크 시간 범위 막대 차트">
            <BarChart data={chartData} layout="vertical" margin={{ top: 8, right: 152, left: 0, bottom: 0 }} barCategoryGap="28%">
              <CartesianGrid horizontal={false} />
              <XAxis
                type="number"
                domain={[420, 1380]}
                ticks={[420, 600, 780, 960, 1140, 1320, 1380]}
                tickFormatter={formatHourTick}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <YAxis
                type="category"
                dataKey="weekdayLabel"
                width={52}
                tickLine={false}
                axisLine={false}
                tickMargin={8}
              />
              <Tooltip cursor={{ fill: "var(--muted)" }} content={(props) => <PeakTooltip {...props} />} />
              <Bar dataKey="range" name="피크 시간" fill="var(--color-range)" radius={4} isAnimationActive={false}>
                <LabelList dataKey="label" position="right" offset={8} className="fill-foreground text-[11px] font-medium" />
              </Bar>
            </BarChart>
          </ChartContainer>
          <ul className="sr-only" aria-label="요일별 피크 시간 상세">
            {chartData.map((point) => <li key={point.weekday}>{point.weekdayLabel}: {point.label}</li>)}
          </ul>
          <p className="mt-3 text-xs text-muted-foreground">점검 시간은 포함하지 않은 예약 수요 기준입니다.</p>
        </CardContent>
      </Card>
    </section>
  );
}
