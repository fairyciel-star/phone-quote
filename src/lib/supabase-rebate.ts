import { supabase, isSupabaseConfigured } from './supabase';

export interface StoreRebate {
  readonly subsidy_rebate: number;
  readonly installment_rebate: number;
}

const EMPTY_REBATE: StoreRebate = { subsidy_rebate: 0, installment_rebate: 0 };
const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

let cache: Map<string, StoreRebate> | null = null;
let cacheTimestamp = 0;
const CACHE_TTL = 30_000;

export let lastLoadError: string | null = null;
export let lastLoadCount = 0;
export let lastRebateUpdatedAt: string | null = null;

function cacheKey(modelId: string, carrier: string, storage: string, subscriptionType: string, planTier: string): string {
  return `${modelId}|${carrier}|${storage}|${subscriptionType}|${planTier}`;
}

export async function loadAllRebates(): Promise<Map<string, StoreRebate>> {
  if (cache && Date.now() - cacheTimestamp < CACHE_TTL) {
    return cache;
  }

  if (!isSupabaseConfigured()) {
    lastLoadError = 'Supabase 미설정';
    lastLoadCount = 0;
    cache = new Map();
    cacheTimestamp = Date.now();
    return cache;
  }

  const { data, error } = await supabase
    .from('store_rebates')
    .select('*')
    .eq('store_id', DEFAULT_STORE_ID);

  const map = new Map<string, StoreRebate>();

  if (error) {
    lastLoadError = error.message;
    lastLoadCount = 0;
  } else {
    lastLoadError = null;
    const rows = (data ?? []) as unknown as Record<string, unknown>[];
    lastLoadCount = rows.length;

    // 최신 수정 시간 추적
    let maxUpdated = '';
    for (const row of rows) {
      const updatedAt = String(row.updated_at ?? row.created_at ?? '');
      if (updatedAt > maxUpdated) maxUpdated = updatedAt;
    }
    lastRebateUpdatedAt = maxUpdated || null;

    for (const row of rows) {
      const modelId = String(row.model_id ?? '');
      const carrier = String(row.carrier ?? '');
      const storage = String(row.storage ?? '');
      const subscriptionType = String(row.subscription_type ?? '');
      const planTier = String(row.plan_tier ?? '고가');
      const subsidyRebate = Number(row.subsidy_rebate ?? 0);
      const installmentRebate = Number(row.installment_rebate ?? 0);

      const key = cacheKey(modelId, carrier, storage, subscriptionType, planTier);
      map.set(key, {
        subsidy_rebate: subsidyRebate,
        installment_rebate: installmentRebate,
      });
    }
  }

  cache = map;
  cacheTimestamp = Date.now();
  return map;
}

export function getRebate(
  rebateMap: Map<string, StoreRebate>,
  modelId: string,
  carrier: string,
  storage: string,
  subscriptionType: string,
  planTier: string,
): StoreRebate {
  return rebateMap.get(cacheKey(modelId, carrier, storage, subscriptionType, planTier)) ?? EMPTY_REBATE;
}

export function invalidateRebateCache(): void {
  cache = null;
  cacheTimestamp = 0;
}
