# Charcoal Tone Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert the app to a bright charcoal-accented palette and calm the reservation time-slot button colors.

**Architecture:** The app already uses Tailwind v4 theme tokens backed by CSS variables in `src/app/globals.css`. Most components consume those tokens through shadcn-style utility classes, while the reservation time buttons use a few direct Tailwind color classes that need to be replaced.

**Tech Stack:** Next.js, React, TypeScript, Tailwind CSS v4, shadcn UI components.

---

### Task 1: Global Theme Tokens

**Files:**
- Modify: `src/app/globals.css`

**Step 1: Update theme variables**

Set the light theme tokens to cool neutral values: bright background, white cards, charcoal foreground, charcoal primary, soft gray secondary/muted/accent, and neutral borders/rings.

**Step 2: Update page background**

Replace the warm beige grid with a cool light-gray gradient and subtle charcoal grid lines.

**Step 3: Verify**

Run: `npm run build`

Expected: build succeeds.

### Task 2: Reservation Time Button Colors

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Replace saturated color classes**

Change selected/pending time buttons from `bg-emerald-600` to a charcoal token-based style, and available buttons from `bg-blue-600 hover:bg-blue-700` to `bg-primary hover:bg-primary/90`.

**Step 2: Keep unavailable muted**

Leave blocked slots on muted background with muted foreground to preserve disabled affordance.

**Step 3: Verify**

Run: `npm run build`

Expected: build succeeds and no behavior changes.
