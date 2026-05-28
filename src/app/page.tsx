"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { AnimatePresence, motion, MotionConfig } from "framer-motion";
import { CalendarIcon, CheckCircle2Icon, ChevronLeftIcon, ChevronRightIcon, XIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  BOOKING_PERIODS,
  findReservationConflict,
  formatMinutes,
  getBookingDurationOptions,
  getBookingPeriodTimePoints,
  getRoomName,
  isBookingDurationAvailable,
  ROOMS,
  type BookingPeriodId,
  type ReservationDraft,
} from "@/lib/reservations";
import { dateToKoreaValue, formatKoreaDate, isBeforeKoreaToday, todayKoreaValue, valueToKoreaDate } from "@/lib/korea-date";
import {
  BOOKING_STEP_ITEMS,
  formatKoreanPhoneNumber,
  getBookingStepNavigation,
  getReservationSummary,
  type BookingStep,
} from "@/lib/reservation-ui";
import { useReservations } from "@/lib/use-reservations";

const contactSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  phone: z.string().trim().min(1, "연락처를 입력해 주세요."),
});

type ContactValues = z.infer<typeof contactSchema>;
type SelectedTime = {
  startMinutes: number;
  endMinutes: number;
  label: string;
};

const sectionMotion = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -8 },
  transition: { duration: 0.28, ease: "easeOut" },
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

