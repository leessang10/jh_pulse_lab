# JH Pulse Lab Reservation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a local-storage MVP reservation system with a user booking page and admin management page.

**Architecture:** Create a Next.js App Router application with TypeScript and Tailwind CSS. Keep booking rules in pure functions under `src/lib/reservations.ts`, use a client-side localStorage store for persistence, and render two client pages for booking and management.

**Tech Stack:** Next.js, TypeScript, Tailwind CSS, Vitest, React, localStorage.

---

### Task 1: Scaffold App

**Files:**
- Create: `package.json`
- Create: `src/app/layout.tsx`
- Create: `src/app/page.tsx`
- Create: `src/app/admin/page.tsx`
- Create: `src/app/globals.css`
- Create: `src/lib/reservations.ts`
- Create: `src/lib/reservations.test.ts`

**Step 1:** Use `create-next-app` with TypeScript, Tailwind, App Router, and no src import alias surprises.

**Step 2:** Install Vitest and React testing dependencies if the scaffold does not include them.

### Task 2: Reservation Rules

**Step 1: Write failing tests**

Test `formatMinutes`, `generateTimeSlots`, `findReservationConflict`, and `validateReservationDraft` in `src/lib/reservations.test.ts`.

**Step 2: Run test to verify failure**

Run: `npm run test -- src/lib/reservations.test.ts`

Expected: FAIL because reservation helpers are missing.

**Step 3: Implement rules**

Add room constants, status labels, time helpers, overlap detection, and draft validation in `src/lib/reservations.ts`.

**Step 4: Run test to verify pass**

Run: `npm run test -- src/lib/reservations.test.ts`

Expected: PASS.

### Task 3: Local Storage Store

**Files:**
- Create: `src/lib/use-reservations.ts`

**Step 1:** Build a hook that loads reservations from `localStorage`, writes changes back, and exposes add, update status, and remove functions.

**Step 2:** Keep parsing defensive: invalid stored JSON should reset to an empty list.

### Task 4: User Booking Page

**Files:**
- Modify: `src/app/page.tsx`

**Step 1:** Render date, room, start, duration, name, phone, and note inputs.

**Step 2:** Use reservation validation before saving.

**Step 3:** Show availability and same-day schedule.

### Task 5: Admin Page

**Files:**
- Modify: `src/app/admin/page.tsx`

**Step 1:** Render filters for date, room, and status.

**Step 2:** Render reservation rows with status update and delete actions.

**Step 3:** Keep cancelled reservations visible unless filtered out.

### Task 6: Verification

**Step 1:** Run `npm run test`.

**Step 2:** Run `npm run build`.

**Step 3:** Start `npm run dev` and open the local app for manual inspection.

