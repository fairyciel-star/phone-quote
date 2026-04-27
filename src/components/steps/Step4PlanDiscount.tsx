import { useEffect, useMemo, useRef, useState } from 'react';
import type { Discount, DiscountType, Phone, Plan } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepNavigation } from '../layout/StepNavigation';
import plansData from '../../data/plans.json';
import phonesData from '../../data/phones.json';
import discountsData from '../../data/discounts.json';
import carriersData from '../../data/carriers.json';
import { calculateFullQuote } from '../../utils/price';
import { detectDevice, findMatchingUsedPhone } from '../../utils/detectDevice';
import { formatWon } from '../../utils/format';
import styles from './Step4PlanDiscount.module.css';
import summaryStyles from './Step6Summary.module.css';

const plans = plansData as unknown as Plan[];
const phones = phonesData as unknown as Phone[];
const jsonDiscounts = discountsData as unknown as Discount[];

export function Step4PlanDiscount() {
  const topRef = useRef<HTMLDivElement>(null);
  const scrollToTop = () => topRef.current?.scrollIntoView({ behavior: 'smooth' });

  const state = useQuoteStore();
  const { carrierId, selectedPhoneId, selectedStorage, selectedColor, selectedPlanId, discountType, selectedDiscountIds: selectedIds, 할부개월, subscriptionType } = state;
  const setPlan = useQuoteStore((s) => s.setPlan);
  const setDiscountType = useQuoteStore((s) => s.setDiscountType);
  const toggleDiscount = useQuoteStore((s) => s.toggleDiscount);
  const setColor = useQuoteStore((s) => s.setColor);
  const setStorage = useQuoteStore((s) => s.setStorage);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSheetCards = useSheetStore((s) => s.getCardDiscountsForCarrier);
  const getSheetPlans = useSheetStore((s) => s.getPlansForCarrier);
  // 부가서비스 조건 임시 비활성화
  // const getSheetAddons = useSheetStore((s) => s.getAddonsForCarrier);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);
  const getStoragesForPhone = useSheetStore((s) => s.getStoragesForPhone);
  const getUsedPhoneList = useSheetStore((s) => s.getUsedPhoneList);
  const getSelectAgreementSubsidy = useSheetStore((s) => s.getSelectAgreementSubsidy);

  const selectedPhone = phones.find((p) => p.id === selectedPhoneId);
  const carrier = carriersData.find((c) => c.id === carrierId);

  // Plans
  const sheetPlans = sheetLoaded && carrierId ? getSheetPlans(carrierId) : [];
  const jsonPlans = plans.filter((p) => p.carrier === carrierId);
  const carrierPlans = sheetPlans.length > 0 ? sheetPlans : jsonPlans;
  const premiumPlan = carrierPlans.reduce<Plan | null>(
    (best, p) => (!best || p.monthlyFee > best.monthlyFee ? p : best),
    null
  );

  useEffect(() => {
    if (!premiumPlan) return;
    const hasSelected = selectedPlanId && carrierPlans.some((p) => p.id === selectedPlanId);
    if (!hasSelected) {
      setPlan(premiumPlan.id);
    }
  }, [premiumPlan, selectedPlanId, carrierPlans, setPlan]);

  // Subsidy (mode-aware: 공통지원금 vs 선택약정)
  const getSubsidyData = (): { 공통지원금: number; 추가지원금: number; 특별지원: number } => {
    if (!selectedPhone || !carrierId || !selectedStorage || !subscriptionType) return { 공통지원금: 0, 추가지원금: 0, 특별지원: 0 };
    if (sheetLoaded && discountType === '선택약정') {
      // 선택약정 모드: 선택약정 시트의 추가/특별지원 사용 (공통지원금은 0)
      const sa = getSelectAgreementSubsidy(selectedPhone.id, carrierId, selectedStorage, subscriptionType);
      return { 공통지원금: 0, 추가지원금: sa.추가지원금, 특별지원: sa.특별지원 };
    }
    if (sheetLoaded) {
      const sheet = getSubsidy(selectedPhone.id, carrierId, selectedStorage, subscriptionType);
      if (sheet.공통지원금 > 0) return { 공통지원금: sheet.공통지원금, 추가지원금: sheet.추가지원금, 특별지원: sheet.특별지원 };
    }
    const jsonSubsidy = selectedPhone.공통지원금[carrierId];
    return { 공통지원금: jsonSubsidy?.[selectedStorage] ?? 0, 추가지원금: 0, 특별지원: 0 };
  };
  const subsidyData = getSubsidyData();
  const subsidyAmount = subsidyData.공통지원금;
  const extraSubsidy = subsidyData.추가지원금;
  const specialSupport = subsidyData.특별지원;
  const totalMaxSubsidy = extraSubsidy + specialSupport;

  // Card discounts
  const sheetCardDiscounts = sheetLoaded && carrierId ? getSheetCards(carrierId) : [];
  const jsonCarrierDiscounts = jsonDiscounts.filter((d) => d.carrier === carrierId);
  const jsonCardDiscounts = jsonCarrierDiscounts.filter((d) => d.type === '제휴카드');
  const cardDiscounts = sheetCardDiscounts.length > 0 ? sheetCardDiscounts : jsonCardDiscounts;

  // Addons — 부가서비스 조건 임시 비활성화
  // const sheetAddons = sheetLoaded && carrierId ? getSheetAddons(carrierId) : [];
  // const jsonAddons = jsonCarrierDiscounts.filter((d) => d.type === '부가서비스');
  // const addons = sheetAddons.length > 0 ? sheetAddons : jsonAddons;

  const [cardEnabled, setCardEnabled] = useState(false);
  // 부가서비스 조건 임시 비활성화
  // const [addonEnabled, setAddonEnabled] = useState(false);
  const [condReturn, setCondReturn] = useState(false);
  const [selectedUsedPhone, setSelectedUsedPhone] = useState<string | null>(null);
  const [selectedUsedStorage, setSelectedUsedStorage] = useState<string | null>(null);
  const [detectedModel, setDetectedModel] = useState<string>('');
  const [detectedDebug, setDetectedDebug] = useState<string>('');
  const [isMobileDevice, setIsMobileDevice] = useState<boolean | null>(null);
  const [showPhoneList, setShowPhoneList] = useState(false);
  const [showGradeSelect, setShowGradeSelect] = useState(false);
  const [selectedGrade, setSelectedGrade] = useState<string | null>(null);

  // 중고폰 시세 목록
  const usedPhoneList = sheetLoaded ? getUsedPhoneList() : [];
  // 모델별 고유 목록 (중복 모델ID 제거)
  const uniqueModels = usedPhoneList.filter((p, i, arr) =>
    arr.findIndex((q) => q.모델ID === p.모델ID) === i
  );
  // 선택된 모델의 용량 목록
  const storageOptions = selectedUsedPhone
    ? usedPhoneList.filter((p) => p.모델ID === selectedUsedPhone)
    : [];
  // 모델ID + 용량으로 정확히 매칭
  const selectedUsedPhoneData = usedPhoneList.find(
    (p) => p.모델ID === selectedUsedPhone && p.용량 === selectedUsedStorage
  );

  // 선택된 등급의 가격
  const getGradePrice = (): number => {
    if (!selectedUsedPhoneData || !selectedGrade) return 0;
    switch (selectedGrade) {
      case 'S': return selectedUsedPhoneData.A등급;
      case 'A': return selectedUsedPhoneData.B등급;
      case 'C': return selectedUsedPhoneData.C등급;
      case 'D': return selectedUsedPhoneData.E등급;
      default: return 0;
    }
  };
  const gradePrice = getGradePrice();

  const sortedCardDiscounts = [...cardDiscounts].sort(
    (a, b) => (b.monthlyDiscount ?? 0) - (a.monthlyDiscount ?? 0)
  );

  const selectedCardId = selectedIds.find((id) =>
    cardDiscounts.some((d) => d.id === id)
  );

  // 카드/부가서비스 자동 선택은 "있음" 상태일 때만
  useEffect(() => {
    if (cardEnabled && sortedCardDiscounts.length > 0 && !selectedCardId) {
      toggleDiscount(sortedCardDiscounts[0].id);
    }
  }, [cardEnabled, sortedCardDiscounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 부가서비스 조건 임시 비활성화
  // useEffect(() => {
  //   if (addonEnabled && addons.length > 0) {
  //     for (const addon of addons) {
  //       if (!selectedIds.includes(addon.id)) toggleDiscount(addon.id);
  //     }
  //   }
  // }, [addonEnabled, addons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardSelect = (discountId: string) => {
    if (selectedCardId && selectedCardId !== discountId) {
      toggleDiscount(selectedCardId);
    }
    toggleDiscount(discountId);
  };

  const handleCardToggle = () => {
    if (cardEnabled && selectedCardId) {
      toggleDiscount(selectedCardId);
    }
    const nextEnabled = !cardEnabled;
    setCardEnabled(nextEnabled);
    if (nextEnabled) {
      setTimeout(scrollToTop, 100);
    }
  };

  // 부가서비스 조건 임시 비활성화로 미사용
  // const handleAddonToggle = () => {
  //   if (addonEnabled) {
  //     for (const addon of addons) {
  //       if (selectedIds.includes(addon.id)) toggleDiscount(addon.id);
  //     }
  //   }
  //   setAddonEnabled(!addonEnabled);
  // };

  // Quote calculation
  const allDiscounts = [
    ...(sheetCardDiscounts.length > 0 ? sheetCardDiscounts : jsonCardDiscounts),
    // 부가서비스 조건 임시 비활성화
    // ...(sheetAddons.length > 0 ? sheetAddons : jsonAddons),
  ];
  const selectedDiscounts = allDiscounts.filter((d) => selectedIds.includes(d.id));

  const commonSheetSubsidy = sheetLoaded && selectedPhoneId && carrierId && selectedStorage && subscriptionType
    ? getSubsidy(selectedPhoneId, carrierId, selectedStorage, subscriptionType)
    : null;

  const saSheetSubsidy = sheetLoaded && selectedPhoneId && carrierId && selectedStorage && subscriptionType
    ? getSelectAgreementSubsidy(selectedPhoneId, carrierId, selectedStorage, subscriptionType)
    : null;

  // 선택약정 모드: 선택약정 시트값 우선, 공통지원금 모드: 공통지원금 시트값
  const activeSheetSubsidy = discountType === '선택약정'
    ? (saSheetSubsidy ? {
        출고가: saSheetSubsidy.출고가 || commonSheetSubsidy?.출고가 || 0,
        공통지원금: 0,
        추가지원금: saSheetSubsidy.추가지원금,
        특별지원: saSheetSubsidy.특별지원,
      } : commonSheetSubsidy)
    : commonSheetSubsidy;

  const plan = carrierPlans.find((p) => p.id === selectedPlanId) ?? premiumPlan;

  const quote = useMemo(() => {
    if (!selectedPhone || !plan || !selectedStorage || !carrierId) return null;
    return calculateFullQuote({
      phone: selectedPhone,
      storage: selectedStorage,
      carrierId,
      plan,
      discountType,
      selectedDiscounts,
      할부개월,
      출고가Override: activeSheetSubsidy?.출고가,
      공통지원금Override: activeSheetSubsidy?.공통지원금,
      추가지원금Override: activeSheetSubsidy?.추가지원금,
      특별지원Override: activeSheetSubsidy?.특별지원,
    });
  }, [selectedPhone, plan, selectedStorage, carrierId, discountType, selectedDiscounts, 할부개월, activeSheetSubsidy]);

  return (
    <>
      <div className={styles.container} ref={topRef}>
        {/* ===== 상단: 폰 이미지 + 가격 + 색상 ===== */}
        {selectedPhone && (
          <div className={styles.phoneHero}>
            <div className={styles.phoneHeroImageWrap}>
              <img
                className={styles.phoneHeroImage}
                src={selectedPhone.colors.find((c) => c.name === selectedColor)?.image ?? selectedPhone.image}
                alt={selectedPhone.name}
              />
            </div>
            <div className={styles.phoneHeroInfo}>
              <div className={styles.phoneHeroName}>{selectedPhone.name}</div>
              {quote && (
                <>
                  <div className={styles.phoneHeroOriginal}>
                    <span className={styles.phoneHeroStrike}>{formatWon(quote.출고가)}</span>
                  </div>
                  <div className={styles.phoneHeroPriceRow}>
                    <span className={styles.phoneHeroPrice}>{formatWon(Math.max(0, quote.할부원금 - gradePrice))}</span>
                    {carrier && (
                      <img
                        src={`/images/${carrier.id}.png`}
                        alt={carrier.name}
                        className={styles.phoneHeroCarrier}
                      />
                    )}
                  </div>
                  <div className={styles.phoneHeroBadges}>
                    {subsidyAmount > 0 && (
                      <div className={styles.phoneHeroBadge}>구매지원금 {formatWon(subsidyAmount + extraSubsidy + specialSupport)}</div>
                    )}
                    {gradePrice > 0 && (
                      <div className={`${styles.phoneHeroBadge} ${styles.badgeTrade}`}>중고폰 판매 {formatWon(gradePrice)}</div>
                    )}
                    {cardEnabled && quote.제휴카드24개월할인 > 0 && (
                      <div className={`${styles.phoneHeroBadge} ${styles.badgeCard}`}>카드 발급 할인 {formatWon(quote.제휴카드24개월할인)}</div>
                    )}
                  </div>
                </>
              )}
              {/* 색상 선택 */}
              {selectedPhone.colors.length > 0 && (
                <div className={styles.colorSelector}>
                  <div className={styles.colorDots}>
                    {selectedPhone.colors.map((c) => (
                      <button
                        key={c.name}
                        className={`${styles.colorDot} ${selectedColor === c.name ? styles.colorDotActive : ''}`}
                        style={{ backgroundColor: c.hex }}
                        onClick={() => setColor(c.name)}
                        title={c.name}
                      />
                    ))}
                  </div>
                  <div className={styles.colorInfo}>
                    <span className={styles.colorName}>{selectedColor || ' '}</span>
                  </div>
                </div>
              )}

              {/* 용량 선택 — 항상 고정 표시 */}
              {(() => {
                const sheetStorages = sheetLoaded && selectedPhoneId && carrierId
                  ? getStoragesForPhone(selectedPhoneId, carrierId as import('../../types').CarrierId)
                  : [];
                const storages = sheetStorages.length > 0
                  ? sheetStorages
                  : selectedPhone.storage.map((s) => ({ size: s.size, price: s.price }));
                return storages.length > 0 ? (
                  <div className={styles.storageSelector}>
                    <div className={styles.storageSelectorLabel}>용량을 선택해주세요</div>
                    <div className={styles.storageBtns}>
                      {storages.map((s) => (
                        <button
                          key={s.size}
                          className={`${styles.storageBtn} ${selectedStorage === s.size ? styles.storageBtnActive : ''}`}
                          onClick={() => setStorage(s.size)}
                        >
                          {s.size}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : null;
              })()}
            </div>
          </div>
        )}

        {quote && (
          <>
            <div className={summaryStyles.installmentSelector}>
              {[12, 24, 36].map((m) => (
                <button
                  key={m}
                  className={`${summaryStyles.installmentBtn} ${할부개월 === m ? summaryStyles.active : ''}`}
                  onClick={() => state.set할부개월(m)}
                >
                  {m}개월
                </button>
              ))}
            </div>
          </>
        )}

        {/* ===== 요금제 & 할인 선택 ===== */}
        <div className={styles.discountToggle}>
          <button
            className={`${styles.toggleBtn} ${discountType === '공통지원금' ? styles.active : ''}`}
            onClick={() => setDiscountType('공통지원금' as DiscountType)}
          >
            공통지원금
          </button>
          <button
            className={`${styles.toggleBtn} ${discountType === '선택약정' ? styles.active : ''}`}
            onClick={() => setDiscountType('선택약정' as DiscountType)}
          >
            선택약정 (25%)
          </button>
        </div>

        <div className={styles.discountInfo}>
          <div>{discountType === '공통지원금'
            ? '공통지원금: 기기값을 할인받는 대신, 요금제 할인은 받지 못합니다.'
            : '선택약정: 요금제를 25% 할인받는 대신, 기기값 할인(공통지원금)은 받지 못합니다.'}</div>
          <div className={styles.discountInfoSub}>*부가서비스가 포함 된 최대 금액 기준 입니다.</div>
        </div>

        <h2 className={styles.title}>요금제</h2>
        <p className={styles.subtitle}>
          {carrierId === 'SKT' && '6개월 이후 45,000원 이상 요금제로 변경 가능'}
          {carrierId === 'KT' && '6개월 이후 47,000원 이상 요금제로 변경 가능'}
          {carrierId === 'LGU' && '6개월 이후 47,000원 이상 요금제로 변경 가능'}
        </p>

        {discountType === '공통지원금' && premiumPlan && (
          <Card selected={true} onClick={() => setPlan(premiumPlan.id)} className={styles.planCard}>
            <div className={styles.planLayout}>
              <div className={styles.planLeft}>
                <div className={styles.planNameRow}>
                  <span className={styles.planName}>{premiumPlan.name}</span>
                </div>
                <div className={styles.planPriceRow}>
                  <span className={styles.planPriceLabel}>월</span>
                  <span className={styles.planPrice}>{formatWon(premiumPlan.monthlyFee)}</span>
                </div>
              </div>
              <div className={styles.planRight}>
                <div className={styles.planBadges}>
                  <Badge>데이터</Badge>
                  <Badge>{premiumPlan.data}</Badge>
                  <Badge>6개월 유지</Badge>
                </div>
                <div className={styles.subsidyColumn}>
                  <div className={styles.subsidyItem}>
                    <span className={styles.subsidyLabel}>공통지원금</span>
                    <span className={styles.subsidyAmount}>{formatWon(subsidyAmount)}</span>
                  </div>
                  {extraSubsidy > 0 && (
                    <div className={styles.subsidyItem}>
                      <span className={styles.subsidyLabel}>최대 매장지원금</span>
                      <span className={styles.subsidyAmount}>{formatWon(extraSubsidy)}</span>
                    </div>
                  )}
                  {specialSupport > 0 && (
                    <div className={styles.subsidyItem}>
                      <span className={styles.subsidyLabel}>동네폰 특별지원</span>
                      <span className={styles.subsidyAmount}>{formatWon(specialSupport)}</span>
                    </div>
                  )}
                  <div className={styles.subsidyItem}>
                    <span className={styles.subsidyTotalLabel}>최대 지원금</span>
                    <span className={styles.subsidyTotalAmount}>{formatWon(subsidyAmount + totalMaxSubsidy)}</span>
                  </div>
                </div>
              </div>
            </div>
          </Card>
        )}

        {discountType === '선택약정' && premiumPlan && (
          <Card selected={true} onClick={() => setPlan(premiumPlan.id)} className={styles.planCard}>
            <div className={styles.planLayout}>
              <div className={styles.planLeft}>
                <div className={styles.planNameRow}>
                  <span className={styles.planName}>{premiumPlan.name}</span>
                </div>
                <div className={styles.planPriceRow}>
                  <span className={styles.planPriceLabel}>월</span>
                  <span className={styles.planPrice}>{formatWon(premiumPlan.monthlyFee)}</span>
                </div>
                <div className={styles.planAfterDiscount}>
                  <span className={styles.planAfterLabel}>25% 할인 후</span>
                  <span className={styles.planAfterPrice}>{formatWon(premiumPlan.monthlyFee - Math.floor(premiumPlan.monthlyFee * (premiumPlan.선택약정할인율 || 0.25)))}</span>
                </div>
              </div>
              <div className={styles.planRight}>
                <div className={styles.planBadges}>
                  <Badge>데이터</Badge>
                  <Badge>{premiumPlan.data}</Badge>
                  <Badge>6개월 유지</Badge>
                </div>
                {(extraSubsidy > 0 || specialSupport > 0) && (
                  <div className={styles.subsidyColumn}>
                    {extraSubsidy > 0 && (
                      <div className={styles.subsidyItem}>
                        <span className={styles.subsidyLabel}>최대 매장지원금</span>
                        <span className={styles.subsidyAmount}>{formatWon(extraSubsidy)}</span>
                      </div>
                    )}
                    {specialSupport > 0 && (
                      <div className={styles.subsidyItem}>
                        <span className={styles.subsidyLabel}>동네폰 특별지원</span>
                        <span className={styles.subsidyAmount}>{formatWon(specialSupport)}</span>
                      </div>
                    )}
                    <div className={styles.subsidyItem}>
                      <span className={styles.subsidyTotalLabel}>최대 지원금</span>
                      <span className={styles.subsidyTotalAmount}>{formatWon(totalMaxSubsidy)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {discountType === '선택약정' && (
          <div className={styles.discountInfo}>
            다른 요금제를 희망하시는 경우 상담신청을 통해 문의 바랍니다.
          </div>
        )}

        {/* ===== 조건 항목 ===== */}
        <div className={styles.conditionSection}>
          {/* 부가서비스 조건 — 추후 추가 예정, 임시 비활성화
          <div className={styles.conditionRow}>
            <div className={styles.conditionLeft}>
              <span className={styles.conditionIcon}>📦</span>
              <span className={styles.conditionLabel}>부가서비스 조건</span>
            </div>
            <button
              className={`${styles.conditionToggle} ${addonEnabled ? styles.conditionYes : styles.conditionNo}`}
              onClick={handleAddonToggle}
            >
              {addonEnabled ? '✅ 있음' : '🟢 없음'}
            </button>
          </div>
          {addonEnabled && addons.length > 0 && (
            <div className={styles.conditionDetail}>
              {addons.map((addon) => {
                const fee = addon.monthlyFee ?? 0;
                const bonus = addon.추가할인 ?? 0;
                return (
                  <button
                    key={addon.id}
                    className={`${styles.cardOption} ${selectedIds.includes(addon.id) ? styles.cardOptionActive : ''}`}
                    onClick={() => toggleDiscount(addon.id)}
                  >
                    <div className={styles.cardOptionLeft}>
                      <span className={styles.cardOptionName}>{addon.name}</span>
                      {addon.description && <span className={styles.cardOptionCond}>{addon.description}</span>}
                    </div>
                    <div className={styles.cardOptionRight}>
                      <span className={styles.cardOptionTotal}>+{formatWon(fee)}/월</span>
                      {bonus > 0 && <span className={styles.cardOptionMonthly}>{formatWon(bonus)} 추가할인</span>}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
          */}

          {/* 카드 발급 조건 */}
          <div className={styles.conditionRow}>
            <div className={styles.conditionLeft}>
              <span className={styles.conditionIcon}>💳</span>
              <span className={styles.conditionLabel}>카드 발급 조건</span>
            </div>
            <button
              className={`${styles.conditionToggle} ${cardEnabled ? styles.conditionYes : styles.conditionNo}`}
              onClick={handleCardToggle}
            >
              {cardEnabled ? '✅ 있음' : '🟢 없음'}
            </button>
          </div>
          {cardEnabled && sortedCardDiscounts.length > 0 && (
            <div className={styles.conditionDetail}>
              {sortedCardDiscounts.map((discount) => {
                const monthly = discount.monthlyDiscount ?? 0;
                const total24 = monthly * 24;
                return (
                  <button
                    key={discount.id}
                    className={`${styles.cardOption} ${selectedCardId === discount.id ? styles.cardOptionActive : ''}`}
                    onClick={() => handleCardSelect(discount.id)}
                  >
                    <div className={styles.cardOptionLeft}>
                      <span className={styles.cardOptionName}>{discount.name}</span>
                      {discount.conditions && <span className={styles.cardOptionCond}>{discount.conditions}</span>}
                    </div>
                    <div className={styles.cardOptionRight}>
                      <span className={styles.cardOptionTotal}>-{formatWon(total24)}</span>
                      <span className={styles.cardOptionMonthly}>월 -{formatWon(monthly)}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* 기기 반납 조건 */}
          <div className={styles.conditionRow}>
            <div className={styles.conditionLeft}>
              <span className={styles.conditionIcon}>🔄</span>
              <span className={styles.conditionLabel}>기기 반납 조건</span>
            </div>
            <button
              className={`${styles.conditionToggle} ${condReturn ? styles.conditionYes : styles.conditionNo}`}
              onClick={async () => {
                const nextVal = !condReturn;
                setCondReturn(nextVal);
                if (nextVal) {
                  // "있음" 활성화 시 자동 기기 감지
                  const detected = await detectDevice();
                  setIsMobileDevice(detected.isMobile);
                  setDetectedModel(detected.matchKeyword || detected.raw);
                  setDetectedDebug(detected.debugQuota);
                  if (detected.matchKeyword) {
                    const matchId = findMatchingUsedPhone(detected.matchKeyword, usedPhoneList);
                    if (matchId) {
                      setSelectedUsedPhone(matchId);
                      const modelStorages = usedPhoneList.filter((p) => p.모델ID === matchId);
                      // 감지된 용량으로 자동 선택 시도
                      const matchedByStorage = detected.storageGB
                        ? modelStorages.find((p) => p.용량 === detected.storageGB)
                        : null;
                      if (matchedByStorage) {
                        setSelectedUsedStorage(detected.storageGB);
                      } else if (modelStorages.length === 1) {
                        setSelectedUsedStorage(modelStorages[0].용량);
                      } else {
                        setSelectedUsedStorage(null);
                      }
                      setShowGradeSelect(true);
                    }
                  }
                } else {
                  setDetectedModel('');
                  setSelectedUsedPhone(null);
                  setSelectedUsedStorage(null);
                  setShowPhoneList(false);
                  setShowGradeSelect(false);
                  setSelectedGrade(null);
                }
              }}
            >
              {condReturn ? '✅ 있음' : '🟢 없음'}
            </button>
          </div>
          {/* 선택된 등급 가격 표시 */}
          {condReturn && selectedGrade && selectedUsedPhoneData && (
            <div className={styles.returnPriceBadge}>
              <span>기기 반납 예상 금액</span>
              <span className={styles.returnPriceValue}>{formatWon(gradePrice)}</span>
            </div>
          )}

          {condReturn && (
            <div className={styles.conditionDetail}>
              {/* 1단계: 감지 결과 + 내 기기 선택 버튼 */}
              {isMobileDevice === false ? (
                <>
                  <div className={styles.detectedDevice}>
                    <span className={styles.detectedIcon}>💻</span>
                    <span>PC에서는 기기 자동 인식이 불가합니다.</span>
                  </div>
                  <button className={styles.showPhoneListBtn} onClick={() => setShowPhoneList(!showPhoneList)}>
                    {showPhoneList ? '기종 목록 닫기 ▲' : '직접 기종 선택하기 ▼'}
                  </button>
                </>
              ) : detectedModel && selectedUsedPhone ? (
                <div className={styles.detectedDevice}>
                  <span className={styles.detectedIcon}>📱</span>
                  <span>감지된 기기: <strong>{detectedModel}{selectedUsedStorage ? ` ${selectedUsedStorage}` : ''}</strong></span>
                  {detectedDebug && <div style={{ fontSize: 10, color: '#999', width: '100%' }}>[debug] {detectedDebug}</div>}
                  {selectedUsedStorage && selectedGrade && (
                    <button
                      className={styles.selectMyDeviceBtn}
                      onClick={() => { setSelectedGrade(null); setShowGradeSelect(true); }}
                    >
                      변경
                    </button>
                  )}
                </div>
              ) : detectedModel && !selectedUsedPhone ? (
                <>
                  <div className={styles.detectedDevice}>
                    <span className={styles.detectedIcon}>📱</span>
                    <span>감지된 기기: <strong>{detectedModel}</strong> (시세 데이터 없음)</span>
                  </div>
                  <button className={styles.showPhoneListBtn} onClick={() => setShowPhoneList(!showPhoneList)}>
                    {showPhoneList ? '기종 목록 닫기 ▲' : '직접 기종 선택하기 ▼'}
                  </button>
                </>
              ) : isMobileDevice === true ? (
                <>
                  <div className={styles.detectedDevice}>
                    <span className={styles.detectedIcon}>📱</span>
                    <span>기기를 자동으로 인식할 수 없습니다.</span>
                  </div>
                  <button className={styles.showPhoneListBtn} onClick={() => setShowPhoneList(!showPhoneList)}>
                    {showPhoneList ? '기종 목록 닫기 ▲' : '직접 기종 선택하기 ▼'}
                  </button>
                </>
              ) : null}

              {/* 기종 직접 선택 목록 (숨김 → 펼침) */}
              {showPhoneList && usedPhoneList.length > 0 && (
                <div className={styles.usedPhoneSelect}>
                  <span className={styles.usedPhoneSelectLabel}>기종을 선택해주세요</span>
                  <div className={styles.usedPhoneList}>
                    {uniqueModels.map((p) => (
                      <button
                        key={p.모델ID}
                        className={`${styles.usedPhoneBtn} ${selectedUsedPhone === p.모델ID ? styles.usedPhoneBtnActive : ''}`}
                        onClick={() => {
                          setSelectedUsedPhone(p.모델ID === selectedUsedPhone ? null : p.모델ID);
                          setSelectedUsedStorage(null);
                          setSelectedGrade(null);
                          if (p.모델ID !== selectedUsedPhone) {
                            setShowGradeSelect(true);
                            setShowPhoneList(false);
                          }
                        }}
                      >
                        <span className={styles.usedPhoneName}>{p.모델명}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 용량 선택 */}
              {showGradeSelect && selectedUsedPhone && storageOptions.length > 0 && !selectedUsedStorage && (
                <div className={styles.usedPhoneSelect}>
                  <span className={styles.usedPhoneSelectLabel}>용량을 선택해주세요</span>
                  <div className={styles.usedPhoneList}>
                    {storageOptions.map((p) => (
                      <button
                        key={`${p.모델ID}-${p.용량}`}
                        className={styles.usedPhoneBtn}
                        onClick={() => setSelectedUsedStorage(p.용량)}
                      >
                        <span className={styles.usedPhoneName}>{p.모델명}</span>
                        <span className={styles.usedPhoneStorage}>{p.용량}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* 등급 선택 화면 */}
              {showGradeSelect && selectedUsedPhoneData && (
                <div className={styles.gradeSelectPanel}>
                  <div className={styles.gradeSelectTitle}>기존 사용 기기를 판매하시겠어요?</div>
                  <div className={styles.gradeSelectSub}>판매할 휴대폰의 상태는 어떤가요?</div>

                  {([
                    { grade: 'S', label: '최상(S)', lines: ['화면: 기스 거의 없음', '외관: 스크래치·찍힘 없음', '기능: 모든 기능 100% 정상', '배터리: 90% 이상(교체 이력 없음)'] },
                    { grade: 'A', label: '상(A~B)', lines: ['화면: 미세한 잔기스', '외관: 작은 기스·아주 작은 찍힘 1~2개', '기능: 기능 이상 없음', '배터리: 80~90% 이상(혹은 1회 교체)'] },
                    { grade: 'C', label: '중(C)', lines: ['화면: 눈에 띄는 기스 있음', '외관: 다수의 잔기스, 여러 개의 찍힘', '기능: 경미한 기능 문제 가능', '배터리: 75~85%'] },
                    { grade: 'D', label: '하(D)', lines: ['화면: 깨짐, 화면줄, 터치 불량 등', '외관: 심한 파손, 휘어짐', '기능: 주요 기능 고장', '배터리: 75%↓ 또는 성능저하 경고'] },
                  ] as const).map(({ grade, label, lines }) => (
                    <button
                      key={grade}
                      className={`${styles.gradeCard} ${selectedGrade === grade ? styles.gradeCardActive : ''}`}
                      onClick={() => {
                        setSelectedGrade(grade);
                        setShowGradeSelect(false);
                        scrollToTop();
                      }}
                    >
                      <div className={styles.gradeCardHeader}>{label}</div>
                      <div className={styles.gradeCardBody}>
                        {lines.map((line) => <div key={line}>{line}</div>)}
                      </div>
                    </button>
                  ))}

                  <div className={styles.gradeNotice}>
                    <span className={styles.gradeNoticeIcon}>ℹ️</span>
                    <span>실제 보상금은 기기 검수 후 결정됩니다</span>
                  </div>
                </div>
              )}
            </div>
          )}

        </div>

        {/* ===== 상세 내역 ===== */}
        {quote && plan && carrier && (
          <>
            {/* 선택 정보 */}
            <div className={summaryStyles.summaryCard}>
              <div className={summaryStyles.sectionTitle}>선택 정보</div>
              <div className={summaryStyles.selectedInfo}>
                <div className={summaryStyles.infoRow}>
                  <span className={summaryStyles.infoLabel}>가입유형</span>
                  <span className={summaryStyles.infoValue}>{subscriptionType}</span>
                </div>
                <div className={summaryStyles.infoRow}>
                  <span className={summaryStyles.infoLabel}>통신사</span>
                  <span className={summaryStyles.infoValue}>{carrier.name}</span>
                </div>
                <div className={summaryStyles.infoRow}>
                  <span className={summaryStyles.infoLabel}>모델</span>
                  <span className={summaryStyles.infoValue}>{selectedPhone?.name} {selectedStorage}</span>
                </div>
                <div className={summaryStyles.infoRow}>
                  <span className={summaryStyles.infoLabel}>요금제</span>
                  <span className={summaryStyles.infoValue}>{plan.name}</span>
                </div>
                <div className={summaryStyles.infoRow}>
                  <span className={summaryStyles.infoLabel}>할인방식</span>
                  <span className={summaryStyles.infoValue}>{discountType}</span>
                </div>
              </div>
            </div>

            {/* 가격 상세 */}
            <div className={summaryStyles.summaryCard}>
              <div className={summaryStyles.sectionTitle}>가격 상세</div>

              <div className={summaryStyles.breakdownRow}>
                <span className={summaryStyles.breakdownLabel}>출고가</span>
                <span className={summaryStyles.breakdownValue}>{formatWon(quote.출고가)}</span>
              </div>

              {quote.공통지원금 > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>공통지원금</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownDiscount}`}>
                    -{formatWon(quote.공통지원금)}
                  </span>
                </div>
              )}

              {quote.추가지원금 > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>최대 매장지원금</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownDiscount}`}>
                    -{formatWon(quote.추가지원금)}
                  </span>
                </div>
              )}

              {specialSupport > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>동네폰 특별지원(대상자 한정)</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownDiscount}`}>
                    -{formatWon(specialSupport)}
                  </span>
                </div>
              )}

              {quote.제휴카드24개월할인 > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>제휴카드 할인 (24개월)</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownDiscount}`}>
                    -{formatWon(quote.제휴카드24개월할인)}
                  </span>
                </div>
              )}

              {quote.부가서비스추가할인 > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>부가서비스 추가할인</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownDiscount}`}>
                    -{formatWon(quote.부가서비스추가할인)}
                  </span>
                </div>
              )}

              {gradePrice > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>기기 반납 예상금액</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownDiscount}`}>
                    -{formatWon(gradePrice)}
                  </span>
                </div>
              )}

              <div className={`${summaryStyles.breakdownRow} ${summaryStyles.breakdownHighlight}`}>
                <span>할부원금</span>
                <span>{formatWon(Math.max(0, quote.할부원금 - gradePrice))}</span>
              </div>

              <div className={summaryStyles.divider} />

              <div className={summaryStyles.breakdownRow}>
                <span className={summaryStyles.breakdownLabel}>월 할부금 ({할부개월}개월)</span>
                <span className={summaryStyles.breakdownValue}>{formatWon(Math.max(0, Math.round((quote.할부원금 - gradePrice) / 할부개월)))}</span>
              </div>

              <div className={summaryStyles.breakdownRow}>
                <span className={summaryStyles.breakdownLabel}>월 요금제</span>
                <span className={summaryStyles.breakdownValue}>{formatWon(quote.월요금제)}</span>
              </div>

              {quote.선택약정할인 > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>선택약정할인</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownDiscount}`}>
                    -{formatWon(quote.선택약정할인)}/월
                  </span>
                </div>
              )}

              {quote.월부가서비스료 > 0 && (
                <div className={summaryStyles.breakdownRow}>
                  <span className={summaryStyles.breakdownLabel}>부가서비스</span>
                  <span className={`${summaryStyles.breakdownValue} ${summaryStyles.breakdownAdd}`}>
                    +{formatWon(quote.월부가서비스료)}
                  </span>
                </div>
              )}

              <div className={`${summaryStyles.breakdownRow} ${summaryStyles.breakdownTotal}`}>
                <span>월 납입금 합계</span>
                <span>{formatWon(quote.월납입금총액 - (gradePrice > 0 ? quote.월할부금 - Math.max(0, Math.round((quote.할부원금 - gradePrice) / 할부개월)) : 0))}</span>
              </div>
            </div>

            {/* 사전승낙서 링크 */}
            <a
              href="https://ictmarket.or.kr:8443/precon/pop_CertIcon.do?PRECON_REQ_ID=PRE0000194989&YN=1"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.preconLink}
            >
              <div className={styles.preconIcon}>
                <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <rect width="28" height="28" rx="6" fill="#E8F0FE"/>
                  <rect x="7" y="5" width="14" height="18" rx="2" fill="#4A6CF7" opacity="0.15"/>
                  <rect x="7" y="5" width="14" height="18" rx="2" stroke="#4A6CF7" strokeWidth="1.5"/>
                  <line x1="10" y1="10" x2="18" y2="10" stroke="#4A6CF7" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="10" y1="13.5" x2="18" y2="13.5" stroke="#4A6CF7" strokeWidth="1.5" strokeLinecap="round"/>
                  <line x1="10" y1="17" x2="15" y2="17" stroke="#4A6CF7" strokeWidth="1.5" strokeLinecap="round"/>
                  <circle cx="20" cy="20" r="5" fill="#4A6CF7"/>
                  <path d="M18 20l1.5 1.5L22 18.5" stroke="white" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </div>
              <span className={styles.preconLabel}>사전승낙서</span>
              <svg className={styles.preconExtIcon} width="18" height="18" viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M10 3h5v5" stroke="#4A6CF7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                <path d="M15 3L8 10" stroke="#4A6CF7" strokeWidth="1.5" strokeLinecap="round"/>
                <path d="M14 10v4a1 1 0 01-1 1H4a1 1 0 01-1-1V5a1 1 0 011-1h4" stroke="#4A6CF7" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
            </a>
          </>
        )}
      </div>
      <StepNavigation
        canProceed={selectedPlanId !== null}
        priceDisplay={quote ? { 출고가: quote.출고가, 할부원금: Math.max(0, quote.할부원금 - gradePrice) } : undefined}
      />
    </>
  );
}
