"use client";

import { useEffect, useMemo, useState } from "react";
import { CalendarX2Icon, Trash2Icon } from "lucide-react";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { dateToKoreaValue, formatKoreaDate, todayKoreaValue, valueToKoreaDate } from "@/lib/korea-date";
import { formatMinutes, getRoomName, ROOMS, STATUS_LABELS, type ReservationStatus } from "@/lib/reservations";
import { useReservations } from "@/lib/use-reservations";
import AdminPageHeader from "./admin-page-header";

const statuses: Array<ReservationStatus | "all"> = ["all", "pending", "confirmed", "cancelled"];

function statusVariant(status: ReservationStatus) {
  if (status === "cancelled") return "destructive";
  if (status === "confirmed") return "default";
  return "secondary";
}

export default function AdminReservationsPage() {
  const [date, setDate] = useState(todayKoreaValue);
  const [roomId, setRoomId] = useState("all");
  const [status, setStatus] = useState<ReservationStatus | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const { reservations, updateReservationStatus, removeReservation, isReady, error, refresh } = useReservations({
    date,
    admin: true,
    roomId,
    status,
  });

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void refresh();
    }, 60_000);

    return () => window.clearInterval(intervalId);
  }, [refresh]);

  const filteredReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.date === date)
        .filter((reservation) => roomId === "all" || reservation.roomId === roomId)
        .filter((reservation) => status === "all" || reservation.status === status)
        .filter((reservation) => {
          const query = searchQuery.trim().toLowerCase();
          if (!query) return true;

          return `${reservation.name} ${reservation.note ?? ""}`.toLowerCase().includes(query);
        })
        .sort((a, b) => a.startMinutes - b.startMinutes || a.roomId.localeCompare(b.roomId)),
    [date, reservations, roomId, searchQuery, status],
  );

  async function deleteReservation(id: string) {
    const result = await removeReservation(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("예약을 삭제했습니다.");
  }

  async function cancelReservation(id: string) {
    const result = await updateReservationStatus(id, "cancelled");
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("예약을 취소했습니다.");
  }

  return (
    <main className="min-h-screen w-full px-5 py-4 lg:px-8">
      <AdminPageHeader title="예약 목록" />

      <Card className="mt-4 border bg-card">
        <CardHeader>
          <CardTitle>필터</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4">
          <div className="grid gap-2">
            <span className="text-sm font-semibold text-muted-foreground">검색</span>
            <Input
              className="h-11"
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="예약자 또는 메모"
              value={searchQuery}
            />
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-semibold text-muted-foreground">날짜</span>
            <Popover>
              <PopoverTrigger render={<Button variant="outline" className="h-11 justify-start" />}>{formatKoreaDate(date)}</PopoverTrigger>
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
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-semibold text-muted-foreground">연습실</span>
            <Select value={roomId} onValueChange={(value) => value && setRoomId(value)}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체</SelectItem>
                {ROOMS.map((room) => (
                  <SelectItem key={room.id} value={room.id}>
                    {room.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-2">
            <span className="text-sm font-semibold text-muted-foreground">상태</span>
            <Select value={status} onValueChange={(value) => setStatus(value as ReservationStatus | "all")}>
              <SelectTrigger className="h-11 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {statuses.map((value) => (
                  <SelectItem key={value} value={value}>
                    {value === "all" ? "전체" : STATUS_LABELS[value]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card className="mt-6 border bg-card">
        <CardHeader>
          <CardTitle>예약 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 font-semibold text-destructive">
              {error}
            </div>
          ) : null}
          {!isReady ? (
            <div className="p-8 text-center text-muted-foreground">예약 데이터를 불러오는 중입니다.</div>
          ) : filteredReservations.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center text-muted-foreground">조건에 맞는 예약이 없습니다.</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>시간</TableHead>
                    <TableHead>연습실</TableHead>
                    <TableHead>예약자</TableHead>
                    <TableHead>상태</TableHead>
                    <TableHead className="text-right">관리</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredReservations.map((reservation) => (
                    <TableRow key={reservation.id}>
                      <TableCell className="font-bold">
                        {formatMinutes(reservation.startMinutes)}-{formatMinutes(reservation.endMinutes)}
                      </TableCell>
                      <TableCell>{getRoomName(reservation.roomId)}</TableCell>
                      <TableCell>
                        <div className="font-bold">{reservation.name}</div>
                        {reservation.note ? <div className="mt-1 text-xs text-muted-foreground">{reservation.note}</div> : null}
                      </TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(reservation.status)}>{STATUS_LABELS[reservation.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          {reservation.status !== "cancelled" ? (
                            <AlertDialog>
                              <AlertDialogTrigger render={<Button size="sm" type="button" variant="destructive" />}>
                                <CalendarX2Icon />
                                예약 취소
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>예약을 취소할까요?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    {reservation.name}님의 {getRoomName(reservation.roomId)}{" "}
                                    {formatMinutes(reservation.startMinutes)}-{formatMinutes(reservation.endMinutes)} 예약이
                                    취소되고 해당 슬롯이 다시 열립니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>닫기</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => cancelReservation(reservation.id)}>
                                    예약 취소
                                  </AlertDialogAction>
                                </AlertDialogFooter>
                              </AlertDialogContent>
                            </AlertDialog>
                          ) : null}
                          <AlertDialog>
                            <AlertDialogTrigger render={<Button size="sm" type="button" variant="destructive" />}>
                              <Trash2Icon />
                              삭제
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>예약을 삭제할까요?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  {reservation.name}님의 {getRoomName(reservation.roomId)} 예약이 목록에서 제거됩니다.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>취소</AlertDialogCancel>
                                <AlertDialogAction onClick={() => deleteReservation(reservation.id)}>삭제</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
