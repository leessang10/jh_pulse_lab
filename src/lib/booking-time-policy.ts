export const BOOKING_START_GRACE_MINUTES = 20;

export function isBookingStartPastGracePeriod(
  date: string,
  startMinutes: number,
  currentTime?: { date: string; minutes: number },
) {
  if (!currentTime) return false;
  if (date < currentTime.date) return true;
  if (date > currentTime.date) return false;

  return currentTime.minutes > startMinutes + BOOKING_START_GRACE_MINUTES;
}
