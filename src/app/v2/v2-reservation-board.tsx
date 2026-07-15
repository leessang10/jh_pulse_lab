"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import { listPublicScheduleBlocks } from "@/lib/reservation-actions";
import type { ScheduleBlock } from "@/lib/maintenance-blocks";
import { cn } from "@/lib/utils";
import { cancelV2PublicReservation, createV2PublicReservation } from "@/lib/v2-reservation-actions";
import {
  buildV2BoardRows,
  getV2DurationOptionsForTile,
  getV2ReservationRangeLabel,
  validateV2ReservationDraft,
  type V2BoardRow,
  type V2BoardTile,
} from "@/lib/v2-reservation-board";

type V2ReservationBoardProps = {
  today: string;
  todayLabel: string;
};

export function V2ReservationBoard({ today, todayLabel }: V2ReservationBoardProps) {
  const [reservations, setReservations] = useState<ScheduleBlock[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedTile, setSelectedTile] = useState<V2BoardTile | null>(null);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [durationMinutes, setDurationMinutes] = useState<30 | 60>(30);
  const [dialogError, setDialogError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [isSubmitting, startSubmitTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await listPublicScheduleBlocks(today);
    if (!result.ok) {
      setError(result.error);
      setReservations([]);
      setIsReady(true);
      return;
    }

    setError(null);
    setReservations(result.data);
    setIsReady(true);
  }, [today]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  useEffect(() => {
    const id = window.setInterval(() => {
      void refresh();
    }, 10_000);

    return () => window.clearInterval(id);
  }, [refresh]);

  const rows = useMemo(
    () =>
      buildV2BoardRows({
        date: today,
        reservations,
        currentTime: getCurrentKoreaBookingTime(),
      }),
    [reservations, today],
  );
  const durationOptions =
    selectedTile?.state === "available"
      ? getV2DurationOptionsForTile(selectedTile, reservations, getCurrentKoreaBookingTime())
      : [];
  const selectedReservation = selectedTile?.reservation;

  function openTile(tile: V2BoardTile) {
    if (tile.state !== "available" && tile.state !== "reserved") return;

    setSelectedTile(tile);
    setName(tile.reservation?.name ?? "");
    setPassword("");
    setDurationMinutes(30);
    setDialogError(null);
  }

  function closeDialog() {
    setSelectedTile(null);
    setPassword("");
    setDialogError(null);
  }

  function submitBooking() {
    if (!selectedTile || selectedTile.state !== "available") return;

    const draft = {
      date: today,
      roomId: selectedTile.room.id,
      startMinutes: selectedTile.startMinutes,
      endMinutes: selectedTile.startMinutes + durationMinutes,
      name,
      password,
    };
    const validation = validateV2ReservationDraft(draft, reservations, getCurrentKoreaBookingTime());

    if (!validation.ok) {
      setDialogError(validation.error);
      return;
    }

    startSubmitTransition(() => {
      void (async () => {
        const result = await createV2PublicReservation(draft);
        if (!result.ok) {
          setDialogError(result.error);
          await refresh();
          return;
        }

        toast.success("예약이 완료되었습니다.");
        closeDialog();
        await refresh();
      })();
    });
  }

  function submitCancellation() {
    if (!selectedTile?.reservation) return;

    startSubmitTransition(() => {
      void (async () => {
        const result = await cancelV2PublicReservation({
          reservationId: selectedTile.reservation!.id,
          name: selectedTile.reservation!.name,
          password,
        });

        if (!result.ok) {
          setDialogError(result.error);
          return;
        }

        toast.success("예약을 취소했습니다.");
        closeDialog();
        await refresh();
      })();
    });
  }

  return (
    <section className="grid gap-4" aria-label={`${todayLabel} 예약 현황`}>
      <div className="flex min-h-11 flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card px-4 py-3">
        <p className="text-sm font-semibold text-muted-foreground">
          {error
            ? error
            : !isReady
              ? "예약 현황을 불러오는 중입니다."
              : isPending
                ? "예약 현황을 새로고침 중입니다."
                : "오늘 예약 현황입니다."}
        </p>
      </div>
      {!isReady ? (
        <BoardSkeleton />
      ) : (
        <>
          <DesktopBoard rows={rows} onTileClick={openTile} />
          <MobileBoard rows={rows} onTileClick={openTile} />
        </>
      )}
      <Dialog open={Boolean(selectedTile)} onOpenChange={(open) => !open && closeDialog()}>
        <DialogContent className="max-w-md" showCloseButton={false}>
          {selectedTile?.state === "available" ? (
            <>
              <DialogHeader>
                <DialogTitle>예약하기</DialogTitle>
                <DialogDescription>
                  {selectedTile.room.name} {selectedTile.timeLabel} 시작
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <label className="grid gap-2 text-sm font-semibold">
                  이름
                  <Input className="h-12 text-base" value={name} onChange={(event) => setName(event.target.value)} />
                </label>
                <label className="grid gap-2 text-sm font-semibold">
                  비밀번호
                  <Input
                    className="h-12 text-base"
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                <div className="grid gap-2">
                  <span className="text-sm font-semibold">이용시간</span>
                  <div className="grid grid-cols-2 gap-2">
                    {durationOptions.map((option) => (
                      <Button
                        key={option.minutes}
                        type="button"
                        variant={durationMinutes === option.minutes ? "default" : "outline"}
                        className="h-12"
                        disabled={!option.available}
                        onClick={() => setDurationMinutes(option.minutes)}
                      >
                        {option.label}
                      </Button>
                    ))}
                  </div>
                </div>
                {dialogError ? (
                  <p className="rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                    {dialogError}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button className="h-12 w-full sm:w-auto" type="button" variant="outline" onClick={closeDialog}>
                  닫기
                </Button>
                <Button className="h-12 w-full sm:w-auto" onClick={submitBooking} disabled={isSubmitting}>
                  예약하기
                </Button>
              </DialogFooter>
            </>
          ) : selectedReservation ? (
            <>
              <DialogHeader>
                <DialogTitle>예약 정보</DialogTitle>
                <DialogDescription>
                  {selectedReservation.name}님의 {selectedTile?.room.name} 예약입니다.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4">
                <div className="rounded-lg border border-border bg-muted/50 p-4 text-base font-bold">
                  {selectedTile?.room.name}{" "}
                  {getV2ReservationRangeLabel(selectedReservation.startMinutes, selectedReservation.endMinutes)}
                </div>
                <label className="grid gap-2 text-sm font-semibold">
                  비밀번호
                  <Input
                    className="h-12 text-base"
                    inputMode="numeric"
                    maxLength={4}
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </label>
                {dialogError ? (
                  <p className="rounded-lg bg-destructive/10 p-3 text-sm font-semibold text-destructive">
                    {dialogError}
                  </p>
                ) : null}
              </div>
              <DialogFooter>
                <Button className="h-12 w-full sm:w-auto" type="button" variant="outline" onClick={closeDialog}>
                  닫기
                </Button>
                <Button
                  className="h-12 w-full sm:w-auto"
                  variant="destructive"
                  onClick={submitCancellation}
                  disabled={isSubmitting}
                >
                  예약 취소
                </Button>
              </DialogFooter>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}

function DesktopBoard({ rows, onTileClick }: { rows: V2BoardRow[]; onTileClick: (tile: V2BoardTile) => void }) {
  const rooms = rows[0]?.tiles.map((tile) => tile.room) ?? [];

  return (
    <div className="hidden overflow-hidden rounded-lg border border-border bg-card md:block">
      <div className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] border-b border-border bg-muted/60">
        <div className="px-3 py-3 text-sm font-bold text-muted-foreground">시간</div>
        {rooms.map((room) => (
          <div key={room.id} className="border-l border-border px-3 py-3 text-center text-base font-bold">
            {room.name}
          </div>
        ))}
      </div>
      {rows.map((row) => (
        <div
          key={row.startMinutes}
          className="grid grid-cols-[5.5rem_repeat(3,minmax(0,1fr))] border-b border-border last:border-b-0"
        >
          <div className="grid min-h-16 place-items-center bg-muted/30 px-3 text-base font-bold">{row.timeLabel}</div>
          {row.tiles.map((tile) => (
            <div key={tile.key} className="border-l border-border p-2">
              <TileButton tile={tile} onClick={onTileClick} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileBoard({ rows, onTileClick }: { rows: V2BoardRow[]; onTileClick: (tile: V2BoardTile) => void }) {
  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <section key={row.startMinutes} className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-3 text-xl font-bold">{row.timeLabel}</h2>
          <div className="grid gap-2">
            {row.tiles.map((tile) => (
              <TileButton key={tile.key} tile={tile} onClick={onTileClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TileButton({ tile, onClick }: { tile: V2BoardTile; onClick: (tile: V2BoardTile) => void }) {
  const disabled = tile.state === "past" || tile.state === "maintenance" || tile.state === "unavailable";
  const label =
    tile.state === "reserved"
      ? `${tile.reservation?.name ?? "예약됨"} ${getV2ReservationRangeLabel(
          tile.reservation?.startMinutes ?? tile.startMinutes,
          tile.reservation?.endMinutes ?? tile.endMinutes,
        )}`
      : tile.state === "maintenance"
        ? "점검"
        : tile.state === "past"
        ? "종료"
        : "예약 가능";

  return (
    <button
      type="button"
      aria-label={`${tile.timeLabel} ${tile.room.name} ${label}`}
      disabled={disabled}
      onClick={() => onClick(tile)}
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-base font-bold transition active:translate-y-px disabled:pointer-events-none",
        tile.state === "available" && "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
        tile.state === "reserved" && "border-slate-300 bg-slate-100 text-slate-950 hover:bg-slate-200",
        tile.state === "maintenance" && "border-amber-300 bg-amber-50 text-amber-950",
        tile.state === "past" && "border-border bg-muted/50 text-muted-foreground opacity-65",
        tile.state === "unavailable" && "border-border bg-muted/50 text-muted-foreground opacity-65",
      )}
    >
      <span className="md:hidden">{tile.room.name}</span>
      <span className="truncate">{label}</span>
    </button>
  );
}

function BoardSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }, (_, index) => (
        <div key={index} className="h-16 rounded-lg border border-border bg-muted/50" />
      ))}
    </div>
  );
}
