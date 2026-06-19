# Minimal Design Token Cleanup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Normalize mixed design tokens and reduce visual weight across the reservation product while preserving behavior.

**Architecture:** Keep the existing Next.js, Tailwind v4, and shadcn-style UI foundation. Centralize semantic visual values in `globals.css`, expose SVG-safe schedule color strings from a small TypeScript constants module, and then replace page-level arbitrary colors, arbitrary shadows, radius drift, and heavy font weights with tokenized patterns.

**Tech Stack:** Next.js App Router, React, Tailwind v4, shadcn-style components, Vitest.

---

## File Structure

- Modify `src/app/globals.css`: source of global CSS variables, Tailwind theme mappings, motion/choice/scroll helpers, and reduced visual weight defaults.
- Create `src/lib/visual-tokens.ts`: TypeScript constants for SVG/raw style values that cannot be represented as Tailwind classes.
- Modify `src/lib/landing-schedule.ts`: use reservation segment colors from `visual-tokens.ts`.
- Modify `src/lib/landing-schedule.test.ts`: update expected schedule colors to CSS variable tokens.
- Modify `src/lib/landing-detail-schedule.ts`: remove hardcoded shadow/text-shadow/stroke colors and use visual token constants.
- Modify `src/lib/landing-detail-schedule.test.ts`: update expected detail schedule stroke token.
- Modify `src/lib/landing-room-tile.ts`: normalize room tile radius, selected state, and shadow usage.
- Modify `src/lib/landing-room-tile.test.ts`: update selected/hover class expectations if the class names change.
- Modify `src/app/page.tsx`: remove inline `oklch(...)`, reduce `font-black`, normalize radius/shadow/surface classes.
- Modify `src/app/reservation/page.tsx`: normalize card/button/input radius, selected states, inline styles, and visual weight.
- Modify `src/app/reservations/page.tsx`: align lookup and edit surfaces with reservation flow.
- Modify `src/app/admin/page.tsx`: keep dense admin layout, align card/badge/filter surfaces with tokens.

## Task 1: Add Minimal Visual Tokens

**Files:**
- Modify: `src/app/globals.css`
- Create: `src/lib/visual-tokens.ts`

- [ ] **Step 1: Add token mappings in `globals.css`**

Add semantic CSS variables under `:root`:

```css
  --app-background: oklch(0.972 0.003 255);
  --surface-subtle: oklch(0.96 0.003 255);
  --surface-raised: oklch(1 0 0);
  --shadow-soft: 0 8px 20px oklch(0.21 0.007 255 / 7%);
  --reservation-accent: oklch(0.58 0.11 176);
  --reservation-accent-foreground: oklch(0.985 0.003 176);
  --reservation-accent-soft: oklch(0.94 0.025 176);
  --reservation-segment-1: oklch(0.58 0.11 176);
  --reservation-segment-2: oklch(0.64 0.085 176);
  --reservation-segment-3: oklch(0.7 0.06 176);
  --reservation-segment-4: oklch(0.62 0.045 198);
  --reservation-segment-5: oklch(0.68 0.032 215);
  --reservation-segment-6: oklch(0.74 0.02 235);
  --reservation-line: oklch(0.21 0.007 255 / 0.76);
```

Map these into `@theme inline`:

```css
  --color-app-background: var(--app-background);
  --color-surface-subtle: var(--surface-subtle);
  --color-surface-raised: var(--surface-raised);
  --color-reservation-accent: var(--reservation-accent);
  --color-reservation-accent-foreground: var(--reservation-accent-foreground);
  --color-reservation-accent-soft: var(--reservation-accent-soft);
```

Update dark values only for the newly introduced tokens so the current `.dark` block remains coherent.

- [ ] **Step 2: Calm global helper classes**

In `globals.css`, update `.motion-action`, `.motion-choice-selected`, `.range-scroll-area`, and `.field-label`:

