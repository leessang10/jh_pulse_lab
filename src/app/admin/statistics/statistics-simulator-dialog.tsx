"use client";

import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  calculateSubscriptionScenarioFromHours,
  type StatisticsPeakTime,
  type StatisticsRankingEntry,
} from "@/lib/admin-statistics";

type StatisticsSimulatorDialogProps = {
  ranking: StatisticsRankingEntry[];
  peakTimes: StatisticsPeakTime[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function clampNumber(value: number, minimum: number, maximum: number) {
  if (!Number.isFinite(value)) return minimum;
  return Math.min(maximum, Math.max(minimum, value));
}

function formatCurrency(value: number) {
  return `${value.toLocaleString("ko-KR")}원`;
}

function formatPercent(value: number) {
  return `${Number(value.toFixed(1)).toLocaleString("ko-KR")}%`;
}

/** 저장하지 않고 현재 월간 집계로 정기권 가정 결과만 계산한다. */
export default function StatisticsSimulatorDialog({
  ranking,
  peakTimes,
  open,
  onOpenChange,
}: StatisticsSimulatorDialogProps) {
  const [includedHours, setIncludedHours] = useState(8);
  const [monthlyPrice, setMonthlyPrice] = useState(49_000);
  const [conversionRate, setConversionRate] = useState(50);
  const [peakIncludedHours, setPeakIncludedHours] = useState(2);
  const peakDayCount = peakTimes.filter((peak) => peak.hasData).length;
  const scenario = useMemo(() => calculateSubscriptionScenarioFromHours({
    ranking,
    includedHours,
    peakIncludedHours,
    monthlyPrice,
    conversionRate,
  }), [conversionRate, includedHours, monthlyPrice, peakIncludedHours, ranking]);

  function updateIncludedHours(nextValue: number) {
    const nextIncludedHours = clampNumber(nextValue, 1, 100);
    setIncludedHours(nextIncludedHours);
    setPeakIncludedHours((currentPeakHours) => Math.min(currentPeakHours, nextIncludedHours));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>정기권 시뮬레이션</DialogTitle>
          <DialogDescription>
            현재 선택한 기준 월의 이용 기록만 적용합니다. 입력값과 결과는 저장되지 않습니다.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            월 제공 시간
            <Input
              type="number"
              min={1}
              max={100}
              step={1}
              inputMode="numeric"
              value={includedHours}
              onChange={(event) => updateIncludedHours(Number(event.target.value))}
              aria-describedby="included-hours-help"
            />
            <span id="included-hours-help" className="text-xs font-normal text-muted-foreground">1~100시간</span>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            월 가격
            <Input
              type="number"
              min={0}
              max={10_000_000}
              step={1000}
              inputMode="numeric"
              value={monthlyPrice}
              onChange={(event) => setMonthlyPrice(clampNumber(Number(event.target.value), 0, 10_000_000))}
              aria-describedby="monthly-price-help"
            />
            <span id="monthly-price-help" className="text-xs font-normal text-muted-foreground">0~10,000,000원</span>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            예상 가입률
            <Input
              type="number"
              min={0}
              max={100}
              step={1}
              inputMode="numeric"
              value={conversionRate}
              onChange={(event) => setConversionRate(clampNumber(Number(event.target.value), 0, 100))}
              aria-describedby="conversion-rate-help"
            />
            <span id="conversion-rate-help" className="text-xs font-normal text-muted-foreground">0~100%</span>
          </label>

          <label className="grid gap-1.5 text-sm font-medium text-foreground">
            피크 시간 허용 한도
            <Input
              type="number"
              min={0}
              max={includedHours}
              step={1}
              inputMode="numeric"
              value={peakIncludedHours}
              onChange={(event) => setPeakIncludedHours(clampNumber(Number(event.target.value), 0, includedHours))}
              aria-describedby="peak-hours-help"
            />
            <span id="peak-hours-help" className="text-xs font-normal text-muted-foreground">0~{includedHours}시간</span>
          </label>
        </div>

        <section className="rounded-lg border border-border bg-muted/30 p-4" aria-labelledby="simulator-result-title">
          <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
            <h3 id="simulator-result-title" className="font-medium text-foreground">시나리오 결과</h3>
            <p className="text-xs text-muted-foreground">피크 데이터가 있는 요일 {peakDayCount}일 기준입니다.</p>
          </div>
          <dl className="mt-3 grid gap-3 sm:grid-cols-2">
            <div>
              <dt className="text-xs text-muted-foreground">잠재 대상 회원</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{scenario.eligibleUsers.toLocaleString("ko-KR")}명</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">시나리오 가입자</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{scenario.scenarioSubscribers.toLocaleString("ko-KR")}명</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">시나리오 월매출</dt>
              <dd className="mt-1 break-all font-mono text-lg font-semibold tabular-nums text-foreground">{formatCurrency(scenario.scenarioRevenue)}</dd>
            </div>
            <div>
              <dt className="text-xs text-muted-foreground">대상 회원의 피크 이용 비중</dt>
              <dd className="mt-1 font-mono text-lg font-semibold tabular-nums text-foreground">{formatPercent(scenario.eligiblePeakUsageRate)}</dd>
            </div>
          </dl>
        </section>

        <p className="text-sm text-muted-foreground">실제 매출 예측이 아닌 가정 결과입니다.</p>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>닫기</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
