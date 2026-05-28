export type ReservationStatus = "pending" | "confirmed" | "cancelled";

export type Room = {
  id: string;
  name: string;
};

export type Reservation = {
  id: string;
  date: string;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
  name: string;
  phone: string;
  note?: string;
  status: ReservationStatus;
  createdAt: string;
};

export type ReservationDraft = {
  date: string;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
  name: string;
  phone: string;
  note?: string;
};

export const ROOMS: Room[] = [
  { id: "room-1", name: "강의실 1" },
  { id: "room-2", name: "강의실 2" },
  { id: "room-3", name: "강의실 3" },
  { id: "room-4", name: "강의실 4" },
];

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "대기",
  confirmed: "확정",
  cancelled: "취소",
};

export const SLOT_MINUTES = 30;
export const DAY_END_MINUTES = 24 * 60;
export const SIMPLE_BOOKING_START_MINUTES = 9 * 60;
export const SIMPLE_BOOKING_END_MINUTES = 22 * 60;
export const SIMPLE_BOOKING_DURATION_MINUTES = 60;

export type BookingHalfDayPeriodId = "first-half" | "second-half";
export type BookingPeriodId = "morning" | "afternoon" | "evening" | "night";

export type BookingPeriod = {
  id: BookingPeriodId;
  label: string;
  startMinutes: number;
  endMinutes: number;
};

export type BookingHalfDayPeriod = {
  id: BookingHalfDayPeriodId;
  label: string;
  startMinutes: number;
  endMinutes: number;
};

export const BOOKING_HALF_DAY_PERIODS: BookingHalfDayPeriod[] = [
  { id: "first-half", label: "00:00-12:00", startMinutes: 0, endMinutes: 12 * 60 },
  { id: "second-half", label: "12:00-24:00", startMinutes: 12 * 60, endMinutes: DAY_END_MINUTES },
];

export const BOOKING_PERIODS: BookingPeriod[] = [
  { id: "morning", label: "오전", startMinutes: 6 * 60, endMinutes: 12 * 60 },
  { id: "afternoon", label: "오후", startMinutes: 12 * 60, endMinutes: 18 * 60 },
  { id: "evening", label: "저녁", startMinutes: 18 * 60, endMinutes: DAY_END_MINUTES },
  { id: "night", label: "심야", startMinutes: 0, endMinutes: 6 * 60 },
];

export const BOOKING_DURATION_OPTIONS = [
  { minutes: 30, label: "30분" },
  { minutes: 60, label: "1시간" },
  { minutes: 90, label: "1시간 30분" },
  { minutes: 120, label: "2시간" },
  { minutes: 150, label: "2시간 30분" },
  { minutes: 180, label: "3시간" },
];

export function formatMinutes(minutes: number) {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return `${String(hours).padStart(2, "0")}:${String(mins).padStart(2, "0")}`;
}

export function generateTimeSlots() {
  return Array.from({ length: DAY_END_MINUTES / SLOT_MINUTES }, (_, index) => {
    const value = index * SLOT_MINUTES;

    return {
      value,
      label: formatMinutes(value),
    };
  });
}

export function getSimpleBookingTimePoints() {
  const pointCount = (SIMPLE_BOOKING_END_MINUTES - SIMPLE_BOOKING_START_MINUTES) / SIMPLE_BOOKING_DURATION_MINUTES + 1;

  return Array.from(
    { length: pointCount },
    (_, index) => SIMPLE_BOOKING_START_MINUTES + index * SIMPLE_BOOKING_DURATION_MINUTES,
  );
}

export function getBookingPeriodTimePoints(periodId: BookingPeriodId) {
  const period = BOOKING_PERIODS.find((item) => item.id === periodId);
  if (!period) return [];

  const pointCount = (period.endMinutes - period.startMinutes) / SLOT_MINUTES;

  return Array.from({ length: pointCount }, (_, index) => period.startMinutes + index * SLOT_MINUTES);
}

export function getBookingHalfDayTimePoints(periodId: BookingHalfDayPeriodId) {
  const period = BOOKING_HALF_DAY_PERIODS.find((item) => item.id === periodId);
  if (!period) return [];

  const pointCount = (period.endMinutes - period.startMinutes) / SLOT_MINUTES;

  return Array.from({ length: pointCount }, (_, index) => period.startMinutes + index * SLOT_MINUTES);
}

export function getBookingDurationOptions() {
  return BOOKING_DURATION_OPTIONS;
}

export function isBookingDurationAvailable(
  reservations: Reservation[],
  options: {
    date: string;
    roomId: string;
    startMinutes: number;
    durationMinutes: number;
  },
) {
  const endMinutes = options.startMinutes + options.durationMinutes;
  if (options.startMinutes < 0 || endMinutes > DAY_END_MINUTES) return false;

  return (
    findReservationConflict(reservations, {
      date: options.date,
      roomId: options.roomId,
      startMinutes: options.startMinutes,
      endMinutes,
    }) === null
  );
}