```css
.motion-action:not(:disabled):hover {
  transform: translateY(-1px);
  box-shadow: none;
}

.motion-action:not(:disabled):active {
  transform: translateY(0) scale(0.99);
  box-shadow: none;
}

.motion-choice-selected {
  box-shadow: inset 0 0 0 1px color-mix(in oklch, var(--primary) 34%, transparent);
}

.range-scroll-area {
  scrollbar-color: color-mix(in oklch, var(--muted-foreground) 65%, transparent) var(--surface-subtle);
  scrollbar-gutter: stable;
  scrollbar-width: thin;
}

.field-label {
  color: var(--muted-foreground);
  font-size: 0.78rem;
  font-weight: 600;
  letter-spacing: 0;
}
```

- [ ] **Step 3: Create `src/lib/visual-tokens.ts`**

```ts
export const LANDING_RESERVATION_SEGMENT_COLOR_TOKENS = [
  "var(--reservation-segment-1)",
  "var(--reservation-segment-2)",
  "var(--reservation-segment-3)",
  "var(--reservation-segment-4)",
  "var(--reservation-segment-5)",
  "var(--reservation-segment-6)",
] as const;

export const RESERVATION_DETAIL_STROKE_TOKEN = "var(--reservation-line)";
```

- [ ] **Step 4: Run token-related tests**

Run: `npm test -- src/lib/landing-schedule.test.ts src/lib/landing-detail-schedule.test.ts src/lib/landing-room-tile.test.ts`

Expected before later tasks: tests that assert old exact colors may fail.

## Task 2: Tokenize Landing Schedule Helpers

**Files:**
- Modify: `src/lib/landing-schedule.ts`
- Modify: `src/lib/landing-schedule.test.ts`
- Modify: `src/lib/landing-detail-schedule.ts`
- Modify: `src/lib/landing-detail-schedule.test.ts`
- Modify: `src/lib/landing-room-tile.ts`
- Modify: `src/lib/landing-room-tile.test.ts`

- [ ] **Step 1: Replace schedule hex colors**

In `src/lib/landing-schedule.ts`, import the new color array:

```ts
import { LANDING_RESERVATION_SEGMENT_COLOR_TOKENS } from "./visual-tokens";
```

Replace the exported color array body with:

```ts
export const LANDING_RESERVATION_SEGMENT_COLORS = LANDING_RESERVATION_SEGMENT_COLOR_TOKENS;
```

- [ ] **Step 2: Update schedule color tests**

Replace expected hex colors in `src/lib/landing-schedule.test.ts` with:

```ts
[
  "var(--reservation-segment-1)",
  "var(--reservation-segment-2)",
  "var(--reservation-segment-3)",
  "var(--reservation-segment-4)",
  "var(--reservation-segment-5)",
  "var(--reservation-segment-6)",
]
```

- [ ] **Step 3: Tokenize detail schedule helper styles**

In `src/lib/landing-detail-schedule.ts`, import:

```ts
import { RESERVATION_DETAIL_STROKE_TOKEN } from "./visual-tokens";
```

Change `getLandingDetailCenterPanelClassName()` to return:

```ts
return "absolute inset-[34%] grid place-items-center rounded-full border border-border/80 bg-card/95 p-2 text-center";
```

Change `getLandingDetailReservationLabelClassName()` to return:

```ts
return "pointer-events-none absolute max-w-20 border-0 bg-transparent px-0 py-0 text-center text-[0.56rem] font-semibold leading-tight text-foreground shadow-none sm:max-w-28 sm:text-[0.66rem]";
```

Change `getLandingDetailReservationBlockBorder()` to use:

```ts
stroke: RESERVATION_DETAIL_STROKE_TOKEN,
```

- [ ] **Step 4: Update detail schedule tests**

Update `src/lib/landing-detail-schedule.test.ts` expected stroke to:

```ts
stroke: "var(--reservation-line)",
```

Update class expectations from `font-black` to `font-semibold` where applicable.

- [ ] **Step 5: Normalize room tile classes**

In `src/lib/landing-room-tile.ts`, set `ROOM_TILE_BASE_CLASS` to:

