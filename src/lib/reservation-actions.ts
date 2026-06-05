"use server";

import {
  validateReservationDraft,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
} from "@/lib/reservations";
import { validateReservationLookup, type ReservationLookup } from "@/lib/reservation-credentials";
import {
  GENERIC_MESSAGE,
  toReservationActionErrorMessage,
} from "@/lib/reservation-action-errors";
import * as reservationData from "@/lib/reservation-data";
import type { PublicReservationTimeBlock } from "@/lib/supabase/reservation-mappers";

export type ReservationActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function listPublicReservationTimeBlocks(
  date: string,
): Promise<ReservationActionResult<PublicReservationTimeBlock[]>> {
  try {
    return { ok: true, data: await reservationData.listPublicReservationTimeBlocks(date) };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function createPublicReservation(draft: ReservationDraft): Promise<ReservationActionResult<Reservation>> {
  const validationErrors = validateReservationDraft(draft);
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  try {
    return { ok: true, data: await reservationData.createPublicReservation(draft) };
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
    return { ok: true, data: await reservationData.listPublicReservationsByLookup(lookup) };
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
    return { ok: true, data: await reservationData.listAdminReservations(filters) };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}

export async function updateAdminReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<ReservationActionResult<null>> {
  try {
    await reservationData.updateAdminReservationStatus(id, status);
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: toReservationActionErrorMessage(error) };
  }
}

export async function deleteAdminReservation(id: string): Promise<ReservationActionResult<null>> {
  try {
    await reservationData.deleteAdminReservation(id);
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}
