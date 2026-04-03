export type SubscriptionType = '번호이동' | '기기변경';

export type CarrierId = 'SKT' | 'KT' | 'LGU';

export interface Carrier {
  readonly id: CarrierId;
  readonly name: string;
  readonly color: string;
  readonly logo: string;
}

export interface PhoneStorage {
  readonly size: string;
  readonly price: number;
}

export interface PhoneColor {
  readonly name: string;
  readonly hex: string;
}

export interface PhoneSubsidy {
  readonly [storage: string]: number;
}

export interface Phone {
  readonly id: string;
  readonly name: string;
  readonly brand: string;
  readonly image: string;
  readonly carriers: readonly CarrierId[];
  readonly storage: readonly PhoneStorage[];
  readonly colors: readonly PhoneColor[];
  readonly 공통지원금: Readonly<Record<CarrierId, PhoneSubsidy>>;
}

export interface Plan {
  readonly id: string;
  readonly carrier: CarrierId;
  readonly name: string;
  readonly monthlyFee: number;
  readonly data: string;
  readonly voice: string;
  readonly sms: string;
  readonly 선택약정할인율: number;
  readonly benefits: readonly string[];
}

export type DiscountCategory = '제휴카드' | '부가서비스';

export interface Discount {
  readonly id: string;
  readonly carrier: CarrierId;
  readonly type: DiscountCategory;
  readonly name: string;
  readonly monthlyDiscount?: number;
  readonly monthlyFee?: number;
  readonly conditions?: string;
  readonly description?: string;
  readonly 추가할인?: number;
}

export type DiscountType = '공통지원금' | '선택약정';

export interface PriceBreakdown {
  readonly 출고가: number;
  readonly 공통지원금: number;
  readonly 추가지원금: number;
  readonly 제휴카드24개월할인: number;
  readonly 부가서비스추가할인: number;
  readonly 선택약정할인: number;
  readonly 할부원금: number;
  readonly 월할부금: number;
  readonly 월요금제: number;
  readonly 월카드할인: number;
  readonly 월부가서비스료: number;
  readonly 월납입금총액: number;
  readonly 할부개월: number;
}

export interface ConsultationForm {
  readonly name: string;
  readonly phone: string;
  readonly preferredTime: string;
  readonly memo: string;
}

export interface QuoteState {
  readonly currentStep: number;
  readonly selectedBrand: string | null;
  readonly subscriptionType: SubscriptionType | null;
  readonly previousCarrier: CarrierId | null;
  readonly carrierId: CarrierId | null;
  readonly selectedPhoneId: string | null;
  readonly selectedStorage: string | null;
  readonly selectedColor: string | null;
  readonly selectedPlanId: string | null;
  readonly discountType: DiscountType;
  readonly selectedDiscountIds: readonly string[];
  readonly 할부개월: number;
  readonly consultation: ConsultationForm;
}
