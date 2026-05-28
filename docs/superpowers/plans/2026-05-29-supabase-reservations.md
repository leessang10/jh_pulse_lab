# Supabase Reservations Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace browser `localStorage` reservation persistence with Supabase database storage and Supabase Auth email/password admin login.

**Architecture:** Keep reservation rules in `src/lib/reservations.ts` and add a Supabase persistence boundary around them. Public users call server actions that return availability-only data, while admins authenticate with Supabase Auth and call authenticated server actions for full reservation management.

**Tech Stack:** Next.js App Router, TypeScript, React, Supabase JS/SSR, Postgres SQL migrations, Vitest.

---

## File Structure

- Create `supabase/migrations/20260529000000_create_reservations.sql`: reservation table, enum, RLS policies, updated timestamp trigger, and overlap guard.
- Create `.env.local.example`: Supabase environment variable documentation.
- Create `src/lib/supabase/server.ts`: server-only Supabase clients for cookie auth and service-role operations.
- Create `src/lib/supabase/reservation-mappers.ts`: pure row/payload mapping used by actions and tests.
- Create `src/lib/supabase/reservation-mappers.test.ts`: mapper and validation tests.
- Create `src/lib/reservation-actions.ts`: server actions for public availability reads, public reservation creation, admin reads, status updates, and deletes.
- Create `src/lib/admin-auth-actions.ts`: server actions for admin login/logout.
- Modify `src/lib/use-reservations.ts`: remove `localStorage`; call server actions and expose the same client-facing API shape where practical.
- Modify `src/app/page.tsx`: await async reservation creation and refresh availability after writes.
- Modify `src/app/admin/page.tsx`: add login/logout flow and await async admin mutations.
- Modify `package.json` and `package-lock.json`: add Supabase packages.

---

### Task 1: Add Supabase Dependencies And Environment Template

**Files:**
- Modify: `package.json`
- Modify: `package-lock.json`
- Create: `.env.local.example`

- [ ] **Step 1: Install Supabase packages**

Run:

```bash
npm install @supabase/ssr @supabase/supabase-js
```

Expected: `package.json` and `package-lock.json` include both packages.

- [ ] **Step 2: Add environment template**

Create `.env.local.example`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

- [ ] **Step 3: Verify install**

Run:

```bash
npm run test -- src/lib/reservations.test.ts
```

Expected: PASS.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json .env.local.example
git commit -m "chore: Supabase 의존성 추가"
```

---

### Task 2: Add Supabase Database Migration

**Files:**
- Create: `supabase/migrations/20260529000000_create_reservations.sql`

- [ ] **Step 1: Create migration**

Create `supabase/migrations/20260529000000_create_reservations.sql`:

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

create or replace function set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger reservations_set_updated_at
before update on reservations
for each row
execute function set_updated_at();

create or replace function prevent_active_reservation_overlap()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  if exists (
    select 1
    from reservations existing
    where existing.id <> new.id
      and existing.date = new.date
      and existing.room_id = new.room_id
      and existing.status <> 'cancelled'
      and new.start_minutes < existing.end_minutes
      and existing.start_minutes < new.end_minutes
  ) then
    raise exception 'reservation time conflicts with an existing reservation'
      using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger reservations_prevent_overlap
before insert or update on reservations
for each row
execute function prevent_active_reservation_overlap();

alter table reservations enable row level security;

create policy "authenticated admins can read reservations"
on reservations for select
to authenticated
using (true);

create policy "authenticated admins can update reservations"
on reservations for update
to authenticated
using (true)
with check (true);

create policy "authenticated admins can delete reservations"
on reservations for delete
to authenticated
using (true);
```

- [ ] **Step 2: Review migration text**

Run:

```bash
rg -n "reservation_status|prevent_active_reservation_overlap|enable row level security|authenticated admins" supabase/migrations/20260529000000_create_reservations.sql
```

