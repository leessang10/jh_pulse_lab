"use client";

import type { ReactNode } from "react";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { cn } from "@/lib/utils";

type AdminPageHeaderProps = {
  title: string;
  actions?: ReactNode;
  actionsLabel?: string;
  className?: string;
};

export default function AdminPageHeader({
  title,
  actions,
  actionsLabel = "페이지 작업",
  className,
}: AdminPageHeaderProps) {
  return (
    <header
      className={cn(
        "flex min-h-13 flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between",
        className,
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <h1 className="truncate text-2xl font-bold leading-none text-foreground">{title}</h1>
      </div>
      {actions ? (
        <div aria-label={actionsLabel} className="flex min-w-0 items-center gap-2">
          {actions}
        </div>
      ) : null}
    </header>
  );
}
