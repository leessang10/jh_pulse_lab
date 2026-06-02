"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Trash2Icon } from "lucide-react";
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
import { getAdminSession, loginAdmin, logoutAdmin } from "@/lib/admin-auth-actions";
import { formatMinutes, getRoomName, ROOMS, STATUS_LABELS, type ReservationStatus } from "@/lib/reservations";
import { useReservations } from "@/lib/use-reservations";

const statuses: Array<ReservationStatus | "all"> = ["all", "pending", "confirmed", "cancelled"];

function statusVariant(status: ReservationStatus) {
  if (status === "cancelled") return "destructive";
  if (status === "confirmed") return "default";
  return "secondary";
}

export default function AdminPage() {
  const [date, setDate] = useState(todayKoreaValue);
  const [roomId, setRoomId] = useState("all");
  const [status, setStatus] = useState<ReservationStatus | "all">("all");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const { reservations, updateReservationStatus, removeReservation, isReady, error } = useReservations({
    date,
    admin: true,
    enabled: isLoggedIn,
    roomId,
    status,
  });

  useEffect(() => {
    let isMounted = true;

    getAdminSession()
      .then((user) => {
        if (!isMounted) return;
        setIsLoggedIn(Boolean(user));
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoggedIn(false);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsSessionReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const filteredReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.date === date)
        .filter((reservation) => roomId === "all" || reservation.roomId === roomId)
        .filter((reservation) => status === "all" || reservation.status === status)
        .sort((a, b) => a.startMinutes - b.startMinutes || a.roomId.localeCompare(b.roomId)),
    [date, reservations, roomId, status],
  );

  async function submitLogin() {
    const result = await loginAdmin(email, password);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setIsLoggedIn(true);
    setPassword("");
    toast.success("로그인했습니다.");
  }

  async function submitLogout() {
    const result = await logoutAdmin();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    setIsLoggedIn(false);
    toast.success("로그아웃했습니다.");
  }

  async function changeStatus(id: string, nextStatus: ReservationStatus) {
    const result = await updateReservationStatus(id, nextStatus);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success(`예약 상태를 ${STATUS_LABELS[nextStatus]}로 변경했습니다.`);
  }

  async function deleteReservation(id: string) {
    const result = await removeReservation(id);
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("예약을 삭제했습니다.");
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 lg:px-8">
      <header className="flex flex-col gap-4 py-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <Badge variant="outline" className="border-primary/30 bg-card text-primary">
            예약 관리
          </Badge>
          <h1 className="mt-2 text-4xl font-bold text-foreground sm:text-5xl">예약 관리</h1>
        </div>
        <div className="flex flex-wrap gap-2">
          {isLoggedIn ? (
            <Button onClick={submitLogout} type="button" variant="outline">
              로그아웃
            </Button>
          ) : null}
          <Button render={<Link href="/reservation" />} variant="outline">
            예약 페이지
          </Button>
        </div>
      </header>

      {!isSessionReady ? (
        <Card className="mt-6 border bg-card shadow-sm">
          <CardContent className="p-8 text-center text-muted-foreground">관리자 세션을 확인하는 중입니다.</CardContent>
        </Card>
      ) : !isLoggedIn ? (
        <Card className="mt-6 border bg-card shadow-sm">
          <CardHeader>
            <CardTitle>관리자 로그인</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4">
            <Input
              autoComplete="email"
              onChange={(event) => setEmail(event.target.value)}
              placeholder="이메일"
              type="email"
              value={email}
            />
            <Input
              autoComplete="current-password"
              onChange={(event) => setPassword(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void submitLogin();
              }}
              placeholder="비밀번호"
              type="password"
              value={password}
            />
            <Button onClick={submitLogin} type="button">
              로그인
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
      <Card className="mt-6 border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>필터</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <div className="grid gap-2">
            <span className="text-sm font-bold text-muted-foreground">날짜</span>
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
            <span className="text-sm font-bold text-muted-foreground">강의실</span>
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
            <span className="text-sm font-bold text-muted-foreground">상태</span>
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

      <Card className="mt-6 border bg-card shadow-sm">
        <CardHeader>
          <CardTitle>예약 목록</CardTitle>
        </CardHeader>
        <CardContent>
          {error ? (
            <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 font-bold text-destructive">
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
                    <TableHead>강의실</TableHead>
                    <TableHead>예약자</TableHead>
                    <TableHead>연락처</TableHead>
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
                      <TableCell>{reservation.phone}</TableCell>
                      <TableCell>
                        <Badge variant={statusVariant(reservation.status)}>{STATUS_LABELS[reservation.status]}</Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap justify-end gap-2">
                          {(["pending", "confirmed", "cancelled"] as ReservationStatus[]).map((nextStatus) => (
                            <Button
                              key={nextStatus}
                              disabled={reservation.status === nextStatus}
                              onClick={() => changeStatus(reservation.id, nextStatus)}
                              size="sm"
                              type="button"
                              variant="outline"
                            >
                              {STATUS_LABELS[nextStatus]}
                            </Button>
                          ))}
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
        </>
      )}
    </main>
  );
}
