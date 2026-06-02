"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createPublicReservation,
  deleteAdminReservation,
  listAdminReservations,
  listPublicReservationTimeBlocks,
  updateAdminReservationStatus,
  type ReservationActionResult,
} from "@/lib/reservation-actions";
import type { Reservation, ReservationDraft, ReservationStatus } from "@/lib/reservations";
import type { PublicReservationTimeBlock } from "@/lib/supabase/reservation-mappers";

type UseReservationsOptions = {
  date: string;
  admin?: boolean;
  enabled?: boolean;
  roomId?: string;
  status?: ReservationStatus | "all";
};

function toReservation(block: PublicReservationTimeBlock): Reservation {
  return {
    ...block,
    phone: "",
  };
}

function emptyResult<T>(error: string): ReservationActionResult<T> {
  return { ok: false, error };
}

export function useReservations(options: UseReservationsOptions) {
  const enabled = options.enabled ?? true;
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    if (!enabled) {
      setReservations([]);
      setError(null);
      setIsReady(true);
      return { ok: true, data: [] } satisfies ReservationActionResult<Reservation[]>;
    }

    setIsReady(false);
    setError(null);

    const result = options.admin
      ? await listAdminReservations({
          date: options.date,
          roomId: options.roomId === "all" ? undefined : options.roomId,
          status: !options.status || options.status === "all" ? undefined : options.status,
        })
      : await listPublicReservationTimeBlocks(options.date);

    if (result.ok) {
      const data: Reservation[] = options.admin ? (result.data as Reservation[]) : result.data.map(toReservation);
      setReservations(data);
      setIsReady(true);
      return { ok: true, data } satisfies ReservationActionResult<Reservation[]>;
    }

    setReservations([]);
    setError(result.error);
    setIsReady(true);
    return result;
  }, [enabled, options.admin, options.date, options.roomId, options.status]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  return useMemo(
    () => ({
      reservations,
      isReady,
      isPending,
      error,
      refresh,
      async addReservation(draft: ReservationDraft) {
        const result = await createPublicReservation(draft);
        if (result.ok) await refresh();
        return result;
      },
      async updateReservationStatus(id: string, status: ReservationStatus) {
        if (!options.admin) return emptyResult<null>("관리자 로그인이 필요합니다.");

        const result = await updateAdminReservationStatus(id, status);
        if (result.ok) await refresh();
        return result;
      },
      async removeReservation(id: string) {
        if (!options.admin) return emptyResult<null>("관리자 로그인이 필요합니다.");

        const result = await deleteAdminReservation(id);
        if (result.ok) await refresh();
        return result;
      },
    }),
    [error, isPending, isReady, options.admin, refresh, reservations],
  );
}
