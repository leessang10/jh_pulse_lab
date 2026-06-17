"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlusIcon, CheckIcon, ChevronLeftIcon, PencilIcon, SearchIcon, XCircleIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { getBookingAvailability, type BookableRangeOption } from "@/lib/booking-availability";
import { formatKoreaDate } from "@/lib/korea-date";
import {
  cancelPublicReservation,
  listPublicReservationTimeBlocks,
  listPublicReservationsByLookup,
  updatePublicReservationTime,
} from "@/lib/reservation-actions";
import {
  canMutatePublicReservation,
  formatReservationCancellationMessage,
  replaceReservationInList,
} from "@/lib/reservation-owner-ui";
import { RESERVATIONS_PAGE_HEADER } from "@/lib/reservations-page-header";
import { formatMinutes, getRoomName, STATUS_LABELS, type Reservation } from "@/lib/reservations";

const lookupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  password: z.string().regex(/^\d{4}$/, "비밀번호는 숫자 4자리로 입력해 주세요."),
});

type LookupValues = z.infer<typeof lookupSchema>;

type EditingReservationState = {
  reservationId: string;
  isLoading: boolean;
  options: BookableRangeOption[];
  selectedOption: BookableRangeOption | null;
};

function getStatusVariant(status: Reservation["status"]) {
  if (status === "cancelled") return "destructive";
  if (status === "confirmed") return "default";

  return "outline";
}

type ReservationItemProps = {
  reservation: Reservation;
  isEditing: boolean;
  isLoadingChangeOptions: boolean;
  isMutating: boolean;
  changeOptions: BookableRangeOption[];
  selectedChangeOption: BookableRangeOption | null;
  onCancelChange: () => void;
  onCancelReservation: () => void;
  onSelectChangeOption: (option: BookableRangeOption) => void;
  onStartChange: () => void;
  onSubmitChange: () => void;
};

function ReservationItem({
  reservation,
  isEditing,
  isLoadingChangeOptions,
  isMutating,
  changeOptions,
  selectedChangeOption,
  onCancelChange,
  onCancelReservation,
  onSelectChangeOption,
  onStartChange,
  onSubmitChange,
}: ReservationItemProps) {
  const timeLabel = `${formatMinutes(reservation.startMinutes)}-${formatMinutes(reservation.endMinutes)}`;
  const canMutate = canMutatePublicReservation(reservation.status);

  return (
    <article className="grid gap-3 rounded-xl border bg-card p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="text-sm font-bold text-muted-foreground">{formatKoreaDate(reservation.date)}</div>
          <h2 className="mt-1 truncate text-2xl font-bold tracking-normal">
            {getRoomName(reservation.roomId)}
          </h2>
        </div>
        <Badge className="mt-1" variant={getStatusVariant(reservation.status)}>
          {STATUS_LABELS[reservation.status]}
        </Badge>
      </div>
      <div className="rounded-lg bg-muted/45 px-3 py-2 text-xl font-bold">{timeLabel}</div>
      {reservation.note ? <p className="text-sm font-bold text-muted-foreground">{reservation.note}</p> : null}
      <div className="grid gap-2 sm:grid-cols-2">
        <Button
          className="h-11 rounded-lg font-bold"
          disabled={!canMutate || isMutating}
          onClick={onStartChange}
          type="button"
          variant="outline"
        >
          <PencilIcon data-icon="inline-start" />
          예약 변경
        </Button>
        <AlertDialog>
          <AlertDialogTrigger
            render={
              <Button
                className="h-11 rounded-lg font-bold"
                disabled={!canMutate || isMutating}
                type="button"
                variant="destructive"
              />
            }
          >
            <XCircleIcon data-icon="inline-start" />
            예약 취소
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>예약을 취소할까요?</AlertDialogTitle>
              <AlertDialogDescription>
                {formatKoreaDate(reservation.date)} {getRoomName(reservation.roomId)} {timeLabel} 예약이 취소됩니다.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>닫기</AlertDialogCancel>
              <AlertDialogAction onClick={onCancelReservation}>예약 취소</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
      {isEditing ? (
        <div className="grid gap-3 rounded-lg border bg-muted/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="text-sm font-bold text-muted-foreground">변경할 시간</div>
            <Button className="h-9 rounded-lg px-3" onClick={onCancelChange} type="button" variant="ghost">
              닫기
            </Button>
          </div>
          {isLoadingChangeOptions ? (
            <div className="rounded-lg border bg-background p-4 text-sm font-bold text-muted-foreground">
              예약 가능한 시간을 불러오는 중입니다.
            </div>
          ) : changeOptions.length === 0 ? (
            <div className="rounded-lg border bg-background p-4 text-sm font-bold text-muted-foreground">
              변경 가능한 시간이 없습니다.
            </div>
          ) : (
            <div className="range-scroll-area grid max-h-52 gap-2 overflow-y-auto pr-1">
              {changeOptions.map((option) => {
                const isSelected =
                  selectedChangeOption?.startMinutes === option.startMinutes &&
                  selectedChangeOption.endMinutes === option.endMinutes;

                return (
                  <button
                    key={`${option.startMinutes}-${option.endMinutes}`}
                    className={`grid min-h-12 grid-cols-[1fr_auto] items-center rounded-lg border px-3 text-left text-lg font-bold transition-colors focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none ${
                      isSelected
                        ? "border-primary bg-background ring-2 ring-primary/60 ring-inset"
                        : "border-border bg-background hover:border-primary"
                    }`}
                    onClick={() => onSelectChangeOption(option)}
                    type="button"
                  >
                    <span>{option.label}</span>
                    {isSelected ? <CheckIcon className="size-4" /> : null}
                  </button>
                );
              })}
            </div>
          )}
          <Button
            className="h-12 rounded-lg font-bold"
            disabled={!selectedChangeOption || isLoadingChangeOptions || isMutating}
            onClick={onSubmitChange}
            type="button"
          >
            <CheckIcon data-icon="inline-start" />
            {isMutating ? "변경 중..." : "변경 저장"}
          </Button>
        </div>
      ) : null}
    </article>
  );
}

