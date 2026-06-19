"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import { listPublicReservationTimeBlocks } from "@/lib/reservation-actions";
import type { ReservationTimeBlock } from "@/lib/reservations";
import { buildV2BoardRows } from "@/lib/v2-reservation-board";

type V2ReservationBoardProps = {
  today: string;
  todayLabel: string;
};

export function V2ReservationBoard({ today, todayLabel }: V2ReservationBoardProps) {
  const [reservations, setReservations] = useState<ReservationTimeBlock[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await listPublicReservationTimeBlocks(today);
    if (!result.ok) {
      setError(result.error);
      setReservations([]);
      setIsReady(true);
      return;
    }

    setError(null);
    setReservations(result.data);
    setIsReady(true);
  }, [today]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => window.clearInterval(id);
  }, [refresh]);

  const rows = useMemo(
    () =>
      buildV2BoardRows({
        date: today,
        reservations,
        currentTime: getCurrentKoreaBookingTime(),
      }),
    [reservations, today],
  );

  return (
    <section className="grid gap-4" aria-label={`${todayLabel} 예약 현황`}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm font-semibold text-muted-foreground">
          {error
            ? error
            : !isReady
              ? "예약 현황을 불러오는 중입니다."
              : isPending
                ? "예약 현황을 새로고침 중입니다."
                : "오늘 예약 현황입니다."}
        </p>
      </div>
      <pre className="sr-only">{JSON.stringify(rows)}</pre>
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">
        V2 예약 현황판 UI를 연결하는 중입니다.
      </div>
    </section>
  );
}
