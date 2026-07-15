import { describe, expect, it } from "vitest";
import {
  mapReservationDraftToInsert,
  mapReservationRowToReservation,
  mapReservationRowToScheduleBlock,
  mapReservationRowToTimeBlock,
  type ReservationRow,
} from "./reservation-mappers";
import { hashReservationPassword } from "../reservation-credentials";

const row: ReservationRow = {
  id: "67c5bdfa-fcf2-4fbb-8204-912c54f364e6",
  date: "2026-05-29",
  room_id: "room-1",
  start_minutes: 600,
  end_minutes: 660,
  name: " Lee ",
  note: " Bring sticks ",
  password_hash: hashReservationPassword("1234"),
  status: "pending",
  created_at: "2026-05-29T00:00:00.000Z",
  updated_at: "2026-05-29T00:01:00.000Z",
};

describe("Supabase reservation mappers", () => {
  it("maps a Supabase row to the app Reservation shape", () => {
    expect(mapReservationRowToReservation(row)).toEqual({
      id: row.id,
      date: "2026-05-29",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      name: " Lee ",
      note: " Bring sticks ",
      status: "pending",
      createdAt: "2026-05-29T00:00:00.000Z",
    });
  });

  it("maps a Supabase row to a public time block without contact fields", () => {
    expect(mapReservationRowToTimeBlock(row)).toEqual({
      id: row.id,
      date: "2026-05-29",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      name: " Lee ",
      status: "pending",
      createdAt: "2026-05-29T00:00:00.000Z",
    });
  });

  it("maps a Supabase row to a reservation schedule block", () => {
    expect(mapReservationRowToScheduleBlock(row)).toEqual({
      kind: "reservation",
      id: row.id,
      date: "2026-05-29",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      name: " Lee ",
      status: "pending",
      createdAt: "2026-05-29T00:00:00.000Z",
    });
  });

  it("maps a draft to an insert payload with trimmed owner fields and pending status", () => {
    expect(
      mapReservationDraftToInsert({
        date: "2026-05-29",
        roomId: "room-2",
        startMinutes: 720,
        endMinutes: 780,
        name: " Kim ",
        password: "6543",
        note: " ",
      }),
    ).toEqual({
      date: "2026-05-29",
      room_id: "room-2",
      start_minutes: 720,
      end_minutes: 780,
      name: "Kim",
      password_hash: hashReservationPassword("6543"),
      note: null,
      status: "pending",
    });
  });
});
