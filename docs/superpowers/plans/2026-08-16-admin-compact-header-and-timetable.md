# 관리자 컴팩트 헤더와 예약 시간표 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자 세 화면의 헤더를 실제 높이 52~60px 수준으로 통일하고, 예약 시간표의 날짜 피드백과 행 밀도를 개선해 같은 화면에서 더 많은 정보를 확인할 수 있게 한다.

**Architecture:** `AdminPageHeader`가 공통 제목, 모바일 메뉴 버튼과 화면별 액션 슬롯을 렌더링한다. 시간표 날짜 선택 규칙은 `admin-timetable.ts`의 순수 함수로 분리해 동일 날짜 억제와 토스트 문구를 단위 테스트하고, 페이지는 이 결과로 상태와 전역 Sonner 토스트를 갱신한다. 예약 및 통계 데이터 흐름은 유지하고 JSX 구조와 Tailwind 밀도만 조정한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Tailwind CSS, shadcn/Base UI, Sonner, Vitest, React DOM server renderer

## Global Constraints

- 변경 범위는 `/admin/reservations`, `/admin/timetables`, `/admin/statistics`의 헤더와 `/admin/timetables` 시간표 밀도다.
- 세 화면의 제목과 같은 내용을 반복하는 헤더 배지를 제거한다.
- 통계 헤더 설명과 시각 라벨을 제거하되 접근성 이름을 유지한다.
- 데스크톱 공통 헤더는 약 52~60px 높이와 한 줄 배치를 목표로 한다.
- 모바일 시간표 액션은 `날짜 선택 → 점검 등록` 순서로 한 줄을 유지한다.
- 실제로 다른 날짜를 선택할 때만 `<표시 날짜> 시간표로 변경했습니다.` 토스트를 표시한다.
- 시간표 예약자, 예약 시간, 예약 상태, 점검 상태와 빈 시간 정보는 제거하지 않는다.
- 예약, 통계, 점검 데이터 모델과 서버 조회 방식은 변경하지 않는다.
- 기존 사용자 파일과 이 작업에 무관한 변경은 수정하거나 커밋하지 않는다.

---

## File Map

새 파일:

- `src/app/admin/admin-page-header.tsx`: 공통 관리자 페이지 제목, 모바일 메뉴 버튼과 선택적 액션 영역
- `src/app/admin/admin-page-header.test.ts`: 공통 헤더의 제목·액션·접근 가능한 구조 렌더링 테스트

수정 파일:

- `src/app/admin/admin-reservations-page.tsx`: 중복 헤더 마크업을 공통 컴포넌트로 교체하고 콘텐츠 간격 축소
- `src/app/admin/statistics/admin-statistics-page.tsx`: 공통 헤더 사용, 설명·시각 라벨 제거, 컨트롤 접근성 이름 유지
- `src/lib/admin-timetable.ts`: 날짜 변경 여부와 토스트 메시지를 반환하는 순수 함수 추가
- `src/lib/admin-timetable.test.ts`: 다른 날짜, 같은 날짜, 빈 선택의 날짜 변경 규칙 테스트
- `src/app/admin/timetables/page.tsx`: 공통 헤더 사용, 날짜 액션 이동, 필터 카드 제거, 토스트 연결, 시간표 밀도 축소

---

### Task 1: 관리자 공통 컴팩트 헤더

**Files:**
- Create: `src/app/admin/admin-page-header.tsx`
- Create: `src/app/admin/admin-page-header.test.ts`
- Modify: `src/app/admin/admin-reservations-page.tsx:17-25,94-177`
- Modify: `src/app/admin/statistics/admin-statistics-page.tsx:5-9,106-172`

**Interfaces:**
- Produces: `AdminPageHeader({ title, actions, actionsLabel, className })`
- Consumes: `ReactNode`, `SidebarTrigger`, `cn`

- [ ] **Step 1: 공통 헤더가 제목과 액션을 한 번씩 렌더링하는 실패 테스트 작성**

`src/app/admin/admin-page-header.test.ts`를 다음과 같이 만든다. 이 테스트가 막는 회귀는 공통 헤더가 제목을 누락하거나 중복 렌더링하고, 액션 영역에 접근 가능한 이름을 제공하지 않는 경우다.

```ts
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
    expect(markup).not.toContain("aria-label=\"페이지 작업\"");
  });
});
```

- [ ] **Step 2: 테스트가 컴포넌트 부재로 실패하는지 확인**

Run: `npm test -- src/app/admin/admin-page-header.test.ts`

Expected: FAIL with `Cannot find module './admin-page-header'`.

- [ ] **Step 3: 공통 헤더 최소 구현**

`src/app/admin/admin-page-header.tsx`를 만든다.

