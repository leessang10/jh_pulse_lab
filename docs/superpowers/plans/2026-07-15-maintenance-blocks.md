# 관리자 점검 시간 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 Supabase에 연습실별 점검 시간을 등록하면 겹친 예약을 원자적으로 취소하고 모든 공개 예약 화면에서 해당 구간을 `점검`으로 표시한다.

**Architecture:** Supabase의 별도 `maintenance_blocks` 테이블과 관리자 전용 RPC가 점검 등록·자동 취소를 한 트랜잭션으로 처리한다. 애플리케이션은 일반 예약과 점검을 `ScheduleBlock` 합성 타입으로 조회하고, 공통 충돌 검증과 각 시간표가 이 타입을 소비한다. 일반 예약 목록과 예약자 조회는 계속 `reservations`만 사용한다.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Supabase Postgres/RLS/RPC, `@supabase/ssr`, `@supabase/supabase-js`, shadcn/Base UI

## Global Constraints

- 점검은 한 번에 연습실 하나에만 적용한다.
- 시작과 종료는 30분 단위이며 `00:00~24:00` 안에서 길이 상한이 없다.
- 종료된 점검 범위는 만들 수 없지만 오늘 진행 중인 범위는 만들 수 있다.
- 겹친 일반 예약은 자동 취소하고 점검 삭제 후에도 복구하지 않는다.
- 공개 화면의 고정 문구는 `점검`이다.
- 점검 수정, 반복 점검, 여러 연습실 동시 점검, 알림 발송은 만들지 않는다.
- Supabase `authenticated` 사용자는 현행 앱의 관리자 계정으로만 운영한다.
- `maintenance_blocks`는 RLS를 활성화하고 `anon`의 테이블 변경과 RPC 실행을 막는다.
- 일반 예약 생성·변경은 클라이언트, 서버 액션, DB 세 단계에서 점검 충돌을 막는다.
- 사용자가 만든 `.DS_Store` 파일은 스테이징하거나 수정하지 않는다.

---

## File Map

새 파일:

- `src/lib/maintenance-blocks.ts`: 점검·일정 블록 타입, 점검 입력 검증, 공통 표시 도우미
- `src/lib/maintenance-blocks.test.ts`: 점검 입력과 일정 블록 단위 테스트
- `src/lib/supabase/maintenance-mappers.ts`: Supabase 점검 행과 앱 타입 변환
- `src/lib/supabase/maintenance-mappers.test.ts`: 점검 행 매퍼 테스트
- `src/lib/maintenance-actions.ts`: 관리자 점검 조회·등록·삭제 서버 액션
- `src/lib/use-maintenance-blocks.ts`: 관리자 시간표의 점검 상태와 변경 훅
- `src/lib/maintenance-actions.test.ts`: 서버 액션의 조기 검증 테스트
- `supabase/tests/maintenance_blocks.sql`: 트랜잭션 롤백형 DB 동작 검증 SQL
- `supabase/migrations/*_add_maintenance_blocks.sql`: 반드시 `supabase migration new add_maintenance_blocks`가 출력한 경로를 사용

수정 파일:

- `src/lib/supabase/reservation-mappers.ts`: 일반 예약을 `reservation` 일정 블록으로 변환
- `src/lib/supabase/reservation-mappers.test.ts`: 일정 블록 매핑 검증
- `src/lib/reservation-actions.ts`: 공개 합성 일정 조회와 점검 충돌 오류 매핑
- `src/lib/reservation-action-errors.ts`: DB 점검 충돌 메시지 변환
- `src/lib/reservation-action-errors.test.ts`: 점검 충돌 오류 테스트
- `src/lib/use-reservations.ts`: 공개 조회 결과 타입을 `ScheduleBlock[]`로 변경
- `src/lib/booking-availability.ts`: 일반 예약과 점검을 함께 점유 구간으로 처리
- `src/lib/booking-availability.test.ts`: 점검 충돌과 전용 메시지 테스트
- `src/lib/v2-reservation-board.ts`: V2 점검 타일과 예약 불가 계산
- `src/lib/v2-reservation-board.test.ts`: V2 `점검` 타일 테스트
- `src/lib/v2-reservation-actions.ts`: 공개 합성 일정으로 서버 검증
- `src/app/v2/v2-reservation-board.tsx`: V2 점검 타일 표시와 클릭 차단
- `src/lib/landing-schedule.ts`: 메인 원형 시간표의 점검 세그먼트 생성
- `src/lib/landing-schedule.test.ts`: 점검 이름·구간 표시 테스트
- `src/app/page.tsx`: 일반 예약과 점검 세그먼트의 공통 렌더링
- `src/app/reservation/page.tsx`: 합성 일정으로 신규 예약 가능 시간 계산
- `src/app/reservations/page.tsx`: 합성 일정으로 예약 변경 가능 시간 계산
- `src/lib/admin-timetable.ts`: 예약·취소·점검 타일 구분
- `src/lib/admin-timetable.test.ts`: 점검 타일 생성 테스트
- `src/app/admin/timetables/page.tsx`: 점검 등록·삭제 UI

---

### Task 1: 점검과 합성 일정 도메인 만들기

**Files:**
- Create: `src/lib/maintenance-blocks.ts`
- Create: `src/lib/maintenance-blocks.test.ts`
- Modify: `src/lib/supabase/reservation-mappers.ts`
- Test: `src/lib/supabase/reservation-mappers.test.ts`

