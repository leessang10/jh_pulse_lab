import {
  DAY_END_MINUTES,
  ROOMS,
  SLOT_MINUTES,
  formatMinutes,
  getRoomName,
  type ReservationTimeBlock,
} from "./reservations";
import { findReservationConflict } from "./booking-availability";
import { LANDING_RESERVATION_SEGMENT_COLOR_TOKENS } from "./visual-tokens";
import type { ScheduleBlock } from "./maintenance-blocks";

type LandingBlock = ReservationTimeBlock | ScheduleBlock;

export type LandingScheduleSlot = {
  index: number;
  startMinutes: number;
  endMinutes: number;
  label: string;
  rangeLabel: string;
  isBooked: boolean;
  bookedByLabel: string;
  reservationCount: number;
  reservations: LandingBlock[];
};

export type LandingRoomScheduleSummary = {
  roomId: string;
  roomName: string;
  totalSlotCount: number;
  bookedSlotCount: number;
  bookedMinutes: number;
  bookedHourLabel: string;
  bookedDurationLabel: string;
  reservationSegments: LandingReservationSegment[];
  bookedPercent: number;
  nextBookedSlot: LandingScheduleSlot | null;
  slots: LandingScheduleSlot[];
};

export type LandingReservationSegment = {
  reservationId: string;
  startMinutes: number;
  endMinutes: number;
  nameLabel: string;
  rangeLabel: string;
  color: string;
};

export const LANDING_RESERVATION_SEGMENT_COLORS = LANDING_RESERVATION_SEGMENT_COLOR_TOKENS;

function isMaintenanceBlock(block: LandingBlock): block is Extract<ScheduleBlock, { kind: "maintenance" }> {
  return "kind" in block && block.kind === "maintenance";
}

function isActiveBlock(block: LandingBlock) {
  return isMaintenanceBlock(block) || block.status !== "cancelled";
}

function getBlockName(block: LandingBlock) {
  return isMaintenanceBlock(block) ? "점검" : block.name.trim() || "예약자";
}

function getBookedByLabel(blocks: LandingBlock[]) {
  if (blocks.length === 0) return "비어 있어요";
  if (blocks.length === 1) {
    const block = blocks[0];

    return isMaintenanceBlock(block)
      ? `점검 · ${getRoomName(block.roomId)}`
      : `${getBlockName(block)}님 · ${getRoomName(block.roomId)}`;
  }

  const suffix = isMaintenanceBlock(blocks[0]) ? "" : "님";
  return `${getBlockName(blocks[0])}${suffix} 외 ${blocks.length - 1}명`;
}

function formatBookedHourLabel(minutes: number) {
  const hours = minutes / 60;

  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

function formatBookedDurationLabel(minutes: number) {
  if (minutes === 0) return "0시간";

  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  const parts: string[] = [];

  if (hours > 0) parts.push(`${hours}시간`);
  if (remainingMinutes > 0) parts.push(`${remainingMinutes}분`);

  return parts.join(" ");
}

function getLandingReservationSegments(
  reservations: LandingBlock[],
  date: string,
  roomId: string,
): LandingReservationSegment[] {
  return reservations
    .filter((reservation) => isActiveBlock(reservation) && reservation.date === date && reservation.roomId === roomId)
    .sort((a, b) => a.startMinutes - b.startMinutes || a.endMinutes - b.endMinutes || a.id.localeCompare(b.id))
    .map((reservation, index) => {
      const nameLabel = getBlockName(reservation);

      return {
        reservationId: reservation.id,
        startMinutes: reservation.startMinutes,
        endMinutes: reservation.endMinutes,
        nameLabel,
        rangeLabel: `${formatMinutes(reservation.startMinutes)}-${formatMinutes(reservation.endMinutes)}`,
        color: LANDING_RESERVATION_SEGMENT_COLORS[index % LANDING_RESERVATION_SEGMENT_COLORS.length],
      };
    });
}

export function getLandingScheduleSlots(
  reservations: LandingBlock[],
  date: string,
  options: { roomId?: string } = {},
): LandingScheduleSlot[] {
  return Array.from({ length: DAY_END_MINUTES / SLOT_MINUTES }, (_, index) => {
    const startMinutes = index * SLOT_MINUTES;
    const endMinutes = startMinutes + SLOT_MINUTES;
    const slotReservations = reservations.filter(
      (reservation) =>
        isActiveBlock(reservation) &&
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
  reservations: LandingBlock[],
  date: string,
): LandingRoomScheduleSummary[] {
  return ROOMS.map((room) => {
    const slots = getLandingScheduleSlots(reservations, date, { roomId: room.id });
    const bookedSlots = slots.filter((slot) => slot.isBooked);
    const bookedMinutes = bookedSlots.length * SLOT_MINUTES;
    const reservationSegments = getLandingReservationSegments(reservations, date, room.id);

    return {
      roomId: room.id,
      roomName: room.name,
      totalSlotCount: slots.length,
      bookedSlotCount: bookedSlots.length,
      bookedMinutes,
      bookedHourLabel: formatBookedHourLabel(bookedMinutes),
      bookedDurationLabel: formatBookedDurationLabel(bookedMinutes),
      reservationSegments,
      bookedPercent: Math.round((bookedSlots.length / slots.length) * 100),
      nextBookedSlot: bookedSlots[0] ?? null,
      slots,
    };
  });
}
