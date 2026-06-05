# Admin Sidebar Design

## Goal

Add a shadcn-style sidebar to the admin area and apply it to `/admin`.

## Scope

- Add the reusable shadcn sidebar UI component set under `src/components/ui/sidebar.tsx`.
- Keep the existing `/admin` reservation management behavior intact.
- Move logged-in admin content into a sidebar shell.
- Keep the current session-loading and login card flow simple and centered in the page.

## Design

The admin page remains a single client page. The page will render its existing session and reservation management logic, but the logged-in branch will be wrapped with `SidebarProvider`, `Sidebar`, and `SidebarInset`.

Sidebar navigation data will live in a small pure TypeScript module so labels, hrefs, and active-state logic are testable without a browser test setup. The sidebar will show the JH Pulse Lab admin identity, a current "예약 관리" item for `/admin`, and a public "예약 페이지" link for `/reservation`. The logout action remains connected to the current `submitLogout` handler.

## Responsive Behavior

On desktop, the sidebar is visible on the left. On mobile, the admin header includes a `SidebarTrigger` so the sidebar can be opened without crowding the content. The reservation filter and table layout keep their current responsive behavior.

## Testing

- Add a Vitest unit test for admin sidebar navigation data and active-state resolution.
- Run the targeted test first to verify it fails before implementation.
- Run the full test suite and `next build` after implementation.
