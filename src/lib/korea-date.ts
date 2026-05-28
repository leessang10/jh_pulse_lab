import { TZDate } from "react-day-picker";

export const KOREA_LOCALE = "ko-KR";
export const KOREA_TIME_ZONE = "Asia/Seoul";

export function dateToKoreaValue(date: Date) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    day: "2-digit",
    month: "2-digit",
    timeZone: KOREA_TIME_ZONE,
    year: "numeric",
  }).formatToParts(date);

  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatKoreaDate(value: string) {
  return valueToKoreaDate(value).toLocaleDateString(KOREA_LOCALE, {
    day: "numeric",
    month: "long",
    timeZone: KOREA_TIME_ZONE,
    weekday: "short",
    year: "numeric",
  });
}

export function isBeforeKoreaToday(value: string, now = new Date()) {
  return value < dateToKoreaValue(now);
}

export function todayKoreaValue() {
  return dateToKoreaValue(new Date());
}

export function valueToKoreaDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new TZDate(year, month - 1, day, KOREA_TIME_ZONE);
}
