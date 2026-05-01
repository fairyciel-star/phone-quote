import { create } from 'zustand';
import type { CarrierId, ConsultationForm, DiscountType, QuoteState, SubscriptionType } from '../types';

interface QuoteActions {
  showLanding: boolean;
  enterQuote: () => void;
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
      currentStep: 4,
    }),

  setBrand: (brand) =>
    set({
      selectedBrand: brand,
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
      // 현재 통신사를 새로 지정할 때는 번호이동용 원래 통신사 기록을 초기화
      // (Step2에서 통신사를 변경한 뒤 Step1의 "변경할 통신사" 목록이
      //  stale previousCarrier로 잘못 필터링되는 버그 방지)
      previousCarrier: null,
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

  reset: () => set({ ...initialState, showLanding: true }),
}));
