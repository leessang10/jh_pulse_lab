"use client";

import { FormEvent, useMemo, useState } from "react";
import Link from "next/link";
import {
  findReservationConflict,
  formatMinutes,
  generateTimeSlots,
  getRoomName,
  ROOMS,
  STATUS_LABELS,
  validateReservationDraft,
  type ReservationDraft,
} from "@/lib/reservations";
import { useReservations } from "@/lib/use-reservations";

const timeSlots = generateTimeSlots();
const durationOptions = [30, 60, 90, 120, 150, 180, 210, 240];
const steps = ["날짜", "시간", "강의실", "예약자", "접수"];

function todayValue() {
  const now = new Date();
  const offset = now.getTimezoneOffset() * 60_000;
  return new Date(now.getTime() - offset).toISOString().slice(0, 10);
}

export default function ReservationPage() {
  const { reservations, addReservation, isReady } = useReservations();
  const [step, setStep] = useState(0);
  const [date, setDate] = useState(todayValue);
  const [startMinutes, setStartMinutes] = useState(600);
  const [duration, setDuration] = useState(60);
  const [roomId, setRoomId] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [message, setMessage] = useState("");

  const endMinutes = Math.min(startMinutes + duration, 1440);
  const canUseSelectedDuration = startMinutes + duration <= 1440;

  const availableRooms = useMemo(
    () =>
      ROOMS.map((room) => ({
        ...room,
        conflict: findReservationConflict(reservations, {
          date,
          roomId: room.id,
          startMinutes,
          endMinutes,
        }),
      })),
    [date, endMinutes, reservations, startMinutes],
  );

  const selectedRoomConflict =
    roomId === ""
      ? null
      : findReservationConflict(reservations, {
          date,
          roomId,
          startMinutes,
          endMinutes,
        });

  const dayReservations = useMemo(
    () =>
      reservations
        .filter((reservation) => reservation.date === date)
        .sort((a, b) => a.startMinutes - b.startMinutes || a.roomId.localeCompare(b.roomId)),
    [date, reservations],
  );

  function moveNext() {
    setMessage("");

    if (step === 1 && !canUseSelectedDuration) {
      setMessage("선택한 이용 시간이 24:00을 넘습니다.");
      return;
    }

    if (step === 2 && !roomId) {
      setMessage("예약 가능한 강의실을 선택해 주세요.");
      return;
    }

    setStep((current) => Math.min(current + 1, steps.length - 1));
  }

  function moveBack() {
    setMessage("");
    setStep((current) => Math.max(current - 1, 0));
  }

  function submitReservation(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const draft: ReservationDraft = { date, roomId, startMinutes, endMinutes, name, phone, note };
    const errors = validateReservationDraft(draft);
    if (selectedRoomConflict) {
      errors.push(`${getRoomName(roomId)} ${formatMinutes(selectedRoomConflict.startMinutes)} 예약과 시간이 겹칩니다.`);
    }

    if (errors.length > 0) {
      setMessage(errors[0]);
      return;
    }

    const reservation = addReservation(draft);
    setMessage(`${getRoomName(reservation.roomId)} ${formatMinutes(reservation.startMinutes)} 예약이 접수되었습니다.`);
    setStep(4);
  }

  function resetFlow() {
    setStep(0);
    setRoomId("");
    setName("");
    setPhone("");
    setNote("");
    setMessage("");
  }

  return (
    <main className="mx-auto grid min-h-screen w-full max-w-7xl gap-6 px-5 py-6 lg:grid-cols-[1.05fr_0.95fr] lg:px-8">
      <section className="grid content-start gap-6 py-2">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-bold text-[#dba24a]">DRUM ROOM BOOKING</p>
            <h1 className="mt-3 max-w-2xl text-4xl font-black leading-tight text-[#fff7e8] sm:text-6xl">
              JH 펄스랩
              <span className="block text-[#d9c7a3]">단계별 예약</span>
            </h1>
          </div>
          <Link
            href="/admin"
            className="rounded-md border border-[#f7f0df24] px-4 py-2 text-sm font-bold text-[#f7f0df] hover:border-[#dba24a]"
          >
            관리자
          </Link>
        </div>

        <nav className="grid grid-cols-5 gap-2">
          {steps.map((label, index) => (
            <button
              key={label}
              className={`rounded-md border px-2 py-3 text-xs font-black sm:text-sm ${
                index === step
                  ? "border-[#dba24a] bg-[#dba24a] text-[#17120a]"
                  : index < step
                    ? "border-[#dba24a66] bg-[#dba24a18] text-[#f7f0df]"
                    : "border-[#f7f0df18] bg-[#ffffff08] text-[#d7c9ad]"
              }`}
              onClick={() => {
                if (index < step) setStep(index);
              }}
              type="button"
            >
              {index + 1}. {label}
            </button>
          ))}
        </nav>

        <form className="panel grid min-h-[31rem] content-between gap-6 p-5 sm:p-6" onSubmit={submitReservation}>
          <div className="grid gap-5">
            {step === 0 ? (
              <section className="grid gap-5">
                <div>
                  <p className="text-sm font-bold text-[#dba24a]">1단계</p>
                  <h2 className="mt-2 text-3xl font-black">예약 날짜 선택</h2>
                </div>
                <label className="field max-w-sm">
                  <span className="field-label">날짜</span>
                  <input className="input" type="date" value={date} onChange={(event) => setDate(event.target.value)} />
                </label>
              </section>
            ) : null}

            {step === 1 ? (
              <section className="grid gap-5">
                <div>
                  <p className="text-sm font-bold text-[#dba24a]">2단계</p>
                  <h2 className="mt-2 text-3xl font-black">시작 시간과 이용 시간 선택</h2>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    <span className="field-label">시작 시간</span>
                    <select
                      className="input"
                      value={startMinutes}
                      onChange={(event) => {
                        setStartMinutes(Number(event.target.value));
                        setRoomId("");
                      }}
                    >
                      {timeSlots.map((slot) => (
                        <option key={slot.value} value={slot.value}>
                          {slot.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="field-label">이용 시간</span>
                    <select
                      className="input"
                      value={duration}
                      onChange={(event) => {
                        setDuration(Number(event.target.value));
                        setRoomId("");
                      }}
                    >
                      {durationOptions.map((minutes) => (
                        <option key={minutes} value={minutes} disabled={startMinutes + minutes > 1440}>
                          {minutes / 60 >= 1 ? `${minutes / 60}시간` : `${minutes}분`}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
                <p className={canUseSelectedDuration ? "text-sm text-[#d7c9ad]" : "text-sm font-bold text-[#ffb199]"}>
                  선택 시간: {formatMinutes(startMinutes)}-{formatMinutes(endMinutes)}
                </p>
              </section>
            ) : null}

            {step === 2 ? (
              <section className="grid gap-5">
                <div>
                  <p className="text-sm font-bold text-[#dba24a]">3단계</p>
                  <h2 className="mt-2 text-3xl font-black">예약 가능한 강의실 선택</h2>
                  <p className="mt-2 text-sm text-[#d7c9ad]">
                    {date} · {formatMinutes(startMinutes)}-{formatMinutes(endMinutes)}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  {availableRooms.map((room) => {
                    const conflict = room.conflict;
                    const isAvailable = !conflict;
                    const isSelected = roomId === room.id;

                    return (
                      <button
                        key={room.id}
                        className={`rounded-md border p-5 text-left transition ${
                          isSelected
                            ? "border-[#dba24a] bg-[#dba24a22]"
                            : isAvailable
                              ? "border-[#f7f0df18] bg-[#ffffff08] hover:border-[#dba24a]"
                              : "border-[#a8402d66] bg-[#a8402d24]"
                        }`}
                        disabled={!isAvailable}
                        onClick={() => setRoomId(room.id)}
                        type="button"
                      >
                        <span className="block text-xl font-black">{room.name}</span>
                        <span className={isAvailable ? "mt-2 block text-sm text-[#d7c9ad]" : "mt-2 block text-sm text-[#ffb199]"}>
                          {isAvailable
                            ? "예약 가능"
                            : `${formatMinutes(conflict.startMinutes)}-${formatMinutes(conflict.endMinutes)} 예약 있음`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </section>
            ) : null}

            {step === 3 ? (
              <section className="grid gap-5">
                <div>
                  <p className="text-sm font-bold text-[#dba24a]">4단계</p>
                  <h2 className="mt-2 text-3xl font-black">예약자 정보 입력</h2>
                  <p className="mt-2 text-sm text-[#d7c9ad]">
                    {date} · {getRoomName(roomId)} · {formatMinutes(startMinutes)}-{formatMinutes(endMinutes)}
                  </p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="field">
                    <span className="field-label">예약자 이름</span>
                    <input className="input" value={name} onChange={(event) => setName(event.target.value)} />
                  </label>
                  <label className="field">
                    <span className="field-label">연락처</span>
                    <input className="input" value={phone} onChange={(event) => setPhone(event.target.value)} />
                  </label>
                </div>
                <label className="field">
                  <span className="field-label">메모</span>
                  <textarea
                    className="input min-h-24 resize-none"
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                  />
                </label>
              </section>
            ) : null}

            {step === 4 ? (
              <section className="grid content-center gap-5 py-10 text-center">
                <p className="text-sm font-bold text-[#dba24a]">5단계</p>
                <h2 className="text-3xl font-black">예약 접수 완료</h2>
                <p className="mx-auto max-w-lg text-[#d7c9ad]">
                  관리자 확인 후 예약 상태가 확정됩니다. 같은 브라우저의 관리자 페이지에서 접수 내역을 확인할 수 있습니다.
                </p>
                {message ? <p className="rounded-md bg-[#ffffff12] px-4 py-3 text-sm font-bold text-[#fff7e8]">{message}</p> : null}
              </section>
            ) : null}
          </div>

          <div className="grid gap-3">
            {message && step !== 4 ? (
              <p className="rounded-md bg-[#ffffff12] px-4 py-3 text-sm font-bold text-[#fff7e8]">{message}</p>
            ) : null}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <button
                className="rounded-md border border-[#f7f0df24] px-5 py-3 font-bold text-[#f7f0df] hover:border-[#dba24a]"
                disabled={step === 0}
                onClick={step === 4 ? resetFlow : moveBack}
                type="button"
              >
                {step === 4 ? "새 예약" : "이전"}
              </button>
              {step < 3 ? (
                <button
                  className="rounded-md bg-[#dba24a] px-5 py-3 font-black text-[#17120a] hover:bg-[#f0b95f]"
                  onClick={moveNext}
                  type="button"
                >
                  다음
                </button>
              ) : step === 3 ? (
                <button
                  className="rounded-md bg-[#dba24a] px-5 py-3 font-black text-[#17120a] hover:bg-[#f0b95f]"
                  disabled={!isReady}
                  type="submit"
                >
                  접수
                </button>
              ) : (
                <Link
                  className="rounded-md bg-[#dba24a] px-5 py-3 text-center font-black text-[#17120a] hover:bg-[#f0b95f]"
                  href="/admin"
                >
                  관리자에서 확인
                </Link>
              )}
            </div>
          </div>
        </form>
      </section>

      <aside className="grid content-start gap-4 py-2">
        <div className="panel p-5">
          <p className="text-sm font-bold text-[#dba24a]">선택 내역</p>
          <dl className="mt-4 grid gap-3 text-sm">
            <div className="flex justify-between gap-4 border-b border-[#f7f0df12] pb-3">
              <dt className="text-[#d7c9ad]">날짜</dt>
              <dd className="font-bold">{date}</dd>
            </div>
            <div className="flex justify-between gap-4 border-b border-[#f7f0df12] pb-3">
              <dt className="text-[#d7c9ad]">시간</dt>
              <dd className="font-bold">
                {formatMinutes(startMinutes)}-{formatMinutes(endMinutes)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#d7c9ad]">강의실</dt>
              <dd className="font-bold">{roomId ? getRoomName(roomId) : "선택 전"}</dd>
            </div>
          </dl>
        </div>

        <div className="panel p-5">
          <h2 className="text-xl font-black">해당 날짜 예약 현황</h2>
          <div className="mt-4 grid gap-3">
            {dayReservations.length === 0 ? (
              <p className="rounded-md border border-dashed border-[#f7f0df24] p-5 text-center text-sm text-[#d7c9ad]">
                예약이 없습니다.
              </p>
            ) : (
              dayReservations.map((reservation) => (
                <div key={reservation.id} className="rounded-md border border-[#f7f0df14] bg-[#ffffff08] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <strong>{getRoomName(reservation.roomId)}</strong>
                    <span className="text-sm text-[#dba24a]">{STATUS_LABELS[reservation.status]}</span>
                  </div>
                  <p className="mt-2 text-sm text-[#d7c9ad]">
                    {formatMinutes(reservation.startMinutes)}-{formatMinutes(reservation.endMinutes)} · {reservation.name}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      </aside>
    </main>
  );
}
