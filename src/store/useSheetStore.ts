import { create } from 'zustand';
import type { CarrierId, Discount, Plan, PlanTier, SubscriptionType } from '../types';
import {
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
import { usePriceTableStore } from './usePriceTableStore';

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
  setLoaded: () => void;
  // planTier: 요금제 구간 ('고가'|'중가'|'저가'). 미지정 시 '고가' 기본값 (폰 목록 프리뷰용)
  getSubsidy: (
    모델ID: string,
    통신사: CarrierId,
    용량: string,
    가입유형: SubscriptionType,
    planTier?: PlanTier
  ) => { 출고가: number; 공통지원금: number; 추가지원금: number; 특별지원: number; isPriceTableData?: boolean };
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

  loadFromSheet: async (_sheetId: string) => {
    // 새 구글 시트 연동은 App.tsx에서 usePriceTableStore.loadAll()로 직접 처리
    // 이 함수는 loaded 상태만 동기화
    set({ loaded: usePriceTableStore.getState().sktRows.length > 0, loading: false });
  },

  setLoaded: () => {
    set({ loaded: true });
  },

  getSubsidy: (모델ID, 통신사, 용량, 가입유형, _planTier = '고가') => {
    // 단가표 스토어에서 합계 가격 우선 조회
    const ptData = usePriceTableStore.getState().getSubsidyData(모델ID, 통신사, 용량, 가입유형);
    if (ptData.출고가 > 0) return ptData;

    // 폴백: 기존 시트 데이터 (subsidies가 빈 경우 0 반환)
    const row = get().subsidies.find(
      (r) => r.모델ID === 모델ID && r.통신사 === 통신사 && r.용량 === 용량 && r.가입유형 === 가입유형
    );
    const 출고가 = get().colorStorages.find(
      (r) => r.모델ID === 모델ID && r.용량 === 용량
    )?.출고가 ?? 0;
    const tier = getSubsidyByTier(row, _planTier);
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
