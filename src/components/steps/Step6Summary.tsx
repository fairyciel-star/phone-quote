import { useMemo } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { StepNavigation } from '../layout/StepNavigation';
import phonesData from '../../data/phones.json';
import plansData from '../../data/plans.json';
import discountsData from '../../data/discounts.json';
import carriersData from '../../data/carriers.json';
import type { Discount, Phone, Plan } from '../../types';
import { calculateFullQuote } from '../../utils/price';
import { formatWon } from '../../utils/format';
import styles from './Step6Summary.module.css';

const phones = phonesData as unknown as Phone[];
const plans = plansData as unknown as Plan[];
const jsonDiscounts = discountsData as unknown as Discount[];

export function Step6Summary() {
  const state = useQuoteStore();
  const { selectedPhoneId, selectedStorage, selectedPlanId, carrierId, discountType, selectedDiscountIds, 할부개월, subscriptionType } = state;

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);
  const getSheetCards = useSheetStore((s) => s.getCardDiscountsForCarrier);
  const getSheetPlans = useSheetStore((s) => s.getPlansForCarrier);
  const getSheetAddons = useSheetStore((s) => s.getAddonsForCarrier);

  const phone = phones.find((p) => p.id === selectedPhoneId);
  const carrier = carriersData.find((c) => c.id === carrierId);

  // Plans: sheet first, JSON fallback
  const sheetPlans = sheetLoaded && carrierId ? getSheetPlans(carrierId) : [];
  const allPlans = sheetPlans.length > 0 ? sheetPlans : plans;
  const plan = allPlans.find((p) => p.id === selectedPlanId);

  // Discounts: sheet cards + sheet addons, JSON fallback
  const sheetCards = sheetLoaded && carrierId ? getSheetCards(carrierId) : [];
  const sheetAddons = sheetLoaded && carrierId ? getSheetAddons(carrierId) : [];
  const allDiscounts = [
    ...(sheetCards.length > 0 ? sheetCards : jsonDiscounts.filter((d) => d.type === '제휴카드')),
    ...(sheetAddons.length > 0 ? sheetAddons : jsonDiscounts.filter((d) => d.type === '부가서비스')),
  ];
  const selectedDiscounts = allDiscounts.filter((d) => selectedDiscountIds.includes(d.id));

  // 시트 공통지원금/추가지원금 (가입유형별)
  const sheetSubsidy = sheetLoaded && selectedPhoneId && carrierId && selectedStorage && subscriptionType
    ? getSubsidy(selectedPhoneId, carrierId, selectedStorage, subscriptionType)
    : null;

  const specialSupport = sheetSubsidy?.특별지원 ?? 0;

  const quote = useMemo(() => {
    if (!phone || !plan || !selectedStorage || !carrierId) return null;
    return calculateFullQuote({
      phone,
      storage: selectedStorage,
      carrierId,
      plan,
      discountType,
      selectedDiscounts,
      할부개월,
      출고가Override: sheetSubsidy?.출고가,
      공통지원금Override: sheetSubsidy?.공통지원금,
      추가지원금Override: sheetSubsidy?.추가지원금,
      특별지원Override: sheetSubsidy?.특별지원,
    });
  }, [phone, plan, selectedStorage, carrierId, discountType, selectedDiscounts, 할부개월, sheetSubsidy]);

  if (!quote || !phone || !plan) {
    return (
      <>
        <div className={styles.container}>
          <h2 className={styles.title}>견적 확인</h2>
          <p style={{ color: 'var(--color-text-secondary)', textAlign: 'center', marginTop: '40px' }}>
            선택 정보가 부족합니다. 이전 단계를 확인해주세요.
          </p>
        </div>
        <StepNavigation canProceed={false} />
      </>
    );
  }

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>견적 확인</h2>

        {/* Phone Image + Name */}
        <div className={styles.phoneSection}>
          <div className={styles.phoneName}>{phone.name}</div>
          <div className={styles.phoneImageWrap}>
            <img
              className={styles.phoneImage}
              src={phone.image}
              alt={phone.name}
            />
          </div>
          {carrier && (
            <img
              className={styles.carrierLogo}
              src={`/images/${carrier.id}.png`}
              alt={carrier.name}
            />
          )}
        </div>

        {/* 총 할부 원금 Box */}
        <div className={styles.installmentBox}>
          <div className={styles.installmentBoxLabel}>총 할부 원금</div>
          <div className={styles.installmentBoxAmount}>
            할부원금: {formatWon(quote.할부원금)}
          </div>
        </div>

        {/* 할부 개월 선택 */}
        <div className={styles.installmentSelector}>
          {[12, 24, 36].map((m) => (
            <button
              key={m}
              className={`${styles.installmentBtn} ${할부개월 === m ? styles.active : ''}`}
              onClick={() => state.set할부개월(m)}
            >
              {m}개월
            </button>
          ))}
        </div>

        {/* 월 예상 납입금 */}
        <div className={styles.monthlyTotal}>
          <span className={styles.monthlyTotalLabel}>월 예상 납입금</span>
          <span className={styles.monthlyTotalAmount}>
            {formatWon(quote.월할부금)}
            <span className={styles.monthlyTotalUnit}>/월</span>
          </span>
        </div>

        {/* 선택 정보 */}
        <div className={styles.summaryCard}>
          <div className={styles.sectionTitle}>선택 정보</div>
          <div className={styles.selectedInfo}>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>가입유형</span>
              <span className={styles.infoValue}>{subscriptionType}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>통신사</span>
              <span className={styles.infoValue}>{carrier?.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>모델</span>
              <span className={styles.infoValue}>{phone.name} {selectedStorage}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>요금제</span>
              <span className={styles.infoValue}>{plan.name}</span>
            </div>
            <div className={styles.infoRow}>
              <span className={styles.infoLabel}>할인방식</span>
              <span className={styles.infoValue}>{discountType}</span>
            </div>
          </div>
        </div>

        {/* 가격 상세 */}
        <div className={styles.summaryCard}>
          <div className={styles.sectionTitle}>가격 상세</div>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>출고가</span>
            <span className={styles.breakdownValue}>{formatWon(quote.출고가)}</span>
          </div>

          {quote.공통지원금 > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>공통지원금</span>
              <span className={`${styles.breakdownValue} ${styles.breakdownDiscount}`}>
                -{formatWon(quote.공통지원금)}
              </span>
            </div>
          )}

          {quote.추가지원금 > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>최대 매장지원금</span>
              <span className={`${styles.breakdownValue} ${styles.breakdownDiscount}`}>
                -{formatWon(quote.추가지원금)}
              </span>
            </div>
          )}

          {specialSupport > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>프로모션지원금(조건부 한정)</span>
              <span className={`${styles.breakdownValue} ${styles.breakdownDiscount}`}>
                -{formatWon(specialSupport)}
              </span>
            </div>
          )}

          {quote.제휴카드24개월할인 > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>제휴카드 할인 (24개월)</span>
              <span className={`${styles.breakdownValue} ${styles.breakdownDiscount}`}>
                -{formatWon(quote.제휴카드24개월할인)}
              </span>
            </div>
          )}

          {quote.부가서비스추가할인 > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>부가서비스 추가할인</span>
              <span className={`${styles.breakdownValue} ${styles.breakdownDiscount}`}>
                -{formatWon(quote.부가서비스추가할인)}
              </span>
            </div>
          )}

          <div className={`${styles.breakdownRow} ${styles.breakdownHighlight}`}>
            <span>할부원금</span>
            <span>{formatWon(quote.할부원금)}</span>
          </div>

          <div className={styles.divider} />

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>월 할부금액({할부개월}개월)</span>
            <span className={styles.breakdownValue}>{formatWon(quote.월할부금)}</span>
          </div>

          <div className={styles.breakdownRow}>
            <span className={styles.breakdownLabel}>월 요금제</span>
            <span className={styles.breakdownValue}>{formatWon(quote.월요금제)}</span>
          </div>

          {quote.선택약정할인 > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>선택약정할인</span>
              <span className={`${styles.breakdownValue} ${styles.breakdownDiscount}`}>
                -{formatWon(quote.선택약정할인)}/월
              </span>
            </div>
          )}

          {quote.월부가서비스료 > 0 && (
            <div className={styles.breakdownRow}>
              <span className={styles.breakdownLabel}>부가서비스</span>
              <span className={`${styles.breakdownValue} ${styles.breakdownAdd}`}>
                +{formatWon(quote.월부가서비스료)}
              </span>
            </div>
          )}

          <div className={`${styles.breakdownRow} ${styles.breakdownTotal}`}>
            <span>월 납입금 합계</span>
            <span>{formatWon(quote.월납입금총액)}</span>
          </div>
        </div>
      </div>
      <StepNavigation canProceed={true} />
    </>
  );
}
