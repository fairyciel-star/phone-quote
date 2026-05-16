-- store_rebates 테이블에 요금제 구간 및 선택약정 리베이트 컬럼 추가

-- 1. 기존 데이터 삭제 (아직 테스트 단계이므로 안전)
DELETE FROM store_rebates;

-- 2. 기존 유니크 제약 제거
ALTER TABLE store_rebates DROP CONSTRAINT IF EXISTS store_rebates_store_id_model_id_carrier_storage_subscription_key;

-- 3. 새 컬럼 추가
ALTER TABLE store_rebates ADD COLUMN plan_tier text NOT NULL DEFAULT '고가' CHECK (plan_tier IN ('고가','중가','저가'));
ALTER TABLE store_rebates RENAME COLUMN rebate_amount TO subsidy_rebate;
ALTER TABLE store_rebates ADD COLUMN installment_rebate integer NOT NULL DEFAULT 0;

-- 4. 새 유니크 제약 추가
ALTER TABLE store_rebates ADD CONSTRAINT store_rebates_unique_key
  UNIQUE (store_id, model_id, carrier, storage, subscription_type, plan_tier);

-- 5. 인덱스 업데이트
DROP INDEX IF EXISTS idx_store_rebates_lookup;
CREATE INDEX idx_store_rebates_lookup
  ON store_rebates(store_id, model_id, carrier, storage, subscription_type, plan_tier);

-- 6. anon 권한 유지
GRANT ALL ON store_rebates TO anon;
GRANT ALL ON stores TO anon;
