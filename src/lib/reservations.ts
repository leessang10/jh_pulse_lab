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
  { id: "room-1", name: "Room 1" },
  { id: "room-2", name: "Room 2" },
  { id: "room-3", name: "Room 3" },
  { id: "room-4", name: "Room 4" },
];

export const STATUS_LABELS: Record<ReservationStatus, string> = {
  pending: "대기",
  confirmed: "확정",
  cancelled: "취소",
};

export const SLOT_MINUTES = 30;
export const DAY_END_MINUTES = 24 * 60;

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
