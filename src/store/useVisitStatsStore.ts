import { create } from 'zustand';
import { supabaseUntyped, isSupabaseConfigured } from '../lib/supabase';
import type { VisitStatRow } from '../lib/supabase-types';

/** 통계 조회 기간 (일) */
export const STATS_DAYS = 30;

interface VisitStatsState {
  /** 최근 STATS_DAYS 일의 일자별 집계 (최신 날짜가 앞) */
  readonly daily: readonly VisitStatRow[];
  /** 전체 기간 누적 방문 수 */
  readonly totalVisits: number;
  readonly loading: boolean;
  readonly loaded: boolean;
  readonly error: string | null;
  readonly refresh: () => Promise<void>;
}

async function fetchDaily(): Promise<VisitStatRow[]> {
  const { data, error } = await supabaseUntyped.rpc('visit_stats', { days: STATS_DAYS });
  if (error) throw new Error(error.message);
  return (data as VisitStatRow[] | null) ?? [];
}

async function fetchTotal(): Promise<number> {
  // head: true — 행은 받지 않고 개수만 세어 온다
  const { count, error } = await supabaseUntyped
    .from('page_visits')
    .select('*', { count: 'exact', head: true });
  if (error) throw new Error(error.message);
  return count ?? 0;
}

export const useVisitStatsStore = create<VisitStatsState>((set) => ({
  daily: [],
  totalVisits: 0,
  loading: false,
  loaded: false,
  error: null,

  refresh: async () => {
    if (!isSupabaseConfigured()) {
      set({ loading: false, loaded: true, error: 'Supabase가 설정되지 않았습니다' });
      return;
    }
    set({ loading: true, error: null });
    try {
      const [daily, totalVisits] = await Promise.all([fetchDaily(), fetchTotal()]);
      set({ daily, totalVisits, loading: false, loaded: true, error: null });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : '방문 통계를 불러오지 못했습니다';
      set({ loading: false, loaded: true, error: message });
    }
  },
}));
