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
