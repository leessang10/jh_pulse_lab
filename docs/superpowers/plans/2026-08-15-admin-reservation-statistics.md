# 관리자 예약 통계 페이지 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 관리자가 기준 월과 일·주·년 단위를 선택해 예약 이용량, 회원 순위, 요일별 피크 시간과 정기권 매출 시나리오를 확인하는 `/admin/statistics` 페이지를 만든다.

**Architecture:** 인증된 관리자만 실행할 수 있는 Supabase `security invoker` RPC가 날짜 범위 집계를 수행하고 작은 JSON 응답을 반환한다. Next.js 서버 액션은 입력과 RPC 응답을 Zod로 검증하며, 클라이언트 페이지는 URL 검색 파라미터와 shadcn Chart를 사용해 조회 상태를 표현한다. 정기권 시뮬레이터는 조회된 월간 집계만 사용하는 저장 없는 Dialog다.

**Tech Stack:** Next.js App Router, React, TypeScript, Vitest, Supabase Postgres/RLS/RPC, Zod, shadcn/Base UI, Recharts 3.8, Tailwind CSS

## Global Constraints

- 경로는 `/admin/statistics`, 사이드바 문구는 `예약 통계`다.
- 상단 오른쪽 순서는 `기준 월`, `일 / 주 / 년`, `정기권 시뮬레이션`이다.
- 추세 카드 안에는 일·주·년 선택을 중복 배치하지 않는다.
- KPI, 회원 순위, 피크 시간은 기준 월을 사용한다. 현재 월은 한국 시간 오늘까지 집계한다.
- `일`은 기준 월의 일별, `주`는 기준 월의 월요일~일요일 버킷, `년`은 기준 연도 1월부터 기준 월까지 월별 데이터다.
- 총 이용시간·전체 이용자·순위·피크 시간은 취소 예약을 제외한다.
- 총 예약 건수와 취소율은 취소 예약을 포함한 전체 예약을 분모로 사용한다.
- 회원은 앞뒤 공백 제거, 연속 공백 축소, 소문자 변환한 이름으로 근사 식별한다.
- 회원 순위는 5명부터 시작하고 `10명 더 보기`마다 10명씩 추가한다.
- 모든 안내·빈 상태·오류 문구는 존댓말이다.
- 차트와 UI는 shadcn 토큰을 사용하고 값은 색상 외 텍스트·툴팁으로도 제공한다.
- 브라우저에서 예약 원본, 비밀번호 해시, Supabase secret key를 사용하지 않는다.
- 실제 결제, 회원 ID, 출석·노쇼, 취소 사유, 데이터 내보내기는 만들지 않는다.

---

## File Map

새 파일:

- `supabase/migrations/*_add_admin_reservation_statistics.sql`: CLI가 생성한 통계 인덱스·RPC 마이그레이션
- `supabase/tests/admin_reservation_statistics.sql`: RPC 권한과 집계 회귀 테스트
- `src/lib/admin-statistics.ts`: 통계 입력·응답 타입, Zod 스키마, URL·표시·시뮬레이션 순수 함수
- `src/lib/admin-statistics.test.ts`: 통계 순수 함수 테스트
- `src/lib/admin-statistics-actions.ts`: 인증된 통계 RPC 서버 액션
- `src/lib/admin-statistics-actions.test.ts`: 입력·인증·RPC 응답 서버 액션 테스트
- `src/lib/use-admin-statistics.ts`: 조회 상태와 재시도 훅
- `src/app/admin/statistics/page.tsx`: AdminShell을 적용한 라우트
- `src/app/admin/statistics/admin-statistics-page.tsx`: URL 상태와 전체 레이아웃 조합
- `src/app/admin/statistics/statistics-summary-cards.tsx`: KPI 카드 5개
- `src/app/admin/statistics/statistics-trend-chart.tsx`: 이용 추세 Area Chart
- `src/app/admin/statistics/statistics-member-ranking.tsx`: 전체 회원 순위와 더 보기
- `src/app/admin/statistics/statistics-peak-chart.tsx`: 요일별 2시간 Range Bar
- `src/app/admin/statistics/statistics-simulator-dialog.tsx`: 정기권 시뮬레이션 Dialog
- `src/components/ui/chart.tsx`: shadcn Chart primitive
- `src/components/ui/toggle.tsx`: shadcn Toggle primitive
- `src/components/ui/toggle-group.tsx`: shadcn ToggleGroup primitive
- `src/components/ui/skeleton.tsx`: shadcn Skeleton primitive
- `src/components/ui/alert.tsx`: shadcn Alert primitive

