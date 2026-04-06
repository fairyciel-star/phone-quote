import { useEffect, useMemo, useState } from 'react';
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
import { formatWon } from '../../utils/format';
import styles from './Step4PlanDiscount.module.css';
import summaryStyles from './Step6Summary.module.css';

const plans = plansData as unknown as Plan[];
const phones = phonesData as unknown as Phone[];
const jsonDiscounts = discountsData as unknown as Discount[];

export function Step4PlanDiscount() {
  const state = useQuoteStore();
  const { carrierId, selectedPhoneId, selectedStorage, selectedPlanId, discountType, selectedDiscountIds: selectedIds, 할부개월, subscriptionType } = state;
  const setPlan = useQuoteStore((s) => s.setPlan);
  const setDiscountType = useQuoteStore((s) => s.setDiscountType);
  const toggleDiscount = useQuoteStore((s) => s.toggleDiscount);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSheetCards = useSheetStore((s) => s.getCardDiscountsForCarrier);
  const getSheetPlans = useSheetStore((s) => s.getPlansForCarrier);
  const getSheetAddons = useSheetStore((s) => s.getAddonsForCarrier);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);

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
    if (premiumPlan && selectedPlanId !== premiumPlan.id) {
      setPlan(premiumPlan.id);
    }
  }, [premiumPlan, selectedPlanId, setPlan]);

  // Subsidy
  const getSubsidyData = (): { 공통지원금: number; 추가지원금: number; 특별지원: number } => {
    if (!selectedPhone || !carrierId || !selectedStorage || !subscriptionType) return { 공통지원금: 0, 추가지원금: 0, 특별지원: 0 };
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

  // Addons
  const sheetAddons = sheetLoaded && carrierId ? getSheetAddons(carrierId) : [];
  const jsonAddons = jsonCarrierDiscounts.filter((d) => d.type === '부가서비스');
  const addons = sheetAddons.length > 0 ? sheetAddons : jsonAddons;

  const [cardExpanded, setCardExpanded] = useState(true);

  const sortedCardDiscounts = [...cardDiscounts].sort(
    (a, b) => (b.monthlyDiscount ?? 0) - (a.monthlyDiscount ?? 0)
  );

  const selectedCardId = selectedIds.find((id) =>
    cardDiscounts.some((d) => d.id === id)
  );

  useEffect(() => {
    if (sortedCardDiscounts.length > 0 && !selectedCardId) {
      toggleDiscount(sortedCardDiscounts[0].id);
    }
  }, [sortedCardDiscounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (addons.length > 0) {
      for (const addon of addons) {
        if (!selectedIds.includes(addon.id)) {
          toggleDiscount(addon.id);
        }
      }
    }
  }, [addons.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleCardSelect = (discountId: string) => {
    if (selectedCardId && selectedCardId !== discountId) {
      toggleDiscount(selectedCardId);
    }
    toggleDiscount(discountId);
  };

  const handleCardToggle = () => {
    if (cardExpanded && selectedCardId) {
      toggleDiscount(selectedCardId);
    }
    setCardExpanded(!cardExpanded);
  };

  // Quote calculation
  const allDiscounts = [
    ...(sheetCardDiscounts.length > 0 ? sheetCardDiscounts : jsonCardDiscounts),
    ...(sheetAddons.length > 0 ? sheetAddons : jsonAddons),
  ];
  const selectedDiscounts = allDiscounts.filter((d) => selectedIds.includes(d.id));

  const sheetSubsidy = sheetLoaded && selectedPhoneId && carrierId && selectedStorage && subscriptionType
    ? getSubsidy(selectedPhoneId, carrierId, selectedStorage, subscriptionType)
    : null;

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
      출고가Override: sheetSubsidy?.출고가,
      공통지원금Override: sheetSubsidy?.공통지원금,
      추가지원금Override: sheetSubsidy?.추가지원금,
    });
  }, [selectedPhone, plan, selectedStorage, carrierId, discountType, selectedDiscounts, 할부개월, sheetSubsidy]);

  return (
    <>
      <div className={styles.container}>
        {/* ===== 상단: 폰 이미지 + 할부원금 ===== */}
        {selectedPhone && (
          <div className={summaryStyles.phoneSection}>
            <div className={summaryStyles.phoneName}>{selectedPhone.name}</div>
            <div className={summaryStyles.phoneImageWrap}>
              <img className={summaryStyles.phoneImage} src={selectedPhone.image} alt={selectedPhone.name} />
            </div>
            {carrier && (
              <img className={summaryStyles.carrierLogo} src={`/images/${carrier.id}.png`} alt={carrier.name} />
            )}
          </div>
        )}

        {quote && (
          <>
            <div className={summaryStyles.installmentBox}>
              <div className={summaryStyles.installmentBoxLabel}>총 할부 원금</div>
              <div className={summaryStyles.installmentBoxAmount}>
                할부원금: {formatWon(quote.할부원금)}
              </div>
            </div>

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
        <h2 className={styles.title}>요금제 & 할인 선택</h2>
        <p className={styles.subtitle}>요금제와 할인 방식을 선택해주세요</p>

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
          {discountType === '공통지원금'
            ? '공통지원금: 기기값을 할인받는 대신, 요금제 할인은 받지 못합니다.'
            : '선택약정: 요금제를 25% 할인받는 대신, 기기값 할인(공통지원금)은 받지 못합니다.'}
        </div>

        {premiumPlan && (
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
                {discountType === '공통지원금' && (
                  <div className={styles.subsidyColumn}>
                    <div className={styles.subsidyItem}>
                      <span className={styles.subsidyLabel}>공통지원금</span>
                      <span className={styles.subsidyAmount}>{formatWon(subsidyAmount)}</span>
                    </div>
                    <div className={styles.subsidyItem}>
                      <span className={styles.subsidyLabel}>최대 매장지원금</span>
                      <span className={styles.subsidyAmount}>{formatWon(totalMaxSubsidy)}</span>
                    </div>
                    <div className={styles.subsidyItem}>
                      <span className={styles.subsidyTotalLabel}>최대 지원금</span>
                      <span className={styles.subsidyTotalAmount}>{formatWon(subsidyAmount + totalMaxSubsidy)}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </Card>
        )}

        {/* Card Discount */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>💳</span>
            제휴카드 할인
          </div>
          {sortedCardDiscounts.length > 0 && (() => {
            const best = sortedCardDiscounts[0];
            const bestMonthly = best.monthlyDiscount ?? 0;
            const bestTotal = bestMonthly * 24;
            return (
              <Card selected={cardExpanded} onClick={handleCardToggle} className={styles.discountCard}>
                <div className={styles.cardRow}>
                  <div>
                    <span className={styles.discountName}>제휴카드 할인 적용</span>
                    <div className={styles.conditions}>
                      {cardExpanded ? '카드사를 선택해주세요' : '터치하여 카드사 선택'}
                    </div>
                  </div>
                  <div className={styles.discountRight}>
                    <span className={styles.discountTotal24}>-{formatWon(bestTotal)}</span>
                    <span className={styles.discountMonthly}>월 -{formatWon(bestMonthly)}</span>
                  </div>
                </div>
              </Card>
            );
          })()}

          {cardExpanded && (
            <div className={styles.cardPanel}>
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
                      {discount.conditions && (
                        <span className={styles.cardOptionCond}>{discount.conditions}</span>
                      )}
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
        </div>

        {/* Addons */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>📦</span>
            부가서비스
          </div>
          <div className={styles.discountCards}>
            {addons.map((addon) => {
              const fee = addon.monthlyFee ?? 0;
              const bonus = addon.추가할인 ?? 0;
              return (
                <Card key={addon.id} selected={selectedIds.includes(addon.id)} onClick={() => toggleDiscount(addon.id)} className={styles.discountCard}>
                  <div className={styles.cardRow}>
                    <div>
                      <div className={styles.discountName}>{addon.name}</div>
                      {addon.description && <div className={styles.conditions}>{addon.description}</div>}
                    </div>
                    <div className={styles.addonRight}>
                      <span className={styles.addonFee}>+{formatWon(fee)}/월</span>
                      {bonus > 0 && <span className={styles.addonBonus}>{formatWon(bonus)} 추가할인</span>}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>
      </div>
      <StepNavigation canProceed={selectedPlanId !== null} />
    </>
  );
}
