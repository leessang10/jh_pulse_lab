import { describe, expect, it } from "vitest";
import { ADMIN_SIDEBAR_ITEMS, getAdminSidebarItemState } from "./admin-navigation";

describe("admin sidebar navigation", () => {
  it("lists the admin and public reservation destinations", () => {
    expect(ADMIN_SIDEBAR_ITEMS).toEqual([
      { title: "예약 관리", href: "/admin", description: "예약 현황과 상태 변경" },
      { title: "예약 페이지", href: "/reservation", description: "사용자 예약 화면" },
    ]);
  });

  it("marks the matching admin route as active", () => {
    expect(getAdminSidebarItemState("/admin", "/admin")).toEqual({ isActive: true });
    expect(getAdminSidebarItemState("/admin", "/admin?date=2026-06-05")).toEqual({ isActive: true });
    expect(getAdminSidebarItemState("/reservation", "/admin")).toEqual({ isActive: false });
  });
});
