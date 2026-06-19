import type { BookingCurrentTime } from "@/lib/booking-availability";
import { findReservationConflict } from "@/lib/booking-availability";
import {
  ACTIVE_ROOM_IDS,
  BOOKING_DURATION_OPTIONS,
  ROOMS,
  SLOT_MINUTES,
  formatMinutes,
  type ReservationDraft,
  type ReservationTimeBlock,
  type Room,
} from "@/lib/reservations";

export const V2_DAY_START_MINUTES = 10 * 60;
export const V2_DAY_END_MINUTES = 22 * 60;
export const V2_SLOT_MINUTES = SLOT_MINUTES;

export const V2_TODAY_ONLY_MESSAGE = "오늘 예약만 가능합니다.";
export const V2_PAST_TIME_MESSAGE = "현재 시간 이후만 예약할 수 있습니다.";
export const V2_OPERATING_HOURS_MESSAGE = "운영시간은 10:00부터 22:00까지입니다.";
export const V2_DURATION_MESSAGE = "이용시간은 30분 또는 1시간만 가능합니다.";
export const V2_CONFLICT_MESSAGE = "이미 예약된 시간입니다.";

export type V2TileState = "past" | "available" | "reserved" | "unavailable";

export type V2BoardTile = {
  key: string;
  date: string;
  room: Room;
  startMinutes: number;
  endMinutes: number;
  timeLabel: string;
  state: V2TileState;
  reservation?: ReservationTimeBlock;
};

export type V2BoardRow = {
  startMinutes: number;
  timeLabel: string;
  tiles: V2BoardTile[];
};

export type V2DurationOption = {
  minutes: 30 | 60;
  label: string;
  available: boolean;
  reason?: string;
};

export function getV2VisibleSlots() {
  return Array.from({ length: (V2_DAY_END_MINUTES - V2_DAY_START_MINUTES) / V2_SLOT_MINUTES }, (_, index) => {
    const startMinutes = V2_DAY_START_MINUTES + index * V2_SLOT_MINUTES;

    return { startMinutes, label: formatMinutes(startMinutes) };
  });
}

export function buildV2BoardRows(options: {
  date: string;
  reservations: ReservationTimeBlock[];
  currentTime: BookingCurrentTime;
}): V2BoardRow[] {
  return getV2VisibleSlots().map((slot) => ({
    startMinutes: slot.startMinutes,
    timeLabel: slot.label,
    tiles: ROOMS.map((room) => buildV2BoardTile({ ...options, room, startMinutes: slot.startMinutes })),
  }));
}

export function getV2DurationOptionsForTile(
  tile: Pick<V2BoardTile, "date" | "room" | "startMinutes">,
  reservations: ReservationTimeBlock[],
  currentTime: BookingCurrentTime,
): V2DurationOption[] {
  return BOOKING_DURATION_OPTIONS.map((option) => {
    const minutes = option.minutes as 30 | 60;
    const validation = validateV2ReservationTime(
      {
        date: tile.date,
        roomId: tile.room.id,
        startMinutes: tile.startMinutes,
        endMinutes: tile.startMinutes + minutes,
      },
      reservations,
      currentTime,
    );

    return validation.ok
      ? { minutes, label: option.label, available: true }
      : { minutes, label: option.label, available: false, reason: validation.error };
  });
}

export function validateV2ReservationDraft(
  draft: ReservationDraft,
  reservations: ReservationTimeBlock[],
  currentTime: BookingCurrentTime,
): { ok: true } | { ok: false; error: string } {
  if (!draft.name.trim()) return { ok: false, error: "예약자 이름을 입력해 주세요." };
  if (!/^\d{4}$/.test(draft.password)) return { ok: false, error: "비밀번호는 숫자 4자리로 입력해 주세요." };

  return validateV2ReservationTime(draft, reservations, currentTime);
}

export function validateV2ReservationTime(
  draft: Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">,
  reservations: ReservationTimeBlock[],
  currentTime: BookingCurrentTime,
): { ok: true } | { ok: false; error: string } {
  const duration = draft.endMinutes - draft.startMinutes;

  if (draft.date !== currentTime.date) return { ok: false, error: V2_TODAY_ONLY_MESSAGE };
  if (!ACTIVE_ROOM_IDS.includes(draft.roomId)) return { ok: false, error: "연습실을 선택해 주세요." };
  if (draft.startMinutes % V2_SLOT_MINUTES !== 0 || draft.endMinutes % V2_SLOT_MINUTES !== 0) {
    return { ok: false, error: "시작 시간과 종료 시간은 30분 단위여야 합니다." };
  }
  if (duration !== 30 && duration !== 60) return { ok: false, error: V2_DURATION_MESSAGE };
  if (draft.startMinutes < V2_DAY_START_MINUTES || draft.endMinutes > V2_DAY_END_MINUTES) {
    return { ok: false, error: V2_OPERATING_HOURS_MESSAGE };
  }
  if (isV2PastStart(draft.date, draft.startMinutes, currentTime)) return { ok: false, error: V2_PAST_TIME_MESSAGE };
  if (findReservationConflict(reservations, draft)) return { ok: false, error: V2_CONFLICT_MESSAGE };

  return { ok: true };
}

export function getV2ReservationRangeLabel(startMinutes: number, endMinutes: number) {
  return `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`;
}

function buildV2BoardTile(options: {
  date: string;
  room: Room;
  startMinutes: number;
  reservations: ReservationTimeBlock[];
  currentTime: BookingCurrentTime;
}): V2BoardTile {
  const endMinutes = options.startMinutes + V2_SLOT_MINUTES;
  const reservation = options.reservations.find(
    (candidate) =>
      candidate.date === options.date &&
      candidate.roomId === options.room.id &&
      candidate.status !== "cancelled" &&
      options.startMinutes < candidate.endMinutes &&
      candidate.startMinutes < endMinutes,
  );

  const state: V2TileState = reservation
    ? "reserved"
    : isV2PastStart(options.date, options.startMinutes, options.currentTime)
      ? "past"
      : "available";

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

function isV2PastStart(date: string, startMinutes: number, currentTime: BookingCurrentTime) {
  if (date < currentTime.date) return true;
  if (date > currentTime.date) return false;

  return startMinutes <= currentTime.minutes;
}
