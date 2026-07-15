"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createPublicReservation,
  deleteAdminReservation,
  listAdminReservations,
  listPublicScheduleBlocks,
  updateAdminReservationStatus,
  type ReservationActionResult,
} from "@/lib/reservation-actions";
import type { Reservation, ReservationDraft, ReservationStatus, ReservationTimeBlock } from "@/lib/reservations";
import type { ScheduleBlock } from "@/lib/maintenance-blocks";

type UseReservationsBaseOptions = {
  date: string;
  enabled?: boolean;
};

type UsePublicReservationsOptions = UseReservationsBaseOptions & {
  admin?: false;
};

type UseAdminReservationsOptions = UseReservationsBaseOptions & {
  admin: true;
  roomId?: string;
  status?: ReservationStatus | "all";
};

type UseReservationsOptions = UsePublicReservationsOptions | UseAdminReservationsOptions;

type UseReservationsResult<TReservation extends ReservationTimeBlock | ScheduleBlock> = {
  reservations: TReservation[];
  isReady: boolean;
  isPending: boolean;
  error: string | null;
  refresh: () => Promise<ReservationActionResult<TReservation[]>>;
  addReservation: (draft: ReservationDraft) => Promise<ReservationActionResult<Reservation>>;
  updateReservationStatus: (id: string, status: ReservationStatus) => Promise<ReservationActionResult<null>>;
  removeReservation: (id: string) => Promise<ReservationActionResult<null>>;
};

function emptyResult<T>(error: string): ReservationActionResult<T> {
  return { ok: false, error };
}

export function useReservations(options: UseAdminReservationsOptions): UseReservationsResult<Reservation>;
export function useReservations(options: UsePublicReservationsOptions): UseReservationsResult<ScheduleBlock>;
export function useReservations(options: UseReservationsOptions) {
  const enabled = options.enabled ?? true;
  const isAdmin = options.admin === true;
  const adminRoomId = isAdmin ? options.roomId : undefined;
  const adminStatus = isAdmin ? options.status : undefined;
  const [reservations, setReservations] = useState<Array<Reservation | ScheduleBlock>>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    if (!enabled) {
      setReservations([]);
      setError(null);
      setIsReady(true);
      return { ok: true, data: [] } satisfies ReservationActionResult<Array<Reservation | ScheduleBlock>>;
    }

    setIsReady(false);
    setError(null);

    const result = isAdmin
      ? await listAdminReservations({
          date: options.date,
          roomId: adminRoomId === "all" ? undefined : adminRoomId,
          status: !adminStatus || adminStatus === "all" ? undefined : adminStatus,
        })
      : await listPublicScheduleBlocks(options.date);

    if (result.ok) {
      const data = result.data;
      setReservations(data);
      setIsReady(true);
      return { ok: true, data } satisfies ReservationActionResult<Array<Reservation | ScheduleBlock>>;
    }

    setReservations([]);
    setError(result.error);
    setIsReady(true);
    return result;
  }, [adminRoomId, adminStatus, enabled, isAdmin, options.date]);

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
        if (!isAdmin) return emptyResult<null>("관리자 로그인이 필요합니다.");

        const result = await updateAdminReservationStatus(id, status);
        if (result.ok) await refresh();
        return result;
      },
      async removeReservation(id: string) {
        if (!isAdmin) return emptyResult<null>("관리자 로그인이 필요합니다.");

        const result = await deleteAdminReservation(id);
        if (result.ok) await refresh();
        return result;
      },
    }),
    [error, isAdmin, isPending, isReady, refresh, reservations],
  ) as UseReservationsResult<Reservation> | UseReservationsResult<ScheduleBlock>;
}
