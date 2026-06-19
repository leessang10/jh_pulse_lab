# Minimal Design Token Cleanup Design

## Goal

Unify the mixed visual tokens across the public reservation flow, owner lookup flow, landing status screen, and admin page. The result should feel minimal, calm, and operational: fewer decorative surfaces, fewer one-off colors, consistent component shape, and clearer hierarchy.

## Scope

- Normalize global design tokens in `src/app/globals.css`.
- Replace page-level hardcoded `oklch(...)`, hex colors, and arbitrary shadows with named tokens or small local constants.
- Align radius, shadow, font-weight, and state styles across:
  - `src/app/page.tsx`
  - `src/app/reservation/page.tsx`
  - `src/app/reservations/page.tsx`
  - `src/app/admin/page.tsx`
  - `src/lib/landing-schedule.ts`
  - `src/lib/landing-detail-schedule.ts`
  - `src/lib/landing-room-tile.ts`
- Preserve existing reservation behavior, routing, validation, data loading, and Supabase interactions.
- Keep the current shadcn-style component foundation instead of adding a new design system.

## Design Direction

Use a restrained neutral palette with one reservation accent. Most UI surfaces should be expressed with background, border, spacing, and typography rather than heavy shadows or saturated fills.

The default visual language:

- Background: soft neutral app background.
- Surface: white or tokenized card surface.
- Text: high-contrast foreground and muted secondary text.
- Accent: one teal-like reservation accent for selected/reserved states and schedule marks.
- Destructive: current destructive token for cancellation and delete flows.
- Status colors: keep semantic differences, but avoid a rainbow palette unless the information requires category separation.

## Token Rules

- Colors live in `globals.css` or in a small clearly named visual constants module when they must be consumed by SVG/JS.
- Page code should prefer Tailwind token utilities such as `bg-background`, `bg-card`, `bg-muted`, `text-foreground`, `text-muted-foreground`, `border-border`, `text-primary`, and `ring-ring`.
- Avoid arbitrary colors in JSX except when SVG rendering requires a raw CSS value.
- Radius should center on `rounded-lg` for cards, forms, buttons, and panels. Use `rounded-full` only for circular controls or pills. Avoid mixing `rounded-md`, `rounded-xl`, and `rounded-2xl` without a specific role.
- Shadows should be removed by default. Use border/ring for hierarchy. Keep only a subtle shared elevation token if a floating overlay or selected state needs it.
- Font weight should be calmer: `font-medium` or `font-semibold` for most labels and controls, `font-bold` only for primary values. Remove broad `font-black` usage.

## Component Surface Changes

### Landing Status Screen

Keep the compact dashboard-like layout and circular schedule visualization. Reduce visual intensity by:

- Moving schedule segment colors to tokenized accent shades.
- Removing direct background `oklch(...)` from the main element.
- Replacing custom heavy shadows with border/ring styles.
- Reducing overly heavy label weights.
- Keeping room tiles stable in size and clearly selectable.

### Reservation Flow

Keep the current step flow: time selection, contact input, completion. Make the UI quieter by:

- Using consistent card and button radii.
- Removing inline font-size and font-weight styles where Tailwind classes can express the same intent.
- Making selected time/duration states use a consistent `border-primary`, `bg-muted`, and `ring-primary` pattern.
- Keeping tactile motion, but avoiding visual jumps caused by scale changes unless already subtle.

### Owner Reservation Lookup

Keep lookup, edit, cancel, confirmation modal, and post-cancel navigation behavior. Make the screen match the reservation flow by:

- Reusing the same form density, card surface, and selected option style.
- Keeping destructive actions visually distinct but not oversized.
- Making empty and loading states use the same muted panel style.

### Admin Page

Keep admin functionality and sidebar structure intact. Apply the same token cleanup without making the admin page look like a marketing surface:

- Keep dense table behavior.
- Reduce badge and card emphasis.
- Use consistent filter control spacing and radius.
- Preserve mobile sidebar behavior.

## Testing

- Update unit tests that assert exact visual constants only when the constants intentionally change.
- Run `npm test`.
- Run `npm run build`.
- If implementation changes visible layout meaningfully, start the dev server and visually inspect key routes:
  - `/`
  - `/reservation`
  - `/reservations`
  - `/admin`

## Out Of Scope

- No new component library.
- No Supabase schema or reservation logic changes.
- No route restructuring.
- No dark-mode redesign beyond keeping existing dark tokens coherent if touched.
- No image or brand asset work.