Expected: output includes the enum, overlap trigger, RLS enablement, and three admin policies.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/20260529000000_create_reservations.sql
git commit -m "feat: 예약 Supabase 스키마 추가"
```

---

### Task 3: Add Supabase Row Mappers With Tests

**Files:**
- Create: `src/lib/supabase/reservation-mappers.test.ts`
- Create: `src/lib/supabase/reservation-mappers.ts`

- [ ] **Step 1: Write failing mapper tests**

Create `src/lib/supabase/reservation-mappers.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  mapReservationDraftToInsert,
  mapReservationRowToReservation,
  mapReservationRowToTimeBlock,
  type ReservationRow,
} from "./reservation-mappers";

const row: ReservationRow = {
  id: "67c5bdfa-fcf2-4fbb-8204-912c54f364e6",
  date: "2026-05-29",
  room_id: "room-1",
  start_minutes: 600,
  end_minutes: 660,
  name: " Lee ",
  phone: " 010-0000-0000 ",
  note: " Bring sticks ",
  status: "pending",
  created_at: "2026-05-29T00:00:00.000Z",
  updated_at: "2026-05-29T00:01:00.000Z",
};

describe("Supabase reservation mappers", () => {
  it("maps a Supabase row to the app Reservation shape", () => {
    expect(mapReservationRowToReservation(row)).toEqual({
      id: row.id,
      date: "2026-05-29",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      name: " Lee ",
      phone: " 010-0000-0000 ",
      note: " Bring sticks ",
      status: "pending",
      createdAt: "2026-05-29T00:00:00.000Z",
    });
  });

  it("maps a Supabase row to a public time block without private fields", () => {
    expect(mapReservationRowToTimeBlock(row)).toEqual({
      id: row.id,
      date: "2026-05-29",
      roomId: "room-1",
      startMinutes: 600,
      endMinutes: 660,
      status: "pending",
      createdAt: "2026-05-29T00:00:00.000Z",
    });
  });

  it("maps a draft to an insert payload with trimmed contact fields and pending status", () => {
    expect(
      mapReservationDraftToInsert({
        date: "2026-05-29",
        roomId: "room-2",
        startMinutes: 720,
        endMinutes: 780,
        name: " Kim ",
        phone: " 010-1111-2222 ",
        note: " ",
      }),
    ).toEqual({
      date: "2026-05-29",
      room_id: "room-2",
      start_minutes: 720,
      end_minutes: 780,
      name: "Kim",
      phone: "010-1111-2222",
      note: null,
      status: "pending",
    });
  });
});
```

- [ ] **Step 2: Run tests to verify failure**

Run:

```bash
npm run test -- src/lib/supabase/reservation-mappers.test.ts
```

Expected: FAIL because `src/lib/supabase/reservation-mappers.ts` does not exist.

- [ ] **Step 3: Implement mappers**

Create `src/lib/supabase/reservation-mappers.ts`:

```ts
import type { Reservation, ReservationDraft, ReservationStatus } from "@/lib/reservations";

export type ReservationRow = {
  id: string;
  date: string;
  room_id: string;
  start_minutes: number;
  end_minutes: number;
  name: string;
  phone: string;
  note: string | null;
  status: ReservationStatus;
  created_at: string;
  updated_at: string;
};

export type PublicReservationTimeBlock = Omit<Reservation, "name" | "phone" | "note">;

export type ReservationInsert = {
  date: string;
  room_id: string;
  start_minutes: number;
  end_minutes: number;
  name: string;
  phone: string;
  note: string | null;
  status: "pending";
};

