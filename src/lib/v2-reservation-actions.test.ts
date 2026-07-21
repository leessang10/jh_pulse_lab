import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));

import { cancelV2PublicReservation, createV2PublicReservation } from "./v2-reservation-actions";

describe("v2 reservation actions", () => {
  it("rejects non-today reservation drafts before writing", async () => {
    await expect(
      createV2PublicReservation(
        {
          date: "2026-06-19",
          roomId: "room-1",
          startMinutes: 600,
          endMinutes: 630,
          name: "Kim",
          password: "1234",
        },
        { date: "2026-06-20", minutes: 590 },
      ),
    ).resolves.toEqual({ ok: false, error: "오늘 예약만 가능합니다." });
  });

  it("rejects drafts outside shared booking hours before querying", async () => {
    await expect(
      createV2PublicReservation(
        {
          date: "2026-06-20",
          roomId: "room-1",
          startMinutes: 1350,
          endMinutes: 1410,
          name: "Kim",
          password: "1234",
        },
        { date: "2026-06-20", minutes: 590 },
      ),
    ).resolves.toEqual({
      ok: false,
      error: "예약 가능 시간은 07:00부터 23:00까지입니다.",
    });
  });

  it("rejects invalid cancellation input before querying", async () => {
    await expect(cancelV2PublicReservation({ reservationId: "", name: "Kim", password: "1234" })).resolves.toEqual({
      ok: false,
      error: "예약 정보를 찾을 수 없습니다.",
    });

    await expect(cancelV2PublicReservation({ reservationId: "res-1", name: "Kim", password: "123" })).resolves.toEqual({
      ok: false,
      error: "비밀번호는 숫자 4자리로 입력해 주세요.",
    });
  });
});
