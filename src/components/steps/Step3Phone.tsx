import { useEffect, useMemo, useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import phonesData from '../../data/phones.json';
import carriersData from '../../data/carriers.json';
import type { Phone, SubscriptionType } from '../../types';
import type { CarrierId } from '../../types';
import { formatWon } from '../../utils/format';
import { hapticMedium } from '../../utils/haptic';
import { calculateLowestDevicePrice } from '../../utils/price';
import styles from './Step3Phone.module.css';

const phones = phonesData as unknown as Phone[];

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
        });
        return {
          carrierId: altCarrierId as CarrierId,
          price: result.price,
          savings: currentResult.price - result.price,
        };
      })
      .filter((alt) => alt.price > 0 && alt.savings > 0)
      .sort((a, b) => b.savings - a.savings);

    return { currentPrice: currentResult.price, alternatives };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhoneId, carrierId, subscriptionType, sheetLoaded]);

  // 비교 데이터 준비 후 저렴한 대안이 없으면 자동으로 다음 스텝 진행
  useEffect(() => {
    if (!showComparison) return;
    if (!sheetLoaded) {
      // 시트 미로딩 시 바로 진행
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
    if (phone?.storage.length === 1) {
      setStorage(phone.storage[0].size);
    }
    if (phone?.colors.length === 1) {
      setColor(phone.colors[0].name);
    }
    setShowComparison(true);
  };

  // 타 통신사 조건 선택 → 통신사·가입유형 변경 후 다음 스텝
  const handleSelectAlternative = (altCarrierId: CarrierId) => {
    hapticMedium();
    switchCarrier(altCarrierId);
    setSubscriptionType('번호이동');
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
      });
      return {
        phone,
        lowestDevicePrice: result.price,
        retailPrice: result.retailPrice > 0 ? result.retailPrice : getDisplayPrice(phone, phone.storage[0].size),
        totalSubsidy: result.totalSubsidy,
        conditions: result.conditions,
      };
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filteredPhones, sheetLoaded, carrierId, subscriptionType]);

  const displayPhones = useMemo(() => {
    if (!sortByPrice) return phonesWithData;
    return [...phonesWithData].sort((a, b) => a.lowestDevicePrice - b.lowestDevicePrice);
  }, [phonesWithData, sortByPrice]);

  const currentCarrierName = carriersData.find((c) => c.id === carrierId)?.name ?? carrierId ?? '';

  // 키즈폰: 모델ID 기준으로 중복 제거 후 통신사·가입유형 조건에 맞는 최저가 계산
  const kidsModels = useMemo(() => {
    const modelIds = [...new Set(kidsPhones.map((r) => r.모델ID))];
    return modelIds.map((모델ID) => {
      let rows = kidsPhones.filter((r) => r.모델ID === 모델ID);

      // 통신사 선택 시 해당 통신사 행 우선
      if (carrierId) {
        const byCarrier = rows.filter((r) => r.통신사 === carrierId);
        if (byCarrier.length > 0) rows = byCarrier;
      }
      // 가입유형 선택 시 해당 가입유형 행 우선
      if (subscriptionType) {
        const byType = rows.filter((r) => r.가입유형 === subscriptionType);
        if (byType.length > 0) rows = byType;
      }

      let lowestPrice = Infinity;
      let retailPrice = 0;
      let bestRow = rows[0];
      for (const row of rows) {
        const 실구매가 = Math.max(0, row.출고가 - row.공통지원금 - row.추가지원금 - row.특별지원);
        if (row.출고가 > 0 && 실구매가 < lowestPrice) {
          lowestPrice = 실구매가;
          retailPrice = row.출고가;
          bestRow = row;
        }
      }
      return {
        모델ID,
        통신사: bestRow?.통신사 ?? '',
        용량: bestRow?.용량 ?? '',
        배지: bestRow?.배지 ?? '',
        lowestPrice: lowestPrice === Infinity ? 0 : lowestPrice,
        retailPrice,
      };
    });
  }, [kidsPhones, carrierId, subscriptionType]);

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
          {displayPhones.map(({ phone, retailPrice, lowestDevicePrice }) => {
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
                        <span className={styles.comparisonTitle}>번호이동 시 더 저렴해요</span>
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
                            onClick={() => handleSelectAlternative(alt.carrierId)}
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
                              <span className={styles.savingsBadge}>
                                -{formatWon(alt.savings)} ▼
                              </span>
                              <span className={styles.selectLabel}>선택 →</span>
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <button className={styles.proceedCurrentBtn} onClick={handleProceedWithCurrent}>
                      현재 조건({currentCarrierName} {subscriptionType})으로 진행
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
