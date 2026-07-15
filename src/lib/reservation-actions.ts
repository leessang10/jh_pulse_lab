"use server";

import { revalidatePath } from "next/cache";
import { validateBookableDraftTime } from "@/lib/booking-availability";
import {
  validateReservationDraft,
  resolveReservationStatuses,
  validateReservationOwnerBookingWindow,
  validateReservationTimeChange,
  ACTIVE_ROOM_IDS,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
  type ReservationTimeBlock,
  type ReservationTimeChange,
} from "@/lib/reservations";
import {
  hashReservationPassword,
  validateReservationLookup,
  type ReservationLookup,
} from "@/lib/reservation-credentials";
import {
  GENERIC_MESSAGE,
  toReservationActionErrorMessage,
} from "@/lib/reservation-action-errors";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  mapReservationDraftToInsert,
  mapReservationRowToReservation,
  mapReservationRowToScheduleBlock,
  mapReservationRowToTimeBlock,
  type ReservationRow,
} from "@/lib/supabase/reservation-mappers";
import {
  mapMaintenanceRowToBlock,
  type MaintenanceRow,
} from "@/lib/supabase/maintenance-mappers";
import type { ScheduleBlock } from "@/lib/maintenance-blocks";

export type ReservationActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const RESERVATION_SELECT = "id,date,room_id,start_minutes,end_minutes,status,created_at,updated_at,name,note";
const MAINTENANCE_SELECT = "id,date,room_id,start_minutes,end_minutes,created_by,created_at";
const OWNER_RESERVATION_NOT_FOUND_MESSAGE = "예약 정보를 찾을 수 없습니다.";

