export const RESERVATION_REVALIDATION_PATHS = ["/", "/reservation", "/reservations", "/admin"] as const;

export function revalidateReservationPaths(revalidate: (path: string) => void) {
  RESERVATION_REVALIDATION_PATHS.forEach((path) => revalidate(path));
}