```ts
const ROOM_TILE_BASE_CLASS =
  "motion-action grid min-h-[6.35rem] grid-rows-[auto_1fr] place-items-center gap-1 rounded-lg border p-2 text-center transition-[background-color,border-color] focus-visible:ring-3 focus-visible:ring-ring/40 focus-visible:outline-none sm:min-h-[7rem] sm:gap-2 sm:p-3";
```

Set selected state to:

```ts
? "border-primary bg-card ring-2 ring-primary/50 ring-inset"
: "border-border/80 bg-card hover:border-primary/60 hover:bg-muted/40 hover:ring-2 hover:ring-primary/40 hover:ring-inset";
```

Update accent classes to:

```ts
return "fill-reservation-accent-soft stroke-reservation-accent";
```

and:

```ts
return state.isBooked ? "fill-none stroke-reservation-accent" : "fill-none stroke-reservation-accent-soft";
```

- [ ] **Step 6: Update room tile tests**

Update expected selected/hover snippets in `src/lib/landing-room-tile.test.ts` to:

```ts
"ring-2 ring-primary/50 ring-inset"
"hover:ring-2 hover:ring-primary/40 hover:ring-inset"
```

- [ ] **Step 7: Run landing helper tests**

Run: `npm test -- src/lib/landing-schedule.test.ts src/lib/landing-detail-schedule.test.ts src/lib/landing-room-tile.test.ts`

Expected: PASS.

## Task 3: Clean Landing Page Surface

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Use tokenized segment fills**

Replace `reservationSegmentToneFills` with:

```ts
const reservationSegmentToneFills = LANDING_RESERVATION_SEGMENT_COLOR_TOKENS;
```

and import it:

```ts
import { LANDING_RESERVATION_SEGMENT_COLOR_TOKENS } from "@/lib/visual-tokens";
```

- [ ] **Step 2: Replace hardcoded app background**

Change the main class from:

```tsx
<main className="min-h-screen bg-[oklch(0.972_0.004_255)] px-3 py-3 text-foreground sm:px-6 sm:py-5">
```

to:

```tsx
<main className="min-h-screen bg-app-background px-3 py-3 text-foreground sm:px-6 sm:py-5">
```

- [ ] **Step 3: Reduce heavy typography and shadows**

Replace broad `font-black` usages on labels/buttons/headings with `font-semibold` or `font-bold`. Keep `font-bold` for numeric reservation hour values and the main brand row.

Change the detail schedule panel class from:

```tsx
className="grid gap-3 rounded-md border border-border/80 bg-card p-3 shadow-[0_16px_36px_oklch(0.21_0.007_255_/_8%)] sm:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-4"
```

to:

```tsx
className="grid gap-3 rounded-lg border border-border/80 bg-card p-3 sm:grid-cols-[minmax(11rem,14rem)_minmax(0,1fr)] sm:items-center sm:gap-5 sm:p-4"
```

Change small stat containers from `rounded-md` to `rounded-lg`.

- [ ] **Step 4: Run page compile check**

Run: `npm test -- src/lib/landing-schedule.test.ts src/lib/landing-detail-schedule.test.ts src/lib/landing-room-tile.test.ts`

Expected: PASS.

## Task 4: Clean Reservation Flow Surface

**Files:**
- Modify: `src/app/reservation/page.tsx`

- [ ] **Step 1: Normalize radius and card surface**

Replace `rounded-xl` on primary cards, selectable controls, and form controls with `rounded-lg`. Keep `rounded-full` only for progress bars.

Examples:

```tsx
<div className="rounded-lg border bg-card p-4">
<Card className="rounded-lg border bg-card">
<Input className="h-14 rounded-lg px-4 text-xl md:text-xl" />
<Button className="motion-action h-14 rounded-lg text-xl">
```

- [ ] **Step 2: Remove inline style font overrides**

Remove inline styles like:

```tsx
style={{ fontSize: "1.25rem", fontWeight: 700 }}
```

Use existing Tailwind classes such as:

```tsx
className="motion-action h-14 rounded-lg text-xl font-semibold"
```

- [ ] **Step 3: Calm selected state animation**

For duration buttons, change selected scale from:

```ts
scale: isSelected ? 1.025 : 1,
```

to:

```ts
scale: 1,
```