export function getBookingStartOptions(
  reservations: Reservation[],
  options: {
    date: string;
    roomId: string;
    periodId?: BookingHalfDayPeriodId;
    durationMinutes: number;
  },
) {
  const startMinutesList = options.periodId
    ? getBookingHalfDayTimePoints(options.periodId)
    : generateTimeSlots().map((slot) => slot.value);

  return startMinutesList
    .map((startMinutes) => {
      const endMinutes = startMinutes + options.durationMinutes;
      const selectedSlotMinutes = Array.from(
        { length: options.durationMinutes / SLOT_MINUTES },
        (_, index) => startMinutes + index * SLOT_MINUTES,
      );
      const isReservedSlot =
        startMinutes + SLOT_MINUTES <= DAY_END_MINUTES &&
        findReservationConflict(reservations, {
          date: options.date,
          roomId: options.roomId,
          startMinutes,
          endMinutes: startMinutes + SLOT_MINUTES,
        }) !== null;
      const hasReservedSlotInRange = selectedSlotMinutes.some(
        (slotStartMinutes) =>
          slotStartMinutes + SLOT_MINUTES <= DAY_END_MINUTES &&
          findReservationConflict(reservations, {
            date: options.date,
            roomId: options.roomId,
            startMinutes: slotStartMinutes,
            endMinutes: slotStartMinutes + SLOT_MINUTES,
          }) !== null,
      );
      const hasUnavailableSlotInRange = selectedSlotMinutes.some(
        (slotStartMinutes) =>
          !isBookingDurationAvailable(reservations, {
            date: options.date,
            roomId: options.roomId,
            startMinutes: slotStartMinutes,
            durationMinutes: options.durationMinutes,
          }),
      );

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

export function buildTimeRange(firstMinutes: number, secondMinutes: number) {
  if (firstMinutes === secondMinutes) return null;

  const startMinutes = Math.min(firstMinutes, secondMinutes);
  const endMinutes = Math.max(firstMinutes, secondMinutes);

  return {
    startMinutes,
    endMinutes,
    label: `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`,
  };
}

export function getAvailableTimeSlots(
  reservations: Reservation[],
  options: {
    date: string;
    roomId: string;
    durationMinutes?: number;
  },
) {
  return getRoomTimeSlots(reservations, options)
    .filter((slot) => slot.isAvailable)
    .map(({ isAvailable: _isAvailable, ...slot }) => slot);
}

export function getRoomTimeSlots(
  reservations: Reservation[],
  options: {
    date: string;
    roomId: string;
    durationMinutes?: number;
  },
) {
  const durationMinutes = options.durationMinutes ?? SIMPLE_BOOKING_DURATION_MINUTES;
  const slotCount = (SIMPLE_BOOKING_END_MINUTES - SIMPLE_BOOKING_START_MINUTES) / durationMinutes;

  return Array.from({ length: slotCount }, (_, index) => {
    const startMinutes = SIMPLE_BOOKING_START_MINUTES + index * durationMinutes;
    const endMinutes = startMinutes + durationMinutes;
    const conflict = findReservationConflict(reservations, {
      date: options.date,
      roomId: options.roomId,
      startMinutes,
      endMinutes,
    });

    return {
      startMinutes,
      endMinutes,
      label: `${formatMinutes(startMinutes)}-${formatMinutes(endMinutes)}`,
      isAvailable: !conflict,
    };
  });
}

export function findReservationConflict(
  reservations: Reservation[],
  draft: Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">,
  ignoredReservationId?: string,
) {
  return (
    reservations.find((reservation) => {
      if (reservation.id === ignoredReservationId) return false;
      if (reservation.status === "cancelled") return false;
      if (reservation.date !== draft.date) return false;
      if (reservation.roomId !== draft.roomId) return false;

      return draft.startMinutes < reservation.endMinutes && reservation.startMinutes < draft.endMinutes;
    }) ?? null
  );
}

export function validateReservationDraft(draft: ReservationDraft) {
  const errors: string[] = [];
  const roomIds = new Set(ROOMS.map((room) => room.id));
  const isOnGrid = draft.startMinutes % SLOT_MINUTES === 0 && draft.endMinutes % SLOT_MINUTES === 0;

  if (!draft.date) errors.push("날짜를 선택해 주세요.");
  if (!roomIds.has(draft.roomId)) errors.push("강의실을 선택해 주세요.");
  if (!isOnGrid) errors.push("시작 시간과 종료 시간은 30분 단위여야 합니다.");
  if (draft.startMinutes < 0 || draft.endMinutes > DAY_END_MINUTES) {
    errors.push("예약 시간은 00:00부터 24:00 사이여야 합니다.");
  }
  if (draft.endMinutes <= draft.startMinutes) errors.push("종료 시간은 시작 시간보다 늦어야 합니다.");
  if (!draft.name.trim()) errors.push("예약자 이름을 입력해 주세요.");
  if (!draft.phone.trim()) errors.push("연락처를 입력해 주세요.");

  return errors;
}

export function createReservation(draft: ReservationDraft): Reservation {
  return {
    ...draft,
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
    name: draft.name.trim(),
    phone: draft.phone.trim(),
    note: draft.note?.trim() || undefined,
  };
}

export function getRoomName(roomId: string) {
  return ROOMS.find((room) => room.id === roomId)?.name ?? roomId;
}