수정 파일:

- `package.json`, `package-lock.json`: Recharts 의존성
- `src/lib/admin-navigation.ts`: 예약 통계 메뉴
- `src/lib/admin-navigation.test.ts`: 메뉴 순서와 활성 상태
- `src/app/admin/admin-shell.tsx`: 통계 메뉴 아이콘 매핑

---

### Task 1: Supabase 통계 RPC와 날짜 인덱스

**Files:**
- Create via CLI: `supabase/migrations/*_add_admin_reservation_statistics.sql`
- Create: `supabase/tests/admin_reservation_statistics.sql`

**Interfaces:**
- Produces RPC: `public.get_admin_reservation_statistics(p_reference_month date, p_unit text) returns jsonb`
- Produces index: `reservations_date_idx on public.reservations(date)`
- RPC JSON: `{ coverageStart, summary, trend, ranking, peakTimes }`

- [ ] **Step 1: Supabase 변경 사항과 CLI 확인**

Run:

```bash
curl -fsSL https://supabase.com/changelog.md | rg -n "breaking-change|Postgres|RLS|RPC"
npx supabase --version
npx supabase migration new --help
```

Expected: 관련 breaking change를 확인하고 현재 CLI의 migration 명령을 사용한다.

- [ ] **Step 2: 실패하는 DB 회귀 테스트 작성**

`supabase/tests/admin_reservation_statistics.sql`에 트랜잭션 테스트를 작성한다.

```sql
begin;

do $$
begin
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
```

- [ ] **Step 3: DB 테스트 실패 확인**

Run: `npx supabase test db supabase/tests/admin_reservation_statistics.sql`

Expected: FAIL because `get_admin_reservation_statistics` does not exist.

- [ ] **Step 4: CLI로 마이그레이션 생성**

Run: `npx supabase migration new add_admin_reservation_statistics`

Expected: `supabase/migrations/` 아래에 현재 시각 접두사의 파일이 출력된다. 이후 단계는 출력된 정확한 경로만 수정한다.

- [ ] **Step 5: 인덱스와 RPC 구현**

생성된 마이그레이션에 다음 구조를 구현한다.

```sql
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
  )), '[]'::jsonb) into v_trend
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
```

- [ ] **Step 6: 로컬 DB 적용과 테스트**

Run:

```bash
npx supabase db reset
npx supabase test db supabase/tests/admin_reservation_statistics.sql
```

Expected: reset 성공, DB 테스트 PASS.

- [ ] **Step 7: 쿼리 계획과 보안 어드바이저 확인**

Run `npx supabase db query --help`. 지원되면 `EXPLAIN (ANALYZE, BUFFERS)`로 1년 범위 함수 쿼리의 날짜 조건을 확인한다. 지원되지 않으면 Supabase SQL Editor에서 같은 쿼리를 실행한다. 이어서 `npx supabase db advisors --local`을 실행하고 오류가 없어야 한다.

- [ ] **Step 8: 커밋**

```bash
git add supabase/migrations supabase/tests/admin_reservation_statistics.sql
git commit -m "feat: 관리자 예약 통계 RPC 추가"
```

---

### Task 2: 통계 계약, URL 상태, 시뮬레이션 순수 함수

**Files:**
- Create: `src/lib/admin-statistics.ts`
- Create: `src/lib/admin-statistics.test.ts`

