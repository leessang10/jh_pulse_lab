import {
  BOOKING_END_MINUTES,
  BOOKING_DURATION_OPTIONS,
  BOOKING_HOURS_MESSAGE,
  BOOKING_START_MINUTES,
  DAY_END_MINUTES,
  SLOT_MINUTES,
  formatMinutes,
  generateTimeSlots,
  type ReservationDraft,
  type ReservationTimeBlock,
} from "./reservations";
import { isBookingStartPastGracePeriod } from "./booking-time-policy";
import type { ScheduleBlock } from "./maintenance-blocks";

export const BOOKING_RANGE_CONFLICT_MESSAGE = "이미 예약된 시간이 포함되어 있습니다.";
export const BOOKING_DRAFT_CONFLICT_MESSAGE = "이미 예약된 시간입니다.";
export const BOOKING_PAST_TIME_MESSAGE = "현재 시간 이전은 예약할 수 없습니다.";
export const MAINTENANCE_CONFLICT_MESSAGE = "점검 시간에는 예약할 수 없습니다.";

type OccupancyBlock = ReservationTimeBlock | ScheduleBlock;

export type BookableRangeOption = {
  startMinutes: number;
  endMinutes: number;
  label: string;
};

export type SelectedBookingTime = BookableRangeOption;

export type BookingCurrentTime = {
  date: string;
  minutes: number;
};

export type BookingAvailability = {
  durationOptions: typeof BOOKING_DURATION_OPTIONS;
  rangeOptions: BookableRangeOption[];
};

function isWithinBookingHours(startMinutes: number, endMinutes: number) {
  return startMinutes >= BOOKING_START_MINUTES && endMinutes <= BOOKING_END_MINUTES;
}

export function findScheduleConflict(
  blocks: OccupancyBlock[],
  draft: Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">,
  ignoredReservationId?: string,
) {
  return (
    blocks.find((block) => {
      if (!isMaintenanceBlock(block) && block.id === ignoredReservationId) return false;
      if (!isMaintenanceBlock(block) && block.status === "cancelled") return false;
      if (block.date !== draft.date) return false;
      if (block.roomId !== draft.roomId) return false;

      return isTimeRangeOverlapping(draft, block);
    }) ?? null
  );
}

export const findReservationConflict = findScheduleConflict;

function isBookingDurationAvailable(
  reservations: OccupancyBlock[],
  options: {
    date: string;
    roomId: string;
    startMinutes: number;
    durationMinutes: number;
    currentTime?: BookingCurrentTime;
    ignoredReservationId?: string;
  },
) {
  const endMinutes = options.startMinutes + options.durationMinutes;
  if (options.startMinutes < 0 || endMinutes > DAY_END_MINUTES) return false;
  if (!isWithinBookingHours(options.startMinutes, endMinutes)) return false;
  if (isBookingStartPastGracePeriod(options.date, options.startMinutes, options.currentTime)) return false;

  return (
    findScheduleConflict(
      reservations,
      {
        date: options.date,
        roomId: options.roomId,
        startMinutes: options.startMinutes,
        endMinutes,
      },
      options.ignoredReservationId,
    ) === null
  );
}

function getBookingStartOptions(
  reservations: OccupancyBlock[],
  options: {
    date: string;
    roomId: string;
    durationMinutes: number;
    currentTime?: BookingCurrentTime;
    ignoredReservationId?: string;
  },
) {
  const startMinutesList = generateTimeSlots().map((slot) => slot.value);

  return startMinutesList.map((startMinutes) => {
    const endMinutes = startMinutes + options.durationMinutes;
    const selectedSlotMinutes = Array.from(
      { length: options.durationMinutes / SLOT_MINUTES },
      (_, index) => startMinutes + index * SLOT_MINUTES,
    );
    const isReservedSlot =
      startMinutes + SLOT_MINUTES <= DAY_END_MINUTES &&
      findScheduleConflict(
        reservations,
        {
          date: options.date,
          roomId: options.roomId,
          startMinutes,
          endMinutes: startMinutes + SLOT_MINUTES,
        },
        options.ignoredReservationId,
      ) !== null;
    const hasReservedSlotInRange = selectedSlotMinutes.some(
      (slotStartMinutes) =>
        slotStartMinutes + SLOT_MINUTES <= DAY_END_MINUTES &&
        findScheduleConflict(
          reservations,
          {
            date: options.date,
            roomId: options.roomId,
            startMinutes: slotStartMinutes,
            endMinutes: slotStartMinutes + SLOT_MINUTES,
          },
          options.ignoredReservationId,
        ) !== null,
    );
    const hasUnavailableSlotInRange = !isBookingDurationAvailable(reservations, {
      date: options.date,
      roomId: options.roomId,
      startMinutes,
      durationMinutes: options.durationMinutes,
      currentTime: options.currentTime,
      ignoredReservationId: options.ignoredReservationId,
    });

    return {
      startMinutes,
      endMinutes,
      label: formatMinutes(startMinutes),
      rangeLabel: `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`,
      selectedSlotMinutes,
      isReservedSlot,
      hasReservedSlotInRange,
      hasUnavailableSlotInRange,
      isAvailable: !hasUnavailableSlotInRange,
    };
  });
}

