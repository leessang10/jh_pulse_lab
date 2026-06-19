"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { getCurrentKoreaBookingTime } from "@/lib/korea-date";
import { listPublicReservationTimeBlocks } from "@/lib/reservation-actions";
import type { ReservationTimeBlock } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import {
  buildV2BoardRows,
  getV2ReservationRangeLabel,
  type V2BoardRow,
  type V2BoardTile,
} from "@/lib/v2-reservation-board";

type V2ReservationBoardProps = {
  today: string;
  todayLabel: string;
};

export function V2ReservationBoard({ today, todayLabel }: V2ReservationBoardProps) {
  const [reservations, setReservations] = useState<ReservationTimeBlock[]>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    const result = await listPublicReservationTimeBlocks(today);
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
          <DesktopBoard rows={rows} onTileClick={() => {}} />
          <MobileBoard rows={rows} onTileClick={() => {}} />
        </>
      )}
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
  const disabled = tile.state === "past" || tile.state === "unavailable";
  const label =
    tile.state === "reserved"
      ? `${tile.reservation?.name ?? "예약됨"} ${getV2ReservationRangeLabel(
          tile.reservation?.startMinutes ?? tile.startMinutes,
          tile.reservation?.endMinutes ?? tile.endMinutes,
        )}`
      : tile.state === "past"
        ? "종료"
        : "예약 가능";

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => onClick(tile)}
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-base font-bold transition active:translate-y-px disabled:pointer-events-none",
        tile.state === "available" && "border-emerald-300 bg-emerald-50 text-emerald-950 hover:bg-emerald-100",
        tile.state === "reserved" && "border-slate-300 bg-slate-100 text-slate-950 hover:bg-slate-200",
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
