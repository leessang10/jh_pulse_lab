"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  buildStatisticsSearchParams,
  canOpenStatisticsSimulator,
  mergeStatisticsQuery,
  parseStatisticsQuery,
  type StatisticsQuery,
  type StatisticsUnit,
} from "@/lib/admin-statistics";
import { todayKoreaValue } from "@/lib/korea-date";
import { useAdminStatistics } from "@/lib/use-admin-statistics";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import StatisticsMemberRanking from "./statistics-member-ranking";
import StatisticsPeakChart from "./statistics-peak-chart";
import StatisticsSimulatorDialog from "./statistics-simulator-dialog";
import StatisticsSummaryCards from "./statistics-summary-cards";
import StatisticsTrendChart from "./statistics-trend-chart";

function formatMonthLabel(value: string) {
  const [year, month] = value.split("-");
  return `${year}년 ${Number(month)}월`;
}

function getReferenceMonthOptions(currentMonth: string, referenceMonth: string, coverageStart: string | null) {
  const earliestMonth = [coverageStart?.slice(0, 7), referenceMonth]
    .filter((month): month is string => Boolean(month))
    .sort()[0];
  const [startYear, startMonth] = earliestMonth.split("-").map(Number);
  const [endYear, endMonth] = currentMonth.split("-").map(Number);
  const options: string[] = [];

  for (let year = endYear, month = endMonth; year > startYear || (year === startYear && month >= startMonth);) {
    options.push(`${year}-${String(month).padStart(2, "0")}`);
    month -= 1;
    if (month === 0) {
      month = 12;
      year -= 1;
    }
  }

  return options;
}

