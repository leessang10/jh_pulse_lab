export type BookingStep = "time" | "contact" | "done";

export const BOOKING_STEP_ITEMS: Array<{ id: Exclude<BookingStep, "done">; label: string }> = [
  { id: "time", label: "시간" },
  { id: "contact", label: "정보" },
];

export function getReservationSummary(options: { dateLabel: string; roomName: string; timeLabel: string | null }) {
  return [options.dateLabel, options.roomName || "연습실 미선택", options.timeLabel || "시간 미선택"].join(" · ");
}

export function getRoomReservationHref(roomId: string | null | undefined) {
  return roomId ? `/reservation?roomId=${encodeURIComponent(roomId)}` : "/reservation";
}

export function getBookingCompletionReturnAction() {
  return {
    href: "/",
    label: "메인으로",
  } as const;
}

export function getBookingHeaderState(step: BookingStep) {
  const activeIndex = step === "contact" || step === "done" ? 1 : 0;
  const totalSteps = BOOKING_STEP_ITEMS.length;
  const titles: Record<Exclude<BookingStep, "done">, string> = {
    time: "시간 선택",
    contact: "예약자 정보",
  };

  return {
    title: step === "done" ? "예약 완료" : titles[step],
    stepLabel: `${activeIndex + 1}/${totalSteps}`,
    progressPercent: ((activeIndex + 1) / totalSteps) * 100,
  };
}

export function getBookingStepNavigation(options: { step: BookingStep; hasRoom: boolean; hasTime: boolean }) {
  if (options.step === "time") {
    return {
      previousHref: "/",
      previousStep: null,
      nextStep: "contact",
      nextLabel: "다음",
      isNextDisabled: !options.hasTime,
    } as const;
  }

  if (options.step === "contact") {
    return {
      previousHref: null,
      previousStep: "time",
      nextStep: null,
      nextLabel: "예약 확정",
      isNextDisabled: !options.hasRoom || !options.hasTime,
    } as const;
  }

  return {
    previousHref: null,
    previousStep: null,
    nextStep: null,
    nextLabel: "메인으로",
    isNextDisabled: false,
  } as const;
}
