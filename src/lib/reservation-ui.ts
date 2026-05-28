export type BookingStep = "room" | "time" | "contact" | "done";

export const BOOKING_STEP_ITEMS: Array<{ id: Exclude<BookingStep, "done">; label: string }> = [
  { id: "room", label: "강의실" },
  { id: "time", label: "시간" },
  { id: "contact", label: "정보" },
];

export function formatKoreanPhoneNumber(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 3) return digits;
  if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;

  return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
}

export function getReservationSummary(options: { dateLabel: string; roomName: string; timeLabel: string | null }) {
  return [options.dateLabel, options.roomName || "강의실 미선택", options.timeLabel || "시간 미선택"].join(" · ");
}

export function getBookingStepNavigation(options: { step: BookingStep; hasRoom: boolean; hasTime: boolean }) {
  if (options.step === "room") {
    return {
      previousStep: null,
      nextStep: "time",
      nextLabel: "다음",
      isNextDisabled: !options.hasRoom,
    } as const;
  }

  if (options.step === "time") {
    return {
      previousStep: "room",
      nextStep: "contact",
      nextLabel: "다음",
      isNextDisabled: !options.hasTime,
    } as const;
  }

  if (options.step === "contact") {
    return {
      previousStep: "time",
      nextStep: null,
      nextLabel: "예약 확정",
      isNextDisabled: !options.hasRoom || !options.hasTime,
    } as const;
  }

  return {
    previousStep: null,
    nextStep: "room",
    nextLabel: "새 예약",
    isNextDisabled: false,
  } as const;
}
