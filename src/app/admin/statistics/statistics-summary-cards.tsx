import { Alert, AlertAction, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { buildStatisticsSummaryView, type AdminReservationStatistics } from "@/lib/admin-statistics";

type StatisticsSummaryCardsProps = {
  statistics: AdminReservationStatistics | null;
  isReady: boolean;
  error: string | null;
  onRetry: () => void;
};

const summaryCardLabels = [
  { key: "totalUsage", title: "총 이용시간", description: "취소 예약은 제외한 이용시간입니다." },
  { key: "reservationCount", title: "총 예약 건수", description: "취소 예약이 포함된 전체 예약입니다." },
  { key: "userCount", title: "전체 이용자", description: "예약자 이름 기준으로 추정한 인원입니다." },
  { key: "averageUsage", title: "이용자당 평균", description: "취소 예약을 제외한 이용시간 기준입니다." },
  { key: "cancellationRate", title: "예약 취소율", description: "취소 예약을 포함한 전체 예약 기준입니다." },
] as const;

function SummaryCardSkeleton() {
  return (
    <Card className="border bg-card">
      <CardHeader className="gap-2 pb-2">
        <Skeleton className="h-4 w-24" />
      </CardHeader>
      <CardContent className="grid gap-3">
        <Skeleton className="h-8 w-28" />
        <Skeleton className="h-4 w-full" />
      </CardContent>
    </Card>
  );
}

export default function StatisticsSummaryCards({
  statistics,
  isReady,
  error,
  onRetry,
}: StatisticsSummaryCardsProps) {
  if (!isReady) {
    return (
      <section aria-label="핵심 지표를 불러오는 중입니다." className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCardLabels.map((card) => <SummaryCardSkeleton key={card.key} />)}
      </section>
    );
  }

  if (error || !statistics) {
    return (
      <section className="mt-4" aria-live="polite">
        <Alert variant="destructive">
          <AlertTitle>예약 통계를 불러오지 못했습니다.</AlertTitle>
          <AlertDescription>{error ?? "잠시 후 다시 시도해 주세요."}</AlertDescription>
          <AlertAction>
            <Button size="sm" type="button" variant="outline" onClick={onRetry}>다시 시도</Button>
          </AlertAction>
        </Alert>
      </section>
    );
  }

  const summary = buildStatisticsSummaryView(statistics.summary);

  return (
    <section className="mt-4" aria-label="핵심 지표">
      {summary.isEmpty ? (
        <p className="mb-3 text-sm text-muted-foreground">선택한 기간에는 예약 데이터가 없습니다.</p>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {summaryCardLabels.map((card) => {
          const value = summary[card.key];

          return (
            <Card key={card.key} className="border bg-card">
              <CardHeader className="gap-1 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{card.title}</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold tracking-tight text-foreground">{value.value}</p>
                <p className="mt-2 text-xs text-muted-foreground">{card.description}</p>
                <p className="mt-3 text-xs font-medium text-muted-foreground">{value.comparison}</p>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </section>
  );
}
