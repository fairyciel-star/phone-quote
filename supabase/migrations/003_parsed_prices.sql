-- 단가표 이미지 파싱 결과 저장 테이블
-- 통신사별 단가표에서 추출한 공시/선택 단가를 만원 단위로 저장
-- 요금제 구간(고가/중가/저가)별로 별도 행 저장

create table if not exists parsed_prices (
  id              bigint generated always as identity primary key,
  carrier         text not null check (carrier in ('SKT','KT','LGU')),
  model_code      text not null,               -- 단가표 상의 모델코드 (SM-S942N)
  phone_id        text,                        -- phones.json 매칭 ID (galaxy-s26), nullable
  storage         text not null default '',     -- 128G, 256G, 512G 등
  plan_tier       text not null default '고가' check (plan_tier in ('고가','중가','저가')),
  retail_price    integer not null default 0,   -- 출고가 (만원 x 10, 125.4 → 1254)
  -- 공시지원금 방식 단가 (만원)
  subsidy_010     integer default 0,
  subsidy_mnp     integer default 0,
  subsidy_change  integer default 0,
  -- 선택약정 방식 단가 (만원)
  agreement_010   integer default 0,
  agreement_mnp   integer default 0,
  agreement_change integer default 0,
  -- 메타
  batch_id        bigint references price_upload_logs(id),
  updated_at      timestamptz default now(),
  unique (carrier, model_code, storage, plan_tier)
);

-- 인덱스
create index if not exists idx_parsed_prices_carrier
  on parsed_prices(carrier);

create index if not exists idx_parsed_prices_phone_id
  on parsed_prices(phone_id);

create index if not exists idx_parsed_prices_tier
  on parsed_prices(plan_tier);

-- RLS
alter table parsed_prices enable row level security;
create policy "public_read_parsed_prices" on parsed_prices for select using (true);
create policy "service_write_parsed_prices" on parsed_prices for all using (true) with check (true);

-- updated_at 자동 갱신
create trigger set_updated_at_parsed_prices before update on parsed_prices
  for each row execute function update_updated_at();

-- anon 권한
grant all on parsed_prices to anon;
grant all on price_upload_logs to anon;