export default function ReservationsPage() {
  const router = useRouter();
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [ownerLookup, setOwnerLookup] = useState<LookupValues | null>(null);
  const [editingReservation, setEditingReservation] = useState<EditingReservationState | null>(null);
  const [mutatingReservationId, setMutatingReservationId] = useState<string | null>(null);
  const [cancellationMessage, setCancellationMessage] = useState<string | null>(null);
  const form = useForm<LookupValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      name: "",
      password: "",
    },
  });
  const passwordRegistration = form.register("password");
  const resultCountLabel = useMemo(() => {
    if (reservations === null) return "";

    return `${reservations.length}건`;
  }, [reservations]);

  async function submitLookup(values: LookupValues) {
    if (isSearching) return;

    setIsSearching(true);
    try {
      const result = await listPublicReservationsByLookup(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      setOwnerLookup(values);
      setEditingReservation(null);
      setReservations(result.data);
    } finally {
      setIsSearching(false);
    }
  }

  function updateReservationInResults(updated: Reservation) {
    setReservations((current) => (current ? replaceReservationInList(current, updated) : current));
  }

  async function startReservationChange(reservation: Reservation) {
    if (!canMutatePublicReservation(reservation.status)) return;

    setEditingReservation({
      reservationId: reservation.id,
      isLoading: true,
      options: [],
      selectedOption: null,
    });

    const result = await listPublicReservationTimeBlocks(reservation.date);
    if (!result.ok) {
      toast.error(result.error);
      setEditingReservation(null);
      return;
    }

    const durationMinutes = reservation.endMinutes - reservation.startMinutes;
    const availability = getBookingAvailability(result.data, {
      date: reservation.date,
      roomId: reservation.roomId,
      durationMinutes,
      ignoredReservationId: reservation.id,
    });
    const currentOption =
      availability.rangeOptions.find(
        (option) => option.startMinutes === reservation.startMinutes && option.endMinutes === reservation.endMinutes,
      ) ?? null;

    setEditingReservation({
      reservationId: reservation.id,
      isLoading: false,
      options: availability.rangeOptions,
      selectedOption: currentOption,
    });
  }

  function selectChangeOption(option: BookableRangeOption) {
    setEditingReservation((current) => (current ? { ...current, selectedOption: option } : current));
  }

  async function submitReservationChange(reservation: Reservation) {
    if (!ownerLookup || !editingReservation?.selectedOption) return;

    const option = editingReservation.selectedOption;
    setMutatingReservationId(reservation.id);
    try {
      const result = await updatePublicReservationTime(reservation.id, ownerLookup, {
        date: reservation.date,
        roomId: reservation.roomId,
        startMinutes: option.startMinutes,
        endMinutes: option.endMinutes,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      updateReservationInResults(result.data);
      setEditingReservation(null);
      toast.success("예약 시간이 변경되었습니다.");
    } finally {
      setMutatingReservationId(null);
    }
  }

  async function cancelReservation(reservation: Reservation) {
    if (!ownerLookup) return;

    setMutatingReservationId(reservation.id);
    try {
      const result = await cancelPublicReservation(reservation.id, ownerLookup);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      updateReservationInResults(result.data);
      if (editingReservation?.reservationId === reservation.id) setEditingReservation(null);
      setCancellationMessage(formatReservationCancellationMessage(result.data));
    } finally {
      setMutatingReservationId(null);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
      <section className="mx-auto grid w-full max-w-2xl gap-5">
        <nav className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3">
          <Button
            aria-label="처음으로"
            className="size-10 justify-center rounded-lg p-0"
            nativeButton={false}
            render={<Link href="/" />}
            type="button"
            variant="outline"
          >
            <ChevronLeftIcon className="size-4" />
          </Button>
          <div className="min-w-0 text-center">
            {RESERVATIONS_PAGE_HEADER.eyebrow ? (
              <div className="text-[0.72rem] font-bold text-muted-foreground sm:text-xs">
                {RESERVATIONS_PAGE_HEADER.eyebrow}
              </div>
            ) : null}
            <h1 className="text-xl font-bold leading-tight tracking-normal sm:text-2xl">
              {RESERVATIONS_PAGE_HEADER.title}
            </h1>
          </div>
          <div aria-hidden="true" />
        </nav>

        <Card className="rounded-xl border bg-card shadow-sm">
          {RESERVATIONS_PAGE_HEADER.lookupFormTitle ? (
            <CardHeader>
              <CardTitle className="text-2xl">{RESERVATIONS_PAGE_HEADER.lookupFormTitle}</CardTitle>
            </CardHeader>
          ) : null}
          <CardContent>
            <form className="grid gap-4" onSubmit={form.handleSubmit(submitLookup)}>
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
                  autoComplete="current-password"
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
              <Button
                className="motion-action mt-1 h-14 rounded-xl text-xl"
                disabled={isSearching}
                style={{ fontSize: "1.25rem", fontWeight: 700 }}
                type="submit"
              >
                <SearchIcon data-icon="inline-start" />
                {isSearching ? "조회 중..." : "조회하기"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <section className="grid gap-3" aria-live="polite">
          {reservations === null ? null : (
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-xl font-bold tracking-normal">조회 결과</h2>
              <div className="text-sm font-bold text-muted-foreground">{resultCountLabel}</div>
            </div>
          )}

          {reservations?.length === 0 ? (
            <div className="rounded-xl border bg-muted/45 p-5 text-center text-lg font-bold text-muted-foreground">
              일치하는 예약이 없습니다.
            </div>
          ) : null}

          {reservations?.map((reservation) => (
            <ReservationItem
              key={reservation.id}
              reservation={reservation}
              isEditing={editingReservation?.reservationId === reservation.id}
              isLoadingChangeOptions={editingReservation?.reservationId === reservation.id && editingReservation.isLoading}
              isMutating={mutatingReservationId === reservation.id}
              changeOptions={editingReservation?.reservationId === reservation.id ? editingReservation.options : []}
              selectedChangeOption={
                editingReservation?.reservationId === reservation.id ? editingReservation.selectedOption : null
              }
              onCancelChange={() => setEditingReservation(null)}
              onCancelReservation={() => void cancelReservation(reservation)}
              onSelectChangeOption={selectChangeOption}
              onStartChange={() => void startReservationChange(reservation)}
              onSubmitChange={() => void submitReservationChange(reservation)}
            />
          ))}
        </section>

        {RESERVATIONS_PAGE_HEADER.showCreateReservationLink ? (
          <Button
            className="motion-action h-14 rounded-xl text-base font-bold sm:text-lg"
            nativeButton={false}
            render={<Link href="/reservation" />}
            variant="outline"
          >
            <CalendarPlusIcon data-icon="inline-start" />
            새 예약하기
          </Button>
        ) : null}
      </section>

      <AlertDialog open={cancellationMessage !== null} onOpenChange={(open) => !open && setCancellationMessage(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>예약이 취소되었습니다</AlertDialogTitle>
            <AlertDialogDescription>{cancellationMessage}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => router.push("/")}>확인</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </main>
  );
}
