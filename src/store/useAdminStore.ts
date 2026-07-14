import { create } from 'zustand';
import { supabase, isSupabaseConfigured } from '../lib/supabase';

const SUBSIDY_OVERRIDE_KEY = 'admin_subsidy_overrides';

export type AdminTab = 'dashboard' | 'price-table' | 'rebates' | 'phones' | 'plans' | 'discounts' | 'sheet-debug' | 'settings';

export interface SubsidyOverride {
  phoneId: string;
  carrier: string;
  storage: string;
  공통지원금: number;
}

interface AdminState {
  isLoggedIn: boolean;
  authChecked: boolean;
  activeTab: AdminTab;
  subsidyOverrides: SubsidyOverride[];
  login: (email: string, password: string) => Promise<{ ok: boolean; message?: string }>;
  logout: () => Promise<void>;
  restoreSession: () => Promise<void>;
  setTab: (tab: AdminTab) => void;
  changePassword: (newPw: string) => Promise<{ ok: boolean; message: string }>;
  setSubsidyOverride: (override: SubsidyOverride) => void;
  getSubsidyOverride: (phoneId: string, carrier: string, storage: string) => number | null;
  resetSubsidyOverride: (phoneId: string, carrier: string, storage: string) => void;
}

function loadOverrides(): SubsidyOverride[] {
  try {
    const raw = localStorage.getItem(SUBSIDY_OVERRIDE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SubsidyOverride[];
  } catch {
    return [];
  }
}

function saveOverrides(overrides: SubsidyOverride[]) {
  localStorage.setItem(SUBSIDY_OVERRIDE_KEY, JSON.stringify(overrides));
}

export const useAdminStore = create<AdminState>((set, get) => ({
  isLoggedIn: false,
  authChecked: false,
  activeTab: 'dashboard',
  subsidyOverrides: loadOverrides(),

  // Supabase Auth 기반 로그인 — 서버가 자격 증명을 검증하고,
  // 발급된 세션 JWT가 RLS 정책(authenticated 전용 쓰기)의 근거가 된다.
  login: async (email, password) => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: 'Supabase가 설정되지 않아 관리자 로그인을 사용할 수 없습니다' };
    }
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error || !data.session) {
      return { ok: false, message: '이메일 또는 비밀번호가 올바르지 않습니다' };
    }
    set({ isLoggedIn: true });
    return { ok: true };
  },

  logout: async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut();
    }
    set({ isLoggedIn: false, activeTab: 'dashboard' });
  },

  // 새로고침 시 기존 Supabase 세션 복원
  restoreSession: async () => {
    if (!isSupabaseConfigured()) {
      set({ authChecked: true });
      return;
    }
    try {
      const { data } = await supabase.auth.getSession();
      set({ isLoggedIn: !!data.session, authChecked: true });
    } catch {
      set({ authChecked: true });
    }
  },

  setTab: (tab) => set({ activeTab: tab }),

  changePassword: async (newPw) => {
    if (!isSupabaseConfigured()) {
      return { ok: false, message: 'Supabase가 설정되지 않았습니다' };
    }
    if (newPw.length < 6) {
      return { ok: false, message: '비밀번호는 6자 이상이어야 합니다' };
    }
    const { error } = await supabase.auth.updateUser({ password: newPw });
    if (error) {
      return { ok: false, message: `변경 실패: ${error.message}` };
    }
    return { ok: true, message: '비밀번호가 변경되었습니다' };
  },

  setSubsidyOverride: (override) => {
    const current = get().subsidyOverrides;
    const idx = current.findIndex(
      (o) => o.phoneId === override.phoneId && o.carrier === override.carrier && o.storage === override.storage
    );
    let updated: SubsidyOverride[];
    if (idx >= 0) {
      updated = current.map((o, i) => (i === idx ? override : o));
    } else {
      updated = [...current, override];
    }
    saveOverrides(updated);
    set({ subsidyOverrides: updated });
  },

  getSubsidyOverride: (phoneId, carrier, storage) => {
    const found = get().subsidyOverrides.find(
      (o) => o.phoneId === phoneId && o.carrier === carrier && o.storage === storage
    );
    return found?.공통지원금 ?? null;
  },

  resetSubsidyOverride: (phoneId, carrier, storage) => {
    const updated = get().subsidyOverrides.filter(
      (o) => !(o.phoneId === phoneId && o.carrier === carrier && o.storage === storage)
    );
    saveOverrides(updated);
    set({ subsidyOverrides: updated });
  },
}));
