import { RESERVATION_DETAIL_STROKE_TOKEN } from "./visual-tokens";

const RESERVATION_INNER_RADIUS = 58;
const RESERVATION_OUTER_RADIUS = 166;
const CARDINAL_TIME_LABEL_RADIUS = RESERVATION_OUTER_RADIUS + 12;
const DAY_MINUTES = 24 * 60;

export function getLandingDetailScheduleGeometry() {
  return {
    reservationBlockWidth: RESERVATION_OUTER_RADIUS - RESERVATION_INNER_RADIUS,
    reservationInnerRadius: RESERVATION_INNER_RADIUS,
    reservationLabelRadius: (RESERVATION_INNER_RADIUS + RESERVATION_OUTER_RADIUS) / 2,
    reservationOuterRadius: RESERVATION_OUTER_RADIUS,
  } as const;
}

export function getLandingDetailCenterPanelClassName() {
  return "absolute inset-[34%] grid place-items-center rounded-full border border-border/80 bg-card/95 p-2 text-center";
}

export function getLandingDetailHourMarkers() {
  return Array.from({ length: 48 }, (_, index) => {
    const isHour = index % 2 === 0;

    return {
      angleDegrees: index * 7.5,
      index,
      innerRadius: isHour ? RESERVATION_OUTER_RADIUS - 16 : RESERVATION_OUTER_RADIUS - 8,
      kind: isHour ? "hour" : "halfHour",
      outerRadius: RESERVATION_OUTER_RADIUS,
      strokeWidth: isHour ? 1.35 : 0.8,
    } as const;
  });
}

export function getLandingDetailCardinalTimeLabels() {
  return [
    { angleDegrees: 0, label: "00", radius: CARDINAL_TIME_LABEL_RADIUS },
    { angleDegrees: 90, label: "06", radius: CARDINAL_TIME_LABEL_RADIUS },
    { angleDegrees: 180, label: "12", radius: CARDINAL_TIME_LABEL_RADIUS },
    { angleDegrees: 270, label: "18", radius: CARDINAL_TIME_LABEL_RADIUS },
  ] as const;
}

export function getLandingDetailReservationLabelClassName() {
  return "pointer-events-none absolute max-w-20 border-0 bg-transparent px-0 py-0 text-center text-[0.56rem] font-semibold leading-tight text-foreground shadow-none sm:max-w-28 sm:text-[0.66rem]";
}

export function getLandingDetailReservationBlockBorder() {
  return {
    stroke: RESERVATION_DETAIL_STROKE_TOKEN,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    strokeWidth: 1.1,
    vectorEffect: "non-scaling-stroke",
  } as const;
}

export function getLandingDetailSectorAngles({
  endMinutes,
  startMinutes,
}: {
  endMinutes: number;
  startMinutes: number;
}) {
  return {
    endAngleDegrees: (endMinutes / DAY_MINUTES) * 360,
    startAngleDegrees: (startMinutes / DAY_MINUTES) * 360,
  };
}
