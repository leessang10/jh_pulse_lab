import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getUser: vi.fn(),
  rpc: vi.fn(),
}));

vi.mock("server-only", () => ({}));
vi.mock("@/lib/korea-date", () => ({
  todayKoreaValue: () => "2026-08-16",
}));
vi.mock("@/lib/supabase/server", () => ({
  createSupabaseServerClient: async () => ({
    auth: { getUser: mocks.getUser },
    rpc: mocks.rpc,
  }),
}));

import { getAdminReservationStatistics } from "./admin-statistics-actions";

const validStatisticsFixture = {
  coverageStart: "2026-06-17",
  summary: {
    current: { usageMinutes: 180, reservationCount: 3, userCount: 2, cancelledCount: 1 },
    previous: { usageMinutes: 0, reservationCount: 0, userCount: 0, cancelledCount: 0 },
    comparisonAvailable: false,
  },
  trend: [],
  ranking: [],
  peakTimes: [],
};

describe("admin statistics actions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  });

  it("calls the statistics RPC for an authenticated admin", async () => {
    mocks.rpc.mockResolvedValue({ data: validStatisticsFixture, error: null });

    await expect(getAdminReservationStatistics({ referenceMonth: "2026-07", unit: "day" }))
      .resolves.toEqual({ ok: true, data: validStatisticsFixture });
    expect(mocks.rpc).toHaveBeenCalledWith("get_admin_reservation_statistics", {
      p_reference_month: "2026-07-01",
      p_unit: "day",
    });
  });

  it("rejects invalid input before Supabase", async () => {
    await expect(getAdminReservationStatistics({ referenceMonth: "bad", unit: "day" }))
      .resolves.toEqual({ ok: false, error: "통계 조회 조건이 올바르지 않습니다." });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects a future reference month before Supabase", async () => {
    await expect(getAdminReservationStatistics({ referenceMonth: "2026-09", unit: "week" }))
      .resolves.toEqual({ ok: false, error: "통계 조회 조건이 올바르지 않습니다." });
    expect(mocks.getUser).not.toHaveBeenCalled();
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated request", async () => {
    mocks.getUser.mockResolvedValue({ data: { user: null } });

    await expect(getAdminReservationStatistics({ referenceMonth: "2026-07", unit: "year" }))
      .resolves.toEqual({ ok: false, error: "관리자 로그인이 필요합니다." });
    expect(mocks.rpc).not.toHaveBeenCalled();
  });

  it("returns a retryable error when the statistics RPC fails", async () => {
    mocks.rpc.mockResolvedValue({ data: null, error: new Error("database unavailable") });

    await expect(getAdminReservationStatistics({ referenceMonth: "2026-07", unit: "day" }))
      .resolves.toEqual({ ok: false, error: "예약 통계를 불러오지 못했습니다. 다시 시도해 주세요." });
  });

  it("returns a retryable error when the statistics RPC response is malformed", async () => {
    mocks.rpc.mockResolvedValue({ data: { ...validStatisticsFixture, summary: null }, error: null });

    await expect(getAdminReservationStatistics({ referenceMonth: "2026-07", unit: "day" }))
      .resolves.toEqual({ ok: false, error: "예약 통계를 불러오지 못했습니다. 다시 시도해 주세요." });
  });
});
