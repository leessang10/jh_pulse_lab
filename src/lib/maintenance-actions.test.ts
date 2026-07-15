import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
  from: vi.fn(),
  revalidatePath: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: mocks.revalidatePath }));
vi.mock("@/lib/korea-date", () => ({
  getCurrentKoreaBookingTime: () => ({ date: "2026-07-15", minutes: 590 }),
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
    from: mocks.from,
  }),
}));

import {
  createAdminMaintenanceBlock,
  deleteAdminMaintenanceBlock,
} from "./maintenance-actions";

describe("maintenance actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  });

  it("creates a maintenance block through the atomic RPC", async () => {
    const single = vi.fn().mockResolvedValue({
      data: {
        id: "maintenance-1",
        date: "2026-07-15",
        room_id: "room-1",
        start_minutes: 600,
        end_minutes: 780,
        created_by: "admin-1",
        created_at: "2026-07-15T00:00:00.000Z",
      },
      error: null,
    });
    const eq = vi.fn(() => ({ single }));
    const select = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ select });
    mocks.rpc.mockResolvedValue({
      data: [{ maintenance_id: "maintenance-1", cancelled_count: 2 }],
      error: null,
    });

    await expect(
      createAdminMaintenanceBlock({
        date: "2026-07-15",
        roomId: "room-1",
        startMinutes: 600,
        endMinutes: 780,
      }),
    ).resolves.toEqual({
      ok: true,
      data: {
        block: {
          id: "maintenance-1",
          date: "2026-07-15",
          roomId: "room-1",
          startMinutes: 600,
          endMinutes: 780,
          createdBy: "admin-1",
          createdAt: "2026-07-15T00:00:00.000Z",
        },
        cancelledCount: 2,
      },
    });

    expect(mocks.rpc).toHaveBeenCalledWith("create_maintenance_block", {
      p_date: "2026-07-15",
      p_room_id: "room-1",
      p_start_minutes: 600,
      p_end_minutes: 780,
    });
    expect(mocks.revalidatePath).toHaveBeenCalledWith("/admin/timetables");
  });

  it("rejects unauthenticated maintenance creation", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(
      createAdminMaintenanceBlock({
        date: "2026-07-15",
        roomId: "room-1",
        startMinutes: 600,
        endMinutes: 780,
      }),
    ).resolves.toEqual({ ok: false, error: "관리자 로그인이 필요합니다." });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an invalid range before opening Supabase", async () => {
    await expect(
      createAdminMaintenanceBlock({
        date: "2026-07-15",
        roomId: "room-1",
        startMinutes: 780,
        endMinutes: 600,
      }),
    ).resolves.toEqual({
      ok: false,
      error: "종료 시간은 시작 시간보다 늦어야 합니다.",
    });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("deletes only the maintenance block and does not restore reservations", async () => {
    const eq = vi.fn().mockResolvedValue({ error: null });
    const remove = vi.fn(() => ({ eq }));
    mocks.from.mockReturnValue({ delete: remove });

    await expect(deleteAdminMaintenanceBlock("maintenance-1")).resolves.toEqual({ ok: true, data: null });

    expect(mocks.from).toHaveBeenCalledWith("maintenance_blocks");
    expect(remove).toHaveBeenCalledWith();
    expect(eq).toHaveBeenCalledWith("id", "maintenance-1");
  });
});
