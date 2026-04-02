import { create } from 'zustand';
import type { CarrierId, Discount, Plan, SubscriptionType } from '../types';
import {
  fetchSubsidies,
  fetchCardDiscounts,
  fetchPlans,
  fetchAddons,
  type SubsidyRow,
  type CardDiscountRow,
  type PlanRow,
  type AddonRow,
} from '../utils/sheets';

interface SheetState {
  readonly loaded: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly subsidies: readonly SubsidyRow[];
  readonly cardDiscounts: readonly CardDiscountRow[];
  readonly plans: readonly PlanRow[];
  readonly addons: readonly AddonRow[];
  loadFromSheet: (sheetId: string) => Promise<void>;
  getSubsidy: (모델ID: string, 통신사: CarrierId, 용량: string, 가입유형: SubscriptionType) => { 출고가: number; 공통지원금: number; 추가지원금: number; 특별지원: number };
  getPhoneBadge: (모델ID: string, 통신사: CarrierId) => string;
  getCardDiscountsForCarrier: (통신사: CarrierId) => Discount[];
  getPlansForCarrier: (통신사: CarrierId) => Plan[];
  getAddonsForCarrier: (통신사: CarrierId) => Discount[];
}

export const useSheetStore = create<SheetState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  subsidies: [],
  cardDiscounts: [],
  plans: [],
  addons: [],

  loadFromSheet: async (sheetId: string) => {
    set({ loading: true, error: null });
    try {
      const results = await Promise.allSettled([
        fetchSubsidies(sheetId),
        fetchCardDiscounts(sheetId),
        fetchPlans(sheetId),
        fetchAddons(sheetId),
      ]);

      set({
        subsidies: results[0].status === 'fulfilled' ? results[0].value : [],
        cardDiscounts: results[1].status === 'fulfilled' ? results[1].value : [],
        plans: results[2].status === 'fulfilled' ? results[2].value : [],
        addons: results[3].status === 'fulfilled' ? results[3].value : [],
        loaded: true,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '시트 로딩 실패';
      set({ error: message, loading: false });
    }
  },

  getSubsidy: (모델ID, 통신사, 용량, 가입유형) => {
    const row = get().subsidies.find(
      (r) => r.모델ID === 모델ID && r.통신사 === 통신사 && r.용량 === 용량 && r.가입유형 === 가입유형
    );
    return {
      출고가: row?.출고가 ?? 0,
      공통지원금: row?.공통지원금 ?? 0,
      추가지원금: row?.추가지원금 ?? 0,
      특별지원: row?.특별지원 ?? 0,
    };
  },

  getPhoneBadge: (모델ID, 통신사) => {
    const row = get().subsidies.find(
      (r) => r.모델ID === 모델ID && r.통신사 === 통신사 && r.배지
    );
    return row?.배지 ?? '';
  },

  getCardDiscountsForCarrier: (통신사) => {
    return get().cardDiscounts
      .filter((r) => r.통신사 === 통신사)
      .map((r) => ({
        id: r.id,
        carrier: r.통신사,
        type: '제휴카드' as const,
        name: r.카드명,
        monthlyDiscount: r.월할인금액,
        conditions: r.조건,
      }));
  },

  getPlansForCarrier: (통신사) => {
    return get().plans
      .filter((r) => r.통신사 === 통신사)
      .map((r) => ({
        id: r.id,
        carrier: r.통신사,
        name: r.요금제명,
        monthlyFee: r.월요금,
        data: r.데이터,
        voice: r.통화,
        sms: r.문자,
        선택약정할인율: r.선택약정할인율,
        benefits: r.혜택 ? r.혜택.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }));
  },

  getAddonsForCarrier: (통신사) => {
    return get().addons
      .filter((r) => r.통신사 === 통신사)
      .map((r) => ({
        id: r.id,
        carrier: r.통신사,
        type: '부가서비스' as const,
        name: r.서비스명,
        monthlyFee: r.월요금,
        추가할인: r.추가할인,
        description: r.설명,
      }));
  },
}));