**Interfaces:**
- Produces: `StatisticsUnit`, `StatisticsMetric`, `AdminReservationStatistics`
- Produces: `parseStatisticsQuery`, `buildStatisticsSearchParams`
- Produces: `formatStatisticsMinutes`, `getVisibleRanking`
- Produces: `calculateSubscriptionScenario`

- [ ] **Step 1: 실패하는 순수 함수 테스트 작성**

```ts
import { describe, expect, it } from "vitest";
import {
  buildStatisticsSearchParams,
  calculateSubscriptionScenario,
  getVisibleRanking,
  parseStatisticsQuery,
} from "./admin-statistics";

describe("admin statistics", () => {
  it("normalizes invalid query values", () => {
    expect(parseStatisticsQuery(new URLSearchParams("month=nope&unit=month&metric=x"), "2026-08"))
      .toEqual({ referenceMonth: "2026-08", unit: "day", metric: "usageMinutes" });
  });

  it("writes stable query parameters", () => {
    expect(buildStatisticsSearchParams({ referenceMonth: "2026-07", unit: "year", metric: "userCount" }))
      .toBe("month=2026-07&unit=year&metric=userCount");
  });

  it("shows five members first and ten more each time", () => {
    const ranking = Array.from({ length: 26 }, (_, index) => ({
      name: `회원 ${index + 1}`, usageMinutes: 60, peakMinutes: 0, reservationCount: 1,
    }));
    expect(getVisibleRanking(ranking, 5)).toHaveLength(5);
    expect(getVisibleRanking(ranking, 15)).toHaveLength(15);
    expect(getVisibleRanking(ranking, 35)).toHaveLength(26);
  });

  it("calculates a clearly labeled revenue scenario", () => {
    expect(calculateSubscriptionScenario({
      ranking: [
        { name: "A", usageMinutes: 600, peakMinutes: 180, reservationCount: 10 },
        { name: "B", usageMinutes: 420, peakMinutes: 60, reservationCount: 7 },
      ],
      includedMinutes: 480,
      peakIncludedMinutes: 120,
      monthlyPrice: 49000,
      conversionRate: 50,
    })).toEqual({
      eligibleUsers: 1,
      usersExceedingPeakAllowance: 1,
      scenarioSubscribers: 1,
      scenarioRevenue: 49000,
    });
  });
});
```

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/admin-statistics.test.ts`

Expected: FAIL because the module does not exist.

- [ ] **Step 3: 타입·Zod 스키마·순수 함수 구현**

`StatisticsUnit`은 `"day" | "week" | "year"`, `StatisticsMetric`은 `"usageMinutes" | "reservationCount" | "userCount"`로 고정한다. RPC 응답 스키마는 음수가 아닌 정수, `weekday` 1~7, `occupancyRate` 0~100을 검증한다.

```ts
export const statisticsUnits = ["day", "week", "year"] as const;
export const statisticsMetrics = ["usageMinutes", "reservationCount", "userCount"] as const;

