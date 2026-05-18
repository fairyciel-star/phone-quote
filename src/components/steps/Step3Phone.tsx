import { useEffect, useMemo, useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import phonesData from '../../data/phones.json';
import carriersData from '../../data/carriers.json';
import type { Phone, SubscriptionType } from '../../types';
import type { CarrierId } from '../../types';
import { formatWon } from '../../utils/format';
import { hapticMedium } from '../../utils/haptic';
import { calculateLowestDevicePrice } from '../../utils/price';
import { loadAllRebates, type StoreRebate } from '../../lib/supabase-rebate';
import styles from './Step3Phone.module.css';

const phones = phonesData as unknown as Phone[];

const KIDS_MODEL_INFO: Record<string, { name: string; imageId: string; emoji: string }> = {
  'galaxy-a175n-zem': { name: '포켓피스', imageId: 'a175n_zem', emoji: '🐣' },
  'galaxy-a175n-kp':  { name: '폼폼푸린', imageId: 'a175nk-kp', emoji: '🍮' },
  'galaxy-a175n-m2':  { name: '무너2',    imageId: 'a175n-m2',   emoji: '🐰' },
};

const CARRIER_INITIAL: Record<string, string> = { SKT: 'S', KT: 'K', LGU: 'L' };
const CARRIER_NAMES:   Record<string, string> = { SKT: 'SK텔레콤', KT: 'KT', LGU: 'LG U+' };

type BrandFilter = '전체' | '삼성' | 'Apple';

interface Alternative { carrierId: CarrierId; price: number; savings: number; }
interface ComparisonData { currentPrice: number; alternatives: Alternative[]; }

const TOTAL_STEPS = 6;

export function Step3Phone() {
  const carrierId          = useQuoteStore((s) => s.carrierId);
  const subscriptionType   = useQuoteStore((s) => s.subscriptionType);
  const selectedPhoneId    = useQuoteStore((s) => s.selectedPhoneId);
  const selectedBrand      = useQuoteStore((s) => s.selectedBrand);
  const setPhone           = useQuoteStore((s) => s.setPhone);
  const setStorage         = useQuoteStore((s) => s.setStorage);
  const setColor           = useQuoteStore((s) => s.setColor);
  const switchCarrier      = useQuoteStore((s) => s.switchCarrier);
  const setSubscriptionType = useQuoteStore((s) => s.setSubscriptionType);
  const setStep            = useQuoteStore((s) => s.setStep);
  const currentStep        = useQuoteStore((s) => s.currentStep);
  const reset              = useQuoteStore((s) => s.reset);

  const sheetLoaded              = useSheetStore((s) => s.loaded);
  const getSubsidy               = useSheetStore((s) => s.getSubsidy);
  const getSelectAgreementSubsidy = useSheetStore((s) => s.getSelectAgreementSubsidy);
  const kidsPhones               = useSheetStore((s) => s.kidsPhones);
  const phoneMasters             = useSheetStore((s) => s.phoneMasters);
  const colorStorages            = useSheetStore((s) => s.colorStorages);

  const [brandFilter, setBrandFilter] = useState<BrandFilter>(
    selectedBrand === '삼성' ? '삼성' : selectedBrand === 'Apple' ? 'Apple' : '전체'
  );
  const [sortByPrice,    setSortByPrice]    = useState(false);
  const [showComparison, setShowComparison] = useState(false);

  // ── 리베이트 로드 ──
  const [rebateMap, setRebateMap] = useState<Map<string, StoreRebate>>(new Map());
  useEffect(() => {
    loadAllRebates().then(setRebateMap);
    const id = setInterval(() => loadAllRebates().then(setRebateMap), 30_000);
    return () => clearInterval(id);
  }, []);

  const getRebateAmount = useMemo(() => {
    return (modelId: string, cId: CarrierId, storage: string, subType: SubscriptionType): number => {
      const tiers = ['고가', '중가', '저가'] as const;
      let best = 0;
      for (const tier of tiers) {
        const key = `${modelId}|${cId}|${storage}|${subType}|${tier}`;
        const r = rebateMap.get(key);
        if (r) {
          const amt = Math.max(r.subsidy_rebate, r.installment_rebate);
          if (amt > best) best = amt;
        }
      }
      return best;
    };
  }, [rebateMap]);

  // ── 필터링 ──
  const basePhones = carrierId ? phones.filter((p) => p.carriers.includes(carrierId)) : phones;
  const filteredPhones = brandFilter === '전체' ? basePhones : basePhones.filter((p) => p.brand === brandFilter);

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
    return phone.storage.find((s) => s.size === storageSize)?.price ?? 0;
  };

  // ── 비교 데이터 ──
  const comparisonData: ComparisonData | null = useMemo(() => {
    if (!selectedPhoneId || !carrierId || !subscriptionType || !sheetLoaded) return null;
    const phone = phones.find((p) => p.id === selectedPhoneId);
    if (!phone) return null;

    const currentResult = calculateLowestDevicePrice({
      phone, carriers: [carrierId], subscriptionType, sheetLoaded,
      getSubsidy, getSelectAgreementSubsidy, getRebateAmount,
    });
    if (currentResult.price === 0) return null;

    const alternatives: Alternative[] = phone.carriers
      .filter((c) => c !== carrierId)
      .map((altId) => {
        const r = calculateLowestDevicePrice({
          phone, carriers: [altId as CarrierId], subscriptionType: '번호이동',
          sheetLoaded, getSubsidy, getSelectAgreementSubsidy, getRebateAmount,
        });
        return { carrierId: altId as CarrierId, price: r.price, savings: currentResult.price - r.price };
      })
      .filter((alt) => alt.price > 0 && alt.savings > 0)
      .sort((a, b) => b.savings - a.savings);

    return { currentPrice: currentResult.price, alternatives };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPhoneId, carrierId, subscriptionType, sheetLoaded, getRebateAmount]);

  useEffect(() => {
    if (!showComparison) return;
    if (!sheetLoaded) { setShowComparison(false); setStep(currentStep + 1); return; }
    if (comparisonData && comparisonData.alternatives.length === 0) {
      setShowComparison(false); setStep(currentStep + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showComparison, comparisonData, sheetLoaded]);

  // ── 폰 데이터 계산 ──
  const phonesWithData = useMemo(() =>
    filteredPhones.map((phone) => {
      const result = calculateLowestDevicePrice({
        phone,
        carriers: carrierId ? [carrierId] : phone.carriers,
        subscriptionType: subscriptionType ?? null,
        sheetLoaded, getSubsidy, getSelectAgreementSubsidy, getRebateAmount,
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

  const displayPhones = useMemo(() =>
    sortByPrice ? [...phonesWithData].sort((a, b) => a.lowestDevicePrice - b.lowestDevicePrice) : phonesWithData,
    [phonesWithData, sortByPrice]);

  const handleSelectPhone = (phoneId: string) => {
    hapticMedium();
    if (selectedPhoneId === phoneId && showComparison) { setShowComparison(false); return; }
    setPhone(phoneId);
    const phone = phones.find((p) => p.id === phoneId);
    const phoneData = phonesWithData.find((d) => d.phone.id === phoneId);
    const autoStorage = phoneData?.lowestStorage ?? phone?.storage[0]?.size;
    if (autoStorage) setStorage(autoStorage);
    if (phone?.colors.length === 1) setColor(phone.colors[0].name);
    setShowComparison(true);
  };

  const handleSelectAlternative = (altCarrierId: CarrierId) => {
    hapticMedium();
    switchCarrier(altCarrierId);
    setSubscriptionType('번호이동');
    setShowComparison(false);
    setStep(currentStep + 1);
  };

  const handleProceedWithCurrent = () => {
    hapticMedium();
    setShowComparison(false);
    setStep(currentStep + 1);
  };

  // ── 키즈폰 데이터 ──
  const ALL_CARRIERS: CarrierId[] = ['SKT', 'KT', 'LGU'];
  const kidsModels = useMemo(() => {
    const masterKidsIds = phoneMasters.filter((m) => m.키즈전용).map((m) => m.모델ID);
    const modelIds = masterKidsIds.length > 0 ? masterKidsIds : [...new Set(kidsPhones.map((r) => r.모델ID))];
    return modelIds.map((모델ID) => {
      const master = phoneMasters.find((m) => m.모델ID === 모델ID);
      const storageRow = colorStorages.find((r) => r.모델ID === 모델ID);
      const 용량 = storageRow?.용량 ?? '';
      let lowestPrice = Infinity, retailPrice = 0, bestCarrier = '';
      if (sheetLoaded && 용량) {
        for (const c of ALL_CARRIERS) {
          const sub = getSubsidy(모델ID, c, 용량, '신규가입');
          if (sub.출고가 > 0) {
            const price = Math.max(0, sub.출고가 - sub.공통지원금 - sub.추가지원금 - sub.특별지원);
            if (price < lowestPrice) { lowestPrice = price; retailPrice = sub.출고가; bestCarrier = c; }
          }
        }
      }
      if (lowestPrice === Infinity) {
        let rows = kidsPhones.filter((r) => r.모델ID === 모델ID);
        const byType = rows.filter((r) => r.가입유형 === '신규가입');
        if (byType.length > 0) rows = byType;
        for (const row of rows) {
          const 실구매가 = Math.max(0, row.출고가 - row.공통지원금 - row.추가지원금 - row.특별지원);
          if (row.출고가 > 0 && 실구매가 < lowestPrice) { lowestPrice = 실구매가; retailPrice = row.출고가; bestCarrier = row.통신사; }
        }
      }
      return { 모델ID, 통신사: bestCarrier, 용량, 배지: master?.배지 ?? '', lowestPrice: lowestPrice === Infinity ? 0 : lowestPrice, retailPrice };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phoneMasters, kidsPhones, sheetLoaded, getSubsidy, colorStorages]);

  const isKidsSection = selectedBrand === '키즈' || (subscriptionType === '신규가입' && selectedBrand !== 'Apple');

  const currentCarrierName = CARRIER_NAMES[carrierId ?? ''] ?? carrierId ?? '';
  const progress = (currentStep / TOTAL_STEPS) * 100;

  // ── 브레드크럼 ──
  const breadcrumbs: string[] = [];
  if (carrierId) breadcrumbs.push(currentCarrierName);
  if (subscriptionType && subscriptionType !== '신규가입') breadcrumbs.push(subscriptionType);
  if (selectedBrand && selectedBrand !== '키즈') breadcrumbs.push(selectedBrand);

  // ────────────────────────────── 키즈폰 섹션 ──────────────────────────────
  if (isKidsSection) {
    return (
      <div className={styles.overlay}>
        <div className={styles.header}>
          <button className={styles.backBtn} onClick={() => { hapticMedium(); setStep(currentStep - 1); }}>‹</button>
          <span className={styles.headerTitle}>오늘의 시세</span>
          <button className={styles.resetBtn} onClick={reset}>처음부터</button>
        </div>
        <div className={styles.stepBar}>
          <div className={styles.stepRow}>
            <span className={styles.stepCounter}>STEP <strong>{String(currentStep).padStart(2, '0')}</strong> / {String(TOTAL_STEPS).padStart(2, '0')}</span>
            <span className={styles.stepLabel}>모델</span>
          </div>
          <div className={styles.stepTrack}><div className={styles.stepFill} style={{ width: `${progress}%` }} /></div>
        </div>
        <div className={styles.content}>
          <h2 className={styles.heading}>🧒 키즈폰을 선택해주세요!</h2>
          <div className={styles.list}>
            {kidsModels.length === 0 ? (
              <p className={styles.emptyText}>{sheetLoaded ? '키즈폰 정보가 없습니다' : '⏳ 정보 로딩중...'}</p>
            ) : (
              kidsModels.map((model) => {
                const isSelected = selectedPhoneId === model.모델ID;
                const kidsInfo = KIDS_MODEL_INFO[model.모델ID];
                const imageId = kidsInfo?.imageId ?? model.모델ID.toLowerCase();
                const displayName = kidsInfo?.name ?? model.모델ID;
                return (
                  <div
                    key={model.모델ID}
                    className={`${styles.phoneCard} ${isSelected ? styles.phoneCardSelected : ''}`}
                    onClick={() => {
                      hapticMedium(); setPhone(model.모델ID); setStorage(model.용량 || '기본');
                      if (model.통신사) switchCarrier(model.통신사 as CarrierId);
                      setStep(currentStep + 1);
                    }}
                  >
                    <div className={`${styles.phoneImageBox} ${isSelected ? styles.phoneImageBoxSelected : ''}`}>
                      <img src={`/images/phones/${imageId}/${imageId}.png`} alt={displayName} className={styles.phoneImg} />
                    </div>
                    <div className={styles.phoneInfo}>
                      <span className={`${styles.phoneBrand} ${isSelected ? styles.phoneBrandSelected : ''}`}>
                        {kidsInfo?.emoji ?? '📱'} 삼성 키즈폰
                      </span>
                      <span className={`${styles.phoneName} ${isSelected ? styles.phoneNameSelected : ''}`}>{displayName}</span>
                      <div className={styles.phonePriceRow}>
                        <span className={`${styles.phonePrice} ${isSelected ? styles.phonePriceSelected : ''}`}>{formatWon(model.lowestPrice)}</span>
                        {model.retailPrice > 0 && <span className={`${styles.phoneRetail} ${isSelected ? styles.phoneRetailSelected : ''}`}>{formatWon(model.retailPrice)}</span>}
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    );
  }

  // ────────────────────────────── 일반 폰 섹션 ──────────────────────────────
  return (
    <div className={styles.overlay}>

      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={() => { hapticMedium(); setStep(currentStep - 1); }}>‹</button>
        <span className={styles.headerTitle}>오늘의 시세</span>
        <button className={styles.resetBtn} onClick={reset}>처음부터</button>
      </div>

      {/* 스텝바 */}
      <div className={styles.stepBar}>
        <div className={styles.stepRow}>
          <span className={styles.stepCounter}>
            STEP <strong>{String(currentStep).padStart(2, '0')}</strong> / {String(TOTAL_STEPS).padStart(2, '0')}
          </span>
          <span className={styles.stepLabel}>모델</span>
        </div>
        <div className={styles.stepTrack}><div className={styles.stepFill} style={{ width: `${progress}%` }} /></div>
      </div>

      {/* 본문 */}
      <div className={styles.content}>

        {/* 브레드크럼 */}
        {breadcrumbs.length > 0 && (
          <div className={styles.breadcrumbs}>
            {breadcrumbs.map((crumb, i) => (
              <span key={i} className={styles.crumb}>✓ {crumb}</span>
            ))}
          </div>
        )}

        {/* 타이틀 + 정렬 */}
        <div className={styles.titleRow}>
          <h2 className={styles.heading}>기기를 골라주세요</h2>
          <button
            className={`${styles.sortBtn} ${sortByPrice ? styles.sortBtnActive : ''}`}
            onClick={() => setSortByPrice(!sortByPrice)}
          >
            최저가 {sortByPrice ? '↑' : '↓'}
          </button>
        </div>
        <p className={styles.subtitle}>오늘 기준 매장 시세 · 시간당 갱신</p>

        {/* 브랜드 필터 (selectedBrand 없을 때만) */}
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

        {/* 폰 리스트 */}
        <div className={styles.list}>
          {displayPhones.map(({ phone, retailPrice, lowestDevicePrice }) => {
            const isSelected = selectedPhoneId === phone.id;

            if (isSelected) {
              return (
                <div key={phone.id}>
                  {/* 선택된 폰 카드 (블랙) */}
                  <div className={styles.selectedCard} onClick={() => handleSelectPhone(phone.id)}>
                    <div className={styles.selectedImageBox}>
                      <img src={phone.image} alt={phone.name} className={styles.selectedImg} />
                    </div>
                    <div className={styles.selectedInfo}>
                      <span className={styles.selectedBrandLabel}>{phone.brand}</span>
                      <span className={styles.selectedName}>{phone.name}</span>
                      <div className={styles.selectedPriceRow}>
                        <span className={styles.selectedPrice}>{formatWon(lowestDevicePrice)}</span>
                        {retailPrice > 0 && (
                          <span className={styles.selectedRetail}>{formatWon(retailPrice)}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* 비교 패널 */}
                  {showComparison && comparisonData && comparisonData.alternatives.length > 0 && (
                    <div className={styles.comparisonPanel}>
                      <div className={styles.comparisonHeader}>
                        <div className={styles.comparisonIcon}>✳</div>
                        <span className={styles.comparisonTitle}>번호이동 시 더 저렴해요</span>
                      </div>

                      {comparisonData.alternatives.map((alt) => (
                        <button
                          key={alt.carrierId}
                          className={styles.altRow}
                          onClick={() => handleSelectAlternative(alt.carrierId)}
                        >
                          <div className={styles.altCircle}>{CARRIER_INITIAL[alt.carrierId] ?? '?'}</div>
                          <div className={styles.altInfo}>
                            <span className={styles.altCarrierName}>{CARRIER_NAMES[alt.carrierId] ?? alt.carrierId} 번호이동</span>
                            <span className={styles.altPrice}>{formatWon(alt.price)}</span>
                          </div>
                          <div className={styles.altRight}>
                            <span className={styles.savingsBadge}>-{formatWon(alt.savings)}</span>
                            <span className={styles.altArrow}>›</span>
                          </div>
                        </button>
                      ))}

                      {/* 현재 조건 */}
                      <button className={styles.altRow} onClick={handleProceedWithCurrent}>
                        <div className={styles.altCircle}>{CARRIER_INITIAL[carrierId ?? ''] ?? '?'}</div>
                        <div className={styles.altInfo}>
                          <span className={styles.altCarrierName}>{currentCarrierName} {subscriptionType}</span>
                          <span className={styles.altPrice}>{formatWon(comparisonData.currentPrice)}</span>
                        </div>
                        <div className={styles.altRight}>
                          <span className={styles.currentCondition}>현재 조건</span>
                          <span className={styles.altArrow}>›</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>
              );
            }

            // 비선택 카드
            return (
              <div
                key={phone.id}
                className={styles.phoneCard}
                onClick={() => handleSelectPhone(phone.id)}
              >
                <div className={styles.phoneImageBox}>
                  <img src={phone.image} alt={phone.name} className={styles.phoneImg} />
                </div>
                <div className={styles.phoneInfo}>
                  <div className={styles.phoneBrandRow}>
                    <span className={styles.phoneBrand}>{phone.brand}</span>
                    {retailPrice > 0 && <span className={styles.lowestBadge}>오늘 최저가</span>}
                  </div>
                  <span className={styles.phoneName}>{phone.name}</span>
                  {retailPrice > 0 ? (
                    <div className={styles.phonePriceRow}>
                      <span className={styles.phonePrice}>{formatWon(lowestDevicePrice)}</span>
                      <span className={styles.phoneRetail}>{formatWon(retailPrice)}</span>
                    </div>
                  ) : (
                    <span className={styles.phonePriceNone}>가격 준비중</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
