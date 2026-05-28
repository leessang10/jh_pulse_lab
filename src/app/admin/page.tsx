"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  formatMinutes,
  getRoomName,
  ROOMS,
  STATUS_LABELS,
  type ReservationStatus,
} from "@/lib/reservations";
import { useReservations } from "@/lib/use-reservations";

const statuses: Array<ReservationStatus | "all"> = ["all", "pending", "confirmed", "cancelled"];

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function AdminPage() {
  const { reservations, updateReservationStatus, removeReservation, isReady } = useReservations();
  const [date, setDate] = useState(todayValue);
  const [roomId, setRoomId] = useState("all");
  const [status, setStatus] = useState<ReservationStatus | "all">("all");

  const filteredReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.date === date)
        .filter((reservation) => roomId === "all" || reservation.roomId === roomId)
        .filter((reservation) => status === "all" || reservation.status === status)
        .sort((a, b) => a.startMinutes - b.startMinutes || a.roomId.localeCompare(b.roomId)),
    [date, reservations, roomId, status],
  );

  return (
    <main className="mx-auto min-h-screen w-full max-w-7xl px-5 py-6 lg:px-8">
      <header className="flex flex-col gap-4 py-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-bold text-[#dba24a]">ADMIN CONSOLE</p>
          <h1 className="mt-2 text-4xl font-black text-[#fff7e8] sm:text-5xl">예약 관리</h1>
        </div>
        <Link
          href="/"
          className="w-fit rounded-md border border-[#f7f0df24] px-4 py-2 text-sm font-bold text-[#f7f0df] hover:border-[#dba24a]"
        >
          예약 페이지
        </Link>
      </header>

      <section className="panel mt-6 grid gap-4 p-5 md:grid-cols-3">
        <label className="field">
          <span className="field-label">날짜</span>
          <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
        </label>
        <label className="field">
          <span className="field-label">강의실</span>
          <select className="input" value={roomId} onChange={(event) => setRoomId(event.target.value)}>
            <option value="all">전체</option>
            {ROOMS.map((room) => (
              <option key={room.id} value={room.id}>
                {room.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          <span className="field-label">상태</span>
          <select
            className="input"
            value={status}
            onChange={(event) => setStatus(event.target.value as ReservationStatus | "all")}
          >
            {statuses.map((value) => (
              <option key={value} value={value}>
                {value === "all" ? "전체" : STATUS_LABELS[value]}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="mt-6 grid gap-3">
        {!isReady ? (
          <p className="panel p-6 text-center text-[#d7c9ad]">예약 데이터를 불러오는 중입니다.</p>
        ) : filteredReservations.length === 0 ? (
          <p className="panel p-8 text-center text-[#d7c9ad]">조건에 맞는 예약이 없습니다.</p>
        ) : (
          filteredReservations.map((reservation) => (
            <article
              key={reservation.id}
              className="panel grid gap-4 p-5 lg:grid-cols-[1.1fr_1fr_auto] lg:items-center"
            >
              <div>
                <div className="flex flex-wrap items-center gap-3">
                  <strong className="text-xl">{reservation.name}</strong>
                  <span className="rounded-md border border-[#dba24a55] px-2 py-1 text-xs font-black text-[#dba24a]">
                    {STATUS_LABELS[reservation.status]}
                  </span>
                </div>
                <p className="mt-2 text-sm text-[#d7c9ad]">{reservation.phone}</p>
                {reservation.note ? <p className="mt-2 text-sm text-[#f7f0df]">{reservation.note}</p> : null}
              </div>

              <div className="text-sm font-bold text-[#d7c9ad]">
                <p>{getRoomName(reservation.roomId)}</p>
                <p className="mt-2">
                  {reservation.date} · {formatMinutes(reservation.startMinutes)}-
                  {formatMinutes(reservation.endMinutes)}
                </p>
              </div>

              <div className="flex flex-wrap gap-2 lg:justify-end">
                {(["pending", "confirmed", "cancelled"] as ReservationStatus[]).map((nextStatus) => (
                  <button
                    key={nextStatus}
                    className="rounded-md border border-[#f7f0df24] px-3 py-2 text-sm font-bold hover:border-[#dba24a]"
                    disabled={reservation.status === nextStatus}
                    onClick={() => updateReservationStatus(reservation.id, nextStatus)}
                    type="button"
                  >
                    {STATUS_LABELS[nextStatus]}
                  </button>
                ))}
                <button
                  className="rounded-md bg-[#a8402d] px-3 py-2 text-sm font-black text-[#fff7e8] hover:bg-[#bd4e38]"
                  onClick={() => removeReservation(reservation.id)}
                  type="button"
                >
                  삭제
                </button>
              </div>
            </article>
          ))
        )}
      </section>
    </main>
  );
}