export function calculateSubscriptionScenario(input: {
  ranking: StatisticsRankingEntry[];
  includedMinutes: number;
  peakIncludedMinutes: number;
  monthlyPrice: number;
  conversionRate: number;
}) {
  const eligible = input.ranking.filter((entry) => entry.usageMinutes >= input.includedMinutes);
  const eligibleUsers = eligible.length;
  const usersExceedingPeakAllowance = eligible.filter(
    (entry) => entry.peakMinutes > input.peakIncludedMinutes,
  ).length;
  const scenarioSubscribers = Math.round(eligibleUsers * input.conversionRate / 100);
  return {
    eligibleUsers,
    usersExceedingPeakAllowance,
    scenarioSubscribers,
    scenarioRevenue: scenarioSubscribers * input.monthlyPrice,
  };
}
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/admin-statistics.test.ts`

Expected: PASS.

- [ ] **Step 5: 커밋**

```bash
git add src/lib/admin-statistics.ts src/lib/admin-statistics.test.ts
git commit -m "feat: 예약 통계 도메인 추가"
```

---

### Task 3: 인증된 통계 서버 액션과 조회 훅

**Files:**
- Create: `src/lib/admin-statistics-actions.ts`
- Create: `src/lib/admin-statistics-actions.test.ts`
- Create: `src/lib/use-admin-statistics.ts`

**Interfaces:**
- Consumes: `AdminReservationStatistics`, `StatisticsUnit`, RPC Zod schema
- Produces: `getAdminReservationStatistics({ referenceMonth, unit })`
- Produces: `useAdminStatistics({ referenceMonth, unit })`

- [ ] **Step 1: 실패하는 액션 테스트 작성**

기존 `maintenance-actions.test.ts`의 hoisted mock 패턴을 사용해 다음을 검증한다.

```ts
it("calls the statistics RPC for an authenticated admin", async () => {
  mocks.getUser.mockResolvedValue({ data: { user: { id: "admin-1" } } });
  mocks.rpc.mockResolvedValue({ data: validStatisticsFixture, error: null });

  await expect(getAdminReservationStatistics({ referenceMonth: "2026-07", unit: "day" }))
    .resolves.toEqual({ ok: true, data: validStatisticsFixture });
  expect(mocks.rpc).toHaveBeenCalledWith("get_admin_reservation_statistics", {
    p_reference_month: "2026-07-01",
    p_unit: "day",
  });
});

it("rejects invalid input before Supabase", async () => {
  await expect(getAdminReservationStatistics({ referenceMonth: "bad", unit: "day" }))
    .resolves.toEqual({ ok: false, error: "통계 조회 조건이 올바르지 않습니다." });
  expect(mocks.rpc).not.toHaveBeenCalled();
});
```

비로그인, 미래 월, RPC 오류, 잘못된 RPC JSON도 각각 존댓말 오류로 반환하는 테스트를 추가한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/admin-statistics-actions.test.ts`

Expected: FAIL because the action does not exist.

- [ ] **Step 3: 서버 액션 구현**

`createSupabaseServerClient()`의 `auth.getUser()`로 관리자 세션을 확인하고, RPC 결과를 Zod로 파싱한다. 오류 문구는 `관리자 로그인이 필요합니다.`, `통계 조회 조건이 올바르지 않습니다.`, `예약 통계를 불러오지 못했습니다. 다시 시도해 주세요.` 세 가지로 고정한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test -- src/lib/admin-statistics-actions.test.ts src/lib/admin-statistics.test.ts`

Expected: PASS.

- [ ] **Step 5: 조회 훅 구현**

`useAdminStatistics`는 입력 변경 시 서버 액션을 호출하고 `{ statistics, isReady, isPending, error, refresh }`를 반환한다. 이전 요청보다 늦게 끝난 오래된 응답은 request counter로 무시한다. 재조회 시작 시 이전 오류를 지우고 Skeleton 상태를 노출한다.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/admin-statistics-actions.ts src/lib/admin-statistics-actions.test.ts src/lib/use-admin-statistics.ts
git commit -m "feat: 예약 통계 조회 액션 추가"
```

---

### Task 4: shadcn Chart 기반과 관리자 경로 추가

**Files:**
- Create/Modify: `src/components/ui/chart.tsx`, `toggle.tsx`, `toggle-group.tsx`, `skeleton.tsx`, `alert.tsx`
- Modify: `package.json`, `package-lock.json`
- Modify: `src/lib/admin-navigation.ts`
- Modify: `src/lib/admin-navigation.test.ts`
- Create: `src/app/admin/statistics/page.tsx`

**Interfaces:**
- Produces route: `/admin/statistics`
- Produces sidebar item: `{ title: "예약 통계", href: "/admin/statistics", description: "이용 추세와 회원 순위" }`

- [ ] **Step 1: 실패하는 내비게이션 테스트 수정**