export function mapReservationRowToReservation(row: ReservationRow): Reservation {
  return {
    id: row.id,
    date: row.date,
    roomId: row.room_id,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    name: row.name,
    phone: row.phone,
    note: row.note ?? undefined,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapReservationRowToTimeBlock(row: ReservationRow): PublicReservationTimeBlock {
  return {
    id: row.id,
    date: row.date,
    roomId: row.room_id,
    startMinutes: row.start_minutes,
    endMinutes: row.end_minutes,
    status: row.status,
    createdAt: row.created_at,
  };
}

export function mapReservationDraftToInsert(draft: ReservationDraft): ReservationInsert {
  const note = draft.note?.trim();

  return {
    date: draft.date,
    room_id: draft.roomId,
    start_minutes: draft.startMinutes,
    end_minutes: draft.endMinutes,
    name: draft.name.trim(),
    phone: draft.phone.trim(),
    note: note || null,
    status: "pending",
  };
}
```

- [ ] **Step 4: Run mapper tests to verify pass**

Run:

```bash
npm run test -- src/lib/supabase/reservation-mappers.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/lib/supabase/reservation-mappers.ts src/lib/supabase/reservation-mappers.test.ts
git commit -m "feat: 예약 Supabase 매퍼 추가"
```

---

### Task 4: Add Supabase Server Clients

**Files:**
- Create: `src/lib/supabase/server.ts`

- [ ] **Step 1: Implement server clients**

Create `src/lib/supabase/server.ts`:

```ts
import "server-only";

import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";

function getSupabaseUrl() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is required");
  return url;
}

function getSupabaseAnonKey() {
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is required");
  return key;
}

function getSupabaseServiceRoleKey() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required");
  return key;
}

