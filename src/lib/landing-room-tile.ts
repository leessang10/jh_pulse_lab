const ROOM_TILE_BASE_CLASS =
  "motion-action grid min-h-[6.35rem] grid-rows-[auto_1fr] place-items-center gap-1 rounded-md border p-2 text-center transition-[background-color,border-color,box-shadow] focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:min-h-[7rem] sm:gap-2 sm:p-3";

export function getLandingRoomTileClassName(isSelected: boolean) {
  const stateClass = isSelected
    ? "border-primary bg-card shadow-[0_12px_26px_oklch(0.21_0.007_255_/_12%)] ring-2 ring-primary/60 ring-inset"
    : "border-border/80 bg-card/90 hover:border-primary/70 hover:bg-card hover:ring-2 hover:ring-primary/60 hover:ring-inset";

  return `${ROOM_TILE_BASE_CLASS} ${stateClass}`;
}

export function getLandingRoomTileCenterRingClassName() {
  return "fill-pulse-accent-soft stroke-pulse-accent";
}

export function getLandingRoomTileSlotClassName(state: {
  hasBookings: boolean;
  isBooked: boolean;
}) {
  return state.isBooked ? "fill-none stroke-pulse-accent" : "fill-none stroke-pulse-accent-soft";
}
