import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  from: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServiceClient: () => ({ from: mocks.from }),
  createSupabaseServerClient: vi.fn(),
}));

import { listPublicScheduleBlocks } from "./reservation-actions";

function queryResult(data: unknown[]) {
  const query = {
    select: vi.fn(),
    eq: vi.fn(),
    in: vi.fn(),
    neq: vi.fn(),
    order: vi.fn(),
  };
  query.select.mockReturnValue(query);
  query.eq.mockReturnValue(query);
  query.in.mockReturnValue(query);
  query.neq.mockReturnValue(query);
  query.order.mockResolvedValue({ data, error: null });
  return query;
}

describe("public schedule actions", () => {
  it("returns reservations and maintenance blocks as one ordered schedule", async () => {
    const reservationQuery = queryResult([
      {
        id: "reservation-1",
        date: "2026-07-15",
        room_id: "room-2",
        start_minutes: 600,
        end_minutes: 660,
        name: "Lee",
        note: null,
        status: "pending",
        created_at: "2026-07-15T00:00:00.000Z",
        updated_at: "2026-07-15T00:00:00.000Z",
      },
    ]);
    const maintenanceQuery = queryResult([
      {
        id: "maintenance-1",
        date: "2026-07-15",
        room_id: "room-1",
        start_minutes: 600,
        end_minutes: 660,
        created_by: "admin-1",
        created_at: "2026-07-15T00:00:00.000Z",
      },
    ]);
    mocks.from.mockImplementation((table: string) =>
      table === "reservations" ? reservationQuery : maintenanceQuery,
    );

    const result = await listPublicScheduleBlocks("2026-07-15");

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.data.map(({ id, kind }) => ({ id, kind }))).toEqual([
      { id: "maintenance-1", kind: "maintenance" },
      { id: "reservation-1", kind: "reservation" },
    ]);
    expect(mocks.from).toHaveBeenCalledWith("reservations");
    expect(mocks.from).toHaveBeenCalledWith("maintenance_blocks");
  });
});
