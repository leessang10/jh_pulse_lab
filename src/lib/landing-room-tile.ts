const ROOM_TILE_BASE_CLASS =
  "motion-action grid min-h-[6.35rem] grid-rows-[auto_1fr] place-items-center gap-1 rounded-lg border p-2 text-center transition-[background-color,border-color] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:min-h-[7rem] sm:gap-2 sm:p-3";

export function getLandingRoomTileClassName(isSelected: boolean) {
  const stateClass = isSelected
    ? "border-reservation-accent bg-reservation-accent-soft/55 ring-2 ring-reservation-accent/35 ring-inset"
    : "border-border/80 bg-card hover:border-reservation-accent/60 hover:bg-reservation-accent-soft/45 hover:ring-2 hover:ring-reservation-accent/25 hover:ring-inset";

  return `${ROOM_TILE_BASE_CLASS} ${stateClass}`;
}

export function getLandingRoomTileCenterRingClassName() {
  return "fill-reservation-accent-soft stroke-reservation-accent";
}

export function getLandingRoomTileSlotClassName(state: {
  hasBookings: boolean;
  isBooked: boolean;
  isMaintenance: boolean;
}) {
  if (state.isMaintenance) return "fill-none stroke-maintenance-border";

  return state.isBooked ? "fill-none stroke-reservation-accent" : "fill-none stroke-reservation-accent-soft";
}
