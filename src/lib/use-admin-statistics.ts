"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminReservationStatistics,
  type AdminStatisticsActionResult,
} from "@/lib/admin-statistics-actions";
import type { AdminReservationStatistics, StatisticsUnit } from "@/lib/admin-statistics";

type UseAdminStatisticsOptions = {
  referenceMonth: string;
  unit: StatisticsUnit;
};

type UseAdminStatisticsResult = {
  statistics: AdminReservationStatistics | null;
  isReady: boolean;
  isPending: boolean;
  error: string | null;
  refresh: () => Promise<AdminStatisticsActionResult<AdminReservationStatistics>>;
};

const GENERIC_MESSAGE = "예약 통계를 불러오지 못했습니다. 다시 시도해 주세요.";

export function useAdminStatistics({ referenceMonth, unit }: UseAdminStatisticsOptions): UseAdminStatisticsResult {
  const [statistics, setStatistics] = useState<AdminReservationStatistics | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const requestCounter = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestCounter.current;
    setIsReady(false);
    setIsPending(true);
    setError(null);

    try {
      const result = await getAdminReservationStatistics({ referenceMonth, unit });
      if (requestId !== requestCounter.current) return result;

      if (result.ok) {
        setStatistics(result.data);
      } else {
        setStatistics(null);
        setError(result.error);
      }
      setIsReady(true);
      setIsPending(false);
      return result;
    } catch {
      const result: AdminStatisticsActionResult<AdminReservationStatistics> = {
        ok: false,
        error: GENERIC_MESSAGE,
      };
      if (requestId === requestCounter.current) {
        setStatistics(null);
        setError(result.error);
        setIsReady(true);
        setIsPending(false);
      }
      return result;
    }
  }, [referenceMonth, unit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return useMemo(
    () => ({ statistics, isReady, isPending, error, refresh }),
    [error, isPending, isReady, refresh, statistics],
  );
}
