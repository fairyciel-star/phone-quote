-- =============================================
-- 휴대폰 견적 시스템 Supabase 스키마
-- =============================================

-- 1. 휴대폰 마스터
create table if not exists phones (
  model_id   text primary key,
  manufacturer text not null,          -- 삼성, 애플
  model_name text not null,            -- 갤럭시 S26
  badge      text default '',          -- NEW, SALE 등
  is_kids    boolean default false,
  image_url  text default '',
  release_date text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. 색상·용량 (출고가 포함)
create table if not exists phone_variants (
  id          bigint generated always as identity primary key,
  model_id    text not null references phones(model_id) on delete cascade,
  storage     text not null,           -- 256GB, 512GB
  retail_price integer not null default 0,
  color_name  text default '',
  color_hex   text default '',
  color_image_url text default '',
  unique (model_id, storage, color_name)
);

-- 3. 공통지원금 (공시지원금)
create table if not exists carrier_subsidies (
  id              bigint generated always as identity primary key,
  model_id        text not null,
  carrier         text not null check (carrier in ('SKT','KT','LGU')),
  storage         text not null,
  subscription_type text not null check (subscription_type in ('번호이동','기기변경','신규가입')),
  high_subsidy    integer default 0,   -- 고가_공시지원금
  high_additional integer default 0,   -- 고가_추가지원금
  high_special    integer default 0,   -- 고가_특별지원금
  mid_subsidy     integer default 0,   -- 중가_공시지원금
  mid_additional  integer default 0,   -- 중가_추가지원금
  mid_special     integer default 0,   -- 중가_특별지원금
  low_subsidy     integer default 0,   -- 저가_공시지원금
  low_additional  integer default 0,   -- 저가_추가지원금
  low_special     integer default 0,   -- 저가_특별지원금
  updated_at      timestamptz default now(),
  unique (model_id, carrier, storage, subscription_type)
);

-- 4. 선택약정 지원금
create table if not exists installment_subsidies (
  id              bigint generated always as identity primary key,
  model_id        text not null,
  carrier         text not null check (carrier in ('SKT','KT','LGU')),
  storage         text not null,
  subscription_type text not null check (subscription_type in ('번호이동','기기변경','신규가입')),
  high_additional integer default 0,   -- 고가_추가지원금
  high_special    integer default 0,   -- 고가_특별지원금
  mid_additional  integer default 0,   -- 중가_추가지원금
  mid_special     integer default 0,   -- 중가_특별지원금
  low_additional  integer default 0,   -- 저가_추가지원금
  low_special     integer default 0,   -- 저가_특별지원금
  updated_at      timestamptz default now(),
  unique (model_id, carrier, storage, subscription_type)
);

-- 5. 요금제
create table if not exists plans (
  id              text primary key,
  carrier         text not null check (carrier in ('SKT','KT','LGU')),
  plan_name       text not null,
  monthly_fee     integer not null default 0,
  data            text default '',
  calls           text default '',
  texts           text default '',
  discount_rate   numeric(4,2) default 0.25,
  benefits        text default '',
  exclusive_plan  text default '',
  tier            text check (tier in ('고가','중가','저가')),
  category        text default '5G',
  created_at      timestamptz default now()
);

-- 6. 제휴카드 할인
create table if not exists card_discounts (
  id              text primary key,
  carrier         text not null check (carrier in ('SKT','KT','LGU')),
  card_name       text not null,
  monthly_discount integer default 0,
  conditions      text default ''
);

-- 7. 부가서비스
create table if not exists extra_services (
  id              text primary key,
  carrier         text not null check (carrier in ('SKT','KT','LGU')),
  service_name    text not null,
  monthly_fee     integer default 0,
  additional_discount integer default 0,
  description     text default ''
);

-- 8. 중고폰 시세
create table if not exists used_prices (
  id          bigint generated always as identity primary key,
  model_name  text not null,
  model_id    text not null,
  storage     text default '',
  grade_a     integer default 0,
  grade_b     integer default 0,
  grade_c     integer default 0,
  grade_e     integer default 0,
  updated_at  timestamptz default now(),
  unique (model_id, storage)
);

-- 9. 업체 (나중에 사용)
create table if not exists stores (
  id          uuid default gen_random_uuid() primary key,
  store_name  text not null,
  owner_name  text default '',
  carrier     text check (carrier in ('SKT','KT','LGU')),
  phone       text default '',
  email       text default '',
  is_active   boolean default true,
  created_at  timestamptz default now()
);

-- 10. 업체 리베이트 (나중에 사용)
create table if not exists store_rebates (
  id              bigint generated always as identity primary key,
  store_id        uuid not null references stores(id) on delete cascade,
  model_id        text not null,
  carrier         text not null check (carrier in ('SKT','KT','LGU')),
  storage         text not null,
  subscription_type text not null check (subscription_type in ('번호이동','기기변경','신규가입')),
  rebate_amount   integer not null default 0,
  updated_at      timestamptz default now(),
  unique (store_id, model_id, carrier, storage, subscription_type)
);

-- 11. 원가표 업로드 이력
create table if not exists price_upload_logs (
  id          bigint generated always as identity primary key,
  carrier     text not null check (carrier in ('SKT','KT','LGU')),
  image_url   text default '',
  rows_updated integer default 0,
  uploaded_by text default 'admin',
  created_at  timestamptz default now()
);

-- ── 인덱스 ──
create index if not exists idx_carrier_subsidies_lookup
  on carrier_subsidies(model_id, carrier, storage, subscription_type);

create index if not exists idx_installment_subsidies_lookup
  on installment_subsidies(model_id, carrier, storage, subscription_type);

create index if not exists idx_store_rebates_lookup
  on store_rebates(store_id, model_id, carrier);

-- ── RLS (Row Level Security) ──
alter table phones enable row level security;
alter table phone_variants enable row level security;
alter table carrier_subsidies enable row level security;
alter table installment_subsidies enable row level security;
alter table plans enable row level security;
alter table card_discounts enable row level security;
alter table extra_services enable row level security;
alter table used_prices enable row level security;
alter table stores enable row level security;
alter table store_rebates enable row level security;
alter table price_upload_logs enable row level security;

-- 읽기는 모두 허용 (고객 앱에서 조회)
create policy "public_read_phones" on phones for select using (true);
create policy "public_read_variants" on phone_variants for select using (true);
create policy "public_read_subsidies" on carrier_subsidies for select using (true);
create policy "public_read_installment" on installment_subsidies for select using (true);
create policy "public_read_plans" on plans for select using (true);
create policy "public_read_cards" on card_discounts for select using (true);
create policy "public_read_services" on extra_services for select using (true);
create policy "public_read_used" on used_prices for select using (true);
create policy "public_read_rebates" on store_rebates for select using (true);

-- 쓰기는 service_role 키로만 (관리자 API/Edge Function)
create policy "service_write_phones" on phones for all using (true) with check (true);
create policy "service_write_variants" on phone_variants for all using (true) with check (true);
create policy "service_write_subsidies" on carrier_subsidies for all using (true) with check (true);
create policy "service_write_installment" on installment_subsidies for all using (true) with check (true);
create policy "service_write_plans" on plans for all using (true) with check (true);
create policy "service_write_cards" on card_discounts for all using (true) with check (true);
create policy "service_write_services" on extra_services for all using (true) with check (true);
create policy "service_write_used" on used_prices for all using (true) with check (true);
create policy "service_write_stores" on stores for all using (true) with check (true);
create policy "service_write_rebates" on store_rebates for all using (true) with check (true);
create policy "service_write_logs" on price_upload_logs for all using (true) with check (true);

-- ── updated_at 자동 갱신 트리거 ──
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger set_updated_at before update on carrier_subsidies
  for each row execute function update_updated_at();

create trigger set_updated_at before update on installment_subsidies
  for each row execute function update_updated_at();

create trigger set_updated_at before update on phones
  for each row execute function update_updated_at();

create trigger set_updated_at before update on used_prices
  for each row execute function update_updated_at();

create trigger set_updated_at before update on store_rebates
  for each row execute function update_updated_at();