**Interfaces:**
- Produces: `MaintenanceBlock`, `MaintenanceBlockDraft`, `ScheduleBlock`, `MaintenanceValidationCurrentTime`
- Produces: `validateMaintenanceBlockDraft(draft, currentTime): string[]`
- Produces: `toReservationScheduleBlock(reservation): ScheduleBlock`
- Produces: `getScheduleBlockLabel(block): string`
- Produces: `isScheduleBlockActive(block): boolean`
- Produces: `mapReservationRowToScheduleBlock(row): ScheduleBlock`

- [ ] **Step 1: 실패하는 점검 도메인 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import {
  getScheduleBlockLabel,
  validateMaintenanceBlockDraft,
  type MaintenanceBlock,
} from "./maintenance-blocks";

const maintenance: MaintenanceBlock = {
  id: "maintenance-1",
  date: "2026-07-15",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 780,
  createdBy: "00000000-0000-0000-0000-000000000001",
  createdAt: "2026-07-15T00:00:00.000Z",
};

describe("maintenance blocks", () => {
  it("accepts a multi-hour maintenance range on the 30-minute grid", () => {
    expect(
      validateMaintenanceBlockDraft(
        { date: "2026-07-15", roomId: "room-1", startMinutes: 600, endMinutes: 900 },
        { date: "2026-07-15", minutes: 590 },
      ),
    ).toEqual([]);
  });

  it("rejects invalid rooms, off-grid ranges, and already-ended ranges", () => {
    expect(
      validateMaintenanceBlockDraft(
        { date: "2026-07-15", roomId: "room-9", startMinutes: 605, endMinutes: 600 },
        { date: "2026-07-15", minutes: 700 },
      ),
    ).toEqual([
      "연습실을 선택해 주세요.",
      "시작 시간과 종료 시간은 30분 단위여야 합니다.",
      "종료 시간은 시작 시간보다 늦어야 합니다.",
      "이미 종료된 시간에는 점검을 등록할 수 없습니다.",
    ]);
  });

  it("allows an in-progress range and always labels it as maintenance", () => {
    expect(
      validateMaintenanceBlockDraft(
        { date: "2026-07-15", roomId: "room-1", startMinutes: 600, endMinutes: 780 },
        { date: "2026-07-15", minutes: 700 },
      ),
    ).toEqual([]);
    expect(getScheduleBlockLabel({ kind: "maintenance", ...maintenance })).toBe("점검");
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/maintenance-blocks.test.ts`

Expected: FAIL with `Cannot find module './maintenance-blocks'`.

- [ ] **Step 3: 점검 타입과 검증 최소 구현**

```ts
import {
  ACTIVE_ROOM_IDS,
  DAY_END_MINUTES,
  SLOT_MINUTES,
  type ReservationTimeBlock,
} from "./reservations";

export type MaintenanceBlock = {
  id: string;
  date: string;
  roomId: string;
  startMinutes: number;
  endMinutes: number;
  createdBy: string;
  createdAt: string;
};

export type MaintenanceBlockDraft = Pick<
  MaintenanceBlock,
  "date" | "roomId" | "startMinutes" | "endMinutes"
>;

export type ReservationScheduleBlock = ReservationTimeBlock & { kind: "reservation" };
export type MaintenanceScheduleBlock = MaintenanceBlock & { kind: "maintenance" };
export type ScheduleBlock = ReservationScheduleBlock | MaintenanceScheduleBlock;
export type MaintenanceValidationCurrentTime = { date: string; minutes: number };

export const MAINTENANCE_ENDED_MESSAGE = "이미 종료된 시간에는 점검을 등록할 수 없습니다.";

export function validateMaintenanceBlockDraft(
  draft: MaintenanceBlockDraft,
  currentTime: MaintenanceValidationCurrentTime,
) {
  const errors: string[] = [];
  if (!draft.date) errors.push("날짜를 선택해 주세요.");
  if (!ACTIVE_ROOM_IDS.includes(draft.roomId)) errors.push("연습실을 선택해 주세요.");
  if (draft.startMinutes % SLOT_MINUTES !== 0 || draft.endMinutes % SLOT_MINUTES !== 0) {
    errors.push("시작 시간과 종료 시간은 30분 단위여야 합니다.");
  }
  if (draft.startMinutes < 0 || draft.endMinutes > DAY_END_MINUTES) {
    errors.push("점검 시간은 00:00부터 24:00 사이여야 합니다.");
  }
  if (draft.endMinutes <= draft.startMinutes) errors.push("종료 시간은 시작 시간보다 늦어야 합니다.");
  if (draft.date < currentTime.date || (draft.date === currentTime.date && draft.endMinutes <= currentTime.minutes)) {
    errors.push(MAINTENANCE_ENDED_MESSAGE);
  }
  return errors;
}

export function toReservationScheduleBlock(reservation: ReservationTimeBlock): ReservationScheduleBlock {
  return { kind: "reservation", ...reservation };
}

export function getScheduleBlockLabel(block: ScheduleBlock) {
  return block.kind === "maintenance" ? "점검" : block.name.trim() || "예약자";
}

export function isScheduleBlockActive(block: ScheduleBlock) {
  return block.kind === "maintenance" || block.status !== "cancelled";
}
```

`mapReservationRowToScheduleBlock`은 기존 `mapReservationRowToTimeBlock(row)` 결과를 `toReservationScheduleBlock`에 전달한다.

- [ ] **Step 4: 점검·예약 매퍼 테스트 통과 확인**

Run: `npm test -- src/lib/maintenance-blocks.test.ts src/lib/supabase/reservation-mappers.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/maintenance-blocks.ts src/lib/maintenance-blocks.test.ts src/lib/supabase/reservation-mappers.ts src/lib/supabase/reservation-mappers.test.ts
git commit -m "feat: 점검 일정 도메인 추가"
```

---

### Task 2: Supabase 테이블, RLS, RPC, DB 충돌 방지 추가

**Files:**
- Create via CLI: `supabase/migrations/*_add_maintenance_blocks.sql`
- Create: `supabase/tests/maintenance_blocks.sql`
- Modify generated migration only after `npx supabase migration new add_maintenance_blocks` prints its exact path

**Interfaces:**
- Produces table: `public.maintenance_blocks`
- Produces RPC: `public.create_maintenance_block(p_date date, p_room_id text, p_start_minutes integer, p_end_minutes integer)`
- Produces RPC row: `{ maintenance_id uuid, cancelled_count bigint }`
- Extends trigger: `public.prevent_active_reservation_overlap()`
- Produces trigger: `public.prevent_maintenance_block_overlap()`

- [ ] **Step 1: 공식 변경 사항과 문서 확인**

Run:

```bash
curl -fsSL https://supabase.com/changelog.md | rg -n "breaking-change|RLS|RPC|function|migration"
curl -fsSL https://supabase.com/docs/guides/database/postgres/row-level-security.md | rg -n "authenticated|policy|auth.uid"
```

Expected: 관련 breaking change가 없거나, 있으면 이 Task의 SQL과 권한 설계에 반영된 상태.

- [ ] **Step 2: CLI로 마이그레이션 파일 생성**

Run: `npx supabase migration new add_maintenance_blocks`

Expected: `supabase/migrations/` 아래에 현재 시각 접두사의 `add_maintenance_blocks.sql` 경로가 출력됨. 그 출력 경로만 이후 단계에서 사용한다.

- [ ] **Step 3: 마이그레이션 SQL 작성**

생성된 파일에 아래 SQL을 넣는다.

```sql
create table public.maintenance_blocks (
  id uuid primary key default gen_random_uuid(),
  date date not null,
  room_id text not null,
  start_minutes integer not null,
  end_minutes integer not null,
  created_by uuid not null default auth.uid(),
  created_at timestamptz not null default now(),
  constraint maintenance_blocks_room_check check (room_id in ('room-1', 'room-2', 'room-3')),
  constraint maintenance_blocks_time_check check (
    start_minutes >= 0
    and end_minutes <= 1440
    and end_minutes > start_minutes
    and start_minutes % 30 = 0
    and end_minutes % 30 = 0
  )
);

create index maintenance_blocks_date_room_time_idx
on public.maintenance_blocks (date, room_id, start_minutes, end_minutes);

create or replace function public.prevent_maintenance_block_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
declare
  v_korea_now timestamp := clock_timestamp() at time zone 'Asia/Seoul';
  v_current_minutes integer;
begin
  v_current_minutes := extract(hour from v_korea_now)::integer * 60
    + extract(minute from v_korea_now)::integer;

  perform pg_advisory_xact_lock(hashtextextended(new.date::text || ':' || new.room_id, 0));

  if new.date < v_korea_now::date
    or (new.date = v_korea_now::date and new.end_minutes <= v_current_minutes) then
    raise exception 'maintenance block has already ended' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.maintenance_blocks existing
    where existing.id <> new.id
      and existing.date = new.date
      and existing.room_id = new.room_id
      and new.start_minutes < existing.end_minutes
      and existing.start_minutes < new.end_minutes
  ) then
    raise exception 'maintenance block conflicts with existing maintenance' using errcode = '23P01';
  end if;

  if exists (
    select 1 from public.reservations existing
    where existing.date = new.date
      and existing.room_id = new.room_id
      and existing.status <> 'cancelled'
      and new.start_minutes < existing.end_minutes
      and existing.start_minutes < new.end_minutes
  ) then
    raise exception 'maintenance block conflicts with active reservation' using errcode = '23P01';
  end if;

  return new;
end;
$$;

create trigger maintenance_blocks_prevent_overlap
before insert or update on public.maintenance_blocks
for each row execute function public.prevent_maintenance_block_overlap();

alter table public.maintenance_blocks enable row level security;

create policy "authenticated admins can read maintenance blocks"
on public.maintenance_blocks for select
to authenticated
using ((select auth.uid()) is not null);

create policy "authenticated admins can insert maintenance blocks"
on public.maintenance_blocks for insert
to authenticated
with check (created_by = (select auth.uid()));

create policy "authenticated admins can delete maintenance blocks"
on public.maintenance_blocks for delete
to authenticated
using ((select auth.uid()) is not null);

grant select, insert, delete on public.maintenance_blocks to authenticated;
revoke all on public.maintenance_blocks from anon;

create or replace function public.prevent_active_reservation_overlap()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  if new.status = 'cancelled' then
    return new;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.date::text || ':' || new.room_id, 0));

  if exists (
    select 1
    from public.maintenance_blocks maintenance
    where maintenance.date = new.date
      and maintenance.room_id = new.room_id
      and new.start_minutes < maintenance.end_minutes
      and maintenance.start_minutes < new.end_minutes
  ) then
    raise exception 'reservation time conflicts with maintenance block' using errcode = '23P01';
  end if;

  if exists (
    select 1
    from public.reservations existing
    where existing.id <> new.id
      and existing.date = new.date
      and existing.room_id = new.room_id
      and existing.status <> 'cancelled'
      and new.start_minutes < existing.end_minutes
      and existing.start_minutes < new.end_minutes
  ) then
    raise exception 'reservation time conflicts with an existing reservation' using errcode = '23P01';
  end if;

  return new;
end;
$$;

create or replace function public.create_maintenance_block(
  p_date date,
  p_room_id text,
  p_start_minutes integer,
  p_end_minutes integer
)
returns table (maintenance_id uuid, cancelled_count bigint)
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_id uuid;
  v_cancelled_count bigint;
  v_korea_now timestamp := clock_timestamp() at time zone 'Asia/Seoul';
  v_current_minutes integer;
begin
  if auth.uid() is null then
    raise exception 'administrator authentication required' using errcode = '42501';
  end if;

  v_current_minutes := extract(hour from v_korea_now)::integer * 60
    + extract(minute from v_korea_now)::integer;

  if p_room_id not in ('room-1', 'room-2', 'room-3')
    or p_start_minutes < 0
    or p_end_minutes > 1440
    or p_end_minutes <= p_start_minutes
    or p_start_minutes % 30 <> 0
    or p_end_minutes % 30 <> 0 then
    raise exception 'invalid maintenance block' using errcode = '22023';
  end if;

  if p_date < v_korea_now::date
    or (p_date = v_korea_now::date and p_end_minutes <= v_current_minutes) then
    raise exception 'maintenance block has already ended' using errcode = '22023';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_date::text || ':' || p_room_id, 0));

  if exists (
    select 1 from public.maintenance_blocks existing
    where existing.date = p_date
      and existing.room_id = p_room_id
      and p_start_minutes < existing.end_minutes
      and existing.start_minutes < p_end_minutes
  ) then
    raise exception 'maintenance block conflicts with existing maintenance' using errcode = '23P01';
  end if;

  update public.reservations
  set status = 'cancelled'
  where date = p_date
    and room_id = p_room_id
    and status <> 'cancelled'
    and p_start_minutes < end_minutes
    and start_minutes < p_end_minutes;

  get diagnostics v_cancelled_count = row_count;

  insert into public.maintenance_blocks (date, room_id, start_minutes, end_minutes, created_by)
  values (p_date, p_room_id, p_start_minutes, p_end_minutes, auth.uid())
  returning id into v_id;

  return query select v_id, v_cancelled_count;
end;
$$;

revoke execute on function public.create_maintenance_block(date, text, integer, integer) from public, anon;
grant execute on function public.create_maintenance_block(date, text, integer, integer) to authenticated;
```

- [ ] **Step 4: 롤백형 DB 검증 SQL 작성**

`supabase/tests/maintenance_blocks.sql`에 아래 SQL을 작성한다. 테스트 날짜는 한국 날짜 기준 내일이라 실행 시점에 의존하지 않는다.

```sql
begin;

do $$
begin
  if has_function_privilege(
    'anon',
    'public.create_maintenance_block(date,text,integer,integer)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute create_maintenance_block';
  end if;
end;
$$;

insert into public.reservations (
  id, date, room_id, start_minutes, end_minutes, name, password_hash, status
)
values
  (
    '10000000-0000-0000-0000-000000000001',
    (clock_timestamp() at time zone 'Asia/Seoul')::date + 1,
    'room-1', 600, 660, '겹침 예약', 'test-hash-1', 'pending'
  ),
  (
    '10000000-0000-0000-0000-000000000002',
    (clock_timestamp() at time zone 'Asia/Seoul')::date + 1,
    'room-1', 900, 960, '비겹침 예약', 'test-hash-2', 'pending'
  ),
  (
    '10000000-0000-0000-0000-000000000003',
    (clock_timestamp() at time zone 'Asia/Seoul')::date + 1,
    'room-1', 720, 780, '롤백 확인 예약', 'test-hash-3', 'pending'
  );

create or replace function pg_temp.fail_test_reservation_cancel()
returns trigger
language plpgsql
as $$
begin
  if old.id = '10000000-0000-0000-0000-000000000003' then
    raise exception 'forced cancellation failure';
  end if;
  return new;
end;
$$;

create trigger reservations_force_test_cancel_failure
before update on public.reservations
for each row execute function pg_temp.fail_test_reservation_cancel();

select set_config('request.jwt.claim.sub', '20000000-0000-0000-0000-000000000001', true);
set local role authenticated;

do $$
declare
  v_maintenance_id uuid;
  v_cancelled_count bigint;
begin
  select maintenance_id, cancelled_count
  into v_maintenance_id, v_cancelled_count
  from public.create_maintenance_block(
    (clock_timestamp() at time zone 'Asia/Seoul')::date + 1,
    'room-1',
    600,
    690
  );

  if v_cancelled_count <> 1 then
    raise exception 'expected one cancellation, got %', v_cancelled_count;
  end if;

  if not exists (
    select 1 from public.maintenance_blocks
    where id = v_maintenance_id and start_minutes = 600 and end_minutes = 690
  ) then
    raise exception 'maintenance block was not created';
  end if;

  if (select status from public.reservations where id = '10000000-0000-0000-0000-000000000001') <> 'cancelled' then
    raise exception 'overlapping reservation was not cancelled';
  end if;

  if (select status from public.reservations where id = '10000000-0000-0000-0000-000000000002') <> 'pending' then
    raise exception 'non-overlapping reservation changed unexpectedly';
  end if;

  begin
    perform public.create_maintenance_block(
      (clock_timestamp() at time zone 'Asia/Seoul')::date + 1,
      'room-1',
      630,
      720
    );
    raise exception 'overlapping maintenance should fail';
  exception
    when exclusion_violation then null;
  end;

  begin
    perform public.create_maintenance_block(
      (clock_timestamp() at time zone 'Asia/Seoul')::date + 1,
      'room-1',
      720,
      780
    );
    raise exception 'forced rollback test should fail';
  exception
    when raise_exception then
      if sqlerrm <> 'forced cancellation failure' then
        raise;
      end if;
  end;

  if exists (
    select 1 from public.maintenance_blocks
    where date = (clock_timestamp() at time zone 'Asia/Seoul')::date + 1
      and room_id = 'room-1'
      and start_minutes = 720
      and end_minutes = 780
  ) then
    raise exception 'failed RPC left a maintenance block';
  end if;

  delete from public.maintenance_blocks where id = v_maintenance_id;

  if (select status from public.reservations where id = '10000000-0000-0000-0000-000000000001') <> 'cancelled' then
    raise exception 'deleted maintenance restored a cancelled reservation';
  end if;
end;
$$;

rollback;
```

- [ ] **Step 5: 로컬 또는 연결 DB에서 SQL 실패/성공 확인**

Run:

```bash
npx supabase db query --local --file supabase/migrations/*_add_maintenance_blocks.sql
npx supabase db query --local --file supabase/tests/maintenance_blocks.sql
```

Expected: 두 명령 exit 0, 테스트 데이터는 rollback되어 남지 않음. 로컬 DB가 준비되지 않았으면 `npx supabase start` 후 같은 명령을 다시 실행한다.

- [ ] **Step 6: 커밋**

```bash
git add supabase/migrations/*_add_maintenance_blocks.sql supabase/tests/maintenance_blocks.sql
git commit -m "feat: 점검 시간 Supabase 스키마 추가"
```

---

### Task 3: Supabase 매퍼와 점검 서버 액션 연결

**Files:**
- Create: `src/lib/supabase/maintenance-mappers.ts`
- Create: `src/lib/supabase/maintenance-mappers.test.ts`
- Create: `src/lib/maintenance-actions.ts`
- Create: `src/lib/maintenance-actions.test.ts`
- Create: `src/lib/use-maintenance-blocks.ts`
- Modify: `src/lib/reservation-actions.ts`
- Modify: `src/lib/use-reservations.ts`

**Interfaces:**
- Produces: `mapMaintenanceRow(row): MaintenanceBlock`
- Produces: `listPublicScheduleBlocks(date): ReservationActionResult<ScheduleBlock[]>`
- Produces: `listAdminMaintenanceBlocks(date): MaintenanceActionResult<MaintenanceBlock[]>`
- Produces: `createAdminMaintenanceBlock(draft): MaintenanceActionResult<{ block: MaintenanceBlock; cancelledCount: number }>`
- Produces: `deleteAdminMaintenanceBlock(id): MaintenanceActionResult<null>`
- Produces hook: `useMaintenanceBlocks(date)`

- [ ] **Step 1: 실패하는 매퍼·액션 조기 검증 테스트 작성**

```ts
expect(
  mapMaintenanceRow({
    id: "maintenance-1",
    date: "2026-07-15",
    room_id: "room-2",
    start_minutes: 600,
    end_minutes: 780,
    created_by: "admin-1",
    created_at: "2026-07-15T00:00:00.000Z",
  }),
).toEqual({
  id: "maintenance-1",
  date: "2026-07-15",
  roomId: "room-2",
  startMinutes: 600,
  endMinutes: 780,
  createdBy: "admin-1",
  createdAt: "2026-07-15T00:00:00.000Z",
});
```

`maintenance-actions.test.ts`에서는 종료가 시작보다 빠른 draft가 Supabase 호출 전에 첫 검증 오류로 반환되는지 확인한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/supabase/maintenance-mappers.test.ts src/lib/maintenance-actions.test.ts`

Expected: FAIL because modules do not exist.

- [ ] **Step 3: 매퍼와 관리자 액션 구현**

`maintenance-actions.ts`에서 `createSupabaseServerClient()`를 사용한다. 생성 전 `getAdminSession()`과 `validateMaintenanceBlockDraft(..., getCurrentKoreaBookingTime())`를 검사한다. RPC 응답의 `maintenance_id`, `cancelled_count`로 생성 행을 다시 SELECT하고 아래 결과를 반환한다.

```ts
export type MaintenanceActionResult<T> = { ok: true; data: T } | { ok: false; error: string };

export type CreateMaintenanceBlockResult = {
  block: MaintenanceBlock;
  cancelledCount: number;
};
```

성공 후 `/`, `/reservation`, `/reservations`, `/admin/timetables`, `/admin/reservations`, `/v2`를 재검증한다. 삭제는 `maintenance_blocks.delete().eq("id", id)`만 수행하며 예약 상태를 변경하지 않는다.

- [ ] **Step 4: 공개 합성 일정 조회 구현**

`reservation-actions.ts`의 `listPublicReservationTimeBlocks`를 `listPublicScheduleBlocks`로 바꾸고 서비스 클라이언트로 두 쿼리를 병렬 실행한다.

```ts
const [reservationResult, maintenanceResult] = await Promise.all([
  supabase.from("reservations").select(RESERVATION_SELECT).eq("date", date)
    .in("room_id", ACTIVE_ROOM_IDS).neq("status", "cancelled"),
  supabase.from("maintenance_blocks").select(MAINTENANCE_SELECT).eq("date", date)
    .in("room_id", ACTIVE_ROOM_IDS),
]);

return {
  ok: true,
  data: [
    ...((reservationResult.data ?? []) as ReservationRow[]).map(mapReservationRowToScheduleBlock),
    ...((maintenanceResult.data ?? []) as MaintenanceRow[]).map((row) => ({
      kind: "maintenance" as const,
      ...mapMaintenanceRow(row),
    })),
  ].sort((a, b) => a.startMinutes - b.startMinutes || a.roomId.localeCompare(b.roomId)),
};
```

신규 예약과 시간 변경의 서버 검증도 이 합성 일정 결과를 사용한다. `use-reservations.ts`의 공개 overload와 내부 상태를 `ScheduleBlock[]`로 바꾸고 관리자 overload는 `Reservation[]`을 유지한다.

- [ ] **Step 5: 관리자 점검 훅 구현**

`useMaintenanceBlocks(date)`는 `blocks`, `isReady`, `error`, `refresh`, `createBlock`, `removeBlock`을 반환한다. 생성·삭제 성공 뒤 자체 `refresh()`를 호출한다. 관리자 시간표가 기존 `useReservations({ admin: true })`와 이 훅을 나란히 사용하도록 인터페이스를 고정한다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- src/lib/supabase/maintenance-mappers.test.ts src/lib/maintenance-actions.test.ts src/lib/supabase/reservation-mappers.test.ts`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/supabase/maintenance-mappers.ts src/lib/supabase/maintenance-mappers.test.ts src/lib/maintenance-actions.ts src/lib/maintenance-actions.test.ts src/lib/use-maintenance-blocks.ts src/lib/reservation-actions.ts src/lib/use-reservations.ts
git commit -m "feat: 점검 시간 서버 액션 연결"
```

---

### Task 4: 공통 예약 가능 시간과 V2 점검 상태 적용

**Files:**
- Modify: `src/lib/booking-availability.ts`
- Test: `src/lib/booking-availability.test.ts`
- Modify: `src/lib/v2-reservation-board.ts`
- Test: `src/lib/v2-reservation-board.test.ts`
- Modify: `src/lib/v2-reservation-actions.ts`
- Modify: `src/lib/reservation-action-errors.ts`
- Test: `src/lib/reservation-action-errors.test.ts`

**Interfaces:**
- Produces: `findScheduleConflict(blocks, draft, ignoredReservationId): ScheduleBlock | null`
- Produces constant: `MAINTENANCE_CONFLICT_MESSAGE = "점검 시간에는 예약할 수 없습니다."`
- Extends: `V2TileState` with `maintenance`
- Replaces: `V2BoardTile.reservation` with `V2BoardTile.block`

- [ ] **Step 1: 점검 충돌 실패 테스트 작성**

```ts
const maintenance = {
  kind: "maintenance" as const,
  id: "maintenance-1",
  date: "2026-07-15",
  roomId: "room-1",
  startMinutes: 600,
  endMinutes: 780,
  createdBy: "admin-1",
  createdAt: "2026-07-15T00:00:00.000Z",
};

expect(
  validateBookableDraftTime(
    [maintenance],
    { date: "2026-07-15", roomId: "room-1", startMinutes: 630, endMinutes: 690 },
  ),
).toEqual({ ok: false, error: "점검 시간에는 예약할 수 없습니다." });
```

V2 테스트는 해당 30분 타일이 `{ state: "maintenance", label: "점검" }` 의미를 갖고 30분과 60분 옵션을 모두 불가 처리하는지 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/booking-availability.test.ts src/lib/v2-reservation-board.test.ts src/lib/reservation-action-errors.test.ts`

Expected: FAIL because maintenance blocks are not accepted.

- [ ] **Step 3: 공통 충돌 함수를 합성 일정 기반으로 변경**

`findReservationConflict`를 `findScheduleConflict`로 이름 변경한다. `ignoredReservationId`는 `kind === "reservation"`인 블록에만 적용하고, 취소 상태 제외도 예약 블록에만 적용한다. `validateBookableDraftTime`과 `selectBookableRange`는 충돌 블록의 kind가 `maintenance`면 점검 전용 메시지를 반환한다.

```ts
export const MAINTENANCE_CONFLICT_MESSAGE = "점검 시간에는 예약할 수 없습니다.";

function getConflictMessage(block: ScheduleBlock, fallback: string) {
  return block.kind === "maintenance" ? MAINTENANCE_CONFLICT_MESSAGE : fallback;
}
```

- [ ] **Step 4: V2 타일을 일정 블록 기반으로 변경**

`buildV2BoardRows`, `getV2DurationOptionsForTile`, `validateV2ReservationDraft`가 `ScheduleBlock[]`을 받게 한다. 타일은 `block?: ScheduleBlock`을 보유하고 상태는 점검 블록이면 `maintenance`, 일반 예약이면 `reserved`다. 점검 타일은 예약/취소 다이얼로그를 열 수 없다.

- [ ] **Step 5: DB 충돌 오류 메시지 연결**

`toReservationActionErrorMessage`에서 오류 메시지 `reservation time conflicts with maintenance block`을 먼저 검사해 `MAINTENANCE_CONFLICT_MESSAGE`를 반환한다. 기존 일반 예약 충돌 메시지는 유지한다.

- [ ] **Step 6: 테스트 통과 확인**

Run: `npm test -- src/lib/booking-availability.test.ts src/lib/v2-reservation-board.test.ts src/lib/reservation-action-errors.test.ts`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/booking-availability.ts src/lib/booking-availability.test.ts src/lib/v2-reservation-board.ts src/lib/v2-reservation-board.test.ts src/lib/v2-reservation-actions.ts src/lib/reservation-action-errors.ts src/lib/reservation-action-errors.test.ts
git commit -m "feat: 점검 시간 예약 충돌 차단"
```

---

### Task 5: 메인·예약·예약변경·V2 공개 화면에 점검 표시

**Files:**
- Modify: `src/lib/landing-schedule.ts`
- Test: `src/lib/landing-schedule.test.ts`
- Modify: `src/app/page.tsx`
- Modify: `src/app/reservation/page.tsx`
- Modify: `src/app/reservations/page.tsx`
- Modify: `src/app/v2/v2-reservation-board.tsx`

**Interfaces:**
- Replaces: `LandingReservationSegment` with `LandingScheduleSegment`
- Produces segment: `{ blockId, kind, startMinutes, endMinutes, nameLabel, rangeLabel, color }`
- Consumes: `ScheduleBlock[]` from `useReservations` and `listPublicScheduleBlocks`

- [ ] **Step 1: 메인 시간표 점검 세그먼트 실패 테스트 작성**

```ts
expect(getLandingRoomScheduleSummaries([maintenance], "2026-07-15")[0].scheduleSegments).toContainEqual(
  expect.objectContaining({
    blockId: "maintenance-1",
    kind: "maintenance",
    nameLabel: "점검",
    rangeLabel: "10:00-13:00",
  }),
);
```

또한 점검 구간의 슬롯이 `isBooked: true`, `bookedByLabel: "점검 · 연습실 1"`인지 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/landing-schedule.test.ts`

Expected: FAIL because landing schedule still expects reservations only.

- [ ] **Step 3: 랜딩 일정 모델을 합성 타입으로 변경**

`reservationSegments`를 `scheduleSegments`로 이름 변경한다. `getScheduleBlockLabel`과 `isScheduleBlockActive`를 사용하고 점검 세그먼트의 `nameLabel`은 `점검`으로 고정한다. 예약된 총 시간 계산에는 점검 슬롯도 포함하되 화면 문구 `오늘 예약`은 `오늘 사용 불가`로 바꿔 예약과 점검을 함께 설명한다.

- [ ] **Step 4: 공개 4개 화면 연결**

- `src/app/page.tsx`: `LandingScheduleSegment`와 `scheduleSegments`를 렌더링하고 점검 레이블을 표시한다.
- `src/app/reservation/page.tsx`: 공개 hook의 `ScheduleBlock[]`을 그대로 예약 가능 시간 계산에 전달한다.
- `src/app/reservations/page.tsx`: `listPublicScheduleBlocks`로 변경 후보 시간을 조회하고 현재 수정 중인 일반 예약 ID만 무시한다.
- `src/app/v2/v2-reservation-board.tsx`: 상태 `maintenance`의 라벨을 `점검`, disabled를 `true`, 전용 색상을 `border-amber-300 bg-amber-50 text-amber-950`으로 렌더링한다. 일반 예약일 때만 취소 다이얼로그를 연다.

- [ ] **Step 5: 공개 화면 관련 테스트 통과 확인**

Run: `npm test -- src/lib/landing-schedule.test.ts src/lib/booking-availability.test.ts src/lib/v2-reservation-board.test.ts`

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/landing-schedule.ts src/lib/landing-schedule.test.ts src/app/page.tsx src/app/reservation/page.tsx src/app/reservations/page.tsx src/app/v2/v2-reservation-board.tsx
git commit -m "feat: 공개 시간표에 점검 표시"
```

---

### Task 6: 관리자 시간표 점검 등록·삭제 UI 완성

**Files:**
- Modify: `src/lib/admin-timetable.ts`
- Test: `src/lib/admin-timetable.test.ts`
- Modify: `src/app/admin/timetables/page.tsx`

**Interfaces:**
- Extends: `AdminTimetableTileState = "empty" | "reserved" | "cancelled" | "maintenance"`
- Produces tile field: `maintenance?: MaintenanceBlock`
- Consumes hook: `useMaintenanceBlocks(date)`
- Replaces V2 hours in the admin board with all-day `DAY_END_MINUTES` and `SLOT_MINUTES`

- [ ] **Step 1: 관리자 점검 타일 실패 테스트 작성**

```ts
const rows = buildAdminTimetableRows({
  date: "2026-07-15",
  reservations: [],
  maintenanceBlocks: [maintenance],
});

expect(rows.find((row) => row.startMinutes === 600)!.tiles[0]).toEqual(
  expect.objectContaining({
    state: "maintenance",
    maintenance: expect.objectContaining({ id: "maintenance-1" }),
  }),
);

expect(rows).toHaveLength(48);
expect(rows[0].timeLabel).toBe("00:00");
expect(rows[47].timeLabel).toBe("23:30");
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts`

Expected: FAIL because `maintenanceBlocks` is not accepted.

- [ ] **Step 3: 관리자 시간표 모델 확장**

관리자 시간표의 행 생성은 V2의 `10:00~22:00` 상수를 더 이상 사용하지 않고 `00:00~24:00` 전체 48개 타일을 만든다. 각 30분 타일에서 점검을 먼저 찾고, 없을 때만 기존 일반 예약을 찾는다. 점검 타일의 라벨은 전체 점검 범위 `점검 10:00-13:00`을 사용한다. 일반 예약 취소와 점검 삭제는 서로 다른 선택 상태로 분리한다.

- [ ] **Step 4: 점검 등록 다이얼로그 구현**

`/admin/timetables` 헤더에 `점검 등록` 버튼을 추가한다. 다이얼로그 상태는 `roomId`, `startMinutes`, `endMinutes`를 가지며 `generateTimeSlots()`와 종료용 `24:00` 옵션을 사용한다. 현재 `reservations`에서 겹치는 `status !== "cancelled"` 예약 수를 계산해 아래 경고를 표시한다.

```tsx
<p className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-950">
  등록 시 겹치는 예약 {overlappingCount}건이 자동 취소됩니다.
</p>
```

등록 성공 토스트는 RPC 실제 결과를 사용한다.

```ts
toast.success(`점검을 등록했습니다. 예약 ${result.data.cancelledCount}건을 취소했습니다.`);
```

- [ ] **Step 5: 점검 삭제 확인창 구현**

점검 타일 클릭 시 `점검을 삭제해도 자동 취소된 예약은 복구되지 않습니다.`를 표시한다. 삭제 성공 후 `점검을 삭제했습니다.` 토스트를 띄우고 점검·예약 데이터를 모두 새로고침한다.

- [ ] **Step 6: 관리자 시간표 테스트 통과 확인**

Run: `npm test -- src/lib/admin-timetable.test.ts src/lib/maintenance-blocks.test.ts`

Expected: PASS.

- [ ] **Step 7: 커밋**

```bash
git add src/lib/admin-timetable.ts src/lib/admin-timetable.test.ts src/app/admin/timetables/page.tsx
git commit -m "feat: 관리자 점검 시간 관리 추가"
```

---

### Task 7: 전체 검증, Supabase 적용, 실제 화면 확인

**Files:**
- Verify only: all files from Tasks 1-6

**Interfaces:**
- Consumes all prior task outputs
- Produces verified linked Supabase schema and browser evidence

- [ ] **Step 1: 전체 정적·단위 검증**

Run:

```bash
npm test
npm run build
git diff --check
```

Expected: all Vitest tests PASS, Next.js production build exit 0, no whitespace errors.

- [ ] **Step 2: 연결 Supabase 적용 전 dry-run과 migration 확인**

Run:

```bash
npx supabase migration list --linked
npx supabase db push --linked --dry-run
```

Expected: 새 `add_maintenance_blocks` 마이그레이션만 적용 대상으로 표시됨.

- [ ] **Step 3: 연결 Supabase에 마이그레이션 적용**

Run: `npx supabase db push --linked`

Expected: migration applied successfully.

- [ ] **Step 4: 실제 DB 동작과 보안 검증**

Run:

```bash
npx supabase db query --linked --file supabase/tests/maintenance_blocks.sql
npx supabase db advisors --linked --type security --level warn --fail-on error
npx supabase db advisors --linked --type performance --level warn --fail-on error
npx supabase migration list --linked
```

Expected: rollback test exit 0, advisor error 0건, local/remote migration version 일치.

- [ ] **Step 5: 로컬 앱 브라우저 검증**

Run: `npm run dev`

브라우저에서 다음 순서로 확인한다.

1. 일반 예약 하나를 미래 시간에 생성한다.
2. `/admin/timetables`에서 같은 연습실·시간을 포함하는 90분 점검을 등록한다.
3. 실제 취소 건수 토스트와 점검 타일을 확인한다.
4. `/admin/reservations`에서 기존 예약이 취소 상태인지 확인한다.
5. `/`, `/reservation`, `/reservations`, `/v2`에서 `점검` 표시와 선택 차단을 확인한다.
6. 점검을 삭제하고 기존 예약이 계속 취소 상태인지 확인한다.
7. 다른 연습실의 같은 시간은 예약 가능한지 확인한다.

- [ ] **Step 6: 최종 상태 확인과 검증 커밋**

Run:

```bash
git status --short
git log --oneline -7
```

Expected: `.DS_Store` 외 구현 변경 없음, Tasks 1-6 커밋이 순서대로 존재함. 검증 중 코드 수정이 있었다면 관련 테스트와 함께 다음 커밋을 만든다.

```bash
git add -u src supabase
git commit -m "fix: 점검 시간 통합 검증 보완"
```
