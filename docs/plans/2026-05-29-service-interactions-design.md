# Service Interactions Design

## Goal

Make the reservation service feel less rigid by adding focused motion and interaction feedback without changing booking behavior.

## Direction

Use a restrained interactive treatment. Keep the current bright charcoal tone, but add Framer Motion step transitions, tactile button states, staggered room/time item entry, clearer selected-state feedback, a more deliberate completion moment, and Lenis smooth scrolling.

## Scope

- Update `src/app/page.tsx` markup where needed for Framer Motion components.
- Add Lenis through a small client provider used by the root layout.
- Keep CSS limited to visual support styles such as tactile fallback transitions and selected-state shadow.
- Preserve the existing reservation state machine, validation, Supabase flow, and text.
- Respect reduced-motion preferences with static equivalents.

## Interaction Model

- Page sections enter and exit with a short Framer Motion upward fade.
- Repeated choices use Framer Motion stagger timing so room and time options feel responsive.
- Selectable controls lift or compress slightly on hover/press.
- Selected time summary receives a light highlight when a complete time is chosen.
- Completion uses a compact success pop animation for the icon and content.
- Lenis smooths page scrolling while respecting reduced-motion settings.

## Acceptance

- The service still feels practical and easy to scan.
- The new motion improves feedback without making the reservation flow slower.
- Disabled states stay visually quiet and do not animate like available actions.
- `prefers-reduced-motion: reduce` disables nonessential motion.
