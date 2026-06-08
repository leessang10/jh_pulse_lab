export type AdminSidebarItem = {
  title: string;
  href: string;
  description: string;
};

export const ADMIN_SIDEBAR_ITEMS: AdminSidebarItem[] = [
  { title: "예약 관리", href: "/admin", description: "예약 현황과 상태 변경" },
  { title: "예약 페이지", href: "/reservation", description: "사용자 예약 화면" },
];

export function getAdminSidebarItemState(href: string, currentPath: string) {
  const [pathname] = currentPath.split("?");

  return {
    isActive: pathname === href,
  };
}