export async function listPublicScheduleBlocks(
  date: string,
): Promise<ReservationActionResult<ScheduleBlock[]>> {
  try {
    const supabase = createSupabaseServiceClient();
    const [reservationsResult, maintenanceResult] = await Promise.all([
      supabase
        .from("reservations")
        .select(RESERVATION_SELECT)
        .eq("date", date)
        .in("room_id", ACTIVE_ROOM_IDS)
        .neq("status", "cancelled")
        .order("start_minutes", { ascending: true }),
      supabase
        .from("maintenance_blocks")
        .select(MAINTENANCE_SELECT)
        .eq("date", date)
        .in("room_id", ACTIVE_ROOM_IDS)
        .order("start_minutes", { ascending: true }),
    ]);

    if (reservationsResult.error) throw reservationsResult.error;
    if (maintenanceResult.error) throw maintenanceResult.error;

    const reservations = ((reservationsResult.data ?? []) as ReservationRow[])
      .map(mapReservationRowToScheduleBlock);
    const maintenance = ((maintenanceResult.data ?? []) as MaintenanceRow[])
      .map((row) => ({ kind: "maintenance" as const, ...mapMaintenanceRowToBlock(row) }));

    return {
      ok: true,
      data: [...reservations, ...maintenance].sort(
        (left, right) =>
          left.startMinutes - right.startMinutes || left.roomId.localeCompare(right.roomId),
      ),
    };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function createPublicReservation(draft: ReservationDraft): Promise<ReservationActionResult<Reservation>> {
  const validationErrors = validateReservationDraft(draft);
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  try {
    const supabase = createSupabaseServiceClient();
    const currentTime = getCurrentKoreaBookingTime();
    const ownerReservations = await listOwnerActiveReservations(draft, currentTime.date);
    if (!ownerReservations.ok) return ownerReservations;

    const ownerBookingWindow = validateReservationOwnerBookingWindow(ownerReservations.data, currentTime);
    if (!ownerBookingWindow.ok) return ownerBookingWindow;

    const current = await listPublicScheduleBlocks(draft.date);
    if (!current.ok) return current;

    const timeAvailability = validateBookableDraftTime(current.data, draft, undefined, currentTime);
    if (!timeAvailability.ok) return timeAvailability;

    const { data, error } = await supabase
      .from("reservations")
      .insert(mapReservationDraftToInsert(draft))
      .select(RESERVATION_SELECT)
      .single();

    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/reservation");
    revalidatePath("/reservations");
    revalidatePath("/admin");
    revalidatePath("/v2");
    return { ok: true, data: mapReservationRowToReservation(data as ReservationRow) };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

async function listOwnerActiveReservations(
  draft: Pick<ReservationDraft, "name" | "password">,
  currentDate: string,
): Promise<ReservationActionResult<ReservationTimeBlock[]>> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(RESERVATION_SELECT)
      .eq("name", draft.name.trim())
      .eq("password_hash", hashReservationPassword(draft.password))
      .gte("date", currentDate)
      .in("room_id", ACTIVE_ROOM_IDS)
      .neq("status", "cancelled")
      .order("date", { ascending: true })
      .order("start_minutes", { ascending: true });

    if (error) throw error;

    return { ok: true, data: ((data ?? []) as ReservationRow[]).map(mapReservationRowToTimeBlock) };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function listPublicReservationsByLookup(
  lookup: ReservationLookup,
): Promise<ReservationActionResult<Reservation[]>> {
  const validationErrors = validateReservationLookup(lookup);
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(RESERVATION_SELECT)
      .eq("name", lookup.name.trim())
      .eq("password_hash", hashReservationPassword(lookup.password))
      .in("room_id", ACTIVE_ROOM_IDS)
      .neq("status", "cancelled")
      .order("date", { ascending: false })
      .order("start_minutes", { ascending: true });

    if (error) throw error;

    return { ok: true, data: ((data ?? []) as ReservationRow[]).map(mapReservationRowToReservation) };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function cancelPublicReservation(
  reservationId: string,
  lookup: ReservationLookup,
): Promise<ReservationActionResult<Reservation>> {
  if (!reservationId) return { ok: false, error: OWNER_RESERVATION_NOT_FOUND_MESSAGE };

  const validationErrors = validateReservationLookup(lookup);
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .update({ status: "cancelled" })
      .eq("id", reservationId)
      .eq("name", lookup.name.trim())
      .eq("password_hash", hashReservationPassword(lookup.password))
      .in("room_id", ACTIVE_ROOM_IDS)
      .neq("status", "cancelled")
      .select(RESERVATION_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, error: OWNER_RESERVATION_NOT_FOUND_MESSAGE };

    revalidatePath("/");
    revalidatePath("/reservation");
    revalidatePath("/reservations");
    revalidatePath("/admin");
    revalidatePath("/v2");
    return { ok: true, data: mapReservationRowToReservation(data as ReservationRow) };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function updatePublicReservationTime(
  reservationId: string,
  lookup: ReservationLookup,
  change: ReservationTimeChange,
): Promise<ReservationActionResult<Reservation>> {
  if (!reservationId) return { ok: false, error: OWNER_RESERVATION_NOT_FOUND_MESSAGE };

  const lookupErrors = validateReservationLookup(lookup);
  if (lookupErrors.length > 0) return { ok: false, error: lookupErrors[0] };

  const timeErrors = validateReservationTimeChange(change);
  if (timeErrors.length > 0) return { ok: false, error: timeErrors[0] };

  try {
    const supabase = createSupabaseServiceClient();
    const current = await listPublicScheduleBlocks(change.date);
    if (!current.ok) return current;

    const timeAvailability = validateBookableDraftTime(current.data, change, reservationId, getCurrentKoreaBookingTime());
    if (!timeAvailability.ok) return timeAvailability;

    const { data, error } = await supabase
      .from("reservations")
      .update({
        date: change.date,
        room_id: change.roomId,
        start_minutes: change.startMinutes,
        end_minutes: change.endMinutes,
        status: "pending",
      })
      .eq("id", reservationId)
      .eq("name", lookup.name.trim())
      .eq("password_hash", hashReservationPassword(lookup.password))
      .in("room_id", ACTIVE_ROOM_IDS)
      .neq("status", "cancelled")
      .select(RESERVATION_SELECT)
      .maybeSingle();

    if (error) throw error;
    if (!data) return { ok: false, error: OWNER_RESERVATION_NOT_FOUND_MESSAGE };

    revalidatePath("/");
    revalidatePath("/reservation");
    revalidatePath("/reservations");
    revalidatePath("/admin");
    revalidatePath("/v2");
    return { ok: true, data: mapReservationRowToReservation(data as ReservationRow) };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function listAdminReservations(filters: {
  date: string;
  roomId?: string;
  status?: ReservationStatus;
}): Promise<ReservationActionResult<Reservation[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("reservations")
      .select(RESERVATION_SELECT)
      .eq("date", filters.date)
      .in("room_id", ACTIVE_ROOM_IDS)
      .order("start_minutes", { ascending: true });

    if (filters.roomId) query = query.eq("room_id", filters.roomId);

    const { data, error } = await query;
    if (error) throw error;

    const currentTime = getCurrentKoreaBookingTime();
    const reservations = resolveReservationStatuses(
      ((data ?? []) as ReservationRow[]).map(mapReservationRowToReservation),
      currentTime,
      filters.status,
    );

    return { ok: true, data: reservations };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}

export async function updateAdminReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<ReservationActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/reservation");
    revalidatePath("/reservations");
    revalidatePath("/admin");
    revalidatePath("/v2");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function deleteAdminReservation(id: string): Promise<ReservationActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/reservation");
    revalidatePath("/reservations");
    revalidatePath("/admin");
    revalidatePath("/v2");
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}