```tsx
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
    <header className={cn("flex min-h-13 flex-col gap-2 border-b pb-3 sm:flex-row sm:items-center sm:justify-between", className)}>
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
```

- [ ] **Step 4: 공통 헤더 테스트 통과 확인**

Run: `npm test -- src/app/admin/admin-page-header.test.ts`

Expected: PASS with 2 tests.

- [ ] **Step 5: 예약 목록을 공통 헤더로 변경**

`Badge`와 `SidebarTrigger` import를 제거하고 `AdminPageHeader`를 import한다. `<main>`을 `className="min-h-screen w-full px-5 py-4 lg:px-8"`로 바꾸고 기존 `<header>` 전체를 아래 코드로 교체한다. 첫 필터 카드는 `mt-4`로 줄인다.

```tsx
<AdminPageHeader title="예약 목록" />
```

- [ ] **Step 6: 통계 화면을 공통 헤더로 변경하고 시각 라벨 제거**

`Badge`와 `SidebarTrigger` import를 제거하고 `AdminPageHeader`를 import한다. `<main>`을 `className="min-h-screen w-full px-5 py-4 lg:px-8"`로 바꾼다. 기존 `<header>` 전체를 아래 구조로 교체한다.

```tsx
<AdminPageHeader
  title="예약 통계"
  actionsLabel="통계 조회 조건"
  className="xl:flex-row"
  actions={
    <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
      <Select value={query.referenceMonth} onValueChange={(value) => value && updateQuery({ referenceMonth: value })}>
        <SelectTrigger aria-label="기준 월" className="min-w-34 bg-background">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {referenceMonthOptions.map((month) => (
            <SelectItem key={month} value={month}>{formatMonthLabel(month)}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <ToggleGroup
        aria-label="추세 단위"
        value={[query.unit]}
        onValueChange={(value) => {
          const unit = Array.isArray(value) ? value[0] : value;
          if (unit === "day" || unit === "week" || unit === "year") updateQuery({ unit: unit as StatisticsUnit });
        }}
        variant="outline"
        spacing={0}
      >
        <ToggleGroupItem value="day" aria-label="일 단위">일</ToggleGroupItem>
        <ToggleGroupItem value="week" aria-label="주 단위">주</ToggleGroupItem>
        <ToggleGroupItem value="year" aria-label="년 단위">년</ToggleGroupItem>
      </ToggleGroup>
      <Button aria-pressed={isSimulatorOpen} type="button" disabled={!canSimulate} onClick={() => setIsSimulatorOpen(true)}>
        정기권 시뮬레이션
      </Button>
    </div>
  }
/>
```

- [ ] **Step 7: 타입 검사와 관련 테스트 실행**

Run: `npx tsc --noEmit && npm test -- src/app/admin/admin-page-header.test.ts src/lib/admin-statistics.test.ts`

Expected: exit 0 and all selected tests PASS.

- [ ] **Step 8: 공통 헤더 작업 커밋**

```bash
git add src/app/admin/admin-page-header.tsx src/app/admin/admin-page-header.test.ts src/app/admin/admin-reservations-page.tsx src/app/admin/statistics/admin-statistics-page.tsx
git commit -m "feat: 관리자 공통 컴팩트 헤더 추가"
```

---

### Task 2: 시간표 날짜 변경 피드백과 헤더 액션

**Files:**
- Modify: `src/lib/admin-timetable.ts`
- Modify: `src/lib/admin-timetable.test.ts`
- Modify: `src/app/admin/timetables/page.tsx:3-33,53-179`

**Interfaces:**
- Consumes: `dateToKoreaValue(date)`, `formatKoreaDate(value)`, `AdminPageHeader`
- Produces: `getAdminTimetableDateChange(currentDate: string, nextDate: Date | undefined): { date: string; message: string } | null`

- [ ] **Step 1: 날짜 변경 규칙의 실패 테스트 작성**

`src/lib/admin-timetable.test.ts` import에 `getAdminTimetableDateChange`를 추가하고 다음 테스트를 넣는다. 이 테스트가 막는 회귀는 최초/동일 날짜에도 토스트가 뜨거나, 바뀐 날짜와 토스트 문구가 서로 다른 경우다.

```ts
it("returns the changed date and its timetable toast message", () => {
  expect(
    getAdminTimetableDateChange("2026-08-06", new Date("2026-08-06T15:00:00.000Z")),
  ).toEqual({
    date: "2026-08-07",
    message: "2026년 8월 7일 금 시간표로 변경했습니다.",
  });
});

it("ignores an empty selection and the currently selected date", () => {
  expect(getAdminTimetableDateChange("2026-08-07", undefined)).toBeNull();
  expect(
    getAdminTimetableDateChange("2026-08-07", new Date("2026-08-06T15:00:00.000Z")),
  ).toBeNull();
});
```

