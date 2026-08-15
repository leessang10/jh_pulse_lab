begin;

do $$
begin
  if to_regclass('public.reservations_date_idx') is null then
    raise exception 'reservations_date_idx must exist';
  end if;

  if has_function_privilege(
    'anon',
    'public.get_admin_reservation_statistics(date,text)',
    'EXECUTE'
  ) then
    raise exception 'anon must not execute statistics RPC';
  end if;
end;
$$;

delete from public.reservations
where date between date '2026-07-01' and date '2026-07-31';

insert into public.reservations
  (id, date, room_id, start_minutes, end_minutes, name, password_hash, status)
values
  ('31000000-0000-0000-0000-000000000001', '2026-07-06', 'room-1', 1140, 1200, ' 홍길동 ', 'hash-1', 'pending'),
  ('31000000-0000-0000-0000-000000000002', '2026-07-06', 'room-2', 1140, 1200, '홍길동', 'hash-2', 'pending'),
  ('31000000-0000-0000-0000-000000000003', '2026-07-13', 'room-1', 1140, 1200, '김연습', 'hash-3', 'pending'),
  ('31000000-0000-0000-0000-000000000004', '2026-07-13', 'room-2', 1200, 1260, '김연습', 'hash-4', 'cancelled');

set local role authenticated;

do $$
declare
  v_result jsonb;
begin
  select public.get_admin_reservation_statistics('2026-07-01', 'day') into v_result;

  if (v_result #>> '{summary,current,usageMinutes}')::integer <> 180 then
    raise exception 'expected 180 active minutes';
  end if;
  if (v_result #>> '{summary,current,reservationCount}')::integer <> 4 then
    raise exception 'expected four total reservations';
  end if;
  if (v_result #>> '{summary,current,userCount}')::integer <> 2 then
    raise exception 'expected two normalized users';
  end if;
  if (v_result #>> '{summary,current,cancelledCount}')::integer <> 1 then
    raise exception 'expected one cancelled reservation';
  end if;
  if jsonb_array_length(v_result -> 'ranking') <> 2 then
    raise exception 'expected two ranking rows';
  end if;
  if jsonb_array_length(v_result -> 'peakTimes') <> 7 then
    raise exception 'expected seven weekday rows';
  end if;
end;
$$;

rollback;
