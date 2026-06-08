"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlusIcon, ClipboardListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKoreaDate, todayKoreaValue } from "@/lib/korea-date";
import {
  getLandingRoomScheduleSummaries,
  type LandingRoomScheduleSummary,
  type LandingScheduleSlot,
} from "@/lib/landing-schedule";
import { DAY_END_MINUTES, SLOT_MINUTES } from "@/lib/reservations";
import { useReservations } from "@/lib/use-reservations";

const scheduleSize = 360;
const scheduleCenter = scheduleSize / 2;
const scheduleRadius = 126;
const hourMarkerRadius = 150;
const hourLabelRadius = 168;
const slotAngle = 360 / (DAY_END_MINUTES / SLOT_MINUTES);
const hourMarkers = Array.from({ length: 24 }, (_, hour) => hour);

function pointOnCircle(angleDegrees: number, radius: number) {
  const radians = ((angleDegrees - 90) * Math.PI) / 180;

  return {
    x: scheduleCenter + radius * Math.cos(radians),
    y: scheduleCenter + radius * Math.sin(radians),
  };
}

function getSlotArcPath(index: number) {
  const startAngle = index * slotAngle + 0.85;
  const endAngle = (index + 1) * slotAngle - 0.85;
  const start = pointOnCircle(startAngle, scheduleRadius);
  const end = pointOnCircle(endAngle, scheduleRadius);

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${scheduleRadius} ${scheduleRadius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(" ");
}

function getFloatingLabelStyle(slot: LandingScheduleSlot): CSSProperties {
  const angle = (slot.index + 0.5) * slotAngle;
  const radians = ((angle - 90) * Math.PI) / 180;
  const radius = 43;

  return {
    left: `${50 + radius * Math.cos(radians)}%`,
    top: `${50 + radius * Math.sin(radians)}%`,
    transform: "translate(-50%, -50%)",
  };
}

function getSlotTitle(slot: LandingScheduleSlot) {
  return `${slot.rangeLabel} ${slot.bookedByLabel}`;
}

function isFirstLabelSlot(slot: LandingScheduleSlot, index: number, slots: LandingScheduleSlot[]) {
  const previous = slots[index - 1];

  return !previous || previous.endMinutes !== slot.startMinutes || previous.bookedByLabel !== slot.bookedByLabel;
}

function RoomSummaryTile({
  isSelected,
  onSelect,
  summary,
}: {
  isSelected: boolean;
  onSelect: () => void;
  summary: LandingRoomScheduleSummary;
}) {
  const hasBookings = summary.bookedSlotCount > 0;

  return (
    <button
      aria-label={`${summary.roomName} 예약 현황 보기, 예약된 시간 ${summary.bookedSlotCount}개`}
      aria-pressed={isSelected}
      className={`motion-action grid aspect-[1/1.08] min-h-0 grid-rows-[auto_1fr] place-items-center gap-0 rounded-lg border p-1.5 text-center transition-colors focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:aspect-square sm:gap-1 sm:p-3 ${
        isSelected
          ? "border-primary bg-card shadow-sm ring-2 ring-primary/60 ring-inset"
          : "border-border bg-card hover:border-primary hover:bg-muted/55"
      }`}
      onClick={onSelect}
      type="button"
    >
      <div className="truncate text-sm font-black leading-tight tracking-normal text-foreground sm:text-2xl">
        {summary.roomName}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[7.25rem] self-center sm:w-[92%] sm:max-w-none">
        <svg
          aria-hidden="true"
          className="size-full overflow-visible"
          viewBox={`0 0 ${scheduleSize} ${scheduleSize}`}
        >
          <circle
            className={hasBookings ? "fill-none stroke-border" : "fill-pulse-accent-soft stroke-pulse-accent"}
            cx={scheduleCenter}
            cy={scheduleCenter}
            r={scheduleRadius - 34}
            opacity={hasBookings ? 0.55 : 0.3}
            strokeWidth={hasBookings ? 1 : 2}
          />
          {summary.slots.map((slot) => (
            <path
              key={slot.startMinutes}
              className={
                slot.isBooked
                  ? "fill-none stroke-pulse-accent"
                  : hasBookings
                    ? "fill-none stroke-muted"
                    : "fill-none stroke-pulse-accent-soft"
              }
              d={getSlotArcPath(slot.index)}
              opacity={slot.isBooked ? 1 : hasBookings ? 0.48 : slot.index % 2 === 0 ? 0.95 : 0.68}
              strokeLinecap="round"
              strokeWidth={slot.isBooked ? 14 : hasBookings ? 7 : 9}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-xl font-black leading-none tracking-normal text-foreground sm:text-3xl">
            {summary.bookedSlotCount}
          </span>
        </div>
      </div>
    </button>
  );
}

function RoomDetailSchedule({ summary }: { summary: LandingRoomScheduleSummary }) {
  const bookedSlots = summary.slots.filter((slot) => slot.isBooked);
  const bookedLabelSlots = bookedSlots.filter(isFirstLabelSlot);

  return (
    <section aria-label={`${summary.roomName} 상세 예약 현황`} className="grid gap-4">
      <div className="grid gap-1 text-center">
        <div className="text-sm font-bold text-muted-foreground">상세 예약 현황</div>
        <h2 className="text-2xl font-black tracking-normal text-foreground sm:text-3xl">{summary.roomName}</h2>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[min(100%,35rem,calc(100dvh-20rem))] min-w-0">
        <svg
          aria-label={`${summary.roomName} 오늘 예약 시간을 시계처럼 보여주는 표`}
          className="size-full overflow-visible"
          role="img"
          viewBox={`0 0 ${scheduleSize} ${scheduleSize}`}
        >
          <circle
            className="fill-background stroke-border"
            cx={scheduleCenter}
            cy={scheduleCenter}
            r={scheduleRadius - 24}
            strokeWidth="1"
          />
          <circle
            className="fill-none stroke-muted"
            cx={scheduleCenter}
            cy={scheduleCenter}
            r={scheduleRadius}
            strokeWidth="1"
          />
          {summary.slots.map((slot) => (
            <path
              key={slot.startMinutes}
              className={slot.isBooked ? "fill-none stroke-pulse-accent" : "fill-none stroke-muted"}
              d={getSlotArcPath(slot.index)}
              opacity={slot.isBooked ? 1 : 0.62}
              strokeLinecap="round"
              strokeWidth={slot.isBooked ? 11 : 5}
            >
              <title>{getSlotTitle(slot)}</title>
            </path>
          ))}
          {hourMarkers.map((hour) => {
            const angle = hour * 15;
            const outer = pointOnCircle(angle, hourMarkerRadius);
            const inner = pointOnCircle(angle, hour % 6 === 0 ? 132 : 140);
            const label = pointOnCircle(angle, hourLabelRadius);

            return (
              <g key={hour}>
                <line
                  className={hour % 6 === 0 ? "stroke-foreground" : "stroke-muted-foreground"}
                  opacity={hour % 6 === 0 ? 0.86 : 0.5}
                  strokeLinecap="round"
                  strokeWidth={hour % 6 === 0 ? 2.5 : 1.4}
                  x1={inner.x}
                  x2={outer.x}
                  y1={inner.y}
                  y2={outer.y}
                />
                <text
                  className={
                    hour % 6 === 0
                      ? "fill-foreground text-[1.02rem] font-black"
                      : "fill-muted-foreground text-[0.86rem] font-extrabold"
                  }
                  dominantBaseline="middle"
                  textAnchor="middle"
                  x={label.x}
                  y={label.y}
                >
                  {String(hour).padStart(2, "0")}
                </text>
              </g>
            );
          })}
        </svg>

        <div className="absolute inset-[30%] grid place-items-center rounded-full border bg-background/95 p-4 text-center shadow-sm backdrop-blur">
          <div>
            <div className="text-xs font-bold text-muted-foreground">오늘</div>
            <div className="text-3xl font-black leading-none sm:text-4xl">{bookedSlots.length}</div>
            <div className="mt-1 text-xs font-bold text-muted-foreground">예약된 시간</div>
          </div>
        </div>

        {bookedLabelSlots.map((slot) => (
          <div
            key={`${slot.startMinutes}-${slot.bookedByLabel}`}
            className="absolute max-w-28 truncate rounded-md border border-pulse-accent/30 bg-background/95 px-2 py-1 text-[0.68rem] font-bold text-foreground shadow-sm backdrop-blur sm:max-w-36 sm:text-xs"
            style={getFloatingLabelStyle(slot)}
            title={getSlotTitle(slot)}
          >
            {slot.bookedByLabel}
          </div>
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const [date] = useState(todayKoreaValue);
  const { reservations, error } = useReservations({ date });
  const summaries = useMemo(() => getLandingRoomScheduleSummaries(reservations, date), [date, reservations]);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const selectedSummary = useMemo(
    () => summaries.find((summary) => summary.roomId === selectedRoomId) ?? null,
    [selectedRoomId, summaries],
  );
  const dateLabel = useMemo(() => formatKoreaDate(date), [date]);

  return (
    <main className="min-h-screen bg-background px-3 py-4 text-foreground sm:px-6">
      <section className="mx-auto grid min-h-[calc(100vh-2rem)] w-full max-w-5xl content-start gap-5">
        <header className="grid gap-2 pt-2 text-center sm:pt-3">
          <div className="mx-auto flex items-baseline justify-center gap-2 text-2xl font-black tracking-normal text-foreground sm:text-3xl">
            <span>JH</span>
            <span>PULSE</span>
            <span>LAB</span>
          </div>
          <p className="grid gap-1 text-base font-bold text-muted-foreground sm:text-lg">
            <span>{dateLabel}</span>
            <span>강의실별 빈 시간을 한눈에 확인하세요</span>
          </p>
        </header>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {error}
          </div>
        ) : null}

        <section aria-label="강의실별 예약 요약" className="grid grid-cols-3 gap-2 sm:gap-3">
          {summaries.map((summary) => (
            <RoomSummaryTile
              key={summary.roomId}
              isSelected={summary.roomId === selectedSummary?.roomId}
              onSelect={() => setSelectedRoomId(summary.roomId)}
              summary={summary}
            />
          ))}
        </section>

        {selectedSummary ? <RoomDetailSchedule summary={selectedSummary} /> : null}

        <div className="grid gap-3 pb-[max(1rem,env(safe-area-inset-bottom))] sm:grid-cols-2">
          <Button
            className="motion-action h-14 rounded-xl text-base font-bold sm:text-lg"
            nativeButton={false}
            render={<Link href="/reservation" />}
          >
            <CalendarPlusIcon data-icon="inline-start" />
            예약하기
          </Button>
          <Button
            className="motion-action h-14 rounded-xl text-base font-bold sm:text-lg"
            nativeButton={false}
            render={<Link href="/reservations" />}
            variant="outline"
          >
            <ClipboardListIcon data-icon="inline-start" />
            예약내역 보기
          </Button>
        </div>
      </section>
    </main>
  );
}
