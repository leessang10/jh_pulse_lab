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
