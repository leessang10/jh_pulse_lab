# V2 Same-Day Reservation Board Design

## Goal

Add a V2 public reservation experience for JH Pulse Lab that lets visitors immediately see today's available drum practice room slots and reserve with only a name and password.

The existing V1 routes, pages, Supabase table, and public reservation API surface stay in place. V2 is added under `/v2` and does not replace the current pages.

## Scope

- Add `/v2` as the public V2 reservation board.
- Preserve existing pages:
  - `/`
  - `/reservation`
  - `/reservations`
  - `/admin`
- Reuse the existing `reservations` table and server actions where possible.
- Add V2-specific pure helpers only where the current helpers are too broad for same-day board behavior.
- Keep rooms fixed to the existing 3 active rooms.
- Keep operating hours fixed in code at `10:00` to `22:00`.
- Use 30-minute time tiles.
- Allow booking durations of `30` or `60` minutes only.
- Poll reservation data periodically so the board reflects other users' bookings.

## Out Of Scope

- No V2 admin page.
- No admin changes.
- No operating-hours settings UI.
- No room-name editing UI.
- No blocked-time management.
- No Supabase schema changes unless a missing validation cannot be expressed safely in code.
- No user account signup or login.
- No date picker.
- No payment, notifications, or waitlist.

## Route Design

`/v2` is the only new route in this feature.

The route renders a client-side interactive board because users need to open modals, submit reservations, cancel reservations, and see polling updates without navigating away.

The page should display:

- Title: `드럼 연습실 예약`
- Today's Korea date.
- A compact status message for loading, errors, success, or refresh state.
- The reservation board as the primary screen area.
- Reservation and cancellation dialogs.

## Visual Direction

The V2 interface should be cleaner and more direct than V1. It is a service screen, not a landing page.

Design read:

- White-based app surface.
- Large readable type.
- Large tap targets.
- Clear color semantics.
- Minimal navigation.
- Board-first layout.

State colors:

- Available: clear green-tinted positive state.
- Reserved: neutral filled tile with the reserver name.
- Past: low-contrast disabled tile.
- Unavailable by rule: disabled tile.
- Error or destructive action: existing destructive token.

Shape and spacing:

- Use one radius scale for tiles, buttons, inputs, and dialogs.
- Touch targets must be at least 44px tall.
- Avoid nested cards. The board itself is the main surface.
- Use borders and background color for hierarchy instead of heavy shadows.

## Board Behavior

V2 only shows today's schedule. There is no date selection.

The board includes time slots from `10:00` through `21:30`. A 60-minute reservation at `21:30` is invalid because it would end after `22:00`.

Tile states:

- `past`: start time is not after the current Korea time. Disabled.
- `available`: no active reservation overlaps the tile and a valid duration can start there. Click opens booking dialog.
- `reserved`: an active reservation covers the tile. Display the reserver name. Click opens cancellation dialog for that reservation.
- `unavailable`: the tile cannot support the currently selected or default booking rule. Disabled.

The board should evaluate every 30-minute cell for each room.

Desktop layout:

- CSS grid.
- Time labels in the first column.
- Room names across the top.
- One clickable tile per room and time.

Mobile layout:

- Do not squeeze the desktop table.
- Render each time as a group card.
- Inside each group, render one large room tile per active room.

## Booking Flow

Clicking an available tile opens a booking dialog.

The dialog includes:

- Selected room.
- Selected start time.
- Name input.
- Password input.
- Duration selector with `30분` and `1시간`.
- Reservation button.

The default duration is `30분`.

If the user changes duration to `1시간`, the UI must show a clear disabled or error state if the 60-minute range crosses operating hours, crosses the current time rule, or overlaps another reservation.

On submit:

1. Client performs basic validation for empty name, password format, duration, and visible availability.
2. Server action validates the same rules again.
3. If successful, close the dialog, refresh the board, and show a clear success message.
4. If failed, keep the dialog open and show the server error.

## Cancellation Flow

Clicking a reserved tile opens a cancellation dialog.

The dialog shows:

- Reserver name.
- Practice room.
- Reservation time range.
- Password input.
- Cancel button.

The cancellation uses the existing password-based lookup pattern. If the password matches the reservation, the reservation is cancelled. If it does not match, show a clear error message.

After cancellation succeeds, close the dialog, refresh the board, and show a clear success message.

## Server Validation

V2 reservation creation must validate on the server:

- The reservation date is today's Korea date.
- The start time is after the current Korea time.
- The range is within `10:00` to `22:00`.
- The duration is exactly `30` or `60` minutes.
- The start and end times are on the 30-minute grid.
- The room is one of the active 3 rooms.
- No active reservation overlaps the same room and time range.

The existing database overlap trigger remains the final race-condition guard.

## Data Flow

Initial load:

1. `/v2` computes today's Korea date.
2. The V2 board hook loads public time blocks for today.
3. The board renders tiles from the fixed operating-hours window.

Polling:

1. Every 10 seconds, refresh today's public time blocks.
2. Do not reset open dialog form fields during polling.
3. If a selected tile becomes unavailable before submit, show a conflict message on submit and refresh the board.

Booking:

1. The dialog creates a draft with today's date, selected room, start time, calculated end time, name, and password.
2. The server action validates V2 policy and writes to the existing `reservations` table.
3. The board refreshes after success.

Cancellation:

1. The dialog calls a V2 cancellation action by reservation id and password.
2. The server verifies the reservation exists and password matches.
3. The board refreshes after success.

## Component Boundaries

Add V2-specific files so V1 remains stable:

- `src/app/v2/page.tsx`
- `src/app/v2/v2-reservation-board.tsx`
- `src/lib/v2-reservation-board.ts`
- `src/lib/v2-reservation-actions.ts`
- Tests for pure board state and V2 validation helpers.

Reuse existing shared modules:

- `src/lib/reservations.ts`
- `src/lib/booking-availability.ts` when the helper matches V2 rules.
- `src/lib/korea-date.ts`
- `src/lib/use-reservations.ts` only if its polling behavior remains clean enough for V2.
- Existing UI primitives from `src/components/ui`.

## Error Handling

User-facing messages should be short and concrete:

- `예약이 완료되었습니다.`
- `예약을 취소했습니다.`
- `이미 예약된 시간입니다.`
- `현재 시간 이후만 예약할 수 있습니다.`
- `오늘 예약만 가능합니다.`
- `운영시간은 10:00부터 22:00까지입니다.`
- `비밀번호가 일치하지 않습니다.`

Use inline dialog errors for form submissions. Use one board-level message for successful reservation or cancellation.

## Testing

Unit tests:

- Build 30-minute V2 board slots from `10:00` to `22:00`.
- Mark past slots as disabled.
- Mark overlapping reservation slots as reserved.
- Prevent 60-minute booking when the second slot is reserved.
- Prevent booking outside operating hours.
- Reject non-today reservation drafts.
- Preserve existing reservation tests.

Verification:

- Run `npm test`.
- Run `npm run build`.
- Start the dev server.
- Inspect `/v2` on desktop and mobile widths.
- Verify booking success, duplicate booking failure, wrong-password cancellation failure, and successful cancellation.

## Implementation Notes

Do not make the V2 board depend on admin-only data. Public time blocks must remain limited to the fields needed for availability and display.

Do not alter V1 behavior while building V2. If a shared helper must change, add focused tests proving the existing V1 behavior still works.