export default function AdminStatisticsPage() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const currentMonth = todayKoreaValue().slice(0, 7);
  const query = useMemo(
    () => parseStatisticsQuery(new URLSearchParams(searchParams.toString()), currentMonth),
    [currentMonth, searchParams],
  );
  const normalizedQuery = useMemo(() => buildStatisticsSearchParams(query), [query]);
  const queryRef = useRef(query);
  const pendingQueryRef = useRef<string | null>(null);
  const [isSimulatorOpen, setIsSimulatorOpen] = useState(false);
  const { statistics, isReady, error, refresh } = useAdminStatistics({
    referenceMonth: query.referenceMonth,
    unit: query.unit,
  });
  const referenceMonthOptions = useMemo(
    () => getReferenceMonthOptions(currentMonth, query.referenceMonth, statistics?.coverageStart ?? null),
    [currentMonth, query.referenceMonth, statistics?.coverageStart],
  );
  const canSimulate = canOpenStatisticsSimulator({
    isReady,
    hasError: error !== null,
    reservationCount: statistics?.summary.current.reservationCount ?? 0,
    rankingCount: statistics?.ranking.length ?? 0,
  });

  useEffect(() => {
    if (pendingQueryRef.current === null || pendingQueryRef.current === normalizedQuery) {
      queryRef.current = query;
      pendingQueryRef.current = null;
    }
  }, [normalizedQuery, query]);

  useEffect(() => {
    if (!canSimulate) setIsSimulatorOpen(false);
  }, [canSimulate]);

  useEffect(() => {
    if (searchParams.toString() !== normalizedQuery) {
      router.replace(`${pathname}?${normalizedQuery}`, { scroll: false });
    }
  }, [normalizedQuery, pathname, router, searchParams]);

  function updateQuery(next: Partial<StatisticsQuery>) {
    const accumulatedQuery = mergeStatisticsQuery(queryRef.current, next);
    queryRef.current = accumulatedQuery;
    const nextQuery = buildStatisticsSearchParams(accumulatedQuery);
    pendingQueryRef.current = nextQuery;
    router.replace(`${pathname}?${nextQuery}`, { scroll: false });
  }

  return (
    <main className="min-h-screen w-full px-5 py-6 lg:px-8">
      <header className="flex flex-col gap-4 border-b pb-5 xl:flex-row xl:items-end xl:justify-between">
        <div className="flex items-start gap-3">
          <SidebarTrigger className="mt-1 md:hidden" />
          <div>
            <Badge variant="outline" className="border-border bg-background text-muted-foreground">
              예약 통계
            </Badge>
            <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">예약 통계</h1>
            <p className="mt-2 text-sm text-muted-foreground">기준 월의 예약 이용 현황을 확인하실 수 있습니다.</p>
          </div>
        </div>

        <div className="flex flex-wrap items-end gap-3" aria-label="통계 조회 조건">
          <label className="grid gap-1.5 text-sm font-semibold text-muted-foreground">
            기준 월
            <Select value={query.referenceMonth} onValueChange={(value) => value && updateQuery({ referenceMonth: value })}>
              <SelectTrigger className="h-9 min-w-34 bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {referenceMonthOptions.map((month) => (
                  <SelectItem key={month} value={month}>{formatMonthLabel(month)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </label>

          <div className="grid gap-1.5">
            <span className="text-sm font-semibold text-muted-foreground">추세 단위</span>
            <ToggleGroup
              aria-label="추세 단위"
              value={[query.unit]}
              onValueChange={(value) => {
                const unit = Array.isArray(value) ? value[0] : value;
                if (unit === "day" || unit === "week" || unit === "year") updateQuery({ unit: unit as StatisticsUnit });
              }}
              variant="outline"
              spacing={0}
            >
              <ToggleGroupItem value="day" aria-label="일 단위">일</ToggleGroupItem>
              <ToggleGroupItem value="week" aria-label="주 단위">주</ToggleGroupItem>
              <ToggleGroupItem value="year" aria-label="년 단위">년</ToggleGroupItem>
            </ToggleGroup>
          </div>

          <Button
            aria-pressed={isSimulatorOpen}
            className="h-9"
            type="button"
            disabled={!canSimulate}
            onClick={() => setIsSimulatorOpen(true)}
          >
            정기권 시뮬레이션
          </Button>
        </div>
      </header>

      <StatisticsSummaryCards
        error={error}
        isReady={isReady}
        statistics={statistics}
        onRetry={() => { void refresh(); }}
      />

      {isReady && statistics ? (
        <>
          <StatisticsTrendChart
            points={statistics.trend}
            unit={query.unit}
            metric={query.metric}
            onMetricChange={(metric) => updateQuery({ metric })}
          />
          <StatisticsMemberRanking
            entries={statistics.ranking}
            referenceMonth={query.referenceMonth}
          />
          <StatisticsPeakChart
            peakTimes={statistics.peakTimes}
            referenceMonth={query.referenceMonth}
          />
        </>
      ) : !error ? (
        <section className="mt-6" aria-label="추세와 회원 순위를 불러오는 중입니다.">
          <Card className="border bg-card">
            <CardHeader className="gap-2">
              <Skeleton className="h-5 w-24" />
              <Skeleton className="h-4 w-56" />
            </CardHeader>
            <CardContent><Skeleton className="h-64 w-full" /></CardContent>
          </Card>
          <Card className="mt-6 border bg-card">
            <CardHeader className="gap-2">
              <Skeleton className="h-5 w-36" />
              <Skeleton className="h-4 w-64" />
            </CardHeader>
            <CardContent><Skeleton className="h-52 w-full" /></CardContent>
          </Card>
          <Card className="mt-6 border bg-card">
            <CardHeader className="gap-2">
              <Skeleton className="h-5 w-32" />
              <Skeleton className="h-4 w-72" />
            </CardHeader>
            <CardContent><Skeleton className="h-[21rem] w-full" /></CardContent>
          </Card>
        </section>
      ) : null}
      {canSimulate && statistics ? (
        <StatisticsSimulatorDialog
          ranking={statistics.ranking}
          peakTimes={statistics.peakTimes}
          open={isSimulatorOpen}
          onOpenChange={setIsSimulatorOpen}
        />
      ) : null}
    </main>
  );
}