`ADMIN_SIDEBAR_ITEMS` 기대값의 마지막에 예약 통계 항목을 추가하고 `/admin/statistics` 활성 상태를 검증한다.

- [ ] **Step 2: 테스트 실패 확인**

Run: `npm test -- src/lib/admin-navigation.test.ts`

Expected: FAIL because the item is absent.

- [ ] **Step 3: shadcn 변경 미리보기와 설치**

Run:

```bash
npx shadcn add chart toggle-group skeleton alert --dry-run
npx shadcn add chart toggle-group skeleton alert --diff
```

`card.tsx` 덮어쓰기 diff가 기존 Base Nova API를 제거하지 않는지 확인한다. 기존 `Card`의 `size`, `CardAction`이 사라지면 `card.tsx`는 덮어쓰지 않고 나머지 새 파일과 `recharts@3.8.0`만 적용한다. 적용 후 `git diff -- src/components/ui/card.tsx`로 기존 API 보존을 확인한다.

- [ ] **Step 4: 내비게이션과 라우트 구현**

`admin-navigation.ts`에 통계 항목을 추가한다. `page.tsx`는 다음 구조를 사용한다.

```tsx
import AdminShell from "../admin-shell";
import AdminStatisticsPage from "./admin-statistics-page";

export default function AdminStatisticsRoute() {
  return <AdminShell><AdminStatisticsPage /></AdminShell>;
}
```

이 단계에서는 `admin-statistics-page.tsx`를 간단한 존댓말 로딩 화면으로 생성해 라우트를 빌드 가능하게 한다.

- [ ] **Step 5: 테스트와 타입 검사**

Run:

```bash
npm test -- src/lib/admin-navigation.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add package.json package-lock.json src/components/ui src/lib/admin-navigation.ts src/lib/admin-navigation.test.ts src/app/admin/statistics
git commit -m "feat: 예약 통계 관리자 경로 추가"
```

---

### Task 5: 상단 컨트롤, URL 상태, KPI 카드

**Files:**
- Modify: `src/app/admin/statistics/admin-statistics-page.tsx`
- Create: `src/app/admin/statistics/statistics-summary-cards.tsx`
- Modify: `src/lib/admin-statistics.ts`
- Test: `src/lib/admin-statistics.test.ts`

**Interfaces:**
- Consumes: `parseStatisticsQuery`, `buildStatisticsSearchParams`, `useAdminStatistics`
- Produces: 기준 월 Select, 상단 일·주·년 ToggleGroup, KPI 5개

- [ ] **Step 1: 표시 계산 테스트 추가**

이용시간 319.5시간, 평균 12.3시간, 취소율 12.6%, 이전 월 비교 불가 문구를 만드는 `buildStatisticsSummaryView` 테스트를 작성한다. 0건일 때 평균과 취소율이 0인지도 검증한다.

- [ ] **Step 2: 테스트 실패 후 최소 구현**

Run: `npm test -- src/lib/admin-statistics.test.ts`

Expected: FAIL, 구현 후 PASS.

- [ ] **Step 3: 페이지 상단과 URL 동기화 구현**

`useSearchParams`, `useRouter`, `usePathname`을 사용한다. 변경 시 `router.replace(`${pathname}?${nextQuery}`, { scroll: false })`를 호출한다. 컨트롤 순서는 `기준 월`, `일 / 주 / 년`, `정기권 시뮬레이션`으로 고정한다. 미래 월 옵션은 만들지 않는다.

- [ ] **Step 4: KPI 상태 구현**

- 로딩: 5개 Skeleton 카드
- 성공: 총 이용시간, 총 예약 건수, 전체 이용자, 이용자당 평균, 예약 취소율
- 비교 불가: `이전 월 데이터가 충분하지 않습니다.`
- 오류: Alert와 `다시 시도` Button
- 빈 데이터: 모든 KPI 0과 존댓말 빈 상태

- [ ] **Step 5: 테스트와 빌드 확인**

Run:

