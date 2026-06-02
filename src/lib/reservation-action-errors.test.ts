import { describe, expect, it } from "vitest";
import {
  CONFLICT_MESSAGE,
  GENERIC_MESSAGE,
  SCHEMA_SYNC_MESSAGE,
  toReservationActionErrorMessage,
} from "./reservation-action-errors";

describe("reservation action errors", () => {
  it("reports a missing reservation password column as a schema sync problem", () => {
    expect(
      toReservationActionErrorMessage({
        code: "42703",
        message: "column reservations.password_hash does not exist",
      }),
    ).toBe(SCHEMA_SYNC_MESSAGE);
  });

  it("keeps reservation conflict errors user-friendly", () => {
    expect(toReservationActionErrorMessage(new Error("reservations_no_overlap conflicts"))).toBe(CONFLICT_MESSAGE);
  });

  it("falls back to the generic reservation error for unknown failures", () => {
    expect(toReservationActionErrorMessage({ code: "PGRST000", message: "unexpected" })).toBe(GENERIC_MESSAGE);
  });
});
