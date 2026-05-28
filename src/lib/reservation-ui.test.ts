import { describe, expect, it } from "vitest";
import {
  BOOKING_STEP_ITEMS,
  formatKoreanPhoneNumber,
  getBookingStepNavigation,
  getReservationSummary,
} from "./reservation-ui";

describe("reservation UI helpers", () => {
  it("uses compact Korean labels for the public booking steps", () => {
    expect(BOOKING_STEP_ITEMS).toEqual([
      { id: "room", label: "강의실" },
      { id: "time", label: "시간" },
      { id: "contact", label: "정보" },
    ]);
  });

  it("formats Korean mobile phone input while the user types", () => {
    expect(formatKoreanPhoneNumber("010")).toBe("010");
    expect(formatKoreanPhoneNumber("0101234")).toBe("010-1234");
    expect(formatKoreanPhoneNumber("01012345678")).toBe("010-1234-5678");
    expect(formatKoreanPhoneNumber("010-1234-5678")).toBe("010-1234-5678");
    expect(formatKoreanPhoneNumber("010 1234 5678 999")).toBe("010-1234-5678");
  });

  it("builds a compact reservation summary from selected values", () => {
    expect(
      getReservationSummary({
        dateLabel: "5월 29일",
        roomName: "",
        timeLabel: null,
      }),
    ).toBe("5월 29일 · 강의실 미선택 · 시간 미선택");

    expect(
      getReservationSummary({
        dateLabel: "5월 29일",
        roomName: "강의실 2",
        timeLabel: "14:00-15:00",
      }),
    ).toBe("5월 29일 · 강의실 2 · 14:00-15:00");
  });

  it("returns previous and next navigation state for each booking step", () => {
    expect(getBookingStepNavigation({ step: "room", hasRoom: false, hasTime: false })).toEqual({
      previousStep: null,
      nextStep: "time",
      nextLabel: "다음",
      isNextDisabled: true,
    });

    expect(getBookingStepNavigation({ step: "time", hasRoom: true, hasTime: false })).toEqual({
      previousStep: "room",
      nextStep: "contact",
      nextLabel: "다음",
      isNextDisabled: true,
    });

    expect(getBookingStepNavigation({ step: "contact", hasRoom: true, hasTime: true })).toEqual({
      previousStep: "time",
      nextStep: null,
      nextLabel: "예약 확정",
      isNextDisabled: false,
    });

    expect(getBookingStepNavigation({ step: "done", hasRoom: true, hasTime: true })).toEqual({
      previousStep: null,
      nextStep: "room",
      nextLabel: "새 예약",
      isNextDisabled: false,
    });
  });
});
