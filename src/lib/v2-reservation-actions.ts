"use server";

import type { BookingCurrentTime } from "@/lib/booking-availability";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import { validateReservationLookup } from "@/lib/reservation-credentials";
import {
  cancelPublicReservation,
  createPublicReservation,
  listPublicReservationTimeBlocks,
  type ReservationActionResult,
} from "@/lib/reservation-actions";
import type { Reservation, ReservationDraft } from "@/lib/reservations";
import { validateV2ReservationDraft } from "@/lib/v2-reservation-board";

const V2_RESERVATION_NOT_FOUND_MESSAGE = "예약 정보를 찾을 수 없습니다.";

export async function createV2PublicReservation(
  draft: ReservationDraft,
  currentTime: BookingCurrentTime = getCurrentKoreaBookingTime(),
): Promise<ReservationActionResult<Reservation>> {
  const earlyValidation = validateV2ReservationDraft(draft, [], currentTime);
  if (!earlyValidation.ok) return earlyValidation;

  const current = await listPublicReservationTimeBlocks(currentTime.date);
  if (!current.ok) return current;

  const validation = validateV2ReservationDraft(draft, current.data, currentTime);
  if (!validation.ok) return validation;

  return createPublicReservation(draft);
}

export async function cancelV2PublicReservation(input: {
  reservationId: string;
  name: string;
  password: string;
}): Promise<ReservationActionResult<Reservation>> {
  if (!input.reservationId) return { ok: false, error: V2_RESERVATION_NOT_FOUND_MESSAGE };

  const validationErrors = validateReservationLookup({ name: input.name, password: input.password });
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  return cancelPublicReservation(input.reservationId, {
    name: input.name,
    password: input.password,
  });
}
