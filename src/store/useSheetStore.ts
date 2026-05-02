import { create } from 'zustand';
import type { CarrierId, Discount, Plan, PlanTier, SubscriptionType } from '../types';
import {
  fetchSubsidies,
  fetchCardDiscounts,
  fetchPlans,
  fetchAddons,
  fetchUsedPhones,
  fetchSelectAgreementSubsidies,
  fetchKidsPhones,
  fetchPhoneMasters,
  fetchColorStorages,
  getSubsidyByTier,
  getSelectAgreementByTier,
  type SubsidyRow,
  type CardDiscountRow,
  type PlanRow,
  type AddonRow,
  type UsedPhoneRow,
  type SelectAgreementSubsidyRow,
  type KidsPhoneRow,
  type PhoneMasterRow,
  type ColorStorageRow,
} from '../utils/sheets';

interface SheetState {
  readonly loaded: boolean;
  readonly loading: boolean;
  readonly error: string | null;
  readonly subsidies: readonly SubsidyRow[];
  readonly cardDiscounts: readonly CardDiscountRow[];
  readonly plans: readonly PlanRow[];
  readonly addons: readonly AddonRow[];
  readonly usedPhones: readonly UsedPhoneRow[];
  readonly selectAgreementSubsidies: readonly SelectAgreementSubsidyRow[];
  readonly kidsPhones: readonly KidsPhoneRow[];
  readonly phoneMasters: readonly PhoneMasterRow[];
  readonly colorStorages: readonly ColorStorageRow[];
  loadFromSheet: (sheetId: string) => Promise<void>;
  // planTier: 요금제 구간 ('고가'|'중가'|'저가'). 미지정 시 '고가' 기본값 (폰 목록 프리뷰용)
  getSubsidy: (
    모델ID: string,
    통신사: CarrierId,
    용량: string,
    가입유형: SubscriptionType,
    planTier?: PlanTier
  ) => { 출고가: number; 공통지원금: number; 추가지원금: number; 특별지원: number };
  getPhoneBadge: (모델ID: string, 통신사: CarrierId) => string;
  getCardDiscountsForCarrier: (통신사: CarrierId) => Discount[];
  getPlansForCarrier: (통신사: CarrierId) => Plan[];
  getAddonsForCarrier: (통신사: CarrierId) => Discount[];
  getUsedPhonePrice: (모델ID: string, 용량: string) => UsedPhoneRow | null;
  getUsedPhoneList: () => UsedPhoneRow[];
  getStoragesForPhone: (모델ID: string, 통신사: CarrierId) => { size: string; price: number }[];
  getSelectAgreementSubsidy: (
    모델ID: string,
    통신사: CarrierId,
    용량: string,
    가입유형: SubscriptionType,
    planTier?: PlanTier
  ) => { 출고가: number; 추가지원금: number; 특별지원: number };
  getKidsPhones: () => KidsPhoneRow[];
  getColorsForPhone: (모델ID: string, 용량: string) => { name: string; hex: string; image?: string }[];
}

