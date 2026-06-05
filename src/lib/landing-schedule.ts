import {
  DAY_END_MINUTES,
  SLOT_MINUTES,
  formatMinutes,
  getRoomName,
  type ReservationTimeBlock,
} from "./reservations";
import { getReservationsCoveringTimeBlock } from "./booking-availability";

export type LandingScheduleSlot = {
  index: number;
  startMinutes: number;
  endMinutes: number;
  label: string;
  rangeLabel: string;
  isBooked: boolean;
  bookedByLabel: string;
  reservationCount: number;
  reservations: ReservationTimeBlock[];
};

function getReservationName(reservation: ReservationTimeBlock) {
  return reservation.name.trim() || "예약자";
}

function getBookedByLabel(reservations: ReservationTimeBlock[]) {
  if (reservations.length === 0) return "비어 있어요";
  if (reservations.length === 1) {
    const reservation = reservations[0];

    return `${getReservationName(reservation)}님 · ${getRoomName(reservation.roomId)}`;
  }

  return `${getReservationName(reservations[0])}님 외 ${reservations.length - 1}명`;
}

export function getLandingScheduleSlots(reservations: ReservationTimeBlock[], date: string): LandingScheduleSlot[] {
  return Array.from({ length: DAY_END_MINUTES / SLOT_MINUTES }, (_, index) => {
    const startMinutes = index * SLOT_MINUTES;
    const endMinutes = startMinutes + SLOT_MINUTES;
    const slotReservations = getReservationsCoveringTimeBlock(reservations, { date, startMinutes, endMinutes });

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
