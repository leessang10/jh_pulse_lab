import type { Reservation, ReservationDraft, ReservationStatus } from "@/lib/reservations";

export type ReservationRow = {
  id: string;
  date: string;
  room_id: string;
  start_minutes: number;
  end_minutes: number;
  name: string;
  phone: string;
  note: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
};

export type PublicReservationTimeBlock = Omit<Reservation, "name" | "phone" | "note">;

export type ReservationInsert = {
  date: string;
  room_id: string;
  start_minutes: number;
  end_minutes: number;
  name: string;
  phone: string;
  note: string | null;
  status: "pending";
};

export function mapReservationRowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    date: row.date,
    roomId: row.room_id,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    name: row.name,
    phone: row.phone,
    note: row.note ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapReservationRowToTimeBlock(row: ReservationRow): PublicReservationTimeBlock {
  return {
    id: row.id,
    date: row.date,
    roomId: row.room_id,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapReservationDraftToInsert(draft: ReservationDraft): ReservationInsert {
  const note = draft.note?.trim();

  return {
    date: draft.date,
    room_id: draft.roomId,
    start_minutes: draft.startMinutes,
    end_minutes: draft.endMinutes,
    name: draft.name.trim(),
    phone: draft.phone.trim(),
    note: note || null,
    status: "pending",
  };
}
