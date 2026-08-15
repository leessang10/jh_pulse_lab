"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  getAdminReservationStatistics,
  type AdminStatisticsActionResult,
} from "@/lib/admin-statistics-actions";
import {
  selectCurrentStatisticsResponse,
  type AdminReservationStatistics,
  type StatisticsRequestKey,
  type StatisticsUnit,
} from "@/lib/admin-statistics";

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
  const currentKey = useMemo<StatisticsRequestKey>(() => ({ referenceMonth, unit }), [referenceMonth, unit]);
  const [response, setResponse] = useState<{
    key: StatisticsRequestKey;
    statistics: AdminReservationStatistics | null;
    isReady: boolean;
    isPending: boolean;
    error: string | null;
  } | null>(null);
  const requestCounter = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = ++requestCounter.current;
    const requestKey = { referenceMonth, unit };
    setResponse({ key: requestKey, statistics: null, isReady: false, isPending: true, error: null });

    try {
      const result = await getAdminReservationStatistics({ referenceMonth, unit });
      if (requestId !== requestCounter.current) return result;

      if (result.ok) {
        setResponse({ key: requestKey, statistics: result.data, isReady: true, isPending: false, error: null });
      } else {
        setResponse({ key: requestKey, statistics: null, isReady: true, isPending: false, error: result.error });
      }
      return result;
    } catch {
      const result: AdminStatisticsActionResult<AdminReservationStatistics> = {
        ok: false,
        error: GENERIC_MESSAGE,
      };
      if (requestId === requestCounter.current) {
        setResponse({ key: requestKey, statistics: null, isReady: true, isPending: false, error: result.error });
      }
      return result;
    }
  }, [referenceMonth, unit]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const visibleResponse = selectCurrentStatisticsResponse(response, currentKey);
  const isCurrentResponse = response?.key.referenceMonth === currentKey.referenceMonth
    && response.key.unit === currentKey.unit;

  return useMemo(
    () => ({
      ...visibleResponse,
      isPending: isCurrentResponse ? response?.isPending ?? true : true,
      refresh,
    }),
    [isCurrentResponse, refresh, response?.isPending, visibleResponse],
  );
}
