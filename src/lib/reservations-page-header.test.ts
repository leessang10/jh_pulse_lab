import { describe, expect, it } from "vitest";
import { RESERVATIONS_PAGE_HEADER } from "./reservations-page-header";

describe("reservations page header", () => {
  it("uses an instructional main title without secondary labels", () => {
    expect(RESERVATIONS_PAGE_HEADER).toEqual({
      eyebrow: null,
      lookupFormTitle: null,
      showCreateReservationLink: false,
      title: "예약할 때 입력한 정보를 기재해 주세요",
    });
  });
});
