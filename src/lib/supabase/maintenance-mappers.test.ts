import { describe, expect, it } from "vitest";
import { mapMaintenanceRowToBlock } from "./maintenance-mappers";

describe("maintenance mappers", () => {
  it("maps a Supabase row to a maintenance block", () => {
    expect(
      mapMaintenanceRowToBlock({
        id: "maintenance-1",
        date: "2026-07-15",
        room_id: "room-2",
        start_minutes: 600,
        end_minutes: 780,
        created_by: "admin-1",
        created_at: "2026-07-15T00:00:00.000Z",
      }),
    ).toEqual({
      id: "maintenance-1",
      date: "2026-07-15",
      roomId: "room-2",
      startMinutes: 600,
      endMinutes: 780,
      createdBy: "admin-1",
      createdAt: "2026-07-15T00:00:00.000Z",
    });
  });
});
