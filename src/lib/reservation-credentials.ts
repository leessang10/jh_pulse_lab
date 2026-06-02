import { createHash } from "node:crypto";

export type ReservationLookup = {
  name: string;
  phone: string;
  password: string;
};

export function isSixDigitReservationPassword(value: string) {
  return /^\d{6}$/.test(value);
}

export function hashReservationPassword(password: string) {
  return createHash("sha256").update(`jh-pulse-lab:${password}`).digest("hex");
}

export function validateReservationLookup(lookup: ReservationLookup) {
  const errors: string[] = [];

  if (!lookup.name.trim()) errors.push("이름을 입력해 주세요.");
  if (!lookup.phone.trim()) errors.push("연락처를 입력해 주세요.");
  if (!isSixDigitReservationPassword(lookup.password)) {
    errors.push("비밀번호는 숫자 6자리로 입력해 주세요.");
  }

  return errors;
}
