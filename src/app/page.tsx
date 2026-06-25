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
import { LANDING_RESERVATION_SEGMENT_COLOR_TOKENS } from "@/lib/visual-tokens";

const scheduleSize = 360;
const scheduleCenter = scheduleSize / 2;
const scheduleRadius = 126;
const detailScheduleGeometry = getLandingDetailScheduleGeometry();
const detailHourMarkers = getLandingDetailHourMarkers();
const detailCardinalTimeLabels = getLandingDetailCardinalTimeLabels();
const detailReservationBlockBorder = getLandingDetailReservationBlockBorder();
const slotAngle = 360 / (DAY_END_MINUTES / SLOT_MINUTES);
const reservationSegmentToneFills = LANDING_RESERVATION_SEGMENT_COLOR_TOKENS;
const detailSlotTrackStrokeWidth = 2.4;

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

function getReservationSegmentToneFill(index: number) {
  return reservationSegmentToneFills[index % reservationSegmentToneFills.length];
}

function getDetailSlotTrackOpacity(index: number) {
  return index % 2 === 0 ? 0.42 : 0.24;
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
      <div className="truncate text-[0.82rem] font-bold leading-tight tracking-normal text-foreground sm:text-xl">
        {summary.roomName}
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[4.65rem] self-center sm:max-w-[5.9rem]">
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
          <span className="grid place-items-center gap-0.5 text-foreground">
            <span className="text-lg font-bold leading-none tracking-normal sm:text-3xl">
              {summary.bookedHourLabel}
            </span>
            <span className="text-[0.55rem] font-semibold leading-none text-muted-foreground sm:text-[0.68rem]">
              시간
            </span>
          </span>
        </div>
      </div>
    </button>
  );
}

function RoomDetailSchedule({ summary }: { summary: LandingRoomScheduleSummary }) {
  return (
    <section
      aria-label={`${summary.roomName} 상세 예약 현황`}
      className="grid gap-3 rounded-lg border border-border/80 bg-card p-3 sm:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-4"
    >
      <div className="flex items-end justify-between gap-3 sm:grid sm:content-start sm:items-start sm:gap-6">
        <div className="min-w-0 text-left">
          <p className="text-xs font-semibold text-muted-foreground">실시간 예약 현황</p>
          <h2 className="truncate text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
            {summary.roomName}
          </h2>
        </div>
        <div className="grid shrink-0 gap-0.5 rounded-lg bg-muted px-3 py-2 text-right sm:text-left">
          <span className="text-[0.66rem] font-semibold text-muted-foreground">오늘 예약</span>
          <strong className="text-sm font-bold leading-none sm:text-base">{summary.bookedDurationLabel}</strong>
        </div>
      </div>

      <div className="relative mx-auto aspect-square w-full max-w-[min(100%,clamp(20rem,calc(100dvh-25rem),25.5rem))] min-w-0 sm:max-w-[min(100%,26rem)] lg:max-w-[min(100%,28rem)]">
        <svg
          aria-label={`${summary.roomName} 오늘 예약 시간을 시계처럼 보여주는 표`}
          className="size-full overflow-visible"
          role="img"
          viewBox={`0 0 ${scheduleSize} ${scheduleSize}`}
        >
          <circle
            className="fill-none stroke-border"
            cx={scheduleCenter}
            cy={scheduleCenter}
            opacity={0.68}
            r={detailScheduleGeometry.reservationOuterRadius}
            strokeWidth="1.1"
          />
          {summary.slots.map((slot) => (
            <path
              key={slot.startMinutes}
              className="fill-none stroke-border"
              d={getSlotArcPath(slot.index, detailScheduleGeometry.reservationOuterRadius)}
              opacity={getDetailSlotTrackOpacity(slot.index)}
              strokeLinecap="round"
              strokeWidth={detailSlotTrackStrokeWidth}
            >
              <title>{getSlotTitle(slot)}</title>
            </path>
          ))}
          {summary.reservationSegments.map((segment, index) => (
            <path
              key={segment.reservationId}
              d={getTimeSectorPath(segment.startMinutes, segment.endMinutes)}
              fill={getReservationSegmentToneFill(index)}
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
                className={marker.kind === "hour" ? "stroke-muted-foreground" : "stroke-border"}
                opacity={marker.kind === "hour" ? 0.52 : 0.72}
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
                className="fill-muted-foreground text-[0.62rem] font-semibold tracking-normal sm:text-xs"
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
            <div className="text-3xl font-bold leading-none sm:text-4xl">{summary.bookedHourLabel}</div>
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
    <main className="min-h-screen bg-app-background px-3 py-3 text-foreground sm:px-6 sm:py-5">
      <section className="mx-auto grid w-full max-w-5xl content-start gap-3 sm:gap-4">
        <header className="grid gap-3 border-b border-border/80 pb-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div className="grid gap-1 text-left">
            <div className="flex items-baseline gap-2 text-2xl font-bold tracking-normal text-foreground sm:text-3xl">
              <span>JH</span>
              <span>PULSE</span>
              <span>LAB</span>
            </div>
            <p className="text-sm font-semibold text-muted-foreground sm:text-base">{dateLabel}</p>
          </div>

          <div className="grid grid-cols-[1.2fr_1fr] gap-2 sm:min-w-[22rem]">
            <Button
              className="motion-action h-11 rounded-lg text-sm font-semibold sm:text-base"
              nativeButton={false}
              render={<Link href={reservationHref} />}
            >
              <CalendarPlusIcon data-icon="inline-start" />
              예약하기
            </Button>
            <Button
              className="motion-action h-11 rounded-lg bg-card text-sm font-semibold sm:text-base"
              nativeButton={false}
              render={<Link href="/reservations" />}
              variant="outline"
            >
              <ClipboardListIcon data-icon="inline-start" />
              예약조회
            </Button>
          </div>
        </header>

        {error ? (
          <div className="rounded-lg border border-destructive/30 bg-destructive/10 p-3 text-sm font-bold text-destructive">
            {error}
          </div>
        ) : null}

        <section aria-label="연습실별 예약 요약" className="grid grid-cols-3 gap-2 sm:gap-3">
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
      </section>
    </main>
  );
}