export default function ReservationPage() {
  const [step, setStep] = useState<BookingStep>("room");
  const [date, setDate] = useState(todayKoreaValue);
  const [isDateDialogOpen, setIsDateDialogOpen] = useState(false);
  const [pendingDate, setPendingDate] = useState<Date>(() => valueToKoreaDate(todayKoreaValue()));
  const { reservations, addReservation, isReady, error } = useReservations({ date });
  const [roomId, setRoomId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<BookingPeriodId>("afternoon");
  const [selectedStartMinutes, setSelectedStartMinutes] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<SelectedTime | null>(null);
  const [isSubmittingReservation, setIsSubmittingReservation] = useState(false);

  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const selectedRoomName = roomId ? getRoomName(roomId) : "";
  const selectedDate = valueToKoreaDate(date);
  const reservationSummary = getReservationSummary({
    dateLabel: formatKoreaDate(date),
    roomName: selectedRoomName,
    timeLabel: selectedTime?.label ?? null,
  });
  const navigation = getBookingStepNavigation({
    step,
    hasRoom: Boolean(roomId),
    hasTime: Boolean(selectedTime),
  });
  const timePoints = useMemo(() => getBookingPeriodTimePoints(selectedPeriod), [selectedPeriod]);
  const durationOptions = useMemo(() => getBookingDurationOptions(), []);
  const phoneRegistration = form.register("phone");

  function clearTimeSelection() {
    setSelectedStartMinutes(null);
    setSelectedTime(null);
  }

  function changeDate(nextDate: Date | undefined) {
    if (!nextDate) return;

    setDate(dateToKoreaValue(nextDate));
    clearTimeSelection();
    if (step !== "room") setStep(roomId ? "time" : "room");
  }

  function openDateDialog(nextOpen: boolean) {
    setIsDateDialogOpen(nextOpen);
    if (nextOpen) setPendingDate(selectedDate);
  }

  function confirmPendingDate() {
    changeDate(pendingDate);
    setIsDateDialogOpen(false);
  }

  function selectRoom(nextRoomId: string) {
    setRoomId(nextRoomId);
    clearTimeSelection();
    setStep("time");
  }

  function hasAvailableDuration(startMinutes: number) {
    return durationOptions.some((option) =>
      isBookingDurationAvailable(reservations, {
        date,
        roomId,
        startMinutes,
        durationMinutes: option.minutes,
      }),
    );
  }

  function selectPeriod(periodId: BookingPeriodId) {
    setSelectedPeriod(periodId);
    clearTimeSelection();
  }

  function selectStartTime(minutes: number) {
    if (!hasAvailableDuration(minutes)) return;

    setSelectedStartMinutes(minutes);
    setSelectedTime(null);
  }

  function selectDuration(durationMinutes: number) {
    if (selectedStartMinutes === null) return;

    const endMinutes = selectedStartMinutes + durationMinutes;
    const conflict = findReservationConflict(reservations, {
      date,
      roomId,
      startMinutes: selectedStartMinutes,
      endMinutes,
    });

    if (conflict) {
      toast.error("이미 예약된 시간이 포함되어 있습니다.");
      setSelectedTime(null);
      return;
    }

    setSelectedTime({
      startMinutes: selectedStartMinutes,
      endMinutes,
      label: `${formatMinutes(selectedStartMinutes)}-${formatMinutes(endMinutes)}`,
    });
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

    if (!roomId || !selectedTime) {
      setStep(roomId ? "time" : "room");
      return;
    }

    const draft: ReservationDraft = {
      date,
      roomId,
      startMinutes: selectedTime.startMinutes,
      endMinutes: selectedTime.endMinutes,
      name: values.name,
      phone: values.phone,
    };
    const conflict = findReservationConflict(reservations, draft);

    if (conflict) {
      toast.error("이미 예약된 시간입니다.");
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

  function resetFlow() {
    setStep("room");
    setRoomId("");
    clearTimeSelection();
    form.reset();
  }

  function movePrevious() {
    if (navigation.previousStep) setStep(navigation.previousStep);
  }

  function moveNext() {
    if (step === "room" && roomId) {
      setStep("time");
      return;
    }

    if (step === "time") {
      moveToContact();
      return;
    }

    if (step === "contact") {
      void form.handleSubmit(submitReservation, (errors) => {
        toast.error(errors.name?.message ?? errors.phone?.message ?? "확인해 주세요.");
      })();
      return;
    }

    if (step === "done") resetFlow();
  }

  const isNextDisabled =
    navigation.isNextDisabled || (step === "contact" && (!isReady || isSubmittingReservation));

  return (
    <MotionConfig reducedMotion="user">
    <main className="reservation-shell mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 sm:px-6">
      <nav className="sticky top-0 z-20 -mx-4 border-b bg-background/95 px-4 py-3 shadow-sm backdrop-blur sm:-mx-6 sm:px-6">
        <div className="mx-auto grid max-w-2xl gap-2">
          <div className="grid grid-cols-[4.5rem_1fr_4.5rem] items-center gap-2">
            <Button
              className="h-10 justify-center rounded-lg px-2 text-sm font-bold"
              disabled={!navigation.previousStep}
              onClick={movePrevious}
              type="button"
              variant="outline"
            >
              <ChevronLeftIcon className="size-4" />
              이전
            </Button>
            <div className="flex min-w-0 items-center justify-center gap-1 text-xs font-bold text-muted-foreground sm:text-sm">
              {BOOKING_STEP_ITEMS.map((item, index) => {
                const isActive = step === item.id;
                const isDone = step === "done";

                return (
                  <span key={item.id} className="flex min-w-0 items-center gap-1">
                    <span className={isActive || isDone ? "text-foreground" : "text-muted-foreground"}>
                      {item.label}
                    </span>
                    {index < BOOKING_STEP_ITEMS.length - 1 ? <span className="text-muted-foreground/70">&gt;</span> : null}
                  </span>
                );
              })}
            </div>
            <Button
              className="h-10 justify-center rounded-lg px-2 text-sm font-bold"
              disabled={isNextDisabled}
              onClick={moveNext}
              type="button"
            >
              {step === "contact" && isSubmittingReservation ? "예약 중..." : navigation.nextLabel}
              {step !== "contact" && step !== "done" ? <ChevronRightIcon className="size-4" /> : null}
            </Button>
          </div>
          <div className="truncate text-center text-xs font-bold text-muted-foreground sm:text-sm">{reservationSummary}</div>
        </div>
      </nav>

      <header className="grid gap-3 pt-2 sm:flex sm:items-center sm:justify-between">
        <Dialog open={isDateDialogOpen} onOpenChange={openDateDialog}>
          <DialogTrigger
            render={
              <Button
                variant="outline"
                className="h-12 w-full justify-start rounded-xl px-4 text-lg font-bold sm:hidden"
                style={{ fontSize: "1.125rem", fontWeight: 700 }}
              />
            }
          >
            <CalendarIcon className="size-5" />
            {formatKoreaDate(date)}
          </DialogTrigger>
          <DialogContent
            className="mobile-date-dialog !top-auto !right-0 !bottom-0 !left-0 !w-full !max-w-none !translate-x-0 !translate-y-0 gap-5 rounded-t-2xl border-0 p-5 shadow-2xl ring-0 data-closed:slide-out-to-bottom data-open:slide-in-from-bottom data-open:zoom-in-100 data-closed:zoom-out-100 sm:hidden"
            showCloseButton={false}
          >
            <DialogHeader className="flex-row items-start justify-between gap-4">
              <div className="grid gap-1">
                <DialogTitle className="text-2xl font-bold">날짜 선택</DialogTitle>
                <DialogDescription className="sr-only">
                  예약 날짜 선택
                </DialogDescription>
              </div>
              <DialogClose
                render={
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="rounded-full"
                    aria-label="날짜 선택 닫기"
                  />
                }
              >
                <XIcon className="size-5" />
              </DialogClose>
            </DialogHeader>
            <Calendar
              mode="single"
              selected={pendingDate}
              onSelect={(nextDate) => {
                if (nextDate) setPendingDate(nextDate);
              }}
              disabled={(day) => isBeforeKoreaToday(dateToKoreaValue(day))}
              className="mobile-date-calendar w-full p-0"
              classNames={{
                root: "w-full",
                month: "w-full gap-5",
                months: "relative flex w-full flex-col gap-4",
                caption_label: "text-lg font-bold",
                weekday: "flex-1 rounded-(--cell-radius) text-sm font-bold text-muted-foreground select-none",
              }}
            />
            <DialogFooter className="-mx-5 -mb-5 grid grid-cols-[1fr_2fr] gap-2 rounded-b-none bg-background p-5 sm:grid-cols-[1fr_2fr]">
              <Button
                type="button"
                variant="outline"
                className="h-12 rounded-xl text-base font-bold"
                onClick={() => setPendingDate(valueToKoreaDate(todayKoreaValue()))}
              >
                오늘
              </Button>
              <Button
                type="button"
                className="h-12 rounded-xl text-base font-bold"
                onClick={confirmPendingDate}
              >
                선택 완료
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="hidden h-12 w-full justify-start rounded-xl px-4 text-lg font-bold sm:inline-flex sm:w-auto"
                style={{ fontSize: "1.125rem", fontWeight: 700 }}
              />
            }
          >
            <CalendarIcon className="size-5" />
            {formatKoreaDate(date)}
          </PopoverTrigger>
          <PopoverContent align="start" className="w-auto">
            <Calendar
              mode="single"
              selected={selectedDate}
              onSelect={changeDate}
              disabled={(day) => isBeforeKoreaToday(dateToKoreaValue(day))}
            />
          </PopoverContent>
        </Popover>
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 font-bold text-destructive">
          {error}
        </div>
      ) : null}

      <AnimatePresence mode="wait">
      {step === "room" && (
        <motion.section key="room" className="grid flex-1 content-start gap-4" {...sectionMotion}>
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">강의실 선택</h1>
          <div className="grid gap-3 sm:grid-cols-2">
            {ROOMS.map((room, index) => (
              <motion.button
                key={room.id}
                className="min-h-24 rounded-xl border bg-card p-5 text-left text-3xl font-bold shadow-sm transition-colors hover:border-primary hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:min-h-36 sm:p-6 sm:text-4xl"
                {...itemMotion}
                {...tactileMotion}
                transition={{ ...itemMotion.transition, delay: index * 0.06 }}
                onClick={() => selectRoom(room.id)}
                style={{ fontSize: "clamp(1.85rem, 7vw, 2.75rem)", fontWeight: 700 }}
                type="button"
              >
                {room.name}
              </motion.button>
            ))}
          </div>
        </motion.section>
      )}

      {step === "time" && (
        <motion.section key="time" className="grid flex-1 content-start gap-4" {...sectionMotion}>
          <h1 className="text-3xl font-bold tracking-normal sm:text-4xl">{selectedRoomName}</h1>
          <div className="grid gap-4 rounded-xl border bg-card p-3 shadow-sm sm:p-5">
            <div className="grid grid-cols-4 gap-2">
              {BOOKING_PERIODS.map((period, index) => (
                <motion.button
                  key={period.id}
                  className={`h-11 rounded-lg border px-2 text-base font-bold transition-colors focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:h-12 sm:text-lg ${
                    selectedPeriod === period.id
                      ? "motion-choice-selected border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:border-primary"
                  }`}
                  {...itemMotion}
                  {...tactileMotion}
                  animate={{
                    ...itemMotion.animate,
                    scale: selectedPeriod === period.id ? 1.02 : 1,
                  }}
                  transition={{ ...itemMotion.transition, delay: index * 0.025 }}
                  onClick={() => selectPeriod(period.id)}
                  style={{ fontSize: "clamp(0.95rem, 3vw, 1.125rem)", fontWeight: 700 }}
                  type="button"
                >
                  {period.label}
                </motion.button>
              ))}
            </div>

            <div className="grid gap-2">
              <div className="text-base font-bold text-muted-foreground sm:text-lg">시작 시간</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {timePoints.map((minutes, index) => {
                const isBlockedStart = !hasAvailableDuration(minutes);
                const isSelected = selectedStartMinutes === minutes;
                const buttonClassName =
                  isSelected
                    ? "motion-choice-selected border-4 border-primary bg-background text-foreground"
                    : isBlockedStart
                      ? "bg-muted text-muted-foreground"
                      : "border border-primary bg-primary text-primary-foreground hover:bg-primary/90";

                return (
                  <motion.button
                    key={minutes}
                    className={`h-13 rounded-lg px-2 text-xl font-bold transition-colors focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed sm:h-14 ${buttonClassName}`}
                    disabled={isBlockedStart}
                    {...itemMotion}
                    {...(!isBlockedStart ? tactileMotion : {})}
                    animate={{
                      ...itemMotion.animate,
                      scale: isSelected ? 1.025 : 1,
                    }}
                    transition={{ ...itemMotion.transition, delay: index * 0.018 }}
                    onClick={() => selectStartTime(minutes)}
                    style={{ fontSize: "clamp(1.15rem, 4vw, 1.45rem)", fontWeight: 700 }}
                    type="button"
                  >
                    <span className="block leading-tight">{formatMinutes(minutes)}</span>
                    {isBlockedStart ? <span className="block text-xs font-bold leading-tight">예약 마감</span> : null}
                  </motion.button>
                );
              })}
              </div>
            </div>

            <div className="grid gap-2">
              <div className="text-base font-bold text-muted-foreground sm:text-lg">이용 시간</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {durationOptions.map((option, index) => {
                  const isDisabled =
                    selectedStartMinutes === null ||
                    !isBookingDurationAvailable(reservations, {
                      date,
                      roomId,
                      startMinutes: selectedStartMinutes,
                      durationMinutes: option.minutes,
                    });
                  const isSelected =
                    selectedTime !== null &&
                    selectedTime.startMinutes === selectedStartMinutes &&
                    selectedTime.endMinutes === (selectedStartMinutes ?? 0) + option.minutes;
                  const isClosed = selectedStartMinutes !== null && isDisabled;

                  return (
                    <motion.button
                      key={option.minutes}
                      className={`h-12 rounded-lg px-3 text-lg font-bold transition-colors focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed ${
                        isSelected
                          ? "motion-choice-selected border-4 border-primary bg-background text-foreground"
                          : isDisabled
                            ? "bg-muted text-muted-foreground"
                            : "border border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                      disabled={isDisabled}
                      {...itemMotion}
                      {...(!isDisabled ? tactileMotion : {})}
                      animate={{
                        ...itemMotion.animate,
                        scale: isSelected ? 1.025 : 1,
                      }}
                      transition={{ ...itemMotion.transition, delay: index * 0.03 }}
                      onClick={() => selectDuration(option.minutes)}
                      style={{ fontSize: "clamp(1rem, 3vw, 1.125rem)", fontWeight: 700 }}
                      type="button"
                    >
                      <span className="block leading-tight">{option.label}</span>
                      {isClosed ? <span className="block text-xs font-bold leading-tight">예약 마감</span> : null}
                    </motion.button>
                  );
                })}
              </div>
            </div>

            <motion.div
              className="min-h-18 rounded-xl border p-4"
              animate={{
                backgroundColor: selectedTime ? "oklch(0.955 0.003 255)" : "var(--background)",
                scale: selectedTime ? 1.01 : 1,
              }}
              transition={{ duration: 0.24, ease: "easeOut" }}
            >
              <div className="text-sm font-bold text-muted-foreground">선택한 시간</div>
              <div className="mt-1 text-xl font-bold sm:text-2xl">{selectedTime ? selectedTime.label : "시작 시간과 이용 시간을 선택해 주세요"}</div>
            </motion.div>
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
                  placeholder="이름"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <span className="text-base font-bold text-destructive">{form.formState.errors.name.message}</span>
                ) : null}
              </label>
              <label className="grid gap-2">
                <span className="text-lg font-bold">연락처</span>
                <Input
                  className="h-14 rounded-xl px-4 text-xl md:text-xl"
                  inputMode="tel"
                  placeholder="010-0000-0000"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                  {...phoneRegistration}
                  onChange={(event) => {
                    event.currentTarget.value = formatKoreanPhoneNumber(event.currentTarget.value);
                    void phoneRegistration.onChange(event);
                  }}
                />
                {form.formState.errors.phone ? (
                  <span className="text-base font-bold text-destructive">{form.formState.errors.phone.message}</span>
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
                  toast.error(errors.name?.message ?? errors.phone?.message ?? "확인해 주세요.");
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
                onClick={resetFlow}
                style={{ fontSize: "1.5rem", fontWeight: 700 }}
                type="button"
              >
                새 예약
              </Button>
            </CardContent>
          </Card>
          </motion.div>
        </motion.section>
      )}
      </AnimatePresence>
    </main>
    </MotionConfig>
  );
}
