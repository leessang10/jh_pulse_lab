import {
  DAY_END_MINUTES,
  ROOMS,
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

export type LandingRoomScheduleSummary = {
  roomId: string;
  roomName: string;
  totalSlotCount: number;
  bookedSlotCount: number;
  bookedPercent: number;
  nextBookedSlot: LandingScheduleSlot | null;
  slots: LandingScheduleSlot[];
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

export function getLandingScheduleSlots(
  reservations: Reservation[],
  date: string,
  options: { roomId?: string } = {},
): LandingScheduleSlot[] {
  return Array.from({ length: DAY_END_MINUTES / SLOT_MINUTES }, (_, index) => {
    const startMinutes = index * SLOT_MINUTES;
    const endMinutes = startMinutes + SLOT_MINUTES;
    const slotReservations = reservations.filter(
      (reservation) =>
        reservation.status !== "cancelled" &&
        (!options.roomId || reservation.roomId === options.roomId) &&
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

export function getLandingRoomScheduleSummaries(
  reservations: Reservation[],
  date: string,
): LandingRoomScheduleSummary[] {
  return ROOMS.map((room) => {
    const slots = getLandingScheduleSlots(reservations, date, { roomId: room.id });
    const bookedSlots = slots.filter((slot) => slot.isBooked);

    return {
      roomId: room.id,
      roomName: room.name,
      totalSlotCount: slots.length,
      bookedSlotCount: bookedSlots.length,
      bookedPercent: Math.round((bookedSlots.length / slots.length) * 100),
      nextBookedSlot: bookedSlots[0] ?? null,
      slots,
    };
  });
}
