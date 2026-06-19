"use client";

import { Suspense, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion, MotionConfig } from "framer-motion";
import { CheckCircle2Icon, ChevronLeftIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  getBookingAvailability,
  selectBookableRange,
  validateBookableDraftTime,
  type BookableRangeOption,
  type SelectedBookingTime,
} from "@/lib/booking-availability";
import {
  getInitialReservationRoomId,
  getRoomName,
  type ReservationDraft,
} from "@/lib/reservations";
import { todayKoreaValue } from "@/lib/korea-date";
import {
  getBookingCompletionReturnAction,
  getBookingHeaderState,
  getBookingStepNavigation,
  type BookingStep,
} from "@/lib/reservation-ui";
import { useReservations } from "@/lib/use-reservations";

const contactSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  password: z.string().regex(/^\d{4}$/, "비밀번호는 숫자 4자리로 입력해 주세요."),
});

type ContactValues = z.infer<typeof contactSchema>;

const sectionMotion = {
  initial: { opacity: 1, y: 0 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.18, ease: "easeOut" },
} as const;

const itemMotion = {
  initial: { opacity: 0, y: 10, scale: 0.985 },
  animate: { opacity: 1, y: 0, scale: 1 },
  transition: { duration: 0.3, ease: "easeOut" },
} as const;

const tactileMotion = {
  whileHover: { y: -2 },
  whileTap: { scale: 0.985, y: 0 },
} as const;

function ReservationPageFallback() {
  return (
    <main className="reservation-shell mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 sm:px-6">
      <div className="rounded-xl border bg-card p-5 text-lg font-bold text-muted-foreground shadow-sm">
        예약 화면을 준비하는 중입니다.
      </div>
    </main>
  );
}

