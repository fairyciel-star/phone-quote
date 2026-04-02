import type { Discount, DiscountType, Phone, Plan, PriceBreakdown } from '../types';

export function calculate할부원금(
  출고가: number,
  공통지원금: number,
  추가지원금: number,
  discountType: DiscountType
): number {
  if (discountType === '공통지원금') {
    return 출고가 - 공통지원금 - 추가지원금;
  }
  return 출고가 - 추가지원금;
}

const 연이율 = 0.059;

export function calculate월할부금(할부원금: number, months: number): number {
  if (months <= 0) return 할부원금;
  if (할부원금 <= 0) return 0;
  const 월이율 = 연이율 / 12;
  const factor = Math.pow(1 + 월이율, months);
  return Math.round(할부원금 * (월이율 * factor) / (factor - 1));
}

export function calculate선택약정할인(
  monthlyFee: number,
  할인율: number
): number {
  return Math.floor(monthlyFee * 할인율);
}

export function calculateFullQuote(params: {
  phone: Phone;
  storage: string;
  carrierId: string;
  plan: Plan;
  discountType: DiscountType;
  selectedDiscounts: readonly Discount[];
  할부개월: number;
  출고가Override?: number;
  공통지원금Override?: number;
  추가지원금Override?: number;
}): PriceBreakdown {
  const { phone, storage, carrierId, plan, discountType, selectedDiscounts, 할부개월 } = params;

  const storageOption = phone.storage.find((s) => s.size === storage);
  const json출고가 = storageOption?.price ?? 0;
  const 출고가 = (params.출고가Override && params.출고가Override > 0) ? params.출고가Override : json출고가;

  // 시트 데이터가 있으면 오버라이드, 없으면 JSON 폴백
  const carrierSubsidy = phone.공통지원금[carrierId as keyof typeof phone.공통지원금];
  const json공통지원금 = carrierSubsidy?.[storage] ?? 0;

  const 공통지원금Raw = params.공통지원금Override ?? json공통지원금;
  const 추가지원금Raw = params.추가지원금Override ?? 0;

  const 공통지원금 = discountType === '공통지원금' ? 공통지원금Raw : 0;
  const 추가지원금 = 추가지원금Raw;

  // 제휴카드 24개월 합산 할인
  const cardDiscounts = selectedDiscounts.filter((d) => d.type === '제휴카드');
  const 월카드할인 = cardDiscounts.reduce((sum, d) => sum + (d.monthlyDiscount ?? 0), 0);
  const 제휴카드24개월할인 = 월카드할인 * 24;

  // 부가서비스 추가할인 합산
  const addons = selectedDiscounts.filter((d) => d.type === '부가서비스');
  const 부가서비스추가할인 = addons.reduce((sum, d) => sum + (d.추가할인 ?? 0), 0);
  const 월부가서비스료 = addons.reduce((sum, d) => sum + (d.monthlyFee ?? 0), 0);

  // 할부원금 = 출고가 - 공통지원금 - 추가지원금(매장지원금) - 제휴카드24개월할인 - 부가서비스추가할인
  const base할부원금 = calculate할부원금(출고가, 공통지원금, 추가지원금, discountType);
  const 할부원금 = Math.max(0, base할부원금 - 제휴카드24개월할인 - 부가서비스추가할인);
  const 월할부금 = calculate월할부금(할부원금, 할부개월);

  const 선택약정할인 =
    discountType === '선택약정'
      ? calculate선택약정할인(plan.monthlyFee, plan.선택약정할인율)
      : 0;

  const 월요금제 = plan.monthlyFee - 선택약정할인;

  const 월납입금총액 = 월할부금 + 월요금제 + 월부가서비스료;

  return {
    출고가,
    공통지원금,
    추가지원금,
    제휴카드24개월할인,
    부가서비스추가할인,
    선택약정할인,
    할부원금,
    월할부금,
    월요금제,
    월카드할인,
    월부가서비스료,
    월납입금총액,
    할부개월,
  };
}
