"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlusIcon, ChevronLeftIcon, SearchIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { formatKoreaDate } from "@/lib/korea-date";
import { listPublicReservationsByLookup } from "@/lib/reservation-actions";
import { formatKoreanPhoneNumber } from "@/lib/reservation-ui";
import { RESERVATIONS_PAGE_HEADER } from "@/lib/reservations-page-header";
import { formatMinutes, getRoomName, STATUS_LABELS, type Reservation } from "@/lib/reservations";

const lookupSchema = z.object({
  name: z.string().trim().min(1, "이름을 입력해 주세요."),
  phone: z.string().trim().min(1, "연락처를 입력해 주세요."),
  password: z.string().regex(/^\d{6}$/, "비밀번호는 숫자 6자리로 입력해 주세요."),
});

type LookupValues = z.infer<typeof lookupSchema>;

function getStatusVariant(status: Reservation["status"]) {
  if (status === "cancelled") return "destructive";
  if (status === "confirmed") return "default";

  return "outline";
}

function ReservationItem({ reservation }: { reservation: Reservation }) {
  const timeLabel = `${formatMinutes(reservation.startMinutes)}-${formatMinutes(reservation.endMinutes)}`;

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
    </article>
  );
}

export default function ReservationsPage() {
  const [reservations, setReservations] = useState<Reservation[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const form = useForm<LookupValues>({
    resolver: zodResolver(lookupSchema),
    defaultValues: {
      name: "",
      phone: "",
      password: "",
    },
  });
  const phoneRegistration = form.register("phone");
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

      setReservations(result.data);
    } finally {
      setIsSearching(false);
    }
  }

  return (
    <main className="min-h-screen bg-background px-4 py-5 text-foreground sm:px-6">
      <section className="mx-auto grid w-full max-w-2xl gap-5">
        <nav className="grid grid-cols-[2.5rem_1fr_2.5rem] items-center gap-3">
          <Button
            aria-label="처음으로"
            className="size-10 justify-center rounded-lg p-0"
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
                <span className="text-lg font-bold">연락처</span>
                <Input
                  className="h-14 rounded-xl px-4 text-xl md:text-xl"
                  autoComplete="tel"
                  inputMode="tel"
                  placeholder="010-0000-0000"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                  type="tel"
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
              <label className="grid gap-2">
                <span className="text-lg font-bold">비밀번호</span>
                <Input
                  className="h-14 rounded-xl px-4 text-xl md:text-xl"
                  autoComplete="current-password"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="숫자 6자리"
                  style={{ fontSize: "1.25rem", fontWeight: 700 }}
                  type="password"
                  {...passwordRegistration}
                  onChange={(event) => {
                    event.currentTarget.value = event.currentTarget.value.replace(/\D/g, "").slice(0, 6);
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
            <ReservationItem key={reservation.id} reservation={reservation} />
          ))}
        </section>

        {RESERVATIONS_PAGE_HEADER.showCreateReservationLink ? (
          <Button
            className="motion-action h-14 rounded-xl text-base font-bold sm:text-lg"
            render={<Link href="/reservation" />}
            variant="outline"
          >
            <CalendarPlusIcon data-icon="inline-start" />
            새 예약하기
          </Button>
        ) : null}
      </section>
    </main>
  );
}
