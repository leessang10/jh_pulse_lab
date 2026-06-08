# Admin Sidebar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a shadcn-style sidebar to the admin reservation management page.

**Architecture:** Keep `/admin` as the owner of the reservation management behavior, add reusable sidebar primitives under `src/components/ui/sidebar.tsx`, and extract the admin nav model into a pure helper for testability. The logged-in admin branch renders inside the sidebar shell while the login/session-loading branches keep their current simple layout.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn component conventions, lucide-react, Vitest.

---

## File Structure

- Create `src/lib/admin-navigation.ts`: exports admin sidebar items and active-state helper.
- Create `src/lib/admin-navigation.test.ts`: verifies labels, hrefs, and active matching.
- Create `src/components/ui/sidebar.tsx`: reusable shadcn-style sidebar primitives.
- Modify `src/app/admin/page.tsx`: applies the sidebar shell to logged-in admin content.

### Task 1: Admin Navigation Model

**Files:**
- Create: `src/lib/admin-navigation.test.ts`
- Create: `src/lib/admin-navigation.ts`

- [ ] **Step 1: Write the failing test**

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run src/lib/admin-navigation.test.ts`

Expected: FAIL because `src/lib/admin-navigation.ts` does not exist.

- [ ] **Step 3: Implement the helper**

```ts
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
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run src/lib/admin-navigation.test.ts`

Expected: PASS.

### Task 2: Sidebar Component And Admin Page Integration

**Files:**
- Create: `src/components/ui/sidebar.tsx`
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Add sidebar primitives**

Create shadcn-style primitives for provider, rail, inset, trigger, header, content, footer, group, group label, menu, menu item, and menu button.

- [ ] **Step 2: Apply the sidebar to the logged-in admin page**

Import sidebar primitives, `ADMIN_SIDEBAR_ITEMS`, `getAdminSidebarItemState`, and lucide icons. Render logged-in content in `SidebarProvider`; render navigation links and logout in the sidebar; keep filter and reservation table behavior unchanged.

- [ ] **Step 3: Run full verification**

Run: `npm run test`

Expected: all Vitest tests pass.

Run: `npm run build`

Expected: Next.js production build exits with code 0.
