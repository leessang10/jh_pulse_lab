import {
  BOOKING_END_MINUTES,
  BOOKING_START_MINUTES,
  ROOMS,
  SLOT_MINUTES,
  formatMinutes,
  type Reservation,
  type Room,
} from "@/lib/reservations";
import type { MaintenanceBlock } from "@/lib/maintenance-blocks";
import { dateToKoreaValue, formatKoreaDate } from "@/lib/korea-date";

export type AdminTimetableTileState = "empty" | "reserved" | "cancelled" | "maintenance";

export type AdminTimetableTile = {
  key: string;
  date: string;
  room: Room;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  state: AdminTimetableTileState;
  reservation?: Reservation;
  maintenanceBlock?: MaintenanceBlock;
};

export type AdminTimetableRow = {
  startMinutes: number;
  timeLabel: string;
  tiles: AdminTimetableTile[];
};

export function getAdminTimetableDateChange(currentDate: string, nextDate: Date | undefined) {
  if (!nextDate) return null;

  const date = dateToKoreaValue(nextDate);
  if (date === currentDate) return null;

  return {
    date,
    message: `${formatKoreaDate(date)} 시간표로 변경했습니다.`,
  };
}

export function getAdminMaintenanceTimeOptions() {
  const startOptions = Array.from(
    { length: (BOOKING_END_MINUTES - BOOKING_START_MINUTES) / SLOT_MINUTES },
    (_, index) => {
      const value = BOOKING_START_MINUTES + index * SLOT_MINUTES;

      return { value, label: formatMinutes(value) };
    },
  );

  return {
    startOptions,
    endOptions: startOptions.map((option) => option.value + SLOT_MINUTES),
  };
}

export function buildAdminTimetableRows(options: {
  date: string;
  reservations: Reservation[];
  maintenanceBlocks?: MaintenanceBlock[];
}): AdminTimetableRow[] {
  return Array.from({ length: (BOOKING_END_MINUTES - BOOKING_START_MINUTES) / SLOT_MINUTES }, (_, index) => {
    const startMinutes = BOOKING_START_MINUTES + index * SLOT_MINUTES;

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
  maintenanceBlocks?: MaintenanceBlock[];
}): AdminTimetableTile {
  const endMinutes = options.startMinutes + SLOT_MINUTES;
  const maintenanceBlock = options.maintenanceBlocks?.find(
    (block) =>
      block.date === options.date &&
      block.roomId === options.room.id &&
      options.startMinutes < block.endMinutes &&
      block.startMinutes < endMinutes,
  );
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
  const state: AdminTimetableTileState = maintenanceBlock
    ? "maintenance"
    : reservation
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
    reservation: maintenanceBlock ? undefined : reservation,
    maintenanceBlock,
  };
}
