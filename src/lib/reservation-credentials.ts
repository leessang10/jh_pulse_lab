import { createHash } from "node:crypto";

export type ReservationLookup = {
  name: string;
  password: string;
};

export function isFourDigitReservationPassword(value: string) {
  return /^\d{4}$/.test(value);
}

export function hashReservationPassword(password: string) {
  return createHash("sha256").update(`jh-pulse-lab:${password}`).digest("hex");
}

export function validateReservationLookup(lookup: ReservationLookup) {
  const errors: string[] = [];

  if (!lookup.name.trim()) errors.push("이름을 입력해 주세요.");
  if (!isFourDigitReservationPassword(lookup.password)) {
    errors.push("비밀번호는 숫자 4자리로 입력해 주세요.");
  }

  return errors;
}
