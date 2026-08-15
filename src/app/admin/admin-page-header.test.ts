import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { SidebarProvider } from "@/components/ui/sidebar";
import AdminPageHeader from "./admin-page-header";

describe("admin page header", () => {
  it("renders one page title and an accessible action group", () => {
    const markup = renderToStaticMarkup(
      createElement(
        SidebarProvider,
        null,
        createElement(AdminPageHeader, {
          title: "예약 시간표",
          actionsLabel: "시간표 작업",
          actions: createElement("button", { type: "button" }, "점검 등록"),
        }),
      ),
    );

    expect(markup.match(/예약 시간표/g)).toHaveLength(1);
    expect(markup).toContain('<div aria-label="시간표 작업"');
    expect(markup).toContain(">점검 등록</button>");
  });

  it("omits the action group when a page has no actions", () => {
    const markup = renderToStaticMarkup(
      createElement(SidebarProvider, null, createElement(AdminPageHeader, { title: "예약 목록" })),
    );

    expect(markup).toContain(">예약 목록</h1>");
    expect(markup).not.toContain('aria-label="페이지 작업"');
  });
});