- [ ] **Step 2: 날짜 변경 함수 부재로 실패하는지 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts`

Expected: FAIL because `getAdminTimetableDateChange` is not exported.

- [ ] **Step 3: 날짜 변경 순수 함수 최소 구현**

`src/lib/admin-timetable.ts`에 한국 날짜 도우미 import와 함수를 추가한다.

```ts
import { dateToKoreaValue, formatKoreaDate } from "@/lib/korea-date";

export function getAdminTimetableDateChange(currentDate: string, nextDate: Date | undefined) {
  if (!nextDate) return null;

  const date = dateToKoreaValue(nextDate);
  if (date === currentDate) return null;

  return {
    date,
    message: `${formatKoreaDate(date)} 시간표로 변경했습니다.`,
  };
}
```

- [ ] **Step 4: 날짜 변경 테스트 통과 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts`

Expected: PASS with all admin timetable tests.

- [ ] **Step 5: 시간표 페이지 헤더에 날짜 액션 연결**

`Badge`, `CardHeader`, `CardTitle`, `SidebarTrigger`, `dateToKoreaValue` import를 제거한다. `AdminPageHeader`와 `getAdminTimetableDateChange`를 import한다. 날짜 처리기를 추가한다.

```tsx
function selectDate(nextDate: Date | undefined) {
  const change = getAdminTimetableDateChange(date, nextDate);
  if (!change) return;

  setDate(change.date);
  toast.info(change.message);
}
```

`<main>`의 세로 패딩을 `py-4`로 줄이고 기존 헤더와 날짜 카드를 제거한 자리에 다음 공통 헤더를 둔다.

```tsx
<AdminPageHeader
  title="예약 시간표"
  actionsLabel="시간표 작업"
  actions={
    <>
      <Popover>
        <PopoverTrigger render={<Button variant="outline" className="min-w-0 justify-start px-2 sm:px-2.5" />}>
          <span className="truncate">{formatKoreaDate(date)}</span>
        </PopoverTrigger>
        <PopoverContent align="end" className="w-auto">
          <Calendar mode="single" selected={valueToKoreaDate(date)} onSelect={selectDate} />
        </PopoverContent>
      </Popover>
      <Button type="button" onClick={() => setIsMaintenanceDialogOpen(true)}>점검 등록</Button>
    </>
  }
/>
```

시간표 카드는 `mt-4`로 시작하고 제목만을 위한 `CardHeader`를 제거한다. 오류·로딩·시간표 렌더링은 `CardContent className="pt-4"` 안에서 유지한다.

- [ ] **Step 6: 타입 검사와 날짜 테스트 실행**

Run: `npx tsc --noEmit && npm test -- src/lib/admin-timetable.test.ts`

Expected: exit 0 and all selected tests PASS.

- [ ] **Step 7: 날짜 헤더 작업 커밋**

```bash
git add src/lib/admin-timetable.ts src/lib/admin-timetable.test.ts src/app/admin/timetables/page.tsx
git commit -m "feat: 시간표 날짜 변경 안내 추가"
```

---

### Task 3: 데스크톱·모바일 시간표 밀도 축소

**Files:**
- Modify: `src/app/admin/timetables/page.tsx:164-389`

**Interfaces:**
- Consumes: `buildAdminTimetableRows`, `AdminTimetableTile`, existing click handlers
- Produces: 기존과 같은 `DesktopTimetable`, `MobileTimetable`, `TimetableTile` 동작과 더 작은 레이아웃

- [ ] **Step 1: 변경 전 브라우저 기준 화면 캡처**

Run: `npm run dev`

관리자 인증 상태에서 `/admin/timetables`를 데스크톱 1440×900과 모바일 390×844로 열고, 첫 시간표 행의 높이와 900px 안에 보이는 슬롯 수를 기록한다. Expected baseline: 데스크톱 한 슬롯은 약 72px이고 첨부 화면에서는 오전 슬롯 일부만 보인다.

- [ ] **Step 2: 로딩 스켈레톤 밀도 축소**

시간표 로딩 영역을 아래 값으로 바꾼다.

```tsx
<div className="grid gap-2">
  {Array.from({ length: 8 }, (_, index) => (
    <div key={index} className="h-11 rounded-md border border-border bg-muted/50" />
  ))}
</div>
```

- [ ] **Step 3: 데스크톱 시간표 행을 약 48px로 축소**

`DesktopTimetable`의 그리드와 셀 클래스를 다음 값으로 조정한다.

