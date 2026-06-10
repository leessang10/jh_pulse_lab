import { describe, expect, it } from "vitest";
import {
  hashReservationPassword,
  isFourDigitReservationPassword,
  validateReservationLookup,
} from "./reservation-credentials";

describe("reservation credentials", () => {
  it("accepts only four numeric digits for reservation passwords", () => {
    expect(isFourDigitReservationPassword("1234")).toBe(true);
    expect(isFourDigitReservationPassword("123")).toBe(false);
    expect(isFourDigitReservationPassword("12345")).toBe(false);
    expect(isFourDigitReservationPassword("123a")).toBe(false);
  });

  it("hashes a reservation password without returning the raw value", () => {
    const firstHash = hashReservationPassword("1234");
    const secondHash = hashReservationPassword("1234");

    expect(firstHash).toBe(secondHash);
    expect(firstHash).not.toContain("1234");
    expect(firstHash).toHaveLength(64);
  });

  it("validates lookup credentials with only name and password", () => {
    expect(
      validateReservationLookup({
        name: " Lee ",
        password: "1234",
      }),
    ).toEqual([]);

    expect(
      validateReservationLookup({
        name: "",
        password: "123",
      }),
    ).toEqual(["이름을 입력해 주세요.", "비밀번호는 숫자 4자리로 입력해 주세요."]);
  });
});
