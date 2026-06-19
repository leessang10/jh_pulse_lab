import {
  BOOKING_DURATION_OPTIONS,
  DAY_END_MINUTES,
  SLOT_MINUTES,
  formatMinutes,
  generateTimeSlots,
  type ReservationDraft,
  type ReservationTimeBlock,
} from "./reservations";

export const BOOKING_RANGE_CONFLICT_MESSAGE = "이미 예약된 시간이 포함되어 있습니다.";
export const BOOKING_DRAFT_CONFLICT_MESSAGE = "이미 예약된 시간입니다.";
export const BOOKING_PAST_TIME_MESSAGE = "현재 시간 이전은 예약할 수 없습니다.";

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

export function findReservationConflict(
  reservations: ReservationTimeBlock[],
  draft: Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">,
  ignoredReservationId?: string,
) {
  return (
    reservations.find((reservation) => {
      if (reservation.id === ignoredReservationId) return false;
      if (reservation.status === "cancelled") return false;
      if (reservation.date !== draft.date) return false;
      if (reservation.roomId !== draft.roomId) return false;

      return isTimeRangeOverlapping(draft, reservation);
    }) ?? null
  );
}

function isBookingDurationAvailable(
  reservations: ReservationTimeBlock[],
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
  if (isBookingStartNotAfterCurrentTime(options.date, options.startMinutes, options.currentTime)) return false;

  return (
    findReservationConflict(
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
  reservations: ReservationTimeBlock[],
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
      findReservationConflict(
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
        findReservationConflict(
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
  reservations: ReservationTimeBlock[],
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
  reservations: ReservationTimeBlock[],
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
  reservations: ReservationTimeBlock[],
  options: {
    date: string;
    roomId: string;
    option: BookableRangeOption;
    currentTime?: BookingCurrentTime;
    ignoredReservationId?: string;
  },
): { ok: true; selectedTime: SelectedBookingTime } | { ok: false; error: string } {
  if (isBookingStartNotAfterCurrentTime(options.date, options.option.startMinutes, options.currentTime)) {
    return { ok: false, error: BOOKING_PAST_TIME_MESSAGE };
  }

  const conflict = findReservationConflict(
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
    return { ok: false, error: BOOKING_RANGE_CONFLICT_MESSAGE };
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
  reservations: ReservationTimeBlock[],
  draft: Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">,
  ignoredReservationId?: string,
  currentTime?: BookingCurrentTime,
): { ok: true } | { ok: false; error: string } {
  if (isBookingStartNotAfterCurrentTime(draft.date, draft.startMinutes, currentTime)) {
    return { ok: false, error: BOOKING_PAST_TIME_MESSAGE };
  }

  const conflict = findReservationConflict(reservations, draft, ignoredReservationId);

  if (conflict) return { ok: false, error: BOOKING_DRAFT_CONFLICT_MESSAGE };

  return { ok: true };
}

export function getReservationsCoveringTimeBlock(
  reservations: ReservationTimeBlock[],
  options: {
    date: string;
    startMinutes: number;
    endMinutes: number;
  },
) {
  return reservations.filter((reservation) => {
    if (reservation.status === "cancelled") return false;
    if (reservation.date !== options.date) return false;

    return isTimeRangeOverlapping(options, reservation);
  });
}

function isTimeRangeOverlapping(
  first: Pick<ReservationDraft, "startMinutes" | "endMinutes">,
  second: Pick<ReservationDraft, "startMinutes" | "endMinutes">,
) {
  return first.startMinutes < second.endMinutes && second.startMinutes < first.endMinutes;
}

function isBookingStartNotAfterCurrentTime(date: string, startMinutes: number, currentTime?: BookingCurrentTime) {
  if (!currentTime) return false;
  if (date < currentTime.date) return true;
  if (date > currentTime.date) return false;

  return startMinutes <= currentTime.minutes;
}
