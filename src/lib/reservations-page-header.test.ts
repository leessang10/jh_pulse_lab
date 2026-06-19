import { describe, expect, it } from "vitest";
import { RESERVATIONS_PAGE_HEADER } from "./reservations-page-header";

describe("reservations page header", () => {
  it("uses a short main title with form guidance in the card", () => {
    expect(RESERVATIONS_PAGE_HEADER).toEqual({
      eyebrow: null,
      lookupFormDescription: "예약할 때 입력한 이름과 비밀번호를 입력해 주세요.",
      lookupFormTitle: "예약 정보 입력",
      showCreateReservationLink: false,
      title: "예약내역 조회",
    });
  });
});
