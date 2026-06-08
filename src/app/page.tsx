"use client";

import type { CSSProperties } from "react";
import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlusIcon, ClipboardListIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatKoreaDate, todayKoreaValue } from "@/lib/korea-date";
import {
  getLandingDetailCenterPanelClassName,
  getLandingDetailCardinalTimeLabels,
  getLandingDetailHourMarkers,
  getLandingDetailReservationBlockBorder,
  getLandingDetailReservationLabelClassName,
  getLandingDetailScheduleGeometry,
  getLandingDetailSectorAngles,
} from "@/lib/landing-detail-schedule";
import {
  getLandingRoomTileCenterRingClassName,
  getLandingRoomTileClassName,
  getLandingRoomTileSlotClassName,
} from "@/lib/landing-room-tile";
import {
  getLandingRoomScheduleSummaries,
  type LandingRoomScheduleSummary,
  type LandingReservationSegment,
  type LandingScheduleSlot,
} from "@/lib/landing-schedule";
import { DAY_END_MINUTES, SLOT_MINUTES } from "@/lib/reservations";
import { getStableAnnularSectorPath, getStableCirclePoint, toStableSvgCoordinate } from "@/lib/svg-geometry";
import { getRoomReservationHref } from "@/lib/reservation-ui";
import { useReservations } from "@/lib/use-reservations";

const scheduleSize = 360;
const scheduleCenter = scheduleSize / 2;
const scheduleRadius = 126;
const detailScheduleGeometry = getLandingDetailScheduleGeometry();
const detailHourMarkers = getLandingDetailHourMarkers();
const detailCardinalTimeLabels = getLandingDetailCardinalTimeLabels();
const detailReservationBlockBorder = getLandingDetailReservationBlockBorder();
const slotAngle = 360 / (DAY_END_MINUTES / SLOT_MINUTES);

function pointOnCircle(angleDegrees: number, radius: number) {
  return getStableCirclePoint(angleDegrees, radius, scheduleCenter);
}

function getSlotArcPath(index: number, radius = scheduleRadius) {
  const startAngle = index * slotAngle + 0.85;
  const endAngle = (index + 1) * slotAngle - 0.85;
  const start = pointOnCircle(startAngle, radius);
  const end = pointOnCircle(endAngle, radius);

  return [
    `M ${start.x.toFixed(2)} ${start.y.toFixed(2)}`,
    `A ${radius} ${radius} 0 0 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`,
  ].join(" ");
}

function getTimeSectorPath(startMinutes: number, endMinutes: number) {
  const sectorAngles = getLandingDetailSectorAngles({ endMinutes, startMinutes });

  return getStableAnnularSectorPath({
    center: scheduleCenter,
    endAngleDegrees: sectorAngles.endAngleDegrees,
    innerRadius: detailScheduleGeometry.reservationInnerRadius,
    outerRadius: detailScheduleGeometry.reservationOuterRadius,
    startAngleDegrees: sectorAngles.startAngleDegrees,
  });
}

function getSegmentLabelStyle(segment: LandingReservationSegment): CSSProperties {
  const angle = ((segment.startMinutes + segment.endMinutes) / 2 / DAY_END_MINUTES) * 360;
  const point = pointOnCircle(angle, detailScheduleGeometry.reservationLabelRadius);

  return {
    left: `${toStableSvgCoordinate((point.x / scheduleSize) * 100)}%`,
    top: `${toStableSvgCoordinate((point.y / scheduleSize) * 100)}%`,
    transform: "translate(-50%, -50%)",
  };
}

function getSlotTitle(slot: LandingScheduleSlot) {
  return `${slot.rangeLabel} ${slot.bookedByLabel}`;
}

function getSegmentTitle(segment: LandingReservationSegment) {
  return `${segment.nameLabel} ${segment.rangeLabel}`;
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
  const hasBookings = summary.bookedMinutes > 0;

  return (
    <button
      aria-label={`${summary.roomName} 예약 현황 보기, 예약된 시간 ${summary.bookedDurationLabel}`}
      aria-pressed={isSelected}
      className={getLandingRoomTileClassName(isSelected)}
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
            className={getLandingRoomTileCenterRingClassName()}
            cx={scheduleCenter}
            cy={scheduleCenter}
            r={scheduleRadius - 34}
            opacity={0.3}
            strokeWidth={2}
          />
          {summary.slots.map((slot) => (
            <path
              key={slot.startMinutes}
              className={getLandingRoomTileSlotClassName({ hasBookings, isBooked: slot.isBooked })}
              d={getSlotArcPath(slot.index)}
              opacity={slot.isBooked ? 1 : hasBookings ? 0.48 : slot.index % 2 === 0 ? 0.95 : 0.68}
              strokeLinecap="round"
              strokeWidth={slot.isBooked ? 14 : hasBookings ? 7 : 9}
            />
          ))}
        </svg>
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <span className="text-xl font-black leading-none tracking-normal text-foreground sm:text-3xl">
            {summary.bookedHourLabel}
          </span>
        </div>
      </div>
    </button>
  );
}

