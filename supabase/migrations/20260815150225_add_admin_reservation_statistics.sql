create index if not exists reservations_date_idx
on public.reservations (date);

create or replace function public.get_admin_reservation_statistics(
  p_reference_month date,
  p_unit text
)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_today date := (clock_timestamp() at time zone 'Asia/Seoul')::date;
  v_month_start date := date_trunc('month', p_reference_month)::date;
  v_month_end date := (date_trunc('month', p_reference_month) + interval '1 month')::date;
  v_scope_end date;
  v_previous_start date := (date_trunc('month', p_reference_month) - interval '1 month')::date;
  v_previous_end date;
  v_coverage_start date;
  v_current jsonb;
  v_previous jsonb;
  v_trend jsonb;
  v_ranking jsonb;
  v_peak_times jsonb;
begin
  if p_reference_month is null
    or p_unit not in ('day', 'week', 'year')
    or v_month_start > date_trunc('month', v_today)::date then
    raise exception 'invalid statistics input' using errcode = '22023';
  end if;

  v_scope_end := case
    when v_month_start = date_trunc('month', v_today)::date then v_today + 1
    else v_month_end
  end;
  v_previous_end := least(
    v_month_start,
    v_previous_start + (v_scope_end - v_month_start)
  );

  select min(date) into v_coverage_start
  from public.reservations
  where room_id in ('room-1', 'room-2', 'room-3');

  select jsonb_build_object(
    'usageMinutes', coalesce(sum(end_minutes - start_minutes)
      filter (where status <> 'cancelled'), 0),
    'reservationCount', count(*),
    'userCount', count(distinct case when status <> 'cancelled' then
      regexp_replace(lower(btrim(name)), E'\\s+', ' ', 'g') end),
    'cancelledCount', count(*) filter (where status = 'cancelled')
  ) into v_current
  from public.reservations
  where date >= v_month_start and date < v_scope_end
    and room_id in ('room-1', 'room-2', 'room-3');

  select jsonb_build_object(
    'usageMinutes', coalesce(sum(end_minutes - start_minutes)
      filter (where status <> 'cancelled'), 0),
    'reservationCount', count(*),
    'userCount', count(distinct case when status <> 'cancelled' then
      regexp_replace(lower(btrim(name)), E'\\s+', ' ', 'g') end),
    'cancelledCount', count(*) filter (where status = 'cancelled')
  ) into v_previous
  from public.reservations
  where date >= v_previous_start and date < v_previous_end
    and room_id in ('room-1', 'room-2', 'room-3');

  with day_buckets as (
    select d::date start_date, (d + interval '1 day')::date end_date
    from generate_series(v_month_start, v_scope_end - 1, interval '1 day') d
    where p_unit = 'day'
  ), week_buckets as (
    select greatest(w::date, v_month_start) start_date,
      least((w + interval '7 days')::date, v_scope_end) end_date
    from generate_series(
      date_trunc('week', v_month_start)::date,
      v_scope_end - 1,
      interval '7 days'
    ) w
    where p_unit = 'week'
  ), year_buckets as (
    select m::date start_date,
      least((m + interval '1 month')::date, v_scope_end) end_date
    from generate_series(
      date_trunc('year', v_month_start)::date,
      v_month_start,
      interval '1 month'
    ) m
    where p_unit = 'year'
  ), buckets as (
    select * from day_buckets union all
    select * from week_buckets union all
    select * from year_buckets
  ), values_by_bucket as (
    select b.start_date, b.end_date,
      coalesce(sum(r.end_minutes - r.start_minutes)
        filter (where r.status <> 'cancelled'), 0) usage_minutes,
      count(r.id) reservation_count,
      count(distinct case when r.status <> 'cancelled' then
        regexp_replace(lower(btrim(r.name)), E'\\s+', ' ', 'g') end) user_count
    from buckets b
    left join public.reservations r
      on r.date >= b.start_date and r.date < b.end_date
      and r.room_id in ('room-1', 'room-2', 'room-3')
    group by b.start_date, b.end_date
    order by b.start_date
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'key', start_date::text,
    'startDate', start_date,
    'endDate', end_date,
    'usageMinutes', usage_minutes,
    'reservationCount', reservation_count,
    'userCount', user_count,
    'isComplete', v_coverage_start is not null and v_coverage_start <= start_date
  ) order by start_date), '[]'::jsonb) into v_trend
  from values_by_bucket;

  with weekdays as (
    select weekday,
      count(*) filter (where extract(isodow from d)::integer = weekday) occurrences
    from generate_series(1, 7) weekday
    cross join generate_series(v_month_start, v_scope_end - 1, interval '1 day') d
    group by weekday
  ), slots as (
    select w.weekday, w.occurrences, slot_start,
      count(r.id) occupied
    from weekdays w
    cross join generate_series(420, 1350, 30) slot_start
    left join public.reservations r
      on extract(isodow from r.date)::integer = w.weekday
      and r.date >= v_month_start and r.date < v_scope_end
      and r.room_id in ('room-1', 'room-2', 'room-3')
      and r.status <> 'cancelled'
      and r.start_minutes < slot_start + 30
      and r.end_minutes > slot_start
    group by w.weekday, w.occurrences, slot_start
  ), windows as (
    select s.weekday, s.slot_start start_minutes,
      sum(s2.occupied) occupied,
      case when max(s.occurrences) = 0 then 0 else
        avg(s2.occupied::numeric / (s.occurrences * 3) * 100) end occupancy_rate
    from slots s
    join slots s2 on s2.weekday = s.weekday
      and s2.slot_start between s.slot_start and s.slot_start + 90
    where s.slot_start <= 1260
    group by s.weekday, s.slot_start
  ), ranked as (
    select *, row_number() over (
      partition by weekday order by occupancy_rate desc, start_minutes
    ) rank
    from windows
  )
  select jsonb_agg(jsonb_build_object(
    'weekday', weekday,
    'startMinutes', case when occupied > 0 then start_minutes else null end,
    'endMinutes', case when occupied > 0 then start_minutes + 120 else null end,
    'occupancyRate', case when occupied > 0 then round(occupancy_rate, 1) else 0 end,
    'hasData', occupied > 0
  ) order by weekday) into v_peak_times
  from ranked where rank = 1;

  with peak_windows as (
    select (item ->> 'weekday')::integer weekday,
      (item ->> 'startMinutes')::integer start_minutes,
      (item ->> 'endMinutes')::integer end_minutes
    from jsonb_array_elements(v_peak_times) item
    where (item ->> 'hasData')::boolean
  ), normalized as (
    select min(btrim(r.name)) display_name,
      regexp_replace(lower(btrim(r.name)), E'\\s+', ' ', 'g') normalized_name,
      sum(r.end_minutes - r.start_minutes) usage_minutes,
      sum(case when p.weekday is null then 0 else greatest(
        0,
        least(r.end_minutes, p.end_minutes) - greatest(r.start_minutes, p.start_minutes)
      ) end) peak_minutes,
      count(*) reservation_count
    from public.reservations r
    left join peak_windows p
      on extract(isodow from r.date)::integer = p.weekday
    where r.date >= v_month_start and r.date < v_scope_end
      and r.room_id in ('room-1', 'room-2', 'room-3')
      and r.status <> 'cancelled'
    group by regexp_replace(lower(btrim(r.name)), E'\\s+', ' ', 'g')
  )
  select coalesce(jsonb_agg(jsonb_build_object(
    'name', display_name,
    'usageMinutes', usage_minutes,
    'peakMinutes', peak_minutes,
    'reservationCount', reservation_count
  ) order by usage_minutes desc, reservation_count desc, display_name), '[]'::jsonb)
  into v_ranking from normalized;

  return jsonb_build_object(
    'coverageStart', v_coverage_start,
    'summary', jsonb_build_object(
      'current', v_current,
      'previous', v_previous,
      'comparisonAvailable', v_coverage_start is not null
        and v_coverage_start <= v_previous_start
    ),
    'trend', v_trend,
    'ranking', v_ranking,
    'peakTimes', coalesce(v_peak_times, '[]'::jsonb)
  );
end;
$$;

revoke execute on function public.get_admin_reservation_statistics(date, text)
from public, anon;
grant execute on function public.get_admin_reservation_statistics(date, text)
to authenticated;
