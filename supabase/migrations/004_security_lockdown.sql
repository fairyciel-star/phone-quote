-- =============================================
-- 보안 잠금: anon 쓰기 권한 회수 + 쓰기 정책을 인증 사용자 전용으로 제한
-- =============================================
-- 배경:
--   기존 service_write_* 정책이 역할 제한 없이 `using (true)`로 정의되어
--   anon 키만으로 모든 테이블 쓰기/삭제가 가능했음.
--   002/003 마이그레이션의 `GRANT ALL ... TO anon`도 동일 문제.
-- 조치:
--   - 실제로 존재하는 테이블에만 적용 (일부 테이블은 구글 시트로 대체되어 미생성)
--   - 읽기: 고객 앱에 필요한 테이블 anon 유지
--   - 쓰기: authenticated(관리자 로그인) 전용
--   - service_role은 RLS를 우회하므로 Edge Function/서버 작업은 영향 없음
--   - 여러 번 실행해도 안전(idempotent)
-- 주의:
--   이 마이그레이션 적용 후에는 관리자 페이지가 Supabase Auth 로그인을
--   요구하므로, 적용 전에 Supabase 대시보드 > Authentication > Users 에서
--   관리자 계정(이메일+비밀번호)을 먼저 생성할 것.

-- ── 1) 존재하는 테이블에만 RLS + 관리자 전용 쓰기 정책 적용 ──
do $$
declare
  t text;
  target_tables text[] := array[
    'phones','phone_variants','carrier_subsidies','installment_subsidies',
    'plans','card_discounts','extra_services','used_prices',
    'stores','store_rebates','price_upload_logs','parsed_prices'
  ];
  pol record;
begin
  foreach t in array target_tables loop
    -- 테이블이 실제로 존재할 때만 처리
    if to_regclass('public.' || t) is not null then
      -- 기존 개방형 쓰기 정책 및 이전 실행분 제거
      for pol in
        select policyname from pg_policies
        where schemaname = 'public' and tablename = t
          and (policyname like 'service_write_%' or policyname like 'admin_all_%')
      loop
        execute format('drop policy if exists %I on public.%I', pol.policyname, t);
      end loop;

      -- RLS 활성화
      execute format('alter table public.%I enable row level security', t);

      -- 관리자(authenticated) 전용 쓰기 정책
      execute format(
        'create policy %I on public.%I for all to authenticated using (true) with check (true)',
        'admin_all_' || t, t
      );
    end if;
  end loop;
end $$;

-- ── 2) anon 쓰기 권한 회수 (002/003의 GRANT ALL 되돌리기) ──
revoke insert, update, delete, truncate, references, trigger
  on all tables in schema public from anon;
revoke usage on all sequences in schema public from anon;

-- 고객 앱 조회에 필요한 읽기 권한만 유지
grant select on all tables in schema public to anon;

-- ── 3) 관리자(authenticated) 권한 부여 ──
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;

-- ── 4) 관리자 전용 테이블은 anon 읽기도 차단 (존재할 때만) ──
do $$
begin
  if to_regclass('public.stores') is not null then
    revoke select on public.stores from anon;
  end if;
  if to_regclass('public.price_upload_logs') is not null then
    revoke select on public.price_upload_logs from anon;
  end if;
end $$;
