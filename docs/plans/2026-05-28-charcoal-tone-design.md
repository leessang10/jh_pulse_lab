# Charcoal Tone Design

## Goal

Update the reservation app from a warm beige/brown palette to a bright background with charcoal-focused accents.

## Direction

Use a light charcoal system: keep the app background bright, shift text, borders, focus rings, primary actions, and badges toward neutral charcoal values, and avoid saturated blue or green buttons in the reservation time step.

## Scope

- Update global theme tokens in `src/app/globals.css`.
- Replace the warm page background grid with a quieter cool-gray grid.
- Replace direct saturated time-slot classes in `src/app/page.tsx`.
- Keep status semantics readable: available, selected, and unavailable remain visually distinct, but use calmer charcoal tones.

## Acceptance

- The app still reads as a light UI.
- Primary actions and selected states feel charcoal, not blue/green.
- Reservation time buttons are less vivid while staying high contrast.
- Existing booking behavior is unchanged.
