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

delete from public.reservations;

insert into public.reservations
  (id, date, room_id, start_minutes, end_minutes, name, password_hash, status)
values
  ('31000000-0000-0000-0000-000000000001', '2026-07-03', 'room-1', 1140, 1200, ' 홍길동 ', 'hash-1', 'pending'),
  ('31000000-0000-0000-0000-000000000002', '2026-07-06', 'room-2', 1140, 1200, '홍길동', 'hash-2', 'pending'),
  ('31000000-0000-0000-0000-000000000003', '2026-07-13', 'room-1', 1140, 1200, '김연습', 'hash-3', 'pending'),
  ('31000000-0000-0000-0000-000000000004', '2026-07-13', 'room-2', 1200, 1260, '김연습', 'hash-4', 'cancelled');

set local role authenticated;

do $$
declare
  v_result jsonb;
  v_week_result jsonb;
  v_current_result jsonb;
  v_today date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
begin
  select public.get_admin_reservation_statistics('2026-07-01', 'day') into v_result;

  begin
    perform public.get_admin_reservation_statistics('2026-07-01', null);
    raise exception 'NULL p_unit must be rejected';
  exception
    when sqlstate '22023' then null;
  end;

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

  if v_result #>> '{trend,0,status}' <> 'noData'
    or jsonb_typeof(v_result #> '{trend,0,usageMinutes}') <> 'null' then
    raise exception 'buckets before coverage must be noData with null values';
  end if;

  if v_result #>> '{trend,2,status}' <> 'complete' then
    raise exception 'the first covered day must be complete';
  end if;

  select public.get_admin_reservation_statistics('2026-07-01', 'week') into v_week_result;
  if v_week_result #>> '{trend,0,endDate}' <> '2026-07-06' then
    raise exception 'weekly endDate must stay exclusive';
  end if;
  if v_week_result #>> '{trend,0,status}' <> 'partial'
    or (v_week_result #>> '{trend,0,usageMinutes}')::integer <> 60 then
    raise exception 'coverage starting inside a bucket must retain values as partial';
  end if;

  select public.get_admin_reservation_statistics(date_trunc('month', v_today)::date, 'day')
    into v_current_result;
  if v_current_result #>> array['trend', (jsonb_array_length(v_current_result -> 'trend') - 1)::text, 'status'] <> 'partial' then
    raise exception 'the in-progress current day must be partial';
  end if;

end;
$$;

reset role;
delete from public.reservations;
set local role authenticated;

do $$
declare
  v_no_data_result jsonb;
begin
  select public.get_admin_reservation_statistics('2026-07-01', 'day')
    into v_no_data_result;
  if (v_no_data_result ->> 'coverageStart') is not null
    or exists (
      select 1
      from jsonb_array_elements(v_no_data_result -> 'trend') item
      where item ->> 'status' <> 'noData'
        or jsonb_typeof(item -> 'usageMinutes') <> 'null'
        or jsonb_typeof(item -> 'reservationCount') <> 'null'
        or jsonb_typeof(item -> 'userCount') <> 'null'
    ) then
    raise exception 'null coverage must make every trend bucket noData';
  end if;
end;
$$;

rollback;
