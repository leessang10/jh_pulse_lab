import type { Reservation, ReservationStatus } from "./reservations";

export function canMutatePublicReservation(status: ReservationStatus) {
  return status !== "cancelled";
}

export function replaceReservationInList(reservations: Reservation[], updated: Reservation) {
  return reservations.map((reservation) => (reservation.id === updated.id ? updated : reservation));
}
