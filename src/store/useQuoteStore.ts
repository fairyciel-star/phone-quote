import { create } from 'zustand';
import type { CarrierId, ConsultationForm, DiscountType, QuoteState, SubscriptionType } from '../types';

interface QuoteActions {
  showLanding: boolean;
  enterQuote: () => void;
  setStep: (step: number) => void;
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

  setBrand: (brand) =>
    set({
      selectedBrand: brand,
      carrierId: null,
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
      selectedPhoneId: null,
      selectedStorage: null,
      selectedColor: null,
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