For selected time summary, change the animated background from raw `oklch(...)` to:

```ts
backgroundColor: selectedTime ? "var(--muted)" : "var(--background)",
```

- [ ] **Step 4: Normalize font weight**

Use `font-semibold` for labels and controls. Use `font-bold` for selected room name, selected time, and completion title.

- [ ] **Step 5: Run reservation flow tests**

Run: `npm test -- src/lib/booking-availability.test.ts src/lib/reservation-ui.test.ts src/lib/reservations.test.ts`

Expected: PASS.

## Task 5: Clean Owner Lookup Surface

**Files:**
- Modify: `src/app/reservations/page.tsx`

- [ ] **Step 1: Align radius and surfaces**

Replace broad `rounded-xl` with `rounded-lg` for lookup card, reservation item cards, inputs, action buttons, and empty states.

Use:

```tsx
<article className="grid gap-3 rounded-lg border bg-card p-4">
<Card className="rounded-lg border bg-card">
<Input className="h-14 rounded-lg px-4 text-xl md:text-xl" />
```

- [ ] **Step 2: Remove redundant shadows and inline styles**

Remove `shadow-sm` from cards that already have borders. Remove inline font styles and replace with `font-semibold` or `font-bold` classes.

- [ ] **Step 3: Align edit option selected state**

Use the same selected state pattern as reservation flow:

```tsx
isSelected
  ? "border-primary bg-muted ring-2 ring-primary/50 ring-inset"
  : "border-border bg-background hover:border-primary/60 hover:bg-muted/40"
```

- [ ] **Step 4: Preserve cancellation modal behavior**

Do not change:

```tsx
<AlertDialog open={cancellationMessage !== null} onOpenChange={(open) => !open && setCancellationMessage(null)}>
```

Do not change:

```tsx
<AlertDialogAction onClick={() => router.push("/")}>확인</AlertDialogAction>
```

- [ ] **Step 5: Run owner UI tests**

Run: `npm test -- src/lib/reservation-owner-ui.test.ts src/lib/reservations-page-header.test.ts`

Expected: PASS.

## Task 6: Clean Admin Surface

**Files:**
- Modify: `src/app/admin/page.tsx`

- [ ] **Step 1: Normalize unauthenticated admin cards**

Replace `shadow-sm` and large radius drift:

```tsx
<Card className="mt-6 border bg-card">
```

Keep login behavior unchanged.

- [ ] **Step 2: Reduce badge emphasis**

Change admin badges from:

```tsx
<Badge variant="outline" className="border-primary/30 bg-card text-primary">
```

to:

```tsx
<Badge variant="outline" className="border-border bg-background text-muted-foreground">
```

- [ ] **Step 3: Keep table dense and tokenized**

Do not restructure the table. Remove extra card shadows and keep filter/list cards as:

```tsx
<Card className="mt-6 border bg-card">
```

- [ ] **Step 4: Run admin navigation tests**

Run: `npm test -- src/lib/admin-navigation.test.ts`

Expected: PASS.

## Task 7: Full Verification

**Files:**
- Read/verify all modified files.

- [ ] **Step 1: Scan for remaining arbitrary visual values**

Run:

```bash
rg -n "#[0-9a-fA-F]{3,8}|bg-\[|text-\[oklch|shadow-\[|oklch\(" src/app src/lib src/components -g '*.tsx' -g '*.ts' -g '*.css'
```

Expected: remaining matches are either global token definitions in `globals.css`, acceptable typography sizes such as `text-[0.72rem]`, or SVG-safe token constants.

- [ ] **Step 2: Run full test suite**

Run: `npm test`

Expected: PASS.

- [ ] **Step 3: Run production build**

Run: `npm run build`

Expected: PASS.

- [ ] **Step 4: Start dev server if visual inspection is needed**

Run: `npm run dev`

Expected: local Next dev server starts and prints a localhost URL.

Inspect:

- `/`
- `/reservation`
- `/reservations`
- `/admin`

Expected: pages render with calmer neutral surfaces, consistent radius, no obvious overlap, and preserved reservation behavior.
