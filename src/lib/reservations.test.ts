import { describe, expect, it } from "vitest";
import {
  formatMinutes,
  getRoomName,
  generateTimeSlots,
  validateReservationDraft,
  type Reservation,
} from "./reservations";
import {
  findReservationConflict,
} from "./booking-availability";

const baseReservation: Reservation = {
  id: "res-1",
  date: "2026-05-28",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 660,
  name: "Lee",
  phone: "010-0000-0000",
  status: "confirmed",
  createdAt: "2026-05-28T00:00:00.000Z",
};

describe("reservation rules", () => {
  it("formats minutes as 24-hour time", () => {
    expect(formatMinutes(0)).toBe("00:00");
    expect(formatMinutes(570)).toBe("09:30");
    expect(formatMinutes(1440)).toBe("24:00");
  });

  it("generates 30-minute start slots across the whole day", () => {
    const slots = generateTimeSlots();

    expect(slots).toHaveLength(48);
    expect(slots[0]).toEqual({ value: 0, label: "00:00" });
    expect(slots[47]).toEqual({ value: 1410, label: "23:30" });
  });

  it("finds conflicting reservations in the same room and date", () => {
    const conflict = findReservationConflict([baseReservation], {
      date: "2026-05-28",
      roomId: "room-1",
      startMinutes: 630,
      endMinutes: 690,
    });

    expect(conflict?.id).toBe("res-1");
  });

  it("ignores cancelled reservations and different rooms", () => {
    const cancelled: Reservation = { ...baseReservation, status: "cancelled" };
    const otherRoom: Reservation = { ...baseReservation, id: "res-2", roomId: "room-2" };

    expect(
      findReservationConflict([cancelled, otherRoom], {
        date: "2026-05-28",
        roomId: "room-1",
        startMinutes: 630,
        endMinutes: 690,
      }),
    ).toBeNull();
  });

  it("validates reservation drafts", () => {
    expect(
      validateReservationDraft({
        date: "2026-05-28",
        roomId: "room-1",
        startMinutes: 600,
        endMinutes: 660,
        name: "Lee",
        phone: "010-0000-0000",
        password: "123456",
      }),
    ).toEqual([]);

    expect(
      validateReservationDraft({
        date: "",
        roomId: "room-9",
        startMinutes: 605,
        endMinutes: 600,
        name: "",
        phone: "",
        password: "12345",
      }),
    ).toEqual([
      "날짜를 선택해 주세요.",
      "강의실을 선택해 주세요.",
      "시작 시간과 종료 시간은 30분 단위여야 합니다.",
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      "예약자 이름을 입력해 주세요.",
      "연락처를 입력해 주세요.",
      "비밀번호는 숫자 6자리로 입력해 주세요.",
    ]);
  });

  it("uses Korean classroom labels for public room names", () => {
    expect(getRoomName("room-1")).toBe("강의실 1");
    expect(getRoomName("room-4")).toBe("강의실 4");
  });
});
