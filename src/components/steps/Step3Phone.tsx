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
import { calculateLowestDevicePrice } from '../../utils/price';
import { useRebateStore } from '../../store/useRebateStore';
import styles from './Step3Phone.module.css';

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
  savings: number;
  storage: string | null;
}

interface ComparisonData {
  currentPrice: number;
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

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);
  const getSelectAgreementSubsidy = useSheetStore((s) => s.getSelectAgreementSubsidy);
  const kidsPhones = useSheetStore((s) => s.kidsPhones);
  const phoneMasters = useSheetStore((s) => s.phoneMasters);
  const colorStorages = useSheetStore((s) => s.colorStorages);

  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const [brandFilter, setBrandFilter] = useState<BrandFilter>(
    selectedBrand === '삼성' ? '삼성' : selectedBrand === 'Apple' ? 'Apple' : '전체'
  );
  const [sortByPrice, setSortByPrice] = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  const basePhones = carrierId
    ? phones.filter((p) => p.carriers.includes(carrierId))
    : phones;
  const filteredPhones = brandFilter === '전체'
    ? basePhones
    : basePhones.filter((p) => p.brand === brandFilter);

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

    if (currentResult.price === 0) return null;

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
        return {
          carrierId: altCarrierId as CarrierId,
          price: result.price,
          savings: currentResult.price - result.price,
          storage: result.storage,
        };
      })
      .filter((alt) => alt.price > 0 && alt.savings > 0)
      .sort((a, b) => b.savings - a.savings);

    return { currentPrice: currentResult.price, alternatives };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhoneId, carrierId, subscriptionType, sheetLoaded, getRebateAmount]);

  // 저렴한 대안이 없으면 자동으로 다음 스텝 진행
  useEffect(() => {
    if (!showComparison) return;
    if (!sheetLoaded) {
      setShowComparison(false);
      setStep(currentStep + 1);
      return;
    }
    if (comparisonData && comparisonData.alternatives.length === 0) {
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
      return {
        phone,
        lowestDevicePrice: result.price,
        lowestStorage: result.storage ?? phone.storage[0]?.size ?? null,
        retailPrice: result.retailPrice > 0 ? result.retailPrice : getDisplayPrice(phone, phone.storage[0].size),
        totalSubsidy: result.totalSubsidy,
        conditions: result.conditions,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredPhones, sheetLoaded, carrierId, subscriptionType, getRebateAmount]);

  const displayPhones = useMemo(() => {
    if (!sortByPrice) return phonesWithData;
    return [...phonesWithData].sort((a, b) => a.lowestDevicePrice - b.lowestDevicePrice);
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

  return (
    <>
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
          {displayPhones.map(({ phone, retailPrice, lowestDevicePrice, lowestStorage: _ls }) => {
            const isSelected = selectedPhoneId === phone.id;
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
                      {retailPrice > 0 ? (
                        <>
                          <span className={styles.lowestPriceBadge}>▼ 오늘 최저가</span>
                          <span className={styles.lowestPriceValue}>{formatWon(lowestDevicePrice)}</span>
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
                          현재 {currentCarrierName} {subscriptionType} {formatWon(comparisonData.currentPrice)}
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
                              <span className={styles.altPrice}>{formatWon(alt.price)}</span>
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
                        <span className={styles.altPrice}>{formatWon(comparisonData.currentPrice)}</span>
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
