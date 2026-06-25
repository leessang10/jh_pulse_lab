import { V2_DAY_END_MINUTES, V2_DAY_START_MINUTES, V2_SLOT_MINUTES } from "@/lib/v2-reservation-board";
import { ROOMS, formatMinutes, type Reservation, type Room } from "@/lib/reservations";

export type AdminTimetableTileState = "empty" | "reserved" | "cancelled";

export type AdminTimetableTile = {
  key: string;
  date: string;
  room: Room;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  state: AdminTimetableTileState;
  reservation?: Reservation;
};

export type AdminTimetableRow = {
  startMinutes: number;
  timeLabel: string;
  tiles: AdminTimetableTile[];
};

export function buildAdminTimetableRows(options: {
  date: string;
  reservations: Reservation[];
}): AdminTimetableRow[] {
  return Array.from({ length: (V2_DAY_END_MINUTES - V2_DAY_START_MINUTES) / V2_SLOT_MINUTES }, (_, index) => {
    const startMinutes = V2_DAY_START_MINUTES + index * V2_SLOT_MINUTES;

    return {
      startMinutes,
      timeLabel: formatMinutes(startMinutes),
      tiles: ROOMS.map((room) => buildAdminTimetableTile({ ...options, room, startMinutes })),
    };
  });
}

function buildAdminTimetableTile(options: {
  date: string;
  room: Room;
  startMinutes: number;
  reservations: Reservation[];
}): AdminTimetableTile {
  const endMinutes = options.startMinutes + V2_SLOT_MINUTES;
  const overlappingReservations = options.reservations.filter(
    (reservation) =>
      reservation.date === options.date &&
      reservation.roomId === options.room.id &&
      options.startMinutes < reservation.endMinutes &&
      reservation.startMinutes < endMinutes,
  );
  const reservation =
    overlappingReservations.find((candidate) => candidate.status !== "cancelled") ??
    overlappingReservations.find((candidate) => candidate.status === "cancelled");
  const state: AdminTimetableTileState = reservation
    ? reservation.status === "cancelled"
      ? "cancelled"
      : "reserved"
    : "empty";

  return {
    key: `${options.startMinutes}-${options.room.id}`,
    date: options.date,
    room: options.room,
    startMinutes: options.startMinutes,
    endMinutes,
    timeLabel: formatMinutes(options.startMinutes),
    state,
    reservation,
  };
}
