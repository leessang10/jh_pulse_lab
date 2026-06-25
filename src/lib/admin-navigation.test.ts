import { describe, expect, it } from "vitest";
import { ADMIN_SIDEBAR_ITEMS, getAdminSidebarItemState } from "./admin-navigation";

describe("admin sidebar navigation", () => {
  it("lists the admin and public reservation destinations", () => {
    expect(ADMIN_SIDEBAR_ITEMS).toEqual([
      { title: "예약 목록", href: "/admin/reservations", description: "검색, 필터, 테이블 관리" },
      { title: "예약 시간표", href: "/admin/timetables", description: "시간별 타일 보드" },
    ]);
  });

  it("marks the matching admin route as active", () => {
    expect(getAdminSidebarItemState("/admin/reservations", "/admin/reservations")).toEqual({ isActive: true });
    expect(getAdminSidebarItemState("/admin/reservations", "/admin/reservations?date=2026-06-05")).toEqual({
      isActive: true,
    });
    expect(getAdminSidebarItemState("/admin/timetables", "/admin/reservations")).toEqual({ isActive: false });
  });
});
