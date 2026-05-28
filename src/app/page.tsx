"use client";

import { useMemo, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarIcon, CheckCircle2Icon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
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
import { useReservations } from "@/lib/use-reservations";

const contactSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  phone: z.string().trim().min(1, "연락처를 입력해 주세요."),
});

type ContactValues = z.infer<typeof contactSchema>;
type BookingStep = "room" | "time" | "contact" | "done";
type SelectedTime = {
  startMinutes: number;
  endMinutes: number;
  label: string;
};

export default function ReservationPage() {
  const [step, setStep] = useState<BookingStep>("room");
  const [date, setDate] = useState(todayKoreaValue);
  const { reservations, addReservation, isReady, error } = useReservations({ date });
  const [roomId, setRoomId] = useState("");
  const [selectedPeriod, setSelectedPeriod] = useState<BookingPeriodId>("afternoon");
  const [selectedStartMinutes, setSelectedStartMinutes] = useState<number | null>(null);
  const [selectedTime, setSelectedTime] = useState<SelectedTime | null>(null);

  const form = useForm<ContactValues>({
    resolver: zodResolver(contactSchema),
    defaultValues: {
      name: "",
      phone: "",
    },
  });

  const selectedRoomName = roomId ? getRoomName(roomId) : "";
  const selectedDate = valueToKoreaDate(date);
  const timePoints = useMemo(() => getBookingPeriodTimePoints(selectedPeriod), [selectedPeriod]);
  const durationOptions = useMemo(() => getBookingDurationOptions(), []);

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
      clearTimeSelection();
      setStep("time");
      return;
    }

    const result = await addReservation(draft);
    if (!result.ok) {
      toast.error(result.error);
      clearTimeSelection();
      setStep("time");
      return;
    }

    setStep("done");
    toast.success("접수되었습니다.");
  }

  function resetFlow() {
    setStep("room");
    setRoomId("");
    clearTimeSelection();
    form.reset();
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-5xl flex-col gap-5 px-4 py-5 sm:px-8">
      <header className="flex items-center justify-between gap-3">
        <Popover>
          <PopoverTrigger
            render={
              <Button
                variant="outline"
                className="h-14 justify-start rounded-xl px-5 text-xl font-bold"
                style={{ fontSize: "1.25rem", fontWeight: 700 }}
              />
            }
          >
            <CalendarIcon className="size-6" />
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
        {step !== "room" && (
          <Button
            className="h-14 rounded-xl px-5 text-xl"
            onClick={() => setStep("room")}
            style={{ fontSize: "1.25rem", fontWeight: 700 }}
            type="button"
            variant="outline"
          >
            방 변경
          </Button>
        )}
      </header>

      {error ? (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 font-bold text-destructive">
          {error}
        </div>
      ) : null}

      {step === "room" && (
        <section className="grid flex-1 content-start gap-5">
          <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">방 선택</h1>
          <div className="grid gap-4 sm:grid-cols-2">
            {ROOMS.map((room) => (
              <button
                key={room.id}
                className="min-h-40 rounded-2xl border bg-card p-8 text-left text-4xl font-bold shadow-sm transition hover:border-primary hover:bg-primary/5 focus-visible:border-ring focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:min-h-52 sm:text-5xl"
                onClick={() => selectRoom(room.id)}
                style={{ fontSize: "clamp(2.5rem, 6vw, 4rem)", fontWeight: 700 }}
                type="button"
              >
                {room.name}
              </button>
            ))}
          </div>
        </section>
      )}

      {step === "time" && (
        <section className="grid flex-1 content-start gap-5">
          <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">{selectedRoomName}</h1>
          <div className="grid gap-5 rounded-2xl border bg-card p-4 shadow-sm sm:p-5">
            <div className="grid grid-cols-4 gap-2">
              {BOOKING_PERIODS.map((period) => (
                <button
                  key={period.id}
                  className={`h-14 rounded-xl border px-2 text-xl font-bold transition focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none ${
                    selectedPeriod === period.id
                      ? "border-primary bg-primary text-primary-foreground"
                      : "bg-background text-foreground hover:border-primary"
                  }`}
                  onClick={() => selectPeriod(period.id)}
                  style={{ fontSize: "clamp(1rem, 3vw, 1.25rem)", fontWeight: 700 }}
                  type="button"
                >
                  {period.label}
                </button>
              ))}
            </div>

            <div className="grid gap-3">
              <div className="text-xl font-bold text-muted-foreground">시작 시간</div>
              <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {timePoints.map((minutes) => {
                const isBlockedStart = !hasAvailableDuration(minutes);
                const isSelected = selectedStartMinutes === minutes;
                const buttonClassName =
                  isSelected
                    ? "border-4 border-primary bg-background text-foreground"
                    : isBlockedStart
                      ? "bg-muted text-muted-foreground"
                      : "border border-primary bg-primary text-primary-foreground hover:bg-primary/90";

                return (
                  <button
                    key={minutes}
                    className={`h-16 rounded-xl px-3 text-2xl font-bold transition focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed ${buttonClassName}`}
                    disabled={isBlockedStart}
                    onClick={() => selectStartTime(minutes)}
                    style={{ fontSize: "clamp(1.35rem, 4vw, 1.75rem)", fontWeight: 700 }}
                    type="button"
                  >
                    {formatMinutes(minutes)}
                  </button>
                );
              })}
              </div>
            </div>

            <div className="grid gap-3">
              <div className="text-xl font-bold text-muted-foreground">이용 시간</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {durationOptions.map((option) => {
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

                  return (
                    <button
                      key={option.minutes}
                      className={`h-14 rounded-xl px-3 text-xl font-bold transition focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none disabled:cursor-not-allowed ${
                        isSelected
                          ? "border-4 border-primary bg-background text-foreground"
                          : isDisabled
                            ? "bg-muted text-muted-foreground"
                            : "border border-primary bg-primary text-primary-foreground hover:bg-primary/90"
                      }`}
                      disabled={isDisabled}
                      onClick={() => selectDuration(option.minutes)}
                      style={{ fontSize: "clamp(1.1rem, 3vw, 1.25rem)", fontWeight: 700 }}
                      type="button"
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="min-h-20 rounded-xl border bg-background p-4">
              <div className="text-lg font-bold text-muted-foreground">선택한 시간</div>
              <div className="mt-1 text-3xl font-bold">{selectedTime ? selectedTime.label : "시작 시간과 이용 시간을 선택해 주세요"}</div>
            </div>
          </div>
          <Button
            className="h-16 rounded-xl text-2xl"
            disabled={!selectedTime}
            onClick={moveToContact}
            style={{ fontSize: "1.5rem", fontWeight: 700 }}
            type="button"
          >
            다음
          </Button>
        </section>
      )}

      {step === "contact" && selectedTime && (
        <section className="grid flex-1 content-start gap-5">
          <h1 className="text-4xl font-bold tracking-normal sm:text-5xl">
            {selectedRoomName} {selectedTime.label}
          </h1>
          <Card className="rounded-2xl border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="text-3xl">예약자 정보</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-5">
              <label className="grid gap-2">
                <span className="text-xl font-bold">이름</span>
                <Input
                  className="h-16 rounded-xl px-4 text-2xl md:text-2xl"
                  placeholder="이름"
                  style={{ fontSize: "1.5rem", fontWeight: 700 }}
                  {...form.register("name")}
                />
                {form.formState.errors.name ? (
                  <span className="text-lg font-bold text-destructive">{form.formState.errors.name.message}</span>
                ) : null}
              </label>
              <label className="grid gap-2">
                <span className="text-xl font-bold">연락처</span>
                <Input
                  className="h-16 rounded-xl px-4 text-2xl md:text-2xl"
                  inputMode="tel"
                  placeholder="010-0000-0000"
                  style={{ fontSize: "1.5rem", fontWeight: 700 }}
                  {...form.register("phone")}
                />
                {form.formState.errors.phone ? (
                  <span className="text-lg font-bold text-destructive">{form.formState.errors.phone.message}</span>
                ) : null}
              </label>
            </CardContent>
            <CardFooter className="grid gap-3 sm:grid-cols-2">
              <Button
                className="h-16 rounded-xl text-2xl"
                onClick={() => setStep("time")}
                style={{ fontSize: "1.5rem", fontWeight: 700 }}
                type="button"
                variant="outline"
              >
                시간 변경
              </Button>
              <Button
                className="h-16 rounded-xl text-2xl"
                disabled={!isReady}
                onClick={form.handleSubmit(submitReservation, (errors) => {
                  toast.error(errors.name?.message ?? errors.phone?.message ?? "확인해 주세요.");
                })}
                style={{ fontSize: "1.5rem", fontWeight: 700 }}
                type="button"
              >
                접수
              </Button>
            </CardFooter>
          </Card>
        </section>
      )}

      {step === "done" && selectedTime && (
        <section className="grid flex-1 place-items-center">
          <Card className="w-full rounded-2xl border bg-card text-center shadow-sm">
            <CardContent className="grid gap-6 p-10">
              <CheckCircle2Icon className="mx-auto size-20 text-primary" />
              <h1 className="text-5xl font-bold">접수 완료</h1>
              <p className="text-3xl font-bold">
                {selectedRoomName} {selectedTime.label}
              </p>
              <Button
                className="mx-auto h-16 rounded-xl px-10 text-2xl"
                onClick={resetFlow}
                style={{ fontSize: "1.5rem", fontWeight: 700 }}
                type="button"
              >
                새 예약
              </Button>
            </CardContent>
          </Card>
        </section>
      )}
    </main>
  );
}
