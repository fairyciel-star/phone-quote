import { create } from 'zustand';
import { loadAllRebates, invalidateRebateCache, type StoreRebate } from '../lib/supabase-rebate';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

export interface RebateRecord {
  readonly id: number;
  readonly model_id: string;
  readonly carrier: string;
  readonly storage: string;
  readonly subscription_type: string;
  readonly plan_tier: string;
  readonly subsidy_rebate: number;
  readonly installment_rebate: number;
  readonly margin: number;
  readonly updated_at: string;
}

interface RebateState {
  readonly rebateMap: Map<string, StoreRebate>;
  /** 원시 행 배열 — carrier + model_id + plan_tier 부분 조회용 */
  readonly rows: readonly RebateRecord[];
  readonly loading: boolean;
  readonly loaded: boolean;
  readonly refresh: () => Promise<void>;
  /** 저장/삭제 후 호출: 캐시 무효화 후 재로드 */
  readonly reload: () => Promise<void>;
  /** carrier + model_id + plan_tier 기준으로 등록된 리베이트 목록 반환 */
  readonly getByModelTier: (
    carrier: string,
    modelId: string,
    planTier: string,
  ) => readonly RebateRecord[];
  /** 번호이동 우선으로 가장 높은 공시 리베이트를 가진 행 반환 */
  readonly getBestByModelTier: (
    carrier: string,
    modelId: string,
    planTier: string,
  ) => RebateRecord | null;
}

async function fetchRows(): Promise<RebateRecord[]> {
  if (!isSupabaseConfigured()) return [];
  const { data } = await supabase
    .from('store_rebates')
    .select('*')
    .order('updated_at', { ascending: false });
  return (data as RebateRecord[]) ?? [];
}

export const useRebateStore = create<RebateState>((set, get) => ({
  rebateMap: new Map(),
  rows: [],
  loading: false,
  loaded: false,

  refresh: async () => {
    set({ loading: true });
    const [map, rows] = await Promise.all([loadAllRebates(), fetchRows()]);
    set({ rebateMap: new Map(map), rows, loading: false, loaded: true });
  },

  reload: async () => {
    invalidateRebateCache();
    set({ loading: true });
    const [map, rows] = await Promise.all([loadAllRebates(), fetchRows()]);
    set({ rebateMap: new Map(map), rows, loading: false, loaded: true });
  },

  getByModelTier: (carrier, modelId, planTier) =>
    get().rows.filter(
      (r) => r.carrier === carrier && r.model_id === modelId && r.plan_tier === planTier,
    ),

  getBestByModelTier: (carrier, modelId, planTier) => {
    const list = get().rows.filter(
      (r) => r.carrier === carrier && r.model_id === modelId && r.plan_tier === planTier,
    );
    if (list.length === 0) return null;
    const mnp = list.find((r) => r.subscription_type === '번호이동');
    return (
      mnp ??
      list.reduce((a, b) => (a.subsidy_rebate >= b.subsidy_rebate ? a : b))
    );
  },
}));
