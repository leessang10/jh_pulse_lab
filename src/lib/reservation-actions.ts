"use server";

import { revalidatePath } from "next/cache";
import {
  findReservationConflict,
  validateReservationDraft,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
} from "@/lib/reservations";
import {
  hashReservationPassword,
  validateReservationLookup,
  type ReservationLookup,
} from "@/lib/reservation-credentials";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  mapReservationDraftToInsert,
  mapReservationRowToReservation,
  mapReservationRowToTimeBlock,
  type PublicReservationTimeBlock,
  type ReservationRow,
} from "@/lib/supabase/reservation-mappers";

export type ReservationActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

const CONFLICT_MESSAGE = "이미 예약된 시간입니다.";
const GENERIC_MESSAGE = "예약 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";
const RESERVATION_SELECT = "id,date,room_id,start_minutes,end_minutes,status,created_at,updated_at,name,phone,note";

function toActionError(error: unknown) {
  if (error instanceof Error && error.message.includes("conflicts")) return CONFLICT_MESSAGE;
  return GENERIC_MESSAGE;
}

function toConflictReservation(block: PublicReservationTimeBlock): Reservation {
  return {
    ...block,
    name: "",
    phone: "",
  };
}

export async function listPublicReservationTimeBlocks(
  date: string,
): Promise<ReservationActionResult<PublicReservationTimeBlock[]>> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select(RESERVATION_SELECT)
      .eq("date", date)
      .neq("status", "cancelled")
      .order("start_minutes", { ascending: true });

    if (error) throw error;

    return { ok: true, data: ((data ?? []) as ReservationRow[]).map(mapReservationRowToTimeBlock) };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}

export async function createPublicReservation(draft: ReservationDraft): Promise<ReservationActionResult<Reservation>> {
  const validationErrors = validateReservationDraft(draft);
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  try {
    const supabase = createSupabaseServiceClient();
    const current = await listPublicReservationTimeBlocks(draft.date);
    if (!current.ok) return current;

    const conflict = findReservationConflict(current.data.map(toConflictReservation), draft);
    if (conflict) return { ok: false, error: CONFLICT_MESSAGE };

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
    return { ok: true, data: mapReservationRowToReservation(data as ReservationRow) };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
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
      .eq("phone", lookup.phone.trim())
      .eq("password_hash", hashReservationPassword(lookup.password))
      .order("date", { ascending: false })
      .order("start_minutes", { ascending: true });

    if (error) throw error;

    return { ok: true, data: ((data ?? []) as ReservationRow[]).map(mapReservationRowToReservation) };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
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
      .order("start_minutes", { ascending: true });

    if (filters.roomId) query = query.eq("room_id", filters.roomId);
    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;

    return { ok: true, data: ((data ?? []) as ReservationRow[]).map(mapReservationRowToReservation) };
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
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
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
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}
