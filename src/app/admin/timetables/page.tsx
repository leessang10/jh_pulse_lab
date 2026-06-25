"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SidebarTrigger } from "@/components/ui/sidebar";
import AdminShell from "../admin-shell";
import { buildAdminTimetableRows, type AdminTimetableTile } from "@/lib/admin-timetable";
import { dateToKoreaValue, formatKoreaDate, todayKoreaValue, valueToKoreaDate } from "@/lib/korea-date";
import { formatMinutes, getRoomName, STATUS_LABELS } from "@/lib/reservations";
import { cn } from "@/lib/utils";
import { useReservations } from "@/lib/use-reservations";

export default function AdminTimetablesRoute() {
  return (
    <AdminShell>
      <AdminTimetablesPage />
    </AdminShell>
  );
}

function AdminTimetablesPage() {
  const [date, setDate] = useState(todayKoreaValue);
  const [selectedTile, setSelectedTile] = useState<AdminTimetableTile | null>(null);
  const { reservations, updateReservationStatus, isReady, error } = useReservations({
    date,
    admin: true,
    roomId: "all",
    status: "all",
  });

  const rows = useMemo(() => buildAdminTimetableRows({ date, reservations }), [date, reservations]);
  const selectedReservation = selectedTile?.reservation;

  async function cancelReservation() {
    if (!selectedReservation) return;

    const result = await updateReservationStatus(selectedReservation.id, "cancelled");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("예약을 취소했습니다.");
    setSelectedTile(null);
  }

  return (
    <>
        <main className="min-h-screen w-full px-5 py-6 lg:px-8">
          <header className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-start gap-3">
              <SidebarTrigger className="mt-1 md:hidden" />
              <div>
                <Badge variant="outline" className="border-border bg-background text-muted-foreground">
                  예약 시간표
                </Badge>
                <h1 className="mt-2 text-3xl font-bold text-foreground sm:text-4xl">예약 시간표</h1>
              </div>
            </div>
          </header>

          <Card className="mt-6 border bg-card">
            <CardHeader>
              <CardTitle>날짜</CardTitle>
            </CardHeader>
            <CardContent>
              <Popover>
                <PopoverTrigger render={<Button variant="outline" className="h-11 justify-start" />}>
                  {formatKoreaDate(date)}
                </PopoverTrigger>
                <PopoverContent align="start" className="w-auto">
                  <Calendar
                    mode="single"
                    selected={valueToKoreaDate(date)}
                    onSelect={(nextDate) => {
                      if (nextDate) setDate(dateToKoreaValue(nextDate));
                    }}
                  />
                </PopoverContent>
              </Popover>
            </CardContent>
          </Card>

          <Card className="mt-6 border bg-card">
            <CardHeader>
              <CardTitle>시간표</CardTitle>
            </CardHeader>
            <CardContent>
              {error ? (
                <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 font-semibold text-destructive">
                  {error}
                </div>
              ) : null}
              {!isReady ? (
                <div className="grid gap-3">
                  {Array.from({ length: 6 }, (_, index) => (
                    <div key={index} className="h-16 rounded-lg border border-border bg-muted/50" />
                  ))}
                </div>
              ) : (
                <>
                  <DesktopTimetable rows={rows} onTileClick={setSelectedTile} />
                  <MobileTimetable rows={rows} onTileClick={setSelectedTile} />
                </>
              )}
            </CardContent>
          </Card>
        </main>

      <AlertDialog open={Boolean(selectedReservation)} onOpenChange={(open) => !open && setSelectedTile(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>예약을 취소할까요?</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedReservation
                ? `${selectedReservation.name}님의 ${getRoomName(selectedReservation.roomId)} ${formatMinutes(
                    selectedReservation.startMinutes,
                  )}-${formatMinutes(selectedReservation.endMinutes)} 예약이 취소됩니다.`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>닫기</AlertDialogCancel>
            <AlertDialogAction onClick={cancelReservation}>예약 취소</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function DesktopTimetable({
  rows,
  onTileClick,
}: {
  rows: ReturnType<typeof buildAdminTimetableRows>;
  onTileClick: (tile: AdminTimetableTile) => void;
}) {
  const rooms = rows[0]?.tiles.map((tile) => tile.room) ?? [];

  return (
    <div className="hidden overflow-hidden rounded-lg border border-border md:block">
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
              <TimetableTile tile={tile} onClick={onTileClick} />
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

function MobileTimetable({
  rows,
  onTileClick,
}: {
  rows: ReturnType<typeof buildAdminTimetableRows>;
  onTileClick: (tile: AdminTimetableTile) => void;
}) {
  return (
    <div className="grid gap-3 md:hidden">
      {rows.map((row) => (
        <section key={row.startMinutes} className="rounded-lg border border-border bg-card p-3">
          <h2 className="mb-3 text-xl font-bold">{row.timeLabel}</h2>
          <div className="grid gap-2">
            {row.tiles.map((tile) => (
              <TimetableTile key={tile.key} tile={tile} onClick={onTileClick} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function TimetableTile({ tile, onClick }: { tile: AdminTimetableTile; onClick: (tile: AdminTimetableTile) => void }) {
  const reservation = tile.reservation;
  const isClickable = tile.state === "reserved" && reservation;
  const label = reservation
    ? `${reservation.name} ${formatMinutes(reservation.startMinutes)}-${formatMinutes(reservation.endMinutes)}`
    : "비어 있음";

  return (
    <button
      type="button"
      aria-label={`${tile.timeLabel} ${tile.room.name} ${label}`}
      disabled={!isClickable}
      onClick={() => onClick(tile)}
      className={cn(
        "flex min-h-14 w-full items-center justify-between gap-3 rounded-lg border px-4 py-3 text-left text-base font-bold transition active:translate-y-px disabled:pointer-events-none",
        tile.state === "empty" && "border-border bg-background text-muted-foreground",
        tile.state === "reserved" && "border-slate-300 bg-slate-100 text-slate-950 hover:bg-slate-200",
        tile.state === "cancelled" && "border-destructive/30 bg-destructive/10 text-destructive opacity-70",
      )}
    >
      <span className="md:hidden">{tile.room.name}</span>
      <span className="truncate">{label}</span>
      {reservation ? <Badge variant={reservation.status === "cancelled" ? "destructive" : "secondary"}>{STATUS_LABELS[reservation.status]}</Badge> : null}
    </button>
  );
}
