const ROOM_TILE_BASE_CLASS =
  "motion-action grid aspect-[1/1.08] min-h-0 grid-rows-[auto_1fr] place-items-center gap-0 rounded-lg border p-1.5 text-center transition-[background-color,border-color,box-shadow] focus-visible:ring-4 focus-visible:ring-ring/40 focus-visible:outline-none sm:aspect-square sm:gap-1 sm:p-3";

export function getLandingRoomTileClassName(isSelected: boolean) {
  const stateClass = isSelected
    ? "border-primary bg-card shadow-sm ring-2 ring-primary/60 ring-inset"
    : "border-border bg-card hover:border-primary hover:bg-muted/55 hover:ring-2 hover:ring-primary/60 hover:ring-inset";

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
