import { describe, expect, it } from "vitest";
import { ADMIN_DEFAULT_PATH, ADMIN_LOGIN_PATH, getPostLoginAdminPath } from "./admin-routes";

describe("admin routes", () => {
  it("keeps login and default admin destinations separate", () => {
    expect(ADMIN_LOGIN_PATH).toBe("/admin/login");
    expect(ADMIN_DEFAULT_PATH).toBe("/admin/reservations");
  });

  it("normalizes unsafe post-login destinations to the admin default", () => {
    expect(getPostLoginAdminPath("/admin/timetables")).toBe("/admin/timetables");
    expect(getPostLoginAdminPath("/reservation")).toBe("/admin/reservations");
    expect(getPostLoginAdminPath("https://example.com/admin")).toBe("/admin/reservations");
    expect(getPostLoginAdminPath(null)).toBe("/admin/reservations");
  });
});
