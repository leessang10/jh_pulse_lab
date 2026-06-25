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
  note?: string;
  status: ReservationStatus;
  createdAt: string;
};

export type ReservationTimeBlock = Pick<
  Reservation,
  "id" | "date" | "roomId" | "startMinutes" | "endMinutes" | "name" | "status" | "createdAt"
>;

export type ReservationDraft = {
  date: string;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
  name: string;
  password: string;
  note?: string;
};

export type ReservationTimeChange = Pick<ReservationDraft, "date" | "roomId" | "startMinutes" | "endMinutes">;

export const ROOMS: Room[] = [
  { id: "room-1", name: "연습실 1" },
  { id: "room-2", name: "연습실 2" },
  { id: "room-3", name: "연습실 3" },
];

export const ACTIVE_ROOM_IDS = ROOMS.map((room) => room.id);

const ROOM_NAMES = new Map<string, string>([...ROOMS, { id: "room-4", name: "연습실 4" }].map((room) => [room.id, room.name]));

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "대기",
  confirmed: "확정",
  cancelled: "취소",
};

export function getEffectiveReservationStatus(
  reservation: Pick<Reservation, "date" | "startMinutes" | "status">,
  currentTime: { date: string; minutes: number },
): ReservationStatus {
  if (reservation.status === "cancelled") return "cancelled";
  if (reservation.date < currentTime.date) return "confirmed";
  if (reservation.date > currentTime.date) return "pending";

  return reservation.startMinutes <= currentTime.minutes ? "confirmed" : "pending";
}

export function resolveReservationStatuses(
  reservations: Reservation[],
  currentTime: { date: string; minutes: number },
  status?: ReservationStatus,
) {
  return reservations
    .map((reservation) => ({
      ...reservation,
      status: getEffectiveReservationStatus(reservation, currentTime),
    }))
    .filter((reservation) => !status || reservation.status === status);
}

export const SLOT_MINUTES = 30;
export const DAY_END_MINUTES = 24 * 60;
export const MAX_BOOKING_DURATION_MINUTES = 60;

export const BOOKING_DURATION_OPTIONS = [
  { minutes: 30, label: "30분" },
  { minutes: 60, label: "1시간" },
];

export const OWNER_REBOOKING_RELEASE_MINUTES = 10;
export const OWNER_ACTIVE_RESERVATION_MESSAGE =
  "이미 예약된 시간이 있습니다. 예약하신 시간이 종료되기 10분 전부터 추가 예약이 가능합니다.";

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

function validateReservationTimeFields(draft: ReservationTimeChange) {
  const errors: string[] = [];
  const roomIds = new Set(ROOMS.map((room) => room.id));
  const isOnGrid = draft.startMinutes % SLOT_MINUTES === 0 && draft.endMinutes % SLOT_MINUTES === 0;

  if (!draft.date) errors.push("날짜를 선택해 주세요.");
  if (!roomIds.has(draft.roomId)) errors.push("연습실을 선택해 주세요.");
  if (!isOnGrid) errors.push("시작 시간과 종료 시간은 30분 단위여야 합니다.");
  if (draft.startMinutes < 0 || draft.endMinutes > DAY_END_MINUTES) {
    errors.push("예약 시간은 00:00부터 24:00 사이여야 합니다.");
  }
  if (draft.endMinutes <= draft.startMinutes) errors.push("종료 시간은 시작 시간보다 늦어야 합니다.");
  if (draft.endMinutes - draft.startMinutes > MAX_BOOKING_DURATION_MINUTES) {
    errors.push("예약 시간은 최대 1시간까지 가능합니다.");
  }

  return errors;
}

export function validateReservationTimeChange(change: ReservationTimeChange) {
  return validateReservationTimeFields(change);
}

export function validateReservationDraft(draft: ReservationDraft) {
  const errors = validateReservationTimeFields(draft);

  if (!draft.name.trim()) errors.push("예약자 이름을 입력해 주세요.");
  if (!/^\d{4}$/.test(draft.password)) errors.push("비밀번호는 숫자 4자리로 입력해 주세요.");

  return errors;
}

export function validateReservationOwnerBookingWindow(
  ownerReservations: ReservationTimeBlock[],
  currentTime: { date: string; minutes: number },
): { ok: true } | { ok: false; error: string } {
  const hasBlockingReservation = ownerReservations.some((reservation) => {
    if (reservation.status === "cancelled") return false;
    if (reservation.date < currentTime.date) return false;
    if (reservation.date > currentTime.date) return true;

    return reservation.endMinutes - currentTime.minutes > OWNER_REBOOKING_RELEASE_MINUTES;
  });

  return hasBlockingReservation ? { ok: false, error: OWNER_ACTIVE_RESERVATION_MESSAGE } : { ok: true };
}

export function createReservation(draft: ReservationDraft): Reservation {
  const { password: _password, ...reservationDraft } = draft;

  return {
    ...reservationDraft,
    id: crypto.randomUUID(),
    status: "pending",
    createdAt: new Date().toISOString(),
    name: draft.name.trim(),
    note: draft.note?.trim() || undefined,
  };
}

export function getRoomName(roomId: string) {
  return ROOM_NAMES.get(roomId) ?? roomId;
}

export function getInitialReservationRoomId(roomId: string | null | undefined) {
  return ACTIVE_ROOM_IDS.includes(roomId ?? "") ? roomId! : ACTIVE_ROOM_IDS[0];
}