export async function createSupabaseServerClient() {
  const cookieStore = await cookies();

  return createServerClient(getSupabaseUrl(), getSupabaseAnonKey(), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}

export function createSupabaseServiceClient() {
  return createClient(getSupabaseUrl(), getSupabaseServiceRoleKey(), {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
```

- [ ] **Step 2: Run typecheck through build**

Run:

```bash
npm run build
```

Expected: PASS or fail only because Supabase packages are not installed. If packages are installed, TypeScript should accept the file.

- [ ] **Step 3: Commit**

```bash
git add src/lib/supabase/server.ts
git commit -m "feat: Supabase 서버 클라이언트 추가"
```

---

### Task 5: Add Reservation Server Actions

**Files:**
- Create: `src/lib/reservation-actions.ts`

- [ ] **Step 1: Implement reservation actions**

Create `src/lib/reservation-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import {
  findReservationConflict,
  validateReservationDraft,
  type Reservation,
  type ReservationDraft,
  type ReservationStatus,
} from "@/lib/reservations";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import {
  mapReservationDraftToInsert,
  mapReservationRowToReservation,
  mapReservationRowToTimeBlock,
  type PublicReservationTimeBlock,
  type ReservationRow,
} from "@/lib/supabase/reservation-mappers";

export type ReservationActionResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: string };

const CONFLICT_MESSAGE = "이미 예약된 시간입니다.";
const GENERIC_MESSAGE = "예약 정보를 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.";

function toActionError(error: unknown) {
  if (error instanceof Error && error.message.includes("conflicts")) return CONFLICT_MESSAGE;
  return GENERIC_MESSAGE;
}

export async function listPublicReservationTimeBlocks(date: string): Promise<ReservationActionResult<PublicReservationTimeBlock[]>> {
  try {
    const supabase = createSupabaseServiceClient();
    const { data, error } = await supabase
      .from("reservations")
      .select("id,date,room_id,start_minutes,end_minutes,status,created_at,updated_at,name,phone,note")
      .eq("date", date)
      .neq("status", "cancelled")
      .order("start_minutes", { ascending: true });

    if (error) throw error;

    return { ok: true, data: ((data ?? []) as ReservationRow[]).map(mapReservationRowToTimeBlock) };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}

export async function createPublicReservation(draft: ReservationDraft): Promise<ReservationActionResult<Reservation>> {
  const validationErrors = validateReservationDraft(draft);
  if (validationErrors.length > 0) return { ok: false, error: validationErrors[0] };

  try {
    const supabase = createSupabaseServiceClient();
    const current = await listPublicReservationTimeBlocks(draft.date);
    if (!current.ok) return current;

    const conflict = findReservationConflict(
      current.data.map((block) => ({ ...block, name: "", phone: "" })),
      draft,
    );
    if (conflict) return { ok: false, error: CONFLICT_MESSAGE };

    const { data, error } = await supabase
      .from("reservations")
      .insert(mapReservationDraftToInsert(draft))
      .select("id,date,room_id,start_minutes,end_minutes,status,created_at,updated_at,name,phone,note")
      .single();

    if (error) throw error;

    revalidatePath("/");
    revalidatePath("/admin");
    return { ok: true, data: mapReservationRowToReservation(data as ReservationRow) };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function listAdminReservations(filters: {
  date: string;
  roomId?: string;
  status?: ReservationStatus;
}): Promise<ReservationActionResult<Reservation[]>> {
  try {
    const supabase = await createSupabaseServerClient();
    let query = supabase
      .from("reservations")
      .select("id,date,room_id,start_minutes,end_minutes,status,created_at,updated_at,name,phone,note")
      .eq("date", filters.date)
      .order("start_minutes", { ascending: true });

    if (filters.roomId) query = query.eq("room_id", filters.roomId);
    if (filters.status) query = query.eq("status", filters.status);

    const { data, error } = await query;
    if (error) throw error;

    return { ok: true, data: ((data ?? []) as ReservationRow[]).map(mapReservationRowToReservation) };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}

export async function updateAdminReservationStatus(
  id: string,
  status: ReservationStatus,
): Promise<ReservationActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("reservations").update({ status }).eq("id", id);
    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, data: null };
  } catch (error) {
    return { ok: false, error: toActionError(error) };
  }
}

export async function deleteAdminReservation(id: string): Promise<ReservationActionResult<null>> {
  try {
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.from("reservations").delete().eq("id", id);
    if (error) throw error;

    revalidatePath("/admin");
    revalidatePath("/");
    return { ok: true, data: null };
  } catch {
    return { ok: false, error: GENERIC_MESSAGE };
  }
}
```

- [ ] **Step 2: Run build**

Run:

```bash
npm run build
```

Expected: PASS after Supabase packages are installed.

- [ ] **Step 3: Commit**

```bash
git add src/lib/reservation-actions.ts
git commit -m "feat: 예약 서버 액션 추가"
```

---

### Task 6: Replace Local Storage Hook With Supabase Action Hook

**Files:**
- Modify: `src/lib/use-reservations.ts`

- [ ] **Step 1: Replace hook implementation**

Replace `src/lib/use-reservations.ts`:

```ts
"use client";

import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import {
  createPublicReservation,
  listAdminReservations,
  listPublicReservationTimeBlocks,
  type ReservationActionResult,
} from "@/lib/reservation-actions";
import type { Reservation, ReservationDraft, ReservationStatus } from "@/lib/reservations";
import type { PublicReservationTimeBlock } from "@/lib/supabase/reservation-mappers";

type UseReservationsOptions = {
  date: string;
  admin?: boolean;
  roomId?: string;
  status?: ReservationStatus | "all";
};

function emptyResult<T>(error: string): ReservationActionResult<T> {
  return { ok: false, error };
}

export function useReservations(options: UseReservationsOptions) {
  const [reservations, setReservations] = useState<Array<Reservation | PublicReservationTimeBlock>>([]);
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const refresh = useCallback(async () => {
    setIsReady(false);
    setError(null);

    const result = options.admin
      ? await listAdminReservations({
          date: options.date,
          roomId: options.roomId === "all" ? undefined : options.roomId,
          status: !options.status || options.status === "all" ? undefined : options.status,
        })
      : await listPublicReservationTimeBlocks(options.date);

    if (result.ok) {
      setReservations(result.data);
    } else {
      setReservations([]);
      setError(result.error);
    }

    setIsReady(true);
    return result;
  }, [options.admin, options.date, options.roomId, options.status]);

  useEffect(() => {
    startTransition(() => {
      void refresh();
    });
  }, [refresh]);

  return useMemo(
    () => ({
      reservations,
      isReady,
      isPending,
      error,
      refresh,
      async addReservation(draft: ReservationDraft) {
        const result = await createPublicReservation(draft);
        if (result.ok) await refresh();
        return result;
      },
      updateReservationStatus() {
        return emptyResult<null>("관리자 예약 상태 변경 액션을 사용해 주세요.");
      },
      removeReservation() {
        return emptyResult<null>("관리자 예약 삭제 액션을 사용해 주세요.");
      },
    }),
    [error, isPending, isReady, refresh, reservations],
  );
}
```

- [ ] **Step 2: Run build to expose call-site errors**

Run:

```bash
npm run build
```

Expected: FAIL because `/` and `/admin` still call `useReservations()` without options and expect synchronous mutations.

- [ ] **Step 3: Commit after call sites are fixed in later tasks**

Do not commit this task alone if the build is failing. Commit together with Tasks 7 and 8 after the app compiles.

---

### Task 7: Update Public Reservation Page

**Files:**
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Update hook call and async submit**

In `src/app/page.tsx`, change the hook call:

```ts
const { reservations, addReservation, isReady, error } = useReservations({ date });
```

Update `submitReservation`:

```ts
async function submitReservation(values: ContactValues) {
  if (!roomId || !selectedTime) {
    setStep(roomId ? "time" : "room");
    return;
  }

  const draft: ReservationDraft = {
    date,
    roomId,
    startMinutes: selectedTime.startMinutes,
    endMinutes: selectedTime.endMinutes,
    name: values.name,
    phone: values.phone,
  };
  const conflict = findReservationConflict(
    reservations.map((reservation) => ({ ...reservation, name: "", phone: "" })),
    draft,
  );

  if (conflict) {
    toast.error("이미 예약된 시간입니다.");
    clearTimeSelection();
    setStep("time");
    return;
  }

  const result = await addReservation(draft);
  if (!result.ok) {
    toast.error(result.error);
    clearTimeSelection();
    setStep("time");
    return;
  }

  setStep("done");
  toast.success("접수되었습니다.");
}
```

Below the header, render a load error when present:

```tsx
{error ? <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4 font-bold text-destructive">{error}</div> : null}
```

- [ ] **Step 2: Run build with expected admin errors remaining**

Run:

```bash
npm run build
```

Expected: FAIL only in `src/app/admin/page.tsx` because admin still expects the old hook shape.

---

### Task 8: Add Admin Auth Actions And Update Admin Page

**Files:**
- Create: `src/lib/admin-auth-actions.ts`
- Modify: `src/app/admin/page.tsx`
- Modify: `src/lib/use-reservations.ts`

- [ ] **Step 1: Create admin auth actions**

Create `src/lib/admin-auth-actions.ts`:

```ts
"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type AuthActionResult = { ok: true } | { ok: false; error: string };

export async function getAdminSession() {
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
}

export async function loginAdmin(email: string, password: string): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { ok: false, error: "관리자 로그인 정보를 확인해 주세요." };

  revalidatePath("/admin");
  return { ok: true };
}

export async function logoutAdmin(): Promise<AuthActionResult> {
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signOut();

  if (error) return { ok: false, error: "로그아웃하지 못했습니다." };

  revalidatePath("/admin");
  return { ok: true };
}
```

- [ ] **Step 2: Add real admin mutation methods to hook**

In `src/lib/use-reservations.ts`, import admin actions:

```ts
import {
  createPublicReservation,
  deleteAdminReservation,
  listAdminReservations,
  listPublicReservationTimeBlocks,
  updateAdminReservationStatus,
  type ReservationActionResult,
} from "@/lib/reservation-actions";
```

Replace `updateReservationStatus` and `removeReservation` in the returned object:

```ts
async updateReservationStatus(id: string, status: ReservationStatus) {
  const result = await updateAdminReservationStatus(id, status);
  if (result.ok) await refresh();
  return result;
},
async removeReservation(id: string) {
  const result = await deleteAdminReservation(id);
  if (result.ok) await refresh();
  return result;
},
```

- [ ] **Step 3: Update admin page for login and async mutations**

In `src/app/admin/page.tsx`, import auth actions:

```ts
import { loginAdmin, logoutAdmin } from "@/lib/admin-auth-actions";
```

Add login state:

```ts
const [email, setEmail] = useState("");
const [password, setPassword] = useState("");
const [isLoggedIn, setIsLoggedIn] = useState(false);
```

Change the hook call:

```ts
const { reservations, updateReservationStatus, removeReservation, isReady, error } = useReservations({
  date,
  admin: isLoggedIn,
  roomId,
  status,
});
```

Add login handlers:

```ts
async function submitLogin() {
  const result = await loginAdmin(email, password);
  if (!result.ok) {
    toast.error(result.error);
    return;
  }

  setIsLoggedIn(true);
  toast.success("로그인했습니다.");
}

async function submitLogout() {
  const result = await logoutAdmin();
  if (!result.ok) {
    toast.error(result.error);
    return;
  }

  setIsLoggedIn(false);
  toast.success("로그아웃했습니다.");
}
```

Make `changeStatus` and `deleteReservation` async:

```ts
async function changeStatus(id: string, nextStatus: ReservationStatus) {
  const result = await updateReservationStatus(id, nextStatus);
  if (!result.ok) {
    toast.error(result.error);
    return;
  }

  toast.success(`예약 상태를 ${STATUS_LABELS[nextStatus]}로 변경했습니다.`);
}

async function deleteReservation(id: string) {
  const result = await removeReservation(id);
  if (!result.ok) {
    toast.error(result.error);
    return;
  }

  toast.success("예약을 삭제했습니다.");
}
```

Before filters, render the login form when not logged in:

```tsx
{!isLoggedIn ? (
  <Card className="mt-6 border bg-card shadow-sm">
    <CardHeader>
      <CardTitle>관리자 로그인</CardTitle>
    </CardHeader>
    <CardContent className="grid gap-4">
      <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="이메일" type="email" />
      <Input value={password} onChange={(event) => setPassword(event.target.value)} placeholder="비밀번호" type="password" />
      <Button onClick={submitLogin} type="button">로그인</Button>
    </CardContent>
  </Card>
) : (
  <Button onClick={submitLogout} type="button" variant="outline">로그아웃</Button>
)}
```

Render load errors above the table:

```tsx
{error ? <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 p-4 font-bold text-destructive">{error}</div> : null}
```

- [ ] **Step 4: Run build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 5: Commit Tasks 6-8**

```bash
git add src/lib/use-reservations.ts src/app/page.tsx src/app/admin/page.tsx src/lib/admin-auth-actions.ts
git commit -m "feat: Supabase 예약 흐름 연결"
```

---

### Task 9: Verification

**Files:**
- No code changes expected.

- [ ] **Step 1: Run unit tests**

Run:

```bash
npm run test
```

Expected: PASS for reservation rules and Supabase mapper tests.

- [ ] **Step 2: Run production build**

Run:

```bash
npm run build
```

Expected: PASS.

- [ ] **Step 3: Start local dev server**

Run:

```bash
npm run dev
```

Expected: Next.js serves the app locally. If `.env.local` is not configured, the app may show Supabase configuration errors at runtime; that is acceptable until real project credentials are supplied.

- [ ] **Step 4: Manual checks with Supabase credentials**

With a real `.env.local` and migrated Supabase database:

```text
1. Open / and create a reservation.
2. Open / in another browser session and confirm the time is unavailable.
3. Open /admin and log in with a Supabase Auth email/password user.
4. Filter by date, room, and status.
5. Confirm a pending reservation.
6. Cancel a reservation and verify the time becomes available on /.
7. Delete a test reservation.
8. Log out.
```

- [ ] **Step 5: Commit any verification fixes**

```bash
git add .
git commit -m "fix: Supabase 예약 검증 반영"
```

