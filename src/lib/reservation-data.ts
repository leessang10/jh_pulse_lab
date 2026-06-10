import { revalidatePath } from "next/cache";
import { findReservationConflict } from "@/lib/booking-availability";
import {
  RESERVATION_REVALIDATION_PATHS,
  revalidateReservationPaths as revalidateReservationPathPolicy,
} from "@/lib/reservation-data-policy";
import { hashReservationPassword, type ReservationLookup } from "@/lib/reservation-credentials";
import type { Reservation, ReservationDraft, ReservationStatus } from "@/lib/reservations";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  mapReservationDraftToInsert,
  mapReservationRowToReservation,
  mapReservationRowToTimeBlock,
  type PublicReservationTimeBlock,
  type ReservationRow,
} from "@/lib/supabase/reservation-mappers";

export const RESERVATION_SELECT = "id,date,room_id,start_minutes,end_minutes,status,created_at,updated_at,name,note";
export { RESERVATION_REVALIDATION_PATHS };

const RESERVATION_CONFLICT_ERROR_MESSAGE = "reservation time conflicts with an existing reservation";

export function revalidateReservationPaths(revalidate = revalidatePath) {
  revalidateReservationPathPolicy(revalidate);
}

export async function listPublicReservationTimeBlocks(date: string): Promise<PublicReservationTimeBlock[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("date", date)
    .neq("status", "cancelled")
    .order("start_minutes", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as ReservationRow[]).map(mapReservationRowToTimeBlock);
}

export async function createPublicReservation(draft: ReservationDraft): Promise<Reservation> {
  const supabase = createSupabaseServiceClient();
  const current = await listPublicReservationTimeBlocks(draft.date);
  const conflict = findReservationConflict(current, draft);

  if (conflict) throw new Error(RESERVATION_CONFLICT_ERROR_MESSAGE);

  const { data, error } = await supabase
    .from("reservations")
    .insert(mapReservationDraftToInsert(draft))
    .select(RESERVATION_SELECT)
    .single();

  if (error) throw error;

  revalidateReservationPaths();
  return mapReservationRowToReservation(data as ReservationRow);
}

export async function listPublicReservationsByLookup(lookup: ReservationLookup): Promise<Reservation[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from("reservations")
    .select(RESERVATION_SELECT)
    .eq("name", lookup.name.trim())
    .eq("password_hash", hashReservationPassword(lookup.password))
    .order("date", { ascending: false })
    .order("start_minutes", { ascending: true });

  if (error) throw error;

  return ((data ?? []) as ReservationRow[]).map(mapReservationRowToReservation);
}

export async function listAdminReservations(filters: {
  date: string;
  roomId?: string;
  status?: ReservationStatus;
}): Promise<Reservation[]> {
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

  return ((data ?? []) as ReservationRow[]).map(mapReservationRowToReservation);
}

export async function updateAdminReservationStatus(id: string, status: ReservationStatus): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
  if (error) throw error;

  revalidateReservationPaths();
}

export async function deleteAdminReservation(id: string): Promise<void> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.from("reservations").delete().eq("id", id);
  if (error) throw error;

  revalidateReservationPaths();
}
