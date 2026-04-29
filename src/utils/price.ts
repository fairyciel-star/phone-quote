import type { CarrierId, Discount, DiscountType, Phone, Plan, PriceBreakdown, SubscriptionType } from '../types';

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

/**
 * 공통지원금 + 추가지원금 + 특별지원금 합산 기준으로 기기 실구매 최저가를 계산한다.
 * 모든 통신사(또는 선택된 통신사), 용량, 가입유형 조합 중
 * 출고가 - (공통지원금 + 추가지원금 + 특별지원) 의 최솟값을 반환한다.
 */
export interface LowestCondition {
  readonly carrierId: CarrierId;
  readonly subscriptionType: SubscriptionType;
}

export interface LowestDevicePriceResult {
  readonly price: number;
  readonly carrierId: CarrierId | null;
  readonly subscriptionType: SubscriptionType | null;
  readonly retailPrice: number;
  readonly totalSubsidy: number;
  readonly conditions: readonly LowestCondition[];
}

export function calculateLowestDevicePrice(params: {
  phone: Phone;
  carriers: readonly CarrierId[];
  subscriptionType?: SubscriptionType | null;
  getSubsidy?: (
    모델ID: string,
    통신사: CarrierId,
    용량: string,
    가입유형: SubscriptionType
  ) => { 출고가: number; 공통지원금: number; 추가지원금: number; 특별지원: number };
  sheetLoaded?: boolean;
}): LowestDevicePriceResult {
  const { phone, carriers, subscriptionType, getSubsidy, sheetLoaded } = params;
  // 가입유형이 지정된 경우 해당 유형만 계산, 아니면 전체 유형 중 최저가
  const subscriptionTypes: SubscriptionType[] = subscriptionType ? [subscriptionType] : ['번호이동', '기기변경'];

  let lowest = Infinity;
  let lowestRetailPrice = 0;
  let lowestTotalSubsidy = 0;
  const matchMap = new Map<string, LowestCondition>();

  for (const carrierId of carriers) {
    for (const storageOption of phone.storage) {
      for (const subType of subscriptionTypes) {
        let 출고가 = storageOption.price;
        let 공통지원금 = phone.공통지원금[carrierId as keyof typeof phone.공통지원금]?.[storageOption.size] ?? 0;
        let 추가지원금 = 0;
        let 특별지원 = 0;

        if (sheetLoaded && getSubsidy) {
          const sheet = getSubsidy(phone.id, carrierId, storageOption.size, subType);
          if (sheet.출고가 > 0) 출고가 = sheet.출고가;
          if (sheet.공통지원금 > 0) 공통지원금 = sheet.공통지원금;
          if (sheet.추가지원금 > 0) 추가지원금 = sheet.추가지원금;
          if (sheet.특별지원 > 0) 특별지원 = sheet.특별지원;
        }

        if (출고가 === 0) continue;

        const 실구매가 = Math.max(0, 출고가 - 공통지원금 - 추가지원금 - 특별지원);
        if (실구매가 < lowest) {
          lowest = 실구매가;
          lowestRetailPrice = 출고가;
          lowestTotalSubsidy = 공통지원금 + 추가지원금 + 특별지원;
          matchMap.clear();
        }
        if (실구매가 === lowest) {
          const key = `${carrierId}:${subType}`;
          if (!matchMap.has(key)) matchMap.set(key, { carrierId, subscriptionType: subType });
        }
      }
    }
  }

  const conditions = [...matchMap.values()];
  return {
    price: lowest === Infinity ? 0 : lowest,
    carrierId: conditions[0]?.carrierId ?? null,
    subscriptionType: conditions[0]?.subscriptionType ?? null,
    retailPrice: lowestRetailPrice,
    totalSubsidy: lowestTotalSubsidy,
    conditions,
  };
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
  특별지원Override?: number;
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
  const 특별지원Raw = params.특별지원Override ?? 0;

  const 공통지원금 = discountType === '공통지원금' ? 공통지원금Raw : 0;
  const 추가지원금 = 추가지원금Raw;
  // 특별지원은 할인유형(공통지원금/선택약정) 무관하게 항상 적용
  const 특별지원 = 특별지원Raw;

  // 제휴카드 24개월 합산 할인
  const cardDiscounts = selectedDiscounts.filter((d) => d.type === '제휴카드');
  const 월카드할인 = cardDiscounts.reduce((sum, d) => sum + (d.monthlyDiscount ?? 0), 0);
  const 제휴카드24개월할인 = 월카드할인 * 24;

  // 부가서비스 추가할인 합산
  const addons = selectedDiscounts.filter((d) => d.type === '부가서비스');
  const 부가서비스추가할인 = addons.reduce((sum, d) => sum + (d.추가할인 ?? 0), 0);
  const 월부가서비스료 = addons.reduce((sum, d) => sum + (d.monthlyFee ?? 0), 0);

  // 할부원금 = 출고가 - 공통지원금 - 추가지원금 - 특별지원 - 제휴카드24개월할인 - 부가서비스추가할인
  const base할부원금 = 출고가 - 공통지원금 - 추가지원금 - 특별지원;
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
    특별지원,
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
