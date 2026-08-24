-- =============================================
-- 방문 로그: 고객 앱 방문 기록 + 관리자 전용 통계 조회
-- =============================================
-- 설계 원칙:
--   - 개인정보 미수집: IP·User-Agent·개인식별정보를 저장하지 않는다.
--     방문자 식별은 브라우저가 생성한 랜덤 UUID뿐이다.
--   - 004 보안 잠금 기조 유지: anon 에게는 INSERT 만 허용하고
--     조회·수정·삭제는 관리자(authenticated) 전용으로 둔다.
--   - 여러 번 실행해도 안전(idempotent)

create table if not exists public.page_visits (
  id          uuid primary key default gen_random_uuid(),
  -- localStorage 기반 재방문 식별자 (순방문자 집계용)
  visitor_id  uuid not null,
  -- sessionStorage 기반 세션 식별자. unique 제약이 중복 삽입을 막는다.
  session_id  uuid not null unique,
  visited_at  timestamptz not null default now(),
  -- 유입 도메인만 저장 (경로·쿼리스트링 제외)
  referrer    text check (referrer is null or char_length(referrer) <= 200),
  device      text check (device is null or device in ('mobile', 'desktop'))
);

create index if not exists idx_page_visits_visited_at on public.page_visits (visited_at desc);
create index if not exists idx_page_visits_visitor_id on public.page_visits (visitor_id);

-- ── RLS ──
alter table public.page_visits enable row level security;

drop policy if exists anon_insert_page_visits on public.page_visits;
create policy anon_insert_page_visits
  on public.page_visits for insert to anon with check (true);

drop policy if exists admin_read_page_visits on public.page_visits;
create policy admin_read_page_visits
  on public.page_visits for select to authenticated using (true);

-- ── 권한: anon 은 삽입만 가능 (조회 불가) ──
revoke all on public.page_visits from anon;
grant insert on public.page_visits to anon;
-- 관리자 앱은 조회만 한다. 데이터 정리는 Supabase 대시보드(service_role)에서.
grant select on public.page_visits to authenticated;

-- ── 일자별 집계 함수 (한국 시간 기준) ──
-- security invoker 이므로 RLS 가 그대로 적용된다 → 관리자만 결과를 볼 수 있다.
create or replace function public.visit_stats(days integer default 30)
returns table (day date, visits bigint, visitors bigint)
language sql
security invoker
stable
set search_path = public
as $$
  select
    (visited_at at time zone 'Asia/Seoul')::date as day,
    count(*)::bigint                             as visits,
    count(distinct visitor_id)::bigint           as visitors
  from public.page_visits
  where visited_at >= now() - make_interval(days => greatest(days, 1))
  group by 1
  order by 1 desc;
$$;

revoke all on function public.visit_stats(integer) from public;
revoke all on function public.visit_stats(integer) from anon;
grant execute on function public.visit_stats(integer) to authenticated;