function getBookableRangeOptions(
  reservations: OccupancyBlock[],
  options: {
    date: string;
    roomId: string;
    durationMinutes: number;
    currentTime?: BookingCurrentTime;
    ignoredReservationId?: string;
  },
) {
  return getBookingStartOptions(reservations, options)
    .filter((option) => option.isAvailable)
    .map((option) => ({
      startMinutes: option.startMinutes,
      endMinutes: option.endMinutes,
      label: option.rangeLabel,
    }));
}

export function getBookingAvailability(
  reservations: OccupancyBlock[],
  options: {
    date: string;
    roomId: string;
    durationMinutes: number;
    currentTime?: BookingCurrentTime;
    ignoredReservationId?: string;
  },
): BookingAvailability {
  return {
    durationOptions: BOOKING_DURATION_OPTIONS,
    rangeOptions: getBookableRangeOptions(reservations, options),
  };
}

export function selectBookableRange(
  reservations: OccupancyBlock[],
  options: {
    date: string;
    roomId: string;
    option: BookableRangeOption;
    currentTime?: BookingCurrentTime;
    ignoredReservationId?: string;
  },
): { ok: true; selectedTime: SelectedBookingTime } | { ok: false; error: string } {
  if (!isWithinBookingHours(options.option.startMinutes, options.option.endMinutes)) {
    return { ok: false, error: BOOKING_HOURS_MESSAGE };
  }
  if (isBookingStartPastGracePeriod(options.date, options.option.startMinutes, options.currentTime)) {
    return { ok: false, error: BOOKING_PAST_TIME_MESSAGE };
  }

  const conflict = findScheduleConflict(
    reservations,
    {
      date: options.date,
      roomId: options.roomId,
      startMinutes: options.option.startMinutes,
      endMinutes: options.option.endMinutes,
    },
    options.ignoredReservationId,
  );

  if (conflict) {
    return {
      ok: false,
      error: isMaintenanceBlock(conflict)
        ? MAINTENANCE_CONFLICT_MESSAGE
        : BOOKING_RANGE_CONFLICT_MESSAGE,
    };
  }

  return {
    ok: true,
    selectedTime: {
      startMinutes: options.option.startMinutes,
      endMinutes: options.option.endMinutes,
      label: options.option.label,
    },
  };
}

export function validateBookableDraftTime(
  reservations: OccupancyBlock[],
  draft: Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">,
  ignoredReservationId?: string,
  currentTime?: BookingCurrentTime,
): { ok: true } | { ok: false; error: string } {
  if (!isWithinBookingHours(draft.startMinutes, draft.endMinutes)) {
    return { ok: false, error: BOOKING_HOURS_MESSAGE };
  }
  if (isBookingStartPastGracePeriod(draft.date, draft.startMinutes, currentTime)) {
    return { ok: false, error: BOOKING_PAST_TIME_MESSAGE };
  }

  const conflict = findScheduleConflict(reservations, draft, ignoredReservationId);

  if (conflict) {
    return {
      ok: false,
      error: isMaintenanceBlock(conflict)
        ? MAINTENANCE_CONFLICT_MESSAGE
        : BOOKING_DRAFT_CONFLICT_MESSAGE,
    };
  }

  return { ok: true };
}

export function getReservationsCoveringTimeBlock(
  reservations: OccupancyBlock[],
  options: {
    date: string;
    startMinutes: number;
    endMinutes: number;
  },
) {
  return reservations.filter((reservation) => {
    if (!isMaintenanceBlock(reservation) && reservation.status === "cancelled") return false;
    if (reservation.date !== options.date) return false;

    return isTimeRangeOverlapping(options, reservation);
  });
}

function isMaintenanceBlock(block: OccupancyBlock): block is Extract<ScheduleBlock, { kind: "maintenance" }> {
  return "kind" in block && block.kind === "maintenance";
}

function isTimeRangeOverlapping(
  first: Pick<ReservationDraft, "startMinutes" | "endMinutes">,
  second: Pick<ReservationDraft, "startMinutes" | "endMinutes">,
) {
  return first.startMinutes < second.endMinutes && second.startMinutes < first.endMinutes;
}
