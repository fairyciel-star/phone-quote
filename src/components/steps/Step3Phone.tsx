import { useEffect, useMemo, useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import phonesData from '../../data/phones.json';
import carriersData from '../../data/carriers.json';
import type { Phone, SubscriptionType, DiscountType } from '../../types';
import type { CarrierId } from '../../types';
import { formatWon } from '../../utils/format';
import { hapticMedium } from '../../utils/haptic';
import { calculateLowestDevicePrice, applyBenefitDiscount } from '../../utils/price';
import { EMPTY_BENEFITS } from '../../utils/sheets';
import { useRebateStore } from '../../store/useRebateStore';
import { usePriceTableStore } from '../../store/usePriceTableStore';
import styles from './Step3Phone.module.css';
import KakaoAlertBanner from '../KakaoAlertBanner';
import BenefitToggleBar from '../BenefitToggleBar';

const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_xmpfxcn';
const KAKAO_ALERT_DISMISSED_KEY = 'kakaoAlertDismissed';

const phones = phonesData as unknown as Phone[];

// 비교 패널에서 타 통신사 선택 전 원래 상태 보존 (뒤로가기 시 복원용)
let _comparisonPrevState: { carrierId: CarrierId; subscriptionType: SubscriptionType } | null = null;

const KIDS_MODEL_INFO: Record<string, { name: string; imageId: string; emoji: string }> = {
  'galaxy-a175n-zem': { name: '포켓피스', imageId: 'a175n_zem', emoji: '🐣' },
  'galaxy-a175n-kp': { name: '폼폼푸린', imageId: 'a175nk-kp', emoji: '🍮' },
  'galaxy-a175n-m2': { name: '무너2', imageId: 'a175n-m2', emoji: '🐰' },
};

type BrandFilter = '전체' | '삼성' | 'Apple';

interface Alternative {
  carrierId: CarrierId;
  price: number;
  hasPrice: boolean;
  savings: number;
  storage: string | null;
  priceInquiry: boolean;
}

interface ComparisonData {
  currentPrice: number;
  currentPriceInquiry: boolean;
  alternatives: Alternative[];
}

export function Step3Phone() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const subscriptionType = useQuoteStore((s) => s.subscriptionType);
  const selectedPhoneId = useQuoteStore((s) => s.selectedPhoneId);
  const setPhone = useQuoteStore((s) => s.setPhone);
  const setStorage = useQuoteStore((s) => s.setStorage);
  const setColor = useQuoteStore((s) => s.setColor);
  const switchCarrier = useQuoteStore((s) => s.switchCarrier);
  const setSubscriptionType = useQuoteStore((s) => s.setSubscriptionType);
  const cardBenefitApplied = useQuoteStore((s) => s.cardBenefitApplied);
  const toggleCardBenefit = useQuoteStore((s) => s.toggleCardBenefit);
  const addonBenefitApplied = useQuoteStore((s) => s.addonBenefitApplied);
  const toggleAddonBenefit = useQuoteStore((s) => s.toggleAddonBenefit);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);
  const getSelectAgreementSubsidy = useSheetStore((s) => s.getSelectAgreementSubsidy);
  const isSubsidyUp = useSheetStore((s) => s.isSubsidyUp);
  const kidsPhones = useSheetStore((s) => s.kidsPhones);
  const phoneMasters = useSheetStore((s) => s.phoneMasters);
  const colorStorages = useSheetStore((s) => s.colorStorages);
  // 혜택 조건은 통신사 단가표 탭 우측(S~U열)에서 읽어온 값을 그대로 사용한다.
  // 시트의 '금액'은 이미 기기값에서 차감할 최종 할인액이라 별도 환산이 필요 없다.
  const benefitsByCarrier = usePriceTableStore((s) => s.benefits);
  const carrierBenefits = carrierId
    ? benefitsByCarrier?.[carrierId] ?? EMPTY_BENEFITS
    : EMPTY_BENEFITS;
  // 제휴카드는 설명을 노출하지 않고, 부가서비스는 유지 조건만 노출한다
  const cardBenefit = carrierBenefits.제휴카드;
  const addonBenefit = carrierBenefits.부가서비스;

  // 스위치 ON 상태인 조건들의 할인액 합계
  const benefitDiscount =
    (cardBenefitApplied ? cardBenefit.amount : 0) +
    (addonBenefitApplied ? addonBenefit.amount : 0);
  const benefitApplied = benefitDiscount > 0;

  // 할인액이 기기값보다 크면 마이너스 그대로 두고 페이백으로 안내한다 (10% 차감 후 지급)
  const applyBenefit = (price: number) => applyBenefitDiscount(price, benefitDiscount);

  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(
    selectedBrand === '삼성' ? '삼성' : selectedBrand === 'Apple' ? 'Apple' : '전체'
  );
  const [sortByPrice, setSortByPrice] = useState(true);
  const [showComparison, setShowComparison] = useState(false);
  const [showKakaoBanner, setShowKakaoBanner] = useState(true);

  const hasModelInSheet = usePriceTableStore((s) => s.hasModel);

  const basePhones = carrierId
    ? phones.filter((p) => p.carriers.includes(carrierId))
    : phones;

  // 단가표 로드 완료 후 해당 통신사에 매칭되는 모델만 표시
  const visiblePhones = sheetLoaded && carrierId
    ? basePhones.filter((p) => hasModelInSheet(p.id, carrierId))
    : basePhones;

  const filteredPhones = brandFilter === '전체'
    ? visiblePhones
    : visiblePhones.filter((p) => p.brand === brandFilter);

  const getDisplayPrice = (phone: Phone, storageSize: string): number => {
    if (sheetLoaded) {
      const fallbackCarrier = (carrierId ?? phone.carriers[0]) as CarrierId;
      const subTypes: SubscriptionType[] = subscriptionType
        ? [subscriptionType, subscriptionType === '번호이동' ? '기기변경' : '번호이동']
        : ['번호이동', '기기변경'];
      for (const subType of subTypes) {
        const sheet = getSubsidy(phone.id, fallbackCarrier, storageSize, subType);
        if (sheet.출고가 > 0) return sheet.출고가;
      }
    }
    const storage = phone.storage.find((s) => s.size === storageSize);
    return storage?.price ?? 0;
  };

  const setStep = useQuoteStore((s) => s.setStep);
  const currentStep = useQuoteStore((s) => s.currentStep);

  // 뒤로가기 시 비교 패널 선택 이전 통신사·가입유형 복원
  useEffect(() => {
    if (_comparisonPrevState) {
      switchCarrier(_comparisonPrevState.carrierId);
      setSubscriptionType(_comparisonPrevState.subscriptionType);
      _comparisonPrevState = null;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // 공유 리베이트 스토어 (App.tsx에서 30초마다 갱신)
  const rebateMap = useRebateStore((s) => s.rebateMap);

  // 최저가 계산에 쓸 리베이트 금액 조회 함수 (고가/중가/저가 중 최대값, 할인유형별 분리)
  const getRebateAmount = useMemo(() => {
    return (modelId: string, carrierId: CarrierId, storage: string, subType: SubscriptionType, discountType: DiscountType): number => {
      const tiers = ['고가', '중가', '저가'] as const;
      let best = 0;
      for (const tier of tiers) {
        const key = `${modelId}|${carrierId}|${storage}|${subType}|${tier}`;
        const r = rebateMap.get(key);
        if (r) {
          const amt = discountType === '선택약정' ? r.installment_rebate : r.subsidy_rebate;
          if (amt > best) best = amt;
        }
      }
      return best;
    };
  }, [rebateMap]);

  // 선택된 모델의 타 통신사 최저가 비교 데이터
  const comparisonData: ComparisonData | null = useMemo(() => {
    if (!selectedPhoneId || !carrierId || !subscriptionType || !sheetLoaded) return null;
    const phone = phones.find((p) => p.id === selectedPhoneId);
    if (!phone) return null;

    const currentResult = calculateLowestDevicePrice({
      phone,
      carriers: [carrierId],
      subscriptionType,
      sheetLoaded,
      getSubsidy,
      getSelectAgreementSubsidy,
      getRebateAmount,
    });

    // 0원 판매도 유효한 가격이므로 price가 아니라 hasPrice로 판단한다
    if (!currentResult.hasPrice) return null;

    // 현재 통신사 가격문의 여부
    const currentPriceInquiry = phone.storage.some((s) =>
      getSubsidy(phone.id, carrierId, s.size, subscriptionType)?.가격문의
    );

    // 타 통신사는 번호이동 기준으로 비교
    const alternatives: Alternative[] = phone.carriers
      .filter((c) => c !== carrierId)
      .map((altCarrierId) => {
        const result = calculateLowestDevicePrice({
          phone,
          carriers: [altCarrierId as CarrierId],
          subscriptionType: '번호이동',
          sheetLoaded,
          getSubsidy,
          getSelectAgreementSubsidy,
          getRebateAmount,
        });
        const altStorage = result.storage ?? phone.storage[0]?.size;
        const priceInquiry = altStorage
          ? (getSubsidy(phone.id, altCarrierId as CarrierId, altStorage, '번호이동')?.가격문의 ?? false)
          : false;
        return {
          carrierId: altCarrierId as CarrierId,
          price: result.price,
          hasPrice: result.hasPrice,
          savings: currentResult.price - result.price,
          storage: result.storage,
          priceInquiry,
        };
      })
      .filter((alt) => alt.hasPrice && alt.savings > 0)
      .sort((a, b) => b.savings - a.savings);

    return { currentPrice: currentResult.price, currentPriceInquiry, alternatives };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhoneId, carrierId, subscriptionType, sheetLoaded, getRebateAmount]);

  // 저렴한 대안이 없으면 자동으로 다음 스텝 진행
  // 비교 데이터 자체가 없는 경우(전 조건 가격문의 등)도 그냥 다음 스텝으로 보낸다.
  // 그러지 않으면 비교 패널도 안 뜨고 진행도 안 돼 카드가 먹통이 된다.
  useEffect(() => {
    if (!showComparison) return;
    if (!sheetLoaded) {
      setShowComparison(false);
      setStep(currentStep + 1);
      return;
    }
    if (!comparisonData || comparisonData.alternatives.length === 0) {
      setShowComparison(false);
      setStep(currentStep + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComparison, comparisonData, sheetLoaded]);

  const handleSelectPhone = (phoneId: string) => {
    hapticMedium();
    // 이미 선택된 폰을 다시 클릭하면 비교 패널 토글
    if (selectedPhoneId === phoneId && showComparison) {
      setShowComparison(false);
      return;
    }
    setPhone(phoneId);
    const phone = phones.find((p) => p.id === phoneId);

    // 현재 통신사·가입유형 기준으로 최저가 용량을 직접 계산
    // (phonesWithData.lowestStorage는 subscriptionType=null 포함 전체 기준일 수 있어 불일치 발생)
    let autoStorage: string | null = null;
    if (phone && carrierId && subscriptionType) {
      let bestPrice = Infinity;
      for (const storageOpt of phone.storage) {
        const sub = getSubsidy(phoneId, carrierId, storageOpt.size, subscriptionType);
        if (sub.출고가 > 0) {
          const price = sub.출고가 - sub.공통지원금 - sub.추가지원금 - sub.특별지원;
          if (price < bestPrice) {
            bestPrice = price;
            autoStorage = storageOpt.size;
          }
        }
      }
    }
    if (!autoStorage) {
      const phoneData = phonesWithData.find((d) => d.phone.id === phoneId);
      autoStorage = phoneData?.lowestStorage ?? phone?.storage[0]?.size ?? null;
    }
    if (autoStorage) {
      setStorage(autoStorage);
    }
    if (phone?.colors.length === 1) {
      setColor(phone.colors[0].name);
    }
    setShowComparison(true);
  };

  // 타 통신사 조건 선택 → 통신사·가입유형·용량 변경 후 다음 스텝
  const handleSelectAlternative = (altCarrierId: CarrierId, altStorage: string | null) => {
    hapticMedium();
    // 뒤로가기 시 복원을 위해 현재 상태 저장
    if (carrierId && subscriptionType) {
      _comparisonPrevState = { carrierId, subscriptionType };
    }
    switchCarrier(altCarrierId);
    setSubscriptionType('번호이동');
    if (altStorage) setStorage(altStorage);
    setShowComparison(false);
    setStep(currentStep + 1);
  };

  // 현재 조건 유지하고 다음 스텝으로
  const handleProceedWithCurrent = () => {
    hapticMedium();
    setShowComparison(false);
    setStep(currentStep + 1);
  };

  const phonesWithData = useMemo(() =>
    filteredPhones.map((phone) => {
      const result = calculateLowestDevicePrice({
        phone,
        carriers: carrierId ? [carrierId] : phone.carriers,
        subscriptionType: subscriptionType ?? null,
        sheetLoaded,
        getSubsidy,
        getSelectAgreementSubsidy,
        getRebateAmount,
      });
      // 가격문의 여부: 공통지원금·선택약정 두 경로가 모두 막힌 경우에만 가격문의로 본다.
      // (공통지원금 리베이트가 0이어도 선택약정으로 판매 가능하면 그 가격을 보여준다)
      const subTypes = subscriptionType ? [subscriptionType] : ['번호이동', '기기변경'] as const;
      const isPriceInquiry = sheetLoaded && carrierId
        ? phone.storage.every((s) =>
            subTypes.every((st) => {
              const 공통 = getSubsidy(phone.id, carrierId, s.size, st);
              const 선약 = getSelectAgreementSubsidy(phone.id, carrierId, s.size, st);
              const 공통판매가능 = 공통.출고가 > 0 && !공통.가격문의;
              const 선약판매가능 = 선약.출고가 > 0 && !선약.가격문의;
              return !공통판매가능 && !선약판매가능;
            })
          )
        : false;
      // 최저가를 만든 통신사·가입유형 조합의 할인액이 직전 값 대비 올랐는지 확인
      const bestCondition = result.conditions[0] ?? null;
      const subsidyUp = sheetLoaded && bestCondition && result.storage
        ? isSubsidyUp(phone.id, bestCondition.carrierId, result.storage, bestCondition.subscriptionType)
        : false;

      return {
        phone,
        lowestDevicePrice: result.price,
        lowestStorage: result.storage ?? phone.storage[0]?.size ?? null,
        retailPrice: result.retailPrice > 0 ? result.retailPrice : getDisplayPrice(phone, phone.storage[0].size),
        totalSubsidy: result.totalSubsidy,
        conditions: result.conditions,
        isPriceInquiry,
        subsidyUp,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredPhones, sheetLoaded, carrierId, subscriptionType, getRebateAmount, isSubsidyUp]);

  const displayPhones = useMemo(() => {
    // 가격문의·가격 준비중 기기는 정렬 방식과 무관하게 항상 목록 맨 아래로 보낸다.
    // (최저가가 0으로 계산돼 오히려 맨 위로 올라오던 문제)
    const 가격없음 = (p: typeof phonesWithData[number]) =>
      p.isPriceInquiry || p.retailPrice <= 0 ? 1 : 0;
    return [...phonesWithData].sort(
      (a, b) =>
        가격없음(a) - 가격없음(b) ||
        (sortByPrice ? a.lowestDevicePrice - b.lowestDevicePrice : 0),
    );
  }, [phonesWithData, sortByPrice]);

  const currentCarrierName = carriersData.find((c) => c.id === carrierId)?.name ?? carrierId ?? '';

  const ALL_CARRIERS: CarrierId[] = ['SKT', 'KT', 'LGU'];

  // 키즈폰: 휴대폰_마스터 키즈전용=Y 기준, 색상_용량·공시지원금·선택약정 시트로 가격 계산
  const kidsModels = useMemo(() => {
    const masterKidsIds = phoneMasters
      .filter((m) => m.키즈전용)
      .map((m) => m.모델ID);
    const modelIds = masterKidsIds.length > 0
      ? masterKidsIds
      : [...new Set(kidsPhones.map((r) => r.모델ID))];

    return modelIds.map((모델ID) => {
      const master = phoneMasters.find((m) => m.모델ID === 모델ID);

      // 색상_용량 시트에서 출고가·용량 확인
      const storageRow = colorStorages.find((r) => r.모델ID === 모델ID);
      const 용량 = storageRow?.용량 ?? '';
      // 키즈폰은 뒤로가기 후 carrierId 오염 방지를 위해 항상 전체 통신사 순회
      const carriersToCheck = ALL_CARRIERS;
      let lowestPrice = Infinity;
      let retailPrice = 0;
      let bestCarrier = '';

      // 공시지원금 시트 기준 신규가입 가격 계산 (모든 통신사 순회)
      if (sheetLoaded && 용량) {
        for (const c of carriersToCheck) {
          const sub = getSubsidy(모델ID, c, 용량, '신규가입');
          if (sub.출고가 > 0) {
            const price = Math.max(0, sub.출고가 - sub.공통지원금 - sub.추가지원금 - sub.특별지원);
            if (price < lowestPrice) {
              lowestPrice = price;
              retailPrice = sub.출고가;
              bestCarrier = c;
            }
          }
        }
      }

      // 폴백: 키즈전용 시트
      if (lowestPrice === Infinity) {
        let rows = kidsPhones.filter((r) => r.모델ID === 모델ID);
        const byType = rows.filter((r) => r.가입유형 === '신규가입');
        if (byType.length > 0) rows = byType;
        for (const row of rows) {
          const 실구매가 = Math.max(0, row.출고가 - row.공통지원금 - row.추가지원금 - row.특별지원);
          if (row.출고가 > 0 && 실구매가 < lowestPrice) {
            lowestPrice = 실구매가;
            retailPrice = row.출고가;
            bestCarrier = row.통신사;
          }
        }
      }

      return {
        모델ID,
        통신사: bestCarrier,
        용량,
        배지: master?.배지 ?? '',
        lowestPrice: lowestPrice === Infinity ? 0 : lowestPrice,
        retailPrice,
      };
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneMasters, kidsPhones, sheetLoaded, getSubsidy, colorStorages]);

  const isKidsSection = selectedBrand === '키즈' || (subscriptionType === '신규가입' && selectedBrand !== 'Apple');

  if (isKidsSection) {
    return (
      <div className={styles.container}>
        <h2 className={styles.title}>🧒 키즈폰을 선택해주세요!</h2>
        <div className={styles.list}>
          {kidsModels.length === 0 ? (
            <p className={styles.lowestPriceNone}>
              {sheetLoaded ? '키즈폰 정보가 없습니다' : '⏳ 정보 로딩중...'}
            </p>
          ) : (
            kidsModels.map((model) => {
              const isSelected = selectedPhoneId === model.모델ID;
              const kidsInfo = KIDS_MODEL_INFO[model.모델ID];
              const imageId = kidsInfo?.imageId ?? model.모델ID.toLowerCase();
              const displayName = kidsInfo?.name ?? model.모델ID;
              const emoji = kidsInfo?.emoji ?? '📱';
              const carrier = carriersData.find((c) => c.id === model.통신사);
              return (
                <Card
                  key={model.모델ID}
                  selected={isSelected}
                  onClick={() => {
                    hapticMedium();
                    setPhone(model.모델ID);
                    setStorage(model.용량 || '기본');
                    if (model.통신사) {
                      switchCarrier(model.통신사 as CarrierId);
                    }
                    setStep(currentStep + 1);
                  }}
                  className={styles.phoneCard}
                >
                  <div className={styles.phoneRow}>
                    <div className={styles.phoneImage}>
                      <img
                        src={`/images/phones/${imageId}/${imageId}.png`}
                        alt={displayName}
                        className={styles.phoneImg}
                      />
                    </div>
                    <div className={styles.phoneInfo}>
                      <div className={styles.phoneNameRow}>
                        <span className={styles.phoneBrand}>
                          {emoji} 삼성 키즈폰
                        </span>
                        {carrier && (
                          <img
                            src={`/images/${carrier.id}.png`}
                            alt={carrier.name}
                            className={styles.phoneImg}
                            style={{ width: 20, height: 20, objectFit: 'contain', marginLeft: 4 }}
                          />
                        )}
                      </div>
                      <div className={styles.phoneNameRow}>
                        <span className={styles.phoneName}>{displayName}</span>
                      </div>
                      {model.배지 && (
                        <span className={styles.lowestPriceBadge}>{model.배지}</span>
                      )}
                    </div>
                    <div className={styles.lowestPrice}>
                      {model.retailPrice > 0 ? (
                        <>
                          <span className={styles.lowestPriceBadge}>✨ 오늘 최저가</span>
                          <span className={styles.lowestPriceValue}>{formatWon(model.lowestPrice)}</span>
                          <span className={styles.lowestPriceRetail}>{formatWon(model.retailPrice)}</span>
                        </>
                      ) : (
                        <span className={styles.lowestPriceNone}>가격 준비중</span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })
          )}
        </div>
      </div>
    );
  }

  const handleKakaoConfirm = () => {
    window.open(KAKAO_CHANNEL_URL, '_blank', 'noopener,noreferrer');
    setShowKakaoBanner(false);
    localStorage.setItem(KAKAO_ALERT_DISMISSED_KEY, 'true');
  };

  const handleKakaoClose = () => {
    setShowKakaoBanner(false);
    localStorage.setItem(KAKAO_ALERT_DISMISSED_KEY, 'true');
  };

  const handleCardBenefitToggle = () => {
    hapticMedium();
    toggleCardBenefit();
  };

  const handleAddonBenefitToggle = () => {
    hapticMedium();
    toggleAddonBenefit();
  };

  return (
    <>
      <KakaoAlertBanner
        visible={showKakaoBanner}
        onConfirm={handleKakaoConfirm}
        onClose={handleKakaoClose}
      />
      <BenefitToggleBar
        cardOn={cardBenefitApplied}
        onCardToggle={handleCardBenefitToggle}
        addonOn={addonBenefitApplied}
        onAddonToggle={handleAddonBenefitToggle}
        addonCondition={addonBenefit.condition}
      />
      <div className={styles.container}>
        <div className={styles.titleRow}>
          <h2 className={styles.title}>기기를 선택해주세요!</h2>
          <button
            className={`${styles.sortBtn} ${sortByPrice ? styles.sortBtnActive : ''}`}
            onClick={() => setSortByPrice(!sortByPrice)}
          >
            최저가↑
          </button>
        </div>

        {!selectedBrand && (
          <div className={styles.brandFilter}>
            {(['전체', '삼성', 'Apple'] as const).map((brand) => (
              <button
                key={brand}
                className={`${styles.brandBtn} ${brandFilter === brand ? styles.brandBtnActive : ''}`}
                onClick={() => setBrandFilter(brand)}
              >
                {brand}
              </button>
            ))}
          </div>
        )}

        <div className={styles.list}>
          {displayPhones.map(({ phone, retailPrice, lowestDevicePrice, lowestStorage: _ls, isPriceInquiry, subsidyUp }) => {
            const isSelected = selectedPhoneId === phone.id;
            const displayedLowestPrice =
              benefitApplied && !isPriceInquiry && retailPrice > 0
                ? applyBenefit(lowestDevicePrice)
                : lowestDevicePrice;
            return (
              <div key={phone.id}>
                <Card
                  selected={isSelected}
                  onClick={() => handleSelectPhone(phone.id)}
                  className={styles.phoneCard}
                >
                  <div className={styles.phoneRow}>
                    <div className={styles.phoneImage}>
                      <img
                        src={phone.image}
                        alt={phone.name}
                        className={styles.phoneImg}
                      />
                    </div>
                    <div className={styles.phoneInfo}>
                      <span className={styles.phoneBrand}>{phone.brand}</span>
                      <div className={styles.phoneNameRow}>
                        <span className={styles.phoneName}>{phone.name}</span>
                      </div>
                    </div>
                    <div className={styles.lowestPrice}>
                      {isPriceInquiry ? (
                        <>
                          <span className={styles.lowestPriceBadge}>▼ 오늘 최저가</span>
                          <span className={styles.lowestPriceValue} style={{ fontSize: '18px' }}>가격문의</span>
                          <span className={styles.lowestPriceRetail}>{formatWon(retailPrice)}</span>
                        </>
                      ) : retailPrice > 0 ? (
                        <>
                          <span className={styles.lowestPriceBadgeRow}>
                            <span className={styles.lowestPriceBadge}>
                              {benefitApplied ? '💳 혜택 적용가' : '▼ 오늘 최저가'}
                            </span>
                            {subsidyUp && (
                              <span className={styles.subsidyUpBadge}>▲UP</span>
                            )}
                          </span>
                          <span className={styles.lowestPriceValue}>{formatWon(displayedLowestPrice)}</span>
                          {displayedLowestPrice < 0 && (
                            <span className={styles.paybackNote}>페이백으로 돌려드립니다</span>
                          )}
                          <span className={styles.lowestPriceRetail}>{formatWon(retailPrice)}</span>
                        </>
                      ) : (
                        <>
                          <span className={styles.lowestPriceLabel}>오늘 최저가</span>
                          <span className={styles.lowestPriceNone}>가격 준비중</span>
                        </>
                      )}
                    </div>
                  </div>
                </Card>

                {/* 타 통신사 최저가 비교 패널 */}
                {isSelected && showComparison && comparisonData && comparisonData.alternatives.length > 0 && (
                  <div className={styles.comparisonPanel}>
                    <div className={styles.comparisonHeader}>
                      <span className={styles.comparisonIcon}>💡</span>
                      <div className={styles.comparisonHeaderText}>
                        <span className={styles.comparisonTitle}>
                          {comparisonData.alternatives.some((a) => a.savings > 0)
                            ? '번호이동 시 더 저렴해요'
                            : '통신사별 가격 비교'}
                        </span>
                        <span className={styles.comparisonSub}>
                          현재 {currentCarrierName} {subscriptionType}{' '}
                          {comparisonData.currentPriceInquiry
                            ? '가격문의'
                            : formatWon(applyBenefit(comparisonData.currentPrice))}
                        </span>
                      </div>
                    </div>

                    <div className={styles.alternativeList}>
                      {comparisonData.alternatives.map((alt) => {
                        const carrier = carriersData.find((c) => c.id === alt.carrierId);
                        return (
                          <button
                            key={alt.carrierId}
                            className={styles.alternativeRow}
                            onClick={() => handleSelectAlternative(alt.carrierId, alt.storage)}
                          >
                            <img
                              src={`/images/${alt.carrierId}.png`}
                              alt={carrier?.name ?? alt.carrierId}
                              className={styles.altCarrierLogo}
                            />
                            <div className={styles.altInfo}>
                              <span className={styles.altCarrierName}>
                                {carrier?.name ?? alt.carrierId} 번호이동
                              </span>
                              <span className={styles.altPrice}>
                                {alt.priceInquiry
                                  ? '가격문의'
                                  : formatWon(applyBenefit(alt.price))}
                              </span>
                            </div>
                            <div className={styles.altRight}>
                              {alt.savings > 0 && (
                                <span className={styles.savingsBadge}>
                                  -{formatWon(alt.savings)} ▼
                                </span>
                              )}
                              <span className={styles.selectLabel}>선택 →</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button className={styles.alternativeRow} onClick={handleProceedWithCurrent}>
                      {carrierId && (
                        <img
                          src={`/images/${carrierId}.png`}
                          alt={currentCarrierName}
                          className={styles.altCarrierLogo}
                        />
                      )}
                      <div className={styles.altInfo}>
                        <span className={styles.altCarrierName}>
                          {currentCarrierName} {subscriptionType}
                        </span>
                        <span className={styles.altPrice}>
                          {comparisonData.currentPriceInquiry
                            ? '가격문의'
                            : formatWon(applyBenefit(comparisonData.currentPrice))}
                        </span>
                      </div>
                      <div className={styles.altRight}>
                        <span className={styles.selectLabel}>선택 →</span>
                      </div>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}
