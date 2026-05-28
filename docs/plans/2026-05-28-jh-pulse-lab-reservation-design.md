# JH Pulse Lab Reservation Design

## Goal

Build a two-page reservation MVP for JH Pulse Lab, a drum lesson studio with four rooms and 24-hour booking availability.

## Scope

- User reservation page at `/`
- Admin reservation management page at `/admin`
- Four rooms: Room 1, Room 2, Room 3, Room 4
- Operating hours: 00:00 to 24:00
- Reservation interval: 30 minutes
- Local browser storage only, no backend or database

## Architecture

Use a Next.js App Router project with TypeScript and Tailwind CSS. Store reservations in `localStorage` through a small client-side store hook. Keep reservation rules in pure TypeScript functions so overlap detection and time generation are testable without React.

## Data Model

```ts
type ReservationStatus = "pending" | "confirmed" | "cancelled";

type Reservation = {
  id: string;
  date: string;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
  name: string;
  phone: string;
  note?: string;
  status: ReservationStatus;
  createdAt: string;
};
```

## Booking Rules

- A reservation must start and end on a 30-minute boundary.
- Start must be earlier than end.
- End may be exactly 24:00.
- Reservations conflict when they use the same date, room, and overlapping time range.
- Cancelled reservations do not block new bookings.

## UI Design

The user page prioritizes fast booking: date and room selectors, visible available time slots, contact fields, and a same-day schedule summary. The admin page prioritizes scanning and action: filters, compact reservation rows, status controls, and delete actions.

The visual direction is practical and music-specific without becoming decorative: dark charcoal surfaces, warm brass accents, strong grid lines, and clear Korean labels.

## Testing

Unit tests cover pure reservation rules:

- Time slot generation includes 00:00 through 23:30 starts.
- Overlap detection catches partial and exact overlaps.
- Cancelled reservations do not create conflicts.
- Reservation validation rejects invalid ranges and off-grid times.