function ReservationFlow() {
  const searchParams = useSearchParams();
  const initialRoomId = getInitialReservationRoomId(searchParams.get("roomId"));
  const [step, setStep] = useState<BookingStep>("time");
  const [date] = useState(todayKoreaValue);
  const { reservations, addReservation, isReady, error } = useReservations({ date });
  const [roomId] = useState(initialRoomId);
  const [selectedDurationMinutes, setSelectedDurationMinutes] = useState(60);
  const [selectedStartMinutes, setSelectedStartMinutes] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<SelectedBookingTime | null>(null);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);

  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      password: "",
    },
  });

  const selectedRoomName = getRoomName(roomId);
  const completionReturnAction = getBookingCompletionReturnAction();
  const navigation = getBookingStepNavigation({
    step,
    hasRoom: Boolean(roomId),
    hasTime: Boolean(selectedTime),
  });
  const headerState = getBookingHeaderState(step);
  const availability = useMemo(
    () =>
      getBookingAvailability(reservations, {
        date,
        roomId,
        durationMinutes: selectedDurationMinutes,
      }),
    [date, reservations, roomId, selectedDurationMinutes],
  );
  const { durationOptions, rangeOptions } = availability;
  const passwordRegistration = form.register("password");

  function clearTimeSelection() {
    setSelectedStartMinutes(null);
    setSelectedTime(null);
  }

  function selectDuration(durationMinutes: number) {
    setSelectedDurationMinutes(durationMinutes);
    clearTimeSelection();
  }

  function selectRange(option: BookableRangeOption) {
    const result = selectBookableRange(reservations, {
      date,
      roomId,
      option,
    });

    if (!result.ok) {
      toast.error(result.error);
      setSelectedTime(null);
      return;
    }

    setSelectedStartMinutes(result.selectedTime.startMinutes);
    setSelectedTime(result.selectedTime);
  }

  function moveToContact() {
    if (!selectedTime) {
      toast.error("시간을 선택해 주세요.");
      return;
    }

    setStep("contact");
  }

  async function submitReservation(values: ContactValues) {
    if (isSubmittingReservation) return;

    if (!selectedTime) {
      setStep("time");
      return;
    }

    const draft: ReservationDraft = {
      date,
      roomId,
      startMinutes: selectedTime.startMinutes,
      endMinutes: selectedTime.endMinutes,
      name: values.name,
      password: values.password,
    };
    const timeAvailability = validateBookableDraftTime(reservations, draft);

    if (!timeAvailability.ok) {
      toast.error(timeAvailability.error);
      setStep("time");
      return;
    }

    setIsSubmittingReservation(true);
    try {
      const result = await addReservation(draft);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setStep("done");
      toast.success("예약이 확정되었습니다.");
    } finally {
      setIsSubmittingReservation(false);
    }
  }

  function movePrevious() {
    if (navigation.previousStep) setStep(navigation.previousStep);
  }

  return (
    <MotionConfig reducedMotion="user">
    <main className="reservation-shell mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 sm:px-6">
      <nav className="sticky top-0 z-20 -mx-4 border-b bg-background/96 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto grid max-w-2xl gap-2">
          <div className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3">
            {navigation.previousHref ? (
              <Button
                aria-label="처음으로"
                className="size-10 justify-center rounded-lg p-0"
                render={<Link href={navigation.previousHref} />}
                type="button"
                variant="outline"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
            ) : (
              <Button
                aria-label="이전 단계"
                className="size-10 justify-center rounded-lg p-0"
                disabled={!navigation.previousStep}
                onClick={movePrevious}
                type="button"
                variant="outline"
              >
                <ChevronLeftIcon className="size-4" />
              </Button>
            )}
            <div className="min-w-0 text-center">
              <div className="text-[0.72rem] font-bold text-muted-foreground sm:text-xs">{headerState.stepLabel}</div>
              <div className="truncate text-xl font-bold leading-tight tracking-normal sm:text-2xl">
                {headerState.title}
              </div>
            </div>
            <div aria-hidden="true" />
          </div>
          <div className="h-1 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-foreground transition-[width] duration-300 ease-out"
              style={{ width: `${headerState.progressPercent}%` }}
            />
          </div>
        </div>
      </nav>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 font-bold text-destructive">
          {error}
        </div>
      ) : null}

      {step === "time" && (
        <motion.section key="time" className="grid flex-1 content-start gap-5" {...sectionMotion}>
          <div className="rounded-xl border bg-card p-4 shadow-sm">
            <div className="text-sm font-bold text-muted-foreground">예약 연습실</div>
            <div className="mt-1 text-3xl font-bold tracking-normal">{selectedRoomName}</div>
          </div>
          <div className="grid gap-5">
            <div className="grid gap-3">
              <div className="text-lg font-bold text-muted-foreground sm:text-xl">이용 시간</div>
              <div className="grid grid-cols-2 gap-2">
                {durationOptions.map((option, index) => {
                  const isSelected = selectedDurationMinutes === option.minutes;

                  return (
                    <motion.button
                      key={option.minutes}
                        className={`h-13 rounded-xl px-2 text-lg font-bold transition-colors focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed sm:h-15 sm:px-3 sm:text-xl ${
                          isSelected
                          ? "motion-choice-selected border border-primary bg-muted text-foreground ring-2 ring-primary/70 ring-inset"
                          : "border border-border bg-background text-foreground hover:border-primary hover:bg-muted"
                      }`}
                      {...itemMotion}
                      {...tactileMotion}
                      animate={{
                        ...itemMotion.animate,
                        scale: isSelected ? 1.025 : 1,
                      }}
                      transition={{ ...itemMotion.transition, delay: index * 0.03 }}
                      onClick={() => selectDuration(option.minutes)}
                      style={{ fontSize: "clamp(0.95rem, 3vw, 1.25rem)", fontWeight: 700 }}
                      type="button"
                    >
                      <span className="block leading-tight">{option.label}</span>
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="flex items-end justify-between gap-3">
                <div className="text-lg font-bold text-muted-foreground sm:text-xl">예약 가능한 시간</div>
                <div className="text-sm font-bold text-muted-foreground">{rangeOptions.length}개</div>
              </div>
              {rangeOptions.length > 0 ? (
                <div className="range-scroll-area grid h-[min(22vh,14rem)] min-h-36 touch-pan-y gap-2 overflow-y-scroll overscroll-contain pr-1 pb-1 [-webkit-overflow-scrolling:touch]">
                  {rangeOptions.map((option, index) => {
                    const isSelected =
                      selectedTime?.startMinutes === option.startMinutes && selectedTime.endMinutes === option.endMinutes;

                    return (
                      <motion.button
                        key={option.startMinutes}
                        className={`grid min-h-16 touch-pan-y select-none grid-cols-[1fr_auto] items-center gap-3 rounded-xl px-4 text-left font-bold transition-colors focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none ${
                          isSelected
                            ? "motion-choice-selected border border-primary bg-muted text-foreground ring-2 ring-primary/70 ring-inset"
                            : "border border-border bg-background text-foreground hover:border-primary hover:bg-muted"
                        }`}
                        {...itemMotion}
                        animate={{
                          ...itemMotion.animate,
                          scale: 1,
                        }}
                        transition={{ ...itemMotion.transition, delay: index * 0.012 }}
                        onClick={() => selectRange(option)}
                        type="button"
                      >
                        <span className="text-2xl leading-tight sm:text-3xl">{option.label}</span>
                      </motion.button>
                    );
                  })}
                </div>
              ) : (
                <div className="rounded-xl border bg-muted/45 p-5 text-lg font-bold text-muted-foreground">
                  선택한 이용시간으로 예약 가능한 시간이 없습니다.
                </div>
              )}
            </div>

            <motion.div
              className="min-h-18 rounded-xl border bg-muted/45 p-4"
              animate={{
                backgroundColor: selectedTime ? "oklch(0.955 0.003 255)" : "var(--background)",
                scale: selectedTime ? 1.01 : 1,
              }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="text-sm font-bold text-muted-foreground">선택한 시간</div>
              <div className="mt-1 text-xl font-bold sm:text-2xl">{selectedTime ? selectedTime.label : "이용 시간 선택 후 시작 시간을 선택해 주세요"}</div>
            </motion.div>
            <Button
              className="motion-action h-14 rounded-xl text-xl"
              disabled={!selectedTime}
              onClick={moveToContact}
              style={{ fontSize: "1.25rem", fontWeight: 700 }}
              type="button"
            >
              정보 입력
            </Button>
          </div>
        </motion.section>
      )}

      {step === "contact" && selectedTime && (
        <motion.section key="contact" className="grid flex-1 content-start gap-4" {...sectionMotion}>
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">
            {selectedRoomName} {selectedTime.label}
          </h1>
          <Card className="rounded-xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-2xl">예약자 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4">
              <label className="grid gap-2">
                <span className="text-lg font-bold">이름</span>
                <Input
                  className="h-14 rounded-xl px-4 text-xl md:text-xl"
                  autoComplete="name"
                  placeholder="이름"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <span className="text-base font-bold text-destructive">{form.formState.errors.name.message}</span>
                ) : null}
              </label>
              <label className="grid gap-2">
                <span className="text-lg font-bold">비밀번호</span>
                <Input
                  className="h-14 rounded-xl px-4 text-xl md:text-xl"
                  autoComplete="new-password"
                  inputMode="numeric"
                  maxLength={4}
                  placeholder="숫자 4자리"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                  type="password"
                  {...passwordRegistration}
                  onChange={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 4);
                    void passwordRegistration.onChange(event);
                  }}
                />
                {form.formState.errors.password ? (
                  <span className="text-base font-bold text-destructive">{form.formState.errors.password.message}</span>
                ) : null}
              </label>
            </CardContent>
            <CardFooter className="grid gap-3 sm:grid-cols-2">
              <Button
                className="motion-action h-14 rounded-xl text-xl"
                onClick={() => setStep("time")}
                style={{ fontSize: "1.25rem", fontWeight: 700 }}
                type="button"
                variant="outline"
              >
                시간 변경
              </Button>
              <Button
                className="motion-action h-14 rounded-xl text-xl"
                disabled={!isReady || isSubmittingReservation}
                onClick={form.handleSubmit(submitReservation, (errors) => {
                  toast.error(errors.name?.message ?? errors.password?.message ?? "확인해 주세요.");
                })}
                style={{ fontSize: "1.25rem", fontWeight: 700 }}
                type="button"
              >
                {isSubmittingReservation ? "예약 중..." : "예약 확정"}
              </Button>
            </CardFooter>
          </Card>
        </motion.section>
      )}

      {step === "done" && selectedTime && (
        <motion.section key="done" className="grid flex-1 place-items-center" {...sectionMotion}>
          <motion.div
            className="w-full"
            initial={{ opacity: 0, scale: 0.94, y: 14 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            transition={{ duration: 0.42, ease: "easeOut" }}
          >
          <Card className="w-full rounded-2xl border bg-card text-center shadow-sm">
            <CardContent className="grid gap-6 p-10">
              <motion.div
                initial={{ opacity: 0, scale: 0.72, rotate: -8 }}
                animate={{ opacity: 1, scale: 1, rotate: 0 }}
                transition={{ delay: 0.08, duration: 0.44, ease: "easeOut" }}
              >
                <CheckCircle2Icon className="mx-auto size-20 text-primary" />
              </motion.div>
              <h1 className="text-5xl font-bold">예약 완료</h1>
              <p className="text-3xl font-bold">
                {selectedRoomName} {selectedTime.label}
              </p>
              <Button
                className="motion-action mx-auto h-16 rounded-xl px-10 text-2xl"
                nativeButton={false}
                render={<Link href={completionReturnAction.href} />}
                style={{ fontSize: "1.5rem", fontWeight: 700 }}
              >
                {completionReturnAction.label}
              </Button>
            </CardContent>
          </Card>
          </motion.div>
        </motion.section>
      )}
    </main>
    </MotionConfig>
  );
}

export default function ReservationPage() {
  return (
    <Suspense fallback={<ReservationPageFallback />}>
      <ReservationFlow />
    </Suspense>
  );
}
