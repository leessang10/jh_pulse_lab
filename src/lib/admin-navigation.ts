export type AdminSidebarItem = {
  title: string;
  href: string;
  description: string;
};

export const ADMIN_SIDEBAR_ITEMS: AdminSidebarItem[] = [
  { title: "예약 목록", href: "/admin/reservations", description: "검색, 필터, 테이블 관리" },
  { title: "예약 시간표", href: "/admin/timetables", description: "시간별 타일 보드" },
  { title: "예약 통계", href: "/admin/statistics", description: "이용 추세와 회원 순위" },
];

export function getAdminSidebarItemState(href: string, currentPath: string) {
  const [pathname] = currentPath.split("?");

  return {
    isActive: pathname === href,
  };
}
