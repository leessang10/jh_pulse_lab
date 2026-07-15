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
    select 1
    from public.maintenance_blocks existing
    where existing.id <> new.id
      and existing.date = new.date
      and existing.room_id = new.room_id
      and new.start_minutes < existing.end_minutes
      and existing.start_minutes < new.end_minutes
  ) then
    raise exception 'maintenance block conflicts with existing maintenance' using errcode = '23P01';
  end if;

  if exists (
    select 1
    from public.reservations existing
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
for each row
execute function public.prevent_maintenance_block_overlap();

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

revoke all on table public.maintenance_blocks from anon, authenticated;
grant select, insert, delete on table public.maintenance_blocks to authenticated;
grant select, update on table public.reservations to authenticated;

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
    select 1
    from public.maintenance_blocks existing
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
