# Service Interactions Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add restrained animation and interactive feedback to the public reservation service.

**Architecture:** Keep reservation behavior inside `src/app/page.tsx` unchanged and add motion with Framer Motion components. Add Lenis through a small client provider at the root layout, and keep CSS limited to selected-state visual support and reduced-motion-safe interaction fallback styles.

**Tech Stack:** Next.js App Router, React, Tailwind CSS v4, shadcn/ui, lucide-react, Framer Motion, Lenis.

---

### Task 1: Add Motion Dependencies and Provider

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `src/components/smooth-scroll-provider.tsx`
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

**Step 1: Install dependencies**

Run: `npm install framer-motion lenis`
Expected: Dependencies are added to `package.json` and `package-lock.json`.

**Step 2: Add Lenis provider**

Create a client component that initializes Lenis with `requestAnimationFrame`, destroys it on cleanup, and skips initialization when `prefers-reduced-motion: reduce` is active.

**Step 3: Wire provider into layout**

Wrap `children` in `SmoothScrollProvider`.

**Step 4: Keep CSS support utilities**

Keep selected-state shadow and tactile transition fallback styles in `src/app/globals.css`.

**Step 5: Verify CSS and provider compile**

Run: `npm run build`
Expected: PASS with no TypeScript, Tailwind, or CSS errors.

### Task 2: Apply Motion to Reservation Flow

**Files:**
- Modify: `src/app/page.tsx`

**Step 1: Apply section transitions**

Wrap the step branches in `AnimatePresence` and use `motion.section` for `room`, `time`, `contact`, and `done`.

**Step 2: Apply stagger and interaction props**

Use `motion.button` for room cards, period controls, time buttons, and duration buttons. Ensure disabled buttons do not receive hover/tap motion.

**Step 3: Strengthen selected feedback**

Use Framer Motion `animate` props for selected controls, the selected-time summary panel, and the done state icon/card.

**Step 4: Verify behavior**

Run: `npm run build`
Expected: PASS.

### Task 3: Browser QA

**Files:**
- No file changes expected.

**Step 1: Start the app**

Run: `npm run dev`
Expected: Next dev server starts.

**Step 2: Inspect the service screen**

Open the local URL in the browser, check room selection, time selection, contact form, and done state.

**Step 3: Fix visual issues if found**

Adjust CSS or classes only if text overlaps, controls shift unexpectedly, or motion feels too heavy.
