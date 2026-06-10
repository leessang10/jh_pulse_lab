import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
}));
import {
  cancelPublicReservation,
  updatePublicReservationTime,
} from "./reservation-actions";

describe("public reservation owner actions", () => {
  it("rejects cancellation before querying when owner credentials are invalid", async () => {
    await expect(
      cancelPublicReservation("res-1", {
        name: "Lee",
        password: "123",
      }),
    ).resolves.toEqual({
      ok: false,
      error: "비밀번호는 숫자 4자리로 입력해 주세요.",
    });
  });

  it("rejects time changes before querying when the new time is invalid", async () => {
    await expect(
      updatePublicReservationTime(
        "res-1",
        {
          name: "Lee",
          password: "1234",
        },
        {
          date: "2026-05-28",
          roomId: "room-1",
          startMinutes: 600,
          endMinutes: 600,
        },
      ),
    ).resolves.toEqual({
      ok: false,
      error: "종료 시간은 시작 시간보다 늦어야 합니다.",
    });
  });
});
