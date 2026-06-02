import { describe, expect, it } from "vitest";
import {
  hashReservationPassword,
  isSixDigitReservationPassword,
  validateReservationLookup,
} from "./reservation-credentials";

describe("reservation credentials", () => {
  it("accepts only six numeric digits for reservation passwords", () => {
    expect(isSixDigitReservationPassword("123456")).toBe(true);
    expect(isSixDigitReservationPassword("12345")).toBe(false);
    expect(isSixDigitReservationPassword("1234567")).toBe(false);
    expect(isSixDigitReservationPassword("12345a")).toBe(false);
  });

  it("hashes a reservation password without returning the raw value", () => {
    const firstHash = hashReservationPassword("123456");
    const secondHash = hashReservationPassword("123456");

    expect(firstHash).toBe(secondHash);
    expect(firstHash).not.toContain("123456");
    expect(firstHash).toHaveLength(64);
  });

  it("validates lookup credentials before querying private reservations", () => {
    expect(
      validateReservationLookup({
        name: " Lee ",
        phone: " 010-0000-0000 ",
        password: "123456",
      }),
    ).toEqual([]);

    expect(
      validateReservationLookup({
        name: "",
        phone: "",
        password: "12345",
      }),
    ).toEqual(["이름을 입력해 주세요.", "연락처를 입력해 주세요.", "비밀번호는 숫자 6자리로 입력해 주세요."]);
  });
});