```bash
npm test -- src/lib/admin-statistics.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/admin-statistics.ts src/lib/admin-statistics.test.ts src/app/admin/statistics
git commit -m "feat: 예약 통계 요약 화면 추가"
```

---

### Task 6: 이용 추세와 회원 순위

**Files:**
- Create: `src/app/admin/statistics/statistics-trend-chart.tsx`
- Create: `src/app/admin/statistics/statistics-member-ranking.tsx`
- Modify: `src/app/admin/statistics/admin-statistics-page.tsx`
- Modify/Test: `src/lib/admin-statistics.ts`, `src/lib/admin-statistics.test.ts`

**Interfaces:**
- Trend props: `{ points, unit, metric, onMetricChange }`
- Ranking props: `{ entries, referenceMonth }`

- [ ] **Step 1: 차트 라벨·순위 펼침 테스트 작성**

`formatTrendLabel(point, unit)`이 일은 `7/1`, 주는 `7/1~7/5`, 년은 `7월`을 반환하는지 검증한다. `getNextRankingLimit(5, 26)`은 15, `getNextRankingLimit(25, 26)`은 26을 반환해야 한다.

- [ ] **Step 2: 테스트 실패 후 순수 함수 구현**

Run: `npm test -- src/lib/admin-statistics.test.ts`

Expected: FAIL, 구현 후 PASS.

- [ ] **Step 3: shadcn Area Chart 구현**

`ChartContainer`, `ChartTooltip`, `AreaChart`, `Area`, `XAxis`, `YAxis`, `CartesianGrid`를 사용한다. 추세 카드에는 `이용시간 / 예약 건수 / 이용자 수`만 두고 일·주·년은 두지 않는다. 불완전 버킷은 점선 또는 `데이터 없음` 툴팁으로 구분하고 0으로 오해시키지 않는다.

- [ ] **Step 4: 전체 회원 순위 구현**

순위, 이름, 상대 막대, 이용시간, 예약 건수를 표시한다. 처음 5명, 이후 10명씩 추가하고 기준 월 변경 시 5명으로 초기화한다. 마지막에는 버튼을 숨긴다. 모바일에서는 예약 건수를 숨기되 이용시간은 유지한다.

- [ ] **Step 5: 테스트와 타입 검사**

Run:

```bash
npm test -- src/lib/admin-statistics.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/admin-statistics.ts src/lib/admin-statistics.test.ts src/app/admin/statistics
git commit -m "feat: 예약 추세와 회원 순위 추가"
```

---

### Task 7: 요일별 피크 Range Bar와 정기권 모달

**Files:**
- Create: `src/app/admin/statistics/statistics-peak-chart.tsx`
- Create: `src/app/admin/statistics/statistics-simulator-dialog.tsx`
- Modify: `src/app/admin/statistics/admin-statistics-page.tsx`
- Modify/Test: `src/lib/admin-statistics.ts`, `src/lib/admin-statistics.test.ts`

**Interfaces:**
- Peak props: `{ peakTimes, referenceMonth }`
- Simulator props: `{ ranking, peakTimes, open, onOpenChange }`

- [ ] **Step 1: 피크·시뮬레이터 표시 테스트 추가**

`formatPeakWindow({ startMinutes: 1140, endMinutes: 1260, occupancyRate: 50 })`가 `19:00~21:00 · 50%`를 반환하는지 검증한다. 시뮬레이터는 포함시간 8시간, 가격 49,000원, 가입률 50% 입력을 분 단위로 변환해 기존 시나리오 함수에 전달하는지 검증한다.

- [ ] **Step 2: 테스트 실패 후 순수 함수 구현**

Run: `npm test -- src/lib/admin-statistics.test.ts`

Expected: FAIL, 구현 후 PASS.

- [ ] **Step 3: 요일별 Range Bar 구현**

