"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatStatisticsMinutes,
  getNextRankingLimit,
  getVisibleRanking,
  type StatisticsRankingEntry,
} from "@/lib/admin-statistics";

type StatisticsMemberRankingProps = {
  entries: StatisticsRankingEntry[];
  referenceMonth: string;
};

function formatReferenceMonth(referenceMonth: string) {
  const [year, month] = referenceMonth.split("-");
  return `${year}년 ${Number(month)}월`;
}

export default function StatisticsMemberRanking({ entries, referenceMonth }: StatisticsMemberRankingProps) {
  const [limit, setLimit] = useState(5);

  useEffect(() => {
    setLimit(5);
  }, [referenceMonth]);

  const visibleEntries = useMemo(() => getVisibleRanking(entries, limit), [entries, limit]);
  const maxUsageMinutes = Math.max(1, ...entries.map((entry) => entry.usageMinutes));
  const canShowMore = visibleEntries.length < entries.length;

  return (
    <section className="mt-6" aria-labelledby="statistics-member-ranking-title">
      <Card className="border bg-card">
        <CardHeader>
          <CardTitle id="statistics-member-ranking-title">전체 회원 이용 순위</CardTitle>
          <CardDescription>{formatReferenceMonth(referenceMonth)} 기준, 취소 예약을 제외한 이용시간 순위입니다.</CardDescription>
        </CardHeader>
        <CardContent>
          {entries.length === 0 ? (
            <p className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
              선택한 기간에는 회원 이용 데이터가 없습니다.
            </p>
          ) : (
            <ol className="divide-y divide-border" aria-label="회원 이용 순위 목록">
              {visibleEntries.map((entry, index) => {
                const rank = index + 1;
                const usageWidth = `${Math.max(3, (entry.usageMinutes / maxUsageMinutes) * 100)}%`;

                return (
                  <li key={`${entry.name}-${rank}`} className="grid grid-cols-[2.5rem_minmax(0,1fr)_auto] items-center gap-3 py-3 sm:grid-cols-[2.5rem_minmax(0,1fr)_auto_auto] sm:gap-5">
                    <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground" aria-label={`${rank}위`}>{rank}</span>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-foreground">{entry.name}</p>
                      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                        <div className="h-full rounded-full bg-primary" style={{ width: usageWidth }} />
                      </div>
                    </div>
                    <div className="text-end">
                      <p className="text-xs text-muted-foreground">이용시간</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{formatStatisticsMinutes(entry.usageMinutes)}</p>
                    </div>
                    <div className="hidden text-end sm:block">
                      <p className="text-xs text-muted-foreground">예약 건수</p>
                      <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums text-foreground">{entry.reservationCount.toLocaleString("ko-KR")}건</p>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
        {canShowMore ? (
          <CardFooter className="justify-center">
            <Button
              type="button"
              variant="outline"
              onClick={() => setLimit((currentLimit) => getNextRankingLimit(currentLimit, entries.length))}
            >
              10명 더 보기
            </Button>
          </CardFooter>
        ) : null}
      </Card>
    </section>
  );
}
