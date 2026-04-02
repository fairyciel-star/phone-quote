import { useEffect, useState } from 'react';
import type { Discount, DiscountType, Phone, Plan } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepNavigation } from '../layout/StepNavigation';
import plansData from '../../data/plans.json';
import phonesData from '../../data/phones.json';
import discountsData from '../../data/discounts.json';
import { formatWon } from '../../utils/format';
import styles from './Step4PlanDiscount.module.css';

const plans = plansData as unknown as Plan[];
const phones = phonesData as unknown as Phone[];
const jsonDiscounts = discountsData as unknown as Discount[];

export function Step4PlanDiscount() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const selectedPhoneId = useQuoteStore((s) => s.selectedPhoneId);
  const selectedStorage = useQuoteStore((s) => s.selectedStorage);
  const selectedPlanId = useQuoteStore((s) => s.selectedPlanId);
  const discountType = useQuoteStore((s) => s.discountType);
  const selectedIds = useQuoteStore((s) => s.selectedDiscountIds);
  const setPlan = useQuoteStore((s) => s.setPlan);
  const setDiscountType = useQuoteStore((s) => s.setDiscountType);
  const toggleDiscount = useQuoteStore((s) => s.toggleDiscount);

  const subscriptionType = useQuoteStore((s) => s.subscriptionType);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSheetCards = useSheetStore((s) => s.getCardDiscountsForCarrier);
  const getSheetPlans = useSheetStore((s) => s.getPlansForCarrier);
  const getSheetAddons = useSheetStore((s) => s.getAddonsForCarrier);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);

  // Plans: sheet first, JSON fallback → pick premium (most expensive)
  const sheetPlans = sheetLoaded && carrierId ? getSheetPlans(carrierId) : [];
  const jsonPlans = plans.filter((p) => p.carrier === carrierId);
  const carrierPlans = sheetPlans.length > 0 ? sheetPlans : jsonPlans;
  const premiumPlan = carrierPlans.reduce<Plan | null>(
    (best, p) => (!best || p.monthlyFee > best.monthlyFee ? p : best),
    null
  );

  // Auto-select the premium plan
  useEffect(() => {
    if (premiumPlan && selectedPlanId !== premiumPlan.id) {
      setPlan(premiumPlan.id);
    }
  }, [premiumPlan, selectedPlanId, setPlan]);

  // Get 공통지원금 for selected phone + 가입유형
  const selectedPhone = phones.find((p) => p.id === selectedPhoneId);
  const getSubsidyAmount = (): number => {
    if (!selectedPhone || !carrierId || !selectedStorage || !subscriptionType) return 0;
    if (sheetLoaded) {
      const sheet = getSubsidy(selectedPhone.id, carrierId, selectedStorage, subscriptionType);
      if (sheet.공통지원금 > 0) return sheet.공통지원금;
    }
    const jsonSubsidy = selectedPhone.공통지원금[carrierId];
    return jsonSubsidy?.[selectedStorage] ?? 0;
  };
  const subsidyAmount = getSubsidyAmount();

  // Card discounts: sheet first, JSON fallback
  const sheetCardDiscounts = sheetLoaded && carrierId ? getSheetCards(carrierId) : [];
  const jsonCarrierDiscounts = jsonDiscounts.filter((d) => d.carrier === carrierId);
  const jsonCardDiscounts = jsonCarrierDiscounts.filter((d) => d.type === '제휴카드');
  const cardDiscounts = sheetCardDiscounts.length > 0 ? sheetCardDiscounts : jsonCardDiscounts;

  // Addons: sheet first, JSON fallback
  const sheetAddons = sheetLoaded && carrierId ? getSheetAddons(carrierId) : [];
  const jsonAddons = jsonCarrierDiscounts.filter((d) => d.type === '부가서비스');
  const addons = sheetAddons.length > 0 ? sheetAddons : jsonAddons;

  const [cardExpanded, setCardExpanded] = useState(true);

  // 할인율 높은 순 정렬
  const sortedCardDiscounts = [...cardDiscounts].sort(
    (a, b) => (b.monthlyDiscount ?? 0) - (a.monthlyDiscount ?? 0)
  );

  const selectedCardId = selectedIds.find((id) =>
    cardDiscounts.some((d) => d.id === id)
  );

  // 제휴카드 첫 번째(할인율 최고) 자동 선택
  useEffect(() => {
    if (sortedCardDiscounts.length > 0 && !selectedCardId) {
      toggleDiscount(sortedCardDiscounts[0].id);
    }
  }, [sortedCardDiscounts.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // 부가서비스 전체 자동 선택
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
      // 닫을 때 선택 해제
      toggleDiscount(selectedCardId);
    }
    setCardExpanded(!cardExpanded);
  };

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>요금제 & 할인 선택</h2>
        <p className={styles.subtitle}>요금제와 할인 방식을 선택해주세요</p>

        {/* Discount Type Toggle */}
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

        {/* Premium Plan */}
        {premiumPlan && (
          <Card
            selected={true}
            onClick={() => setPlan(premiumPlan.id)}
            className={styles.planCard}
          >
            <div className={styles.planHeader}>
              <div className={styles.planNameRow}>
                <span className={styles.planName}>{premiumPlan.name}</span>
                {premiumPlan.benefits.map((benefit) => (
                  <Badge key={benefit}>{benefit}</Badge>
                ))}
              </div>
              <div>
                <span className={styles.planPrice}>
                  {formatWon(premiumPlan.monthlyFee)}
                </span>
                <span className={styles.planPriceUnit}>/월</span>
              </div>
            </div>

            <div className={styles.planDetails}>
              <span className={styles.planDetail}>
                <span className={styles.planDetailLabel}>데이터</span>
                {premiumPlan.data}
              </span>
              <span className={styles.planDetail}>
                <span className={styles.planDetailLabel}>통화</span>
                {premiumPlan.voice}
              </span>
              <span className={styles.planDetail}>
                <span className={styles.planDetailLabel}>문자</span>
                {premiumPlan.sms}
              </span>
            </div>

            {discountType === '공통지원금' && (
              <div className={styles.subsidyInfo}>
                공통지원금: <span className={styles.subsidyAmount}>{formatWon(subsidyAmount)}</span>
                <span className={styles.subsidyExtra}>+매장지원금 적용</span>
              </div>
            )}
          </Card>
        )}

        {/* Card Discount Section */}
        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>💳</span>
            제휴카드 할인
          </div>

          {/* 메인 토글 버튼 */}
          {sortedCardDiscounts.length > 0 && (() => {
            const best = sortedCardDiscounts[0];
            const bestMonthly = best.monthlyDiscount ?? 0;
            const bestTotal = bestMonthly * 24;
            return (
              <Card
                selected={cardExpanded}
                onClick={handleCardToggle}
                className={styles.discountCard}
              >
                <div className={styles.cardRow}>
                  <div>
                    <span className={styles.discountName}>제휴카드 할인 적용</span>
                    <div className={styles.conditions}>
                      {cardExpanded ? '카드사를 선택해주세요' : '터치하여 카드사 선택'}
                    </div>
                  </div>
                  <div className={styles.discountRight}>
                    <span className={styles.discountTotal24}>
                      -{formatWon(bestTotal)}
                    </span>
                    <span className={styles.discountMonthly}>
                      월 -{formatWon(bestMonthly)}
                    </span>
                  </div>
                </div>
              </Card>
            );
          })()}

          {/* 카드사 선택 패널 */}
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

        {/* Addon Section */}
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
                <Card
                  key={addon.id}
                  selected={selectedIds.includes(addon.id)}
                  onClick={() => toggleDiscount(addon.id)}
                  className={styles.discountCard}
                >
                  <div className={styles.cardRow}>
                    <div>
                      <div className={styles.discountName}>{addon.name}</div>
                      {addon.description && (
                        <div className={styles.conditions}>{addon.description}</div>
                      )}
                    </div>
                    <div className={styles.addonRight}>
                      <span className={styles.addonFee}>
                        +{formatWon(fee)}/월
                      </span>
                      {bonus > 0 && (
                        <span className={styles.addonBonus}>
                          {formatWon(bonus)} 추가할인
                        </span>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </div>

        <div className={styles.skipNote}>
          할인 항목은 선택하지 않아도 다음 단계로 진행할 수 있어요
        </div>
      </div>
      <StepNavigation canProceed={selectedPlanId !== null} />
    </>
  );
}
