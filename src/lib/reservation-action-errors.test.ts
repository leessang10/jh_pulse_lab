import { describe, expect, it } from "vitest";
import {
  CONFLICT_MESSAGE,
  GENERIC_MESSAGE,
  MAINTENANCE_CONFLICT_MESSAGE,
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

  it("reports a missing cached reservation password column as a schema sync problem", () => {
    expect(
      toReservationActionErrorMessage({
        code: "PGRST204",
        message: "Could not find the 'password_hash' column of 'reservations' in the schema cache",
      }),
    ).toBe(SCHEMA_SYNC_MESSAGE);
  });

  it("keeps reservation conflict errors user-friendly", () => {
    expect(toReservationActionErrorMessage(new Error("reservations_no_overlap conflicts"))).toBe(CONFLICT_MESSAGE);
  });

  it("reports database maintenance conflicts separately", () => {
    expect(
      toReservationActionErrorMessage(
        new Error("reservation time conflicts with maintenance block"),
      ),
    ).toBe(MAINTENANCE_CONFLICT_MESSAGE);
  });

  it("falls back to the generic reservation error for unknown failures", () => {
    expect(toReservationActionErrorMessage({ code: "PGRST000", message: "unexpected" })).toBe(GENERIC_MESSAGE);
  });
});
