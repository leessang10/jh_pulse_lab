import { describe, expect, it } from "vitest";
import type { Reservation } from "./reservations";
import { buildAdminTimetableRows } from "./admin-timetable";

const baseReservation: Reservation = {
  id: "res-1",
  date: "2026-06-20",
  roomId: "room-2",
  startMinutes: 630,
  endMinutes: 690,
  name: "홍길동",
  status: "confirmed",
  createdAt: "2026-06-20T01:00:00.000Z",
};

describe("admin timetable", () => {
  it("builds a 10:00 to 22:00 board with one tile per active room", () => {
    const rows = buildAdminTimetableRows({
      date: "2026-06-20",
      reservations: [baseReservation],
    });

    expect(rows).toHaveLength(24);
    expect(rows[0].timeLabel).toBe("10:00");
    expect(rows[0].tiles.map((tile) => tile.room.id)).toEqual(["room-1", "room-2", "room-3"]);
  });

  it("marks reserved and cancelled tiles without blocking empty rooms", () => {
    const rows = buildAdminTimetableRows({
      date: "2026-06-20",
      reservations: [
        baseReservation,
        {
          ...baseReservation,
          id: "res-2",
          roomId: "room-3",
          status: "cancelled",
        },
      ],
    });

    const row1030 = rows.find((row) => row.startMinutes === 630)!;
    expect(row1030.tiles.map((tile) => ({ roomId: tile.room.id, state: tile.state, name: tile.reservation?.name }))).toEqual([
      { roomId: "room-1", state: "empty", name: undefined },
      { roomId: "room-2", state: "reserved", name: "홍길동" },
      { roomId: "room-3", state: "cancelled", name: "홍길동" },
    ]);
  });
});
