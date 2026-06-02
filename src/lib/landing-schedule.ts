import {
  DAY_END_MINUTES,
  SLOT_MINUTES,
  findReservationConflict,
  formatMinutes,
  getRoomName,
  type Reservation,
} from "./reservations";

export type LandingScheduleSlot = {
  index: number;
  startMinutes: number;
  endMinutes: number;
  label: string;
  rangeLabel: string;
  isBooked: boolean;
  bookedByLabel: string;
  reservationCount: number;
  reservations: Reservation[];
};

function getReservationName(reservation: Reservation) {
  return reservation.name.trim() || "예약자";
}

function getBookedByLabel(reservations: Reservation[]) {
  if (reservations.length === 0) return "비어 있어요";
  if (reservations.length === 1) {
    const reservation = reservations[0];

    return `${getReservationName(reservation)}님 · ${getRoomName(reservation.roomId)}`;
  }

  return `${getReservationName(reservations[0])}님 외 ${reservations.length - 1}명`;
}

export function getLandingScheduleSlots(reservations: Reservation[], date: string): LandingScheduleSlot[] {
  return Array.from({ length: DAY_END_MINUTES / SLOT_MINUTES }, (_, index) => {
    const startMinutes = index * SLOT_MINUTES;
    const endMinutes = startMinutes + SLOT_MINUTES;
    const slotReservations = reservations.filter(
      (reservation) =>
        reservation.status !== "cancelled" &&
        findReservationConflict(
          [reservation],
          {
            date,
            roomId: reservation.roomId,
            startMinutes,
            endMinutes,
          },
          undefined,
        ) !== null,
    );

    return {
      index,
      startMinutes,
      endMinutes,
      label: formatMinutes(startMinutes),
      rangeLabel: `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`,
      isBooked: slotReservations.length > 0,
      bookedByLabel: getBookedByLabel(slotReservations),
      reservationCount: slotReservations.length,
      reservations: slotReservations,
    };
  });
}
