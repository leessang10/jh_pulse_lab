import { describe, expect, it } from "vitest";
import {
  getScheduleBlockLabel,
  isScheduleBlockActive,
  toReservationScheduleBlock,
  validateMaintenanceBlockDraft,
  type MaintenanceBlock,
} from "./maintenance-blocks";

const maintenance: MaintenanceBlock = {
  id: "maintenance-1",
  date: "2026-07-15",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 780,
  createdBy: "00000000-0000-0000-0000-000000000001",
  createdAt: "2026-07-15T00:00:00.000Z",
};

describe("maintenance blocks", () => {
  it("accepts a multi-hour maintenance range on the 30-minute grid", () => {
    expect(
      validateMaintenanceBlockDraft(
        { date: "2026-07-15", roomId: "room-1", startMinutes: 600, endMinutes: 900 },
        { date: "2026-07-15", minutes: 590 },
      ),
    ).toEqual([]);
  });

  it("rejects invalid rooms, off-grid ranges, and already-ended ranges", () => {
    expect(
      validateMaintenanceBlockDraft(
        { date: "2026-07-15", roomId: "room-9", startMinutes: 605, endMinutes: 600 },
        { date: "2026-07-15", minutes: 700 },
      ),
    ).toEqual([
      "연습실을 선택해 주세요.",
      "시작 시간과 종료 시간은 30분 단위여야 합니다.",
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      "이미 종료된 시간에는 점검을 등록할 수 없습니다.",
    ]);
  });

  it("allows an in-progress range and always labels it as maintenance", () => {
    expect(
      validateMaintenanceBlockDraft(
        { date: "2026-07-15", roomId: "room-1", startMinutes: 600, endMinutes: 780 },
        { date: "2026-07-15", minutes: 700 },
      ),
    ).toEqual([]);
    expect(getScheduleBlockLabel({ kind: "maintenance", ...maintenance })).toBe("점검");
  });

  it("keeps reservation status semantics inside reservation schedule blocks", () => {
    const block = toReservationScheduleBlock({
      id: "reservation-1",
      date: "2026-07-15",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      name: " Lee ",
      status: "cancelled",
      createdAt: "2026-07-15T00:00:00.000Z",
    });

    expect(block.kind).toBe("reservation");
    expect(getScheduleBlockLabel(block)).toBe("Lee");
    expect(isScheduleBlockActive(block)).toBe(false);
    expect(isScheduleBlockActive({ kind: "maintenance", ...maintenance })).toBe(true);
  });
});
