import { describe, expect, it } from "vitest";
import { RESERVATION_REVALIDATION_PATHS, revalidateReservationPaths } from "./reservation-data-policy";

describe("reservation data module", () => {
  it("keeps reservation page revalidation policy in one place", () => {
    const paths: string[] = [];

    revalidateReservationPaths((path) => paths.push(path));

    expect(paths).toEqual(["/", "/reservation", "/reservations", "/admin"]);
    expect(RESERVATION_REVALIDATION_PATHS).toEqual(paths);
  });
});
