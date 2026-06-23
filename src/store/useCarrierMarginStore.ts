/**
 * 통신사별 마진 스토어
 * - 1회 설정 → 해당 통신사 전체 모델에 적용
 * - localStorage 영속화
 * - 마진 단위: 만원 (예: 5 → 5만원 = 50,000원)
 */
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CarrierId } from '../types';

export interface CarrierMargins {
  SKT: number;
  KT: number;
  LGU: number;
}

interface CarrierMarginState {
  readonly margins: CarrierMargins;
  setMargin: (carrier: CarrierId, margin: number) => void;
  getMargin: (carrier: CarrierId) => number;
  /** 만원 단위 마진 → 원 단위 변환 */
  getMarginWon: (carrier: CarrierId) => number;
}

export const useCarrierMarginStore = create<CarrierMarginState>()(
  persist(
    (set, get) => ({
      margins: { SKT: 0, KT: 0, LGU: 0 },

      setMargin: (carrier, margin) =>
        set((state) => ({
          margins: { ...state.margins, [carrier]: Math.max(0, margin) },
        })),

      getMargin: (carrier) => get().margins[carrier],

      getMarginWon: (carrier) => get().margins[carrier] * 10000,
    }),
    {
      name: 'carrier-margin-store-v1',
    },
  ),
);