```tsx
<div className="grid grid-cols-[4.75rem_repeat(3,minmax(0,1fr))] border-b border-border bg-muted/60">
  <div className="px-2.5 py-2 text-xs font-bold text-muted-foreground">시간</div>
  {/* room headers: border-l px-2.5 py-2 text-center text-sm font-bold */}
</div>

{/* data row: grid-cols-[4.75rem_repeat(3,minmax(0,1fr))] */}
<div className="grid min-h-12 place-items-center bg-muted/30 px-2 text-sm font-bold">{row.timeLabel}</div>
{/* tile cell: border-l border-border p-1 */}
```

- [ ] **Step 4: 모바일 시간별 카드 밀도 축소**

`MobileTimetable`을 `gap-2`로 바꾸고 각 섹션은 `rounded-lg border border-border bg-card p-2.5`, 시간 제목은 `mb-2 text-lg font-bold`, 타일 목록은 `gap-1.5`로 바꾼다.

- [ ] **Step 5: 공통 타일 높이와 텍스트 밀도 축소**

`TimetableTile` 기본 클래스를 다음 값으로 바꾼다.

```tsx
"flex min-h-10 w-full items-center justify-between gap-2 rounded-md border px-3 py-2 text-left text-sm font-bold transition active:translate-y-px disabled:pointer-events-none"
```

상태 배지는 기존 문구와 variant를 유지하고 `className="h-4 px-1.5 text-[0.65rem]"`를 예약·점검 배지에 적용한다. 예약자/시간 라벨은 기존 `truncate`, 모바일 연습실 이름과 빈 시간 문구를 그대로 유지한다.

- [ ] **Step 6: 타입 검사와 전체 단위 테스트 실행**

Run: `npx tsc --noEmit && npm test`

Expected: exit 0 and all Vitest tests PASS.

- [ ] **Step 7: 밀도 변경 커밋**

```bash
git add src/app/admin/timetables/page.tsx
git commit -m "feat: 관리자 시간표 밀도 개선"
```

---

### Task 4: 전체 관리자 화면과 프로덕션 빌드 검증

**Files:**
- Verify: `src/app/admin/admin-reservations-page.tsx`
- Verify: `src/app/admin/timetables/page.tsx`
- Verify: `src/app/admin/statistics/admin-statistics-page.tsx`

**Interfaces:**
- Consumes: 완성된 공통 헤더와 시간표 페이지
- Produces: 테스트, 빌드, 반응형 및 상호작용 검증 증거

- [ ] **Step 1: 전체 자동 검증 실행**

Run: `npm test && npx tsc --noEmit && npm run build`

Expected: 모든 테스트 PASS, TypeScript exit 0, Next.js production build exit 0.

- [ ] **Step 2: 데스크톱 세 화면 검증**

1440×900에서 `/admin/reservations`, `/admin/timetables`, `/admin/statistics`를 확인한다.

- 각 헤더에 제목이 한 번만 보인다.
- 헤더 배지와 통계 설명이 없다.
- 제목과 액션은 한 줄이며 헤더는 약 52~60px 안에 들어온다.
- 첫 콘텐츠가 헤더 아래 약 16px에서 시작한다.
- 통계 기준 월, 단위, 시뮬레이션이 정상 동작한다.

- [ ] **Step 3: 시간표 날짜와 토스트 검증**

`/admin/timetables`에서 날짜 선택이 점검 등록 왼쪽에 있는지 확인한다. 다른 날짜를 선택해 `<표시 날짜> 시간표로 변경했습니다.` 정보 토스트가 한 번 뜨고 데이터가 새 날짜 기준으로 갱신되는지 확인한다. 같은 날짜를 다시 선택했을 때 토스트가 추가되지 않는지 확인한다.

- [ ] **Step 4: 모바일 세 화면 검증**

390×844에서 세 관리자 화면을 확인한다.

- 모바일 메뉴 버튼과 제목이 같은 줄이다.
- 시간표의 날짜 선택과 점검 등록은 다음 줄에서 한 줄을 유지한다.
- 통계 액션은 화면 밖으로 넘치지 않고 필요한 만큼만 줄바꿈한다.
- 포커스 순서가 제목 뒤 기준 월, 단위, 시뮬레이션 순서를 유지한다.
- 예약·점검 타일의 클릭 영역과 다이얼로그 동작이 유지된다.

- [ ] **Step 5: 컴팩트 시간표 결과 기록**

1440×900에서 첫 데이터 행의 실제 높이가 약 48px인지 확인하고, 변경 전보다 더 많은 30분 슬롯이 보이는지 기록한다. 390×844에서도 빈 타일, 예약 타일과 점검 타일의 텍스트가 겹치거나 잘리지 않는지 확인한다.

- [ ] **Step 6: 최종 작업 트리 확인**

Run: `git status --short && git log -5 --oneline`

Expected: 계획에 명시한 파일 외의 새 변경이 없고, 구현 커밋 세 개와 설계/계획 문서 커밋만 보인다.
