"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { CalendarCheckIcon, LogOutIcon } from "lucide-react";
import { toast } from "sonner";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
} from "@/components/ui/sidebar";
import { ADMIN_SIDEBAR_ITEMS, getAdminSidebarItemState } from "@/lib/admin-navigation";
import { getAdminSession, logoutAdmin } from "@/lib/admin-auth-actions";
import { ADMIN_LOGIN_PATH } from "@/lib/admin-routes";

type AdminShellProps = {
  children: ReactNode;
};

export default function AdminShell({ children }: AdminShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [isSessionReady, setIsSessionReady] = useState(false);
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    let isMounted = true;

    getAdminSession()
      .then((user) => {
        if (!isMounted) return;

        const hasSession = Boolean(user);
        setIsLoggedIn(hasSession);
        if (!hasSession) router.replace(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
      })
      .catch(() => {
        if (!isMounted) return;
        setIsLoggedIn(false);
        router.replace(`${ADMIN_LOGIN_PATH}?next=${encodeURIComponent(pathname)}`);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsSessionReady(true);
      });

    return () => {
      isMounted = false;
    };
  }, [pathname, router]);

  async function submitLogout() {
    const result = await logoutAdmin();
    if (!result.ok) {
      toast.error(result.error);
      return;
    }

    toast.success("로그아웃했습니다.");
    router.replace(ADMIN_LOGIN_PATH);
  }

  if (!isSessionReady || !isLoggedIn) {
    return (
      <main className="mx-auto grid min-h-screen w-full max-w-7xl place-items-center px-5 py-6 lg:px-8">
        <div className="rounded-lg border bg-card p-8 text-center text-muted-foreground">
          관리자 세션을 확인하는 중입니다.
        </div>
      </main>
    );
  }

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-3">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <CalendarCheckIcon className="size-5" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-bold">JH Pulse Lab</div>
              <div className="text-xs text-muted-foreground">관리자</div>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>관리 메뉴</SidebarGroupLabel>
            <SidebarMenu>
              {ADMIN_SIDEBAR_ITEMS.map((item) => {
                const { isActive } = getAdminSidebarItemState(item.href, pathname);

                return (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton nativeButton={false} render={<Link href={item.href} />} isActive={isActive}>
                      <CalendarCheckIcon />
                      <span className="grid min-w-0 gap-0.5">
                        <span className="truncate">{item.title}</span>
                        <span className="truncate text-xs font-normal text-muted-foreground">{item.description}</span>
                      </span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                );
              })}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter>
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton onClick={submitLogout} type="button">
                <LogOutIcon />
                <span>로그아웃</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset>{children}</SidebarInset>
    </SidebarProvider>
  );
}