export const useSheetStore = create<SheetState>((set, get) => ({
  loaded: false,
  loading: false,
  error: null,
  subsidies: [],
  cardDiscounts: [],
  plans: [],
  addons: [],
  usedPhones: [],
  selectAgreementSubsidies: [],
  kidsPhones: [],
  phoneMasters: [],
  colorStorages: [],

  loadFromSheet: async (sheetId: string) => {
    set({ loading: true, error: null });
    try {
      const results = await Promise.allSettled([
        fetchSubsidies(sheetId),
        fetchCardDiscounts(sheetId),
        fetchPlans(sheetId),
        fetchAddons(sheetId),
        fetchUsedPhones(sheetId),
        fetchSelectAgreementSubsidies(sheetId),
        fetchKidsPhones(sheetId),
        fetchPhoneMasters(sheetId),
        fetchColorStorages(sheetId),
      ]);

      const subsidies = results[0].status === 'fulfilled' ? results[0].value : [];
      const kidsPhones = results[6].status === 'fulfilled' ? results[6].value : [];

      set({
        subsidies,
        cardDiscounts: results[1].status === 'fulfilled' ? results[1].value : [],
        plans: results[2].status === 'fulfilled' ? results[2].value : [],
        addons: results[3].status === 'fulfilled' ? results[3].value : [],
        usedPhones: results[4].status === 'fulfilled' ? results[4].value : [],
        selectAgreementSubsidies: results[5].status === 'fulfilled' ? results[5].value : [],
        kidsPhones,
        phoneMasters: results[7].status === 'fulfilled' ? results[7].value : [],
        colorStorages: results[8].status === 'fulfilled' ? results[8].value : [],
        loaded: true,
        loading: false,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : '시트 로딩 실패';
      set({ error: message, loading: false });
    }
  },

  getSubsidy: (모델ID, 통신사, 용량, 가입유형, planTier = '고가') => {
    const row = get().subsidies.find(
      (r) => r.모델ID === 모델ID && r.통신사 === 통신사 && r.용량 === 용량 && r.가입유형 === 가입유형
    );

    // 출고가: 색상_용량 시트 우선, 없으면 0 (price.ts가 phones.json 폴백 처리)
    const 출고가 = get().colorStorages.find(
      (r) => r.모델ID === 모델ID && r.용량 === 용량
    )?.출고가 ?? 0;

    const tier = getSubsidyByTier(row, planTier);
    return {
      출고가,
      공통지원금: tier.공시지원금,
      추가지원금: tier.추가지원금,
      특별지원: tier.특별지원금,
    };
  },

  getPhoneBadge: (모델ID, 통신사) => {
    // 휴대폰_마스터 시트 우선
    const master = get().phoneMasters.find((r) => r.모델ID === 모델ID);
    if (master) return master.배지;
    // 하위 호환: 키즈전용 시트에서 배지 읽기
    const kidsRow = get().kidsPhones.find((r) => r.모델ID === 모델ID && r.통신사 === 통신사);
    return kidsRow?.배지 ?? '';
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
        구간: r.구간,
        카테고리: r.카테고리,
        name: r.요금제명,
        monthlyFee: r.월요금,
        data: r.데이터,
        voice: r.통화,
        sms: r.문자,
        선택약정할인율: r.선택약정할인율,
        benefits: r.혜택 ? r.혜택.split(',').map((s) => s.trim()).filter(Boolean) : [],
      }));
  },

  getUsedPhonePrice: (모델ID, 용량) => {
    return get().usedPhones.find(
      (r) => r.모델ID === 모델ID && r.용량 === 용량
    ) ?? null;
  },

  getUsedPhoneList: () => {
    return [...get().usedPhones];
  },

  getStoragesForPhone: (모델ID, 통신사) => {
    // 색상_용량 시트 우선 (출고가 포함)
    const colorRows = get().colorStorages.filter((r) => r.모델ID === 모델ID);
    if (colorRows.length > 0) {
      const seen = new Set<string>();
      const result: { size: string; price: number }[] = [];
      for (const row of colorRows) {
        if (row.용량 && !seen.has(row.용량)) {
          seen.add(row.용량);
          result.push({ size: row.용량, price: row.출고가 });
        }
      }
      return result;
    }

    // 폴백: 공시지원금 시트에서 용량 목록만 추출 (출고가 0)
    const rows = get().subsidies.filter(
      (r) => r.모델ID === 모델ID && r.통신사 === 통신사
    );
    const seen = new Set<string>();
    const result: { size: string; price: number }[] = [];
    for (const row of rows) {
      if (row.용량 && !seen.has(row.용량)) {
        seen.add(row.용량);
        result.push({ size: row.용량, price: 0 });
      }
    }
    return result;
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

  getSelectAgreementSubsidy: (모델ID, 통신사, 용량, 가입유형, planTier = '고가') => {
    const saRow = get().selectAgreementSubsidies.find(
      (r) => r.모델ID === 모델ID && r.통신사 === 통신사 && r.용량 === 용량 && r.가입유형 === 가입유형
    );

    const 출고가 = get().colorStorages.find(
      (r) => r.모델ID === 모델ID && r.용량 === 용량
    )?.출고가 ?? 0;

    const tier = getSelectAgreementByTier(saRow, planTier);
    return {
      출고가,
      추가지원금: tier.추가지원금,
      특별지원: tier.특별지원금,
    };
  },

  getKidsPhones: () => [...get().kidsPhones],

  getColorsForPhone: (모델ID, 용량) => {
    return get().colorStorages
      .filter((r) => r.모델ID === 모델ID && r.용량 === 용량)
      .map((r) => ({
        name: r.색상명,
        hex: r.색상HEX,
        image: r.색상이미지URL || undefined,
      }));
  },
}));
