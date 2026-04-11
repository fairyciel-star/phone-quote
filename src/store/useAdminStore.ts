import { create } from 'zustand';

const ADMIN_PW_KEY = 'admin_password';
const SUBSIDY_OVERRIDE_KEY = 'admin_subsidy_overrides';
const DEFAULT_PASSWORD = 'admin1234';

export type AdminTab = 'dashboard' | 'phones' | 'plans' | 'discounts' | 'settings';

export interface SubsidyOverride {
  phoneId: string;
  carrier: string;
  storage: string;
  공통지원금: number;
}

interface AdminState {
  isLoggedIn: boolean;
  activeTab: AdminTab;
  subsidyOverrides: SubsidyOverride[];
  login: (password: string) => boolean;
  logout: () => void;
  setTab: (tab: AdminTab) => void;
  changePassword: (oldPw: string, newPw: string) => boolean;
  setSubsidyOverride: (override: SubsidyOverride) => void;
  getSubsidyOverride: (phoneId: string, carrier: string, storage: string) => number | null;
  resetSubsidyOverride: (phoneId: string, carrier: string, storage: string) => void;
}

function getStoredPassword(): string {
  return localStorage.getItem(ADMIN_PW_KEY) ?? DEFAULT_PASSWORD;
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
  activeTab: 'dashboard',
  subsidyOverrides: loadOverrides(),

  login: (password) => {
    const stored = getStoredPassword();
    if (password === stored) {
      set({ isLoggedIn: true });
      return true;
    }
    return false;
  },

  logout: () => set({ isLoggedIn: false, activeTab: 'dashboard' }),

  setTab: (tab) => set({ activeTab: tab }),

  changePassword: (oldPw, newPw) => {
    if (oldPw !== getStoredPassword()) return false;
    if (newPw.length < 4) return false;
    localStorage.setItem(ADMIN_PW_KEY, newPw);
    return true;
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