function RoomDetailSchedule({ summary }: { summary: LandingRoomScheduleSummary }) {
  return (
    <section aria-label={`${summary.roomName} 상세 예약 현황`} className="grid gap-4">
      <div className="grid gap-1 text-center">
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
            className="fill-none stroke-muted"
            cx={scheduleCenter}
            cy={scheduleCenter}
            r={detailScheduleGeometry.reservationOuterRadius}
            strokeWidth="1"
          />
          {summary.slots.map((slot) => (
            <path
              key={slot.startMinutes}
              className="fill-none stroke-muted"
              d={getSlotArcPath(slot.index, detailScheduleGeometry.reservationOuterRadius)}
              opacity={slot.index % 2 === 0 ? 0.62 : 0.48}
              strokeLinecap="round"
              strokeWidth={5}
            >
              <title>{getSlotTitle(slot)}</title>
            </path>
          ))}
          {summary.reservationSegments.map((segment) => (
            <path
              key={segment.reservationId}
              d={getTimeSectorPath(segment.startMinutes, segment.endMinutes)}
              fill={segment.color}
              opacity={0.95}
              stroke={detailReservationBlockBorder.stroke}
              strokeLinecap={detailReservationBlockBorder.strokeLinecap}
              strokeLinejoin={detailReservationBlockBorder.strokeLinejoin}
              strokeWidth={detailReservationBlockBorder.strokeWidth}
              vectorEffect={detailReservationBlockBorder.vectorEffect}
            >
              <title>{getSegmentTitle(segment)}</title>
            </path>
          ))}
          {detailHourMarkers.map((marker) => {
            const outer = pointOnCircle(marker.angleDegrees, marker.outerRadius);
            const inner = pointOnCircle(marker.angleDegrees, marker.innerRadius);

            return (
              <line
                key={marker.index}
                className={marker.kind === "hour" ? "stroke-foreground" : "stroke-muted-foreground"}
                opacity={marker.kind === "hour" ? 0.42 : 0.28}
                strokeLinecap="round"
                strokeWidth={marker.strokeWidth}
                x1={inner.x}
                x2={outer.x}
                y1={inner.y}
                y2={outer.y}
              />
            );
          })}
          {detailCardinalTimeLabels.map((marker) => {
            const point = pointOnCircle(marker.angleDegrees, marker.radius);

            return (
              <text
                key={marker.label}
                className="fill-muted-foreground text-[0.62rem] font-black tracking-normal sm:text-xs"
                dominantBaseline="middle"
                textAnchor="middle"
                x={point.x}
                y={point.y}
              >
                {marker.label}
              </text>
            );
          })}
        </svg>

        <div className={getLandingDetailCenterPanelClassName()}>
          <div>
            <div className="text-xs font-bold text-muted-foreground">오늘</div>
            <div className="text-3xl font-black leading-none sm:text-4xl">{summary.bookedHourLabel}</div>
            <div className="mt-1 text-xs font-bold text-muted-foreground">예약된 시간</div>
          </div>
        </div>

        {summary.reservationSegments.map((segment) => (
          <div
            key={segment.reservationId}
            className={getLandingDetailReservationLabelClassName()}
            style={getSegmentLabelStyle(segment)}
            title={getSegmentTitle(segment)}
          >
            <div className="truncate">{segment.nameLabel}</div>
            <div className="truncate text-[0.48rem] font-bold opacity-95 sm:text-[0.58rem]">{segment.rangeLabel}</div>
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
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>("room-1");
  const selectedSummary = useMemo(
    () => summaries.find((summary) => summary.roomId === selectedRoomId) ?? null,
    [selectedRoomId, summaries],
  );
  const reservationHref = useMemo(() => getRoomReservationHref(selectedSummary?.roomId), [selectedSummary?.roomId]);
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
            render={<Link href={reservationHref} />}
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
