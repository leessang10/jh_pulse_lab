import type { Reservation, ReservationStatus } from "./reservations";

export function canMutatePublicReservation(status: ReservationStatus) {
  return status !== "cancelled";
}

export function replaceReservationInList(reservations: Reservation[], updated: Reservation) {
  return reservations.map((reservation) => (reservation.id === updated.id ? updated : reservation));
}

function formatReservationDateLabel(date: string) {
  const [year, month, day] = date.split("-");
  return `${year}.${month}.${day}`;
}

function formatReservationStartTimeLabel(startMinutes: number) {
  const hours = Math.floor(startMinutes / 60);
  const minutes = startMinutes % 60;
  const period = hours < 12 ? "오전" : "오후";
  const displayHours = hours % 12 || 12;

  return `${period} ${displayHours}:${String(minutes).padStart(2, "0")}`;
}

export function formatReservationCancellationMessage(reservation: Reservation) {
  return `${formatReservationDateLabel(reservation.date)} ${formatReservationStartTimeLabel(
    reservation.startMinutes,
  )} 예약이 취소되었습니다.`;
}
