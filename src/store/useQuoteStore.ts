import { create } from 'zustand';
import type { CarrierId, ConsultationForm, DiscountType, PhoneSeries, QuoteState, SubscriptionType } from '../types';

interface QuoteActions {
  /**
   * 기기 목록(Step 4)에서 접어 둔 시리즈.
   * 비교 패널에서 타 통신사를 골랐다가 뒤로 오면 접힘 상태도 그대로여야 해서
   * 컴포넌트 로컬 state가 아니라 스토어에 둔다.
   */
  collapsedSeries: readonly PhoneSeries[];
  toggleSeries: (series: PhoneSeries) => void;
  showLanding: boolean;
  enterQuote: () => void;
  showPreorder: boolean;
  enterPreorder: () => void;
  exitPreorder: () => void;
  cardBenefitApplied: boolean;
  toggleCardBenefit: () => void;
  addonBenefitApplied: boolean;
  toggleAddonBenefit: () => void;
  setStep: (step: number) => void;
  startKidsPath: () => void;
  setBrand: (brand: string) => void;
  setSubscriptionType: (type: SubscriptionType) => void;
  setPreviousCarrier: (carrier: CarrierId) => void;
  switchCarrier: (carrier: CarrierId) => void;
  setCarrier: (carrier: CarrierId) => void;
  setPhone: (phoneId: string) => void;
  setStorage: (storage: string) => void;
  setColor: (color: string) => void;
  setPlan: (planId: string) => void;
  setDiscountType: (type: DiscountType) => void;
  toggleDiscount: (discountId: string) => void;
  set할부개월: (months: number) => void;
  setConsultation: (form: Partial<ConsultationForm>) => void;
  reset: () => void;
}

const initialConsultation: ConsultationForm = {
  name: '',
  phone: '',
  preferredTime: '상관없음',
  memo: '',
};

const initialState: QuoteState = {
  currentStep: 1,
  selectedBrand: null,
  subscriptionType: null,
  previousCarrier: null,
  carrierId: null,
  selectedPhoneId: null,
  selectedStorage: null,
  selectedColor: null,
  selectedPlanId: null,
  discountType: '공통지원금',
  selectedDiscountIds: [],
  할부개월: 24,
  consultation: initialConsultation,
};

export const useQuoteStore = create<QuoteState & QuoteActions>((set) => ({
  ...initialState,
  showLanding: true,

  enterQuote: () => set({ showLanding: false }),

  showPreorder: false,
  enterPreorder: () => set({ showPreorder: true }),
  exitPreorder: () => set({ showPreorder: false }),

  cardBenefitApplied: false,
  toggleCardBenefit: () => set((state) => ({ cardBenefitApplied: !state.cardBenefitApplied })),

  addonBenefitApplied: false,
  toggleAddonBenefit: () => set((state) => ({ addonBenefitApplied: !state.addonBenefitApplied })),

  collapsedSeries: [],
  toggleSeries: (series) =>
    set((state) => ({
      collapsedSeries: state.collapsedSeries.includes(series)
        ? state.collapsedSeries.filter((s) => s !== series)
        : [...state.collapsedSeries, series],
    })),

  setStep: (step) => set({ currentStep: step }),

  startKidsPath: () =>
    set({
      selectedBrand: '키즈',
      carrierId: null,
      subscriptionType: '신규가입',
      previousCarrier: null,
      selectedPhoneId: null,
      selectedStorage: null,
      selectedColor: null,
      selectedPlanId: null,
      selectedDiscountIds: [],
      currentStep: 3,
    }),

  setBrand: (brand) =>
    set({
      selectedBrand: brand,
      // 브랜드가 바뀌면 시리즈 구성 자체가 달라진다
      collapsedSeries: [],
      selectedPhoneId: null,
      selectedStorage: null,
      selectedColor: null,
      selectedPlanId: null,
      selectedDiscountIds: [],
    }),

  setSubscriptionType: (type) =>
    set((state) => {
      // 기기변경 선택 시: previousCarrier가 있으면 원래 통신사로 복원
      if (type === '기기변경' && state.previousCarrier) {
        return {
          subscriptionType: type,
          carrierId: state.previousCarrier,
          previousCarrier: null,
          selectedPlanId: null,
          selectedDiscountIds: [],
        };
      }
      return { subscriptionType: type, previousCarrier: null };
    }),

  setPreviousCarrier: (carrier) => set({ previousCarrier: carrier }),

  switchCarrier: (carrier) =>
    set({
      carrierId: carrier,
      selectedPlanId: null,
      selectedDiscountIds: [],
    }),

  setCarrier: (carrier) =>
    set({
      carrierId: carrier,
      previousCarrier: null,
      // 키즈 경로(selectedBrand='키즈', subscriptionType='신규가입')에서 뒤로가기 후
      // 일반 통신사 선택 시 이전 상태가 남아 step3·4가 오동작하는 버그 방지
      selectedBrand: null,
      subscriptionType: null,
      selectedPlanId: null,
      selectedDiscountIds: [],
    }),

  setPhone: (phoneId) =>
    set({
      selectedPhoneId: phoneId,
      selectedStorage: null,
      selectedColor: null,
    }),

  setStorage: (storage) => set({ selectedStorage: storage }),

  setColor: (color) => set({ selectedColor: color }),

  setPlan: (planId) => set({ selectedPlanId: planId }),

  setDiscountType: (type) => set({ discountType: type }),

  toggleDiscount: (discountId) =>
    set((state) => {
      const exists = state.selectedDiscountIds.includes(discountId);
      return {
        selectedDiscountIds: exists
          ? state.selectedDiscountIds.filter((id) => id !== discountId)
          : [...state.selectedDiscountIds, discountId],
      };
    }),

  set할부개월: (months) => set({ 할부개월: months }),

  setConsultation: (form) =>
    set((state) => ({
      consultation: { ...state.consultation, ...form },
    })),

  reset: () =>
    set({
      ...initialState,
      showLanding: true,
      showPreorder: false,
      cardBenefitApplied: false,
      addonBenefitApplied: false,
      collapsedSeries: [],
    }),
}));
