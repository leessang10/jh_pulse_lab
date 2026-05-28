# Supabase Reservation Backend Design

## Goal

Move the JH Pulse Lab reservation MVP from browser `localStorage` to Supabase while keeping the current booking flow simple:

- Public users can submit reservations without logging in.
- Admin users log in with Supabase Auth email/password.
- Admin users can view, confirm, cancel, and delete reservations.
- Reservation conflicts are prevented consistently across browsers and devices.

## Current Context

The app is a Next.js App Router project. Both `/` and `/admin` currently use `src/lib/use-reservations.ts`, which reads and writes all reservations through `localStorage`. Reservation rules live in `src/lib/reservations.ts` as pure TypeScript functions and already have Vitest coverage.

The Supabase migration should preserve the current pure rule helpers and replace only the persistence and admin authentication boundary.

## Architecture

Use Supabase as the database and authentication provider.

- Public reservation page calls server-side reservation actions and receives only the fields needed to calculate availability.
- Admin login uses Supabase Auth email/password.
- Admin page requires an authenticated Supabase user.
- Server-side code creates Supabase clients from environment variables and request cookies.
- Client components keep local UI state for selected date, room, time, and form fields.
- Shared reservation helpers remain framework-independent and continue to power overlap checks and validation.

This keeps the browser from owning durable state, avoids exposing customer contact data to public users, and gives the database the final authority for reservation writes.

## Data Model

Create a `reservations` table:

```sql
create type reservation_status as enum ('pending', 'confirmed', 'cancelled');

create table reservations (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  room_id text not null,
  start_minutes integer not null,
  end_minutes integer not null,
  name text not null,
  phone text not null,
  note text,
  status reservation_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reservation_room_check check (room_id in ('room-1', 'room-2', 'room-3', 'room-4')),
  constraint reservation_time_grid_check check (
    start_minutes >= 0
    and end_minutes <= 1440
    and end_minutes > start_minutes
    and start_minutes % 30 = 0
    and end_minutes % 30 = 0
  )
);
```

Add a trigger or exclusion-style validation function that rejects overlapping active reservations for the same date and room when both records are not `cancelled`. This is required because client-side availability checks can race.

## Security Model

Enable Row Level Security on `reservations`.

- Public users do not read the table directly. They receive availability data through server actions that strip name, phone, and note.
- Public users may insert reservations only through server actions, with status forced to `pending`.
- Authenticated admin users may select reservations.
- Authenticated admin users may update reservation status.
- Authenticated admin users may delete reservations.

The MVP treats every authenticated Supabase user in this project as an admin. This matches the selected email/password admin-account approach and avoids adding a separate roles table before it is needed. If multiple staff roles become necessary later, add an `admin_users` allowlist table and tighten policies to that table.

Server actions may use the service role key for public availability reads and public inserts, but only on the server. Those actions must validate input before writing and must never return private fields to unauthenticated clients.

## Data Flow

Public booking:

1. The page loads active time blocks for the selected date.
2. The user chooses room, start time, duration, name, and phone.
3. The client validates required fields and checks visible conflicts.
4. A server action validates the draft again.
5. Supabase inserts the reservation.
6. The database overlap guard rejects any race-condition conflict.
7. The page refreshes the selected date reservations and shows completion.

Admin:

1. `/admin` checks the Supabase session.
2. Unauthenticated users see a login form.
3. Authenticated users load reservations by date, room, and status.
4. Status changes and deletes call server-side actions.
5. The list refreshes after each mutation.

## Code Changes

- Add `@supabase/ssr` and `@supabase/supabase-js`.
- Add `src/lib/supabase/server.ts` for server clients.
- Add `src/lib/supabase/client.ts` only if client-side auth helpers are needed.
- Replace `src/lib/use-reservations.ts` with a Supabase-backed hook split into:
  - `src/lib/reservation-actions.ts` for server actions.
  - `src/lib/use-reservations.ts` for client state and action calls.
- Add admin auth actions for login/logout.
- Add a Supabase SQL migration under `supabase/migrations`.
- Add `.env.local.example` with:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

Do not expose the service role key to the browser. Use it only in server-only modules and keep public action responses limited to non-private fields.

## Error Handling

- Show a Korean error message when a reservation conflicts with an existing active reservation.
- Show a generic Korean error when Supabase is unavailable or credentials are missing.
- Keep validation messages from existing reservation helpers.
- Admin login errors should not reveal whether an email exists.

## Testing

Keep existing reservation-rule tests. Add tests around pure mapper and validation logic:

- Convert Supabase rows to `Reservation`.
- Convert public availability rows to reservation-like time blocks without private fields.
- Convert reservation drafts to insert payloads.
- Preserve cancelled reservations as non-blocking in conflict helpers.
- Reject invalid draft input before calling Supabase actions.

Manual verification:

- Public user can create a reservation.
- A second browser sees the new reservation as unavailable.
- Admin can log in, filter reservations, update status, delete rows, and log out.
- Cancelled reservations no longer block new bookings.

## Out of Scope

- Customer login.
- Payment.
- SMS notifications.
- Staff role levels.
- Migrating existing browser `localStorage` data automatically.