Recharts `BarChart layout="vertical"`에서 `[startMinutes, endMinutes]` 범위 값을 사용한다. Y축은 월~일, X축은 420~1380분이다. 막대 오른쪽에 시간·점유율 텍스트를 별도 렌더링한다. `hasData=false`면 `예약 데이터가 없습니다.`를 표시한다.

- [ ] **Step 4: 정기권 Dialog 구현**

입력은 월 제공 시간, 월 가격, 예상 가입률, 피크 허용 한도다. 숫자 범위는 제공시간 1~100시간, 가격 0~10,000,000원, 가입률 0~100%, 피크 한도 0~제공시간으로 제한한다. 결과는 잠재 대상 회원, 시나리오 가입자, 시나리오 월매출, 대상 회원의 피크 이용 비중을 보여준다. 하단에 `실제 매출 예측이 아닌 가정 결과입니다.`를 항상 표시한다. 저장 API는 만들지 않는다.

- [ ] **Step 5: 테스트와 타입 검사**

Run:

```bash
npm test -- src/lib/admin-statistics.test.ts
npx tsc --noEmit
```

Expected: PASS.

- [ ] **Step 6: 커밋**

```bash
git add src/lib/admin-statistics.ts src/lib/admin-statistics.test.ts src/app/admin/statistics
git commit -m "feat: 피크 시간과 정기권 시뮬레이터 추가"
```

---

### Task 8: 전체 검증과 실제 데이터 확인

**Files:**
- Modify only if verification finds a scoped defect

- [ ] **Step 1: 전체 자동 테스트**

Run:

```bash
npm test
npx tsc --noEmit
npm run build
```

Expected: 모든 테스트 PASS, TypeScript 오류 없음, Next.js build 성공.

- [ ] **Step 2: Supabase 회귀 테스트와 실제 집계 교차검증**

Run:

```bash
npx supabase test db supabase/tests/admin_reservation_statistics.sql
```

실제 Supabase에서 2026년 7월을 조회해 다음 기준값과 비교한다.

- 총 예약 390건
- 취소 제외 341건
- 총 이용시간 319.5시간
- 이름 기준 이용자 26명
- 취소율 12.6%

데이터가 이후 변경됐다면 같은 시점 스냅샷이 아니라 현재 직접 집계와 RPC 결과가 일치하는지 확인한다.

- [ ] **Step 3: 브라우저 검증**

개발 서버를 실행하고 `/admin/statistics`에서 다음을 확인한다.

- 상단 순서가 기준 월 → 일·주·년 → 정기권 시뮬레이션인지
- 추세 카드 안에 일·주·년이 중복되지 않는지
- 일·주·년 전환 시 X축과 URL이 바뀌는지
- KPI·순위·피크가 기준 월을 함께 사용하는지
- 회원 순위가 5명에서 10명씩 추가되는지
- 시뮬레이터가 Dialog로 열리고 저장하지 않는지
- 로딩·빈 상태·오류가 모두 존댓말인지
- 390px와 1440px 너비에서 가로 넘침과 잘린 라벨이 없는지

- [ ] **Step 4: 최종 diff와 작업 트리 확인**

Run:

```bash
git diff --check
git status --short
git log --oneline -8
```

Expected: 공백 오류 없음, 계획 범위 밖 파일 없음, Task별 커밋 존재.

- [ ] **Step 5: 검증 수정 커밋**

검증에서 수정이 생긴 경우에만 실행한다.

```bash
git add src/lib/admin-statistics.ts src/lib/admin-statistics.test.ts src/lib/admin-statistics-actions.ts src/lib/admin-statistics-actions.test.ts src/lib/use-admin-statistics.ts src/app/admin/statistics src/components/ui/chart.tsx src/components/ui/toggle.tsx src/components/ui/toggle-group.tsx src/components/ui/skeleton.tsx src/components/ui/alert.tsx src/lib/admin-navigation.ts src/lib/admin-navigation.test.ts package.json package-lock.json supabase/migrations supabase/tests/admin_reservation_statistics.sql
git commit -m "fix: 예약 통계 검증 오류 수정"
```
