import type { Discount } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { useSheetStore } from '../../store/useSheetStore';
import { Card } from '../ui/Card';
import { StepNavigation } from '../layout/StepNavigation';
import discountsData from '../../data/discounts.json';
import { formatWon } from '../../utils/format';
import styles from './Step5Discount.module.css';

const jsonDiscounts = discountsData as unknown as Discount[];

export function Step5Discount() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const selectedIds = useQuoteStore((s) => s.selectedDiscountIds);
  const toggleDiscount = useQuoteStore((s) => s.toggleDiscount);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSheetCards = useSheetStore((s) => s.getCardDiscountsForCarrier);

  // 시트 데이터가 있으면 시트 제휴카드 사용, 없으면 JSON 폴백
  const sheetCardDiscounts = sheetLoaded && carrierId ? getSheetCards(carrierId) : [];
  const jsonCarrierDiscounts = jsonDiscounts.filter((d) => d.carrier === carrierId);
  const jsonCardDiscounts = jsonCarrierDiscounts.filter((d) => d.type === '제휴카드');

  const cardDiscounts = sheetCardDiscounts.length > 0 ? sheetCardDiscounts : jsonCardDiscounts;
  const addons = jsonCarrierDiscounts.filter((d) => d.type === '부가서비스');

  const handleCardSelect = (discountId: string) => {
    const currentCard = selectedIds.find((id) =>
      cardDiscounts.some((d) => d.id === id)
    );
    if (currentCard && currentCard !== discountId) {
      toggleDiscount(currentCard);
    }
    if (currentCard !== discountId) {
      toggleDiscount(discountId);
    } else {
      toggleDiscount(discountId);
    }
  };

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>추가 할인 선택</h2>
        <p className={styles.subtitle}>카드할인과 부가서비스를 선택해주세요 (선택사항)</p>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>💳</span>
            제휴카드 할인
          </div>
          <div className={styles.cards}>
            {cardDiscounts.map((discount) => (
              <Card
                key={discount.id}
                selected={selectedIds.includes(discount.id)}
                onClick={() => handleCardSelect(discount.id)}
                className={styles.discountCard}
              >
                <div className={styles.cardRow}>
                  <span className={styles.discountName}>{discount.name}</span>
                  <span className={styles.discountAmount}>
                    -{formatWon(discount.monthlyDiscount ?? 0)}/월
                  </span>
                </div>
                {discount.conditions && (
                  <div className={styles.conditions}>{discount.conditions}</div>
                )}
              </Card>
            ))}
          </div>
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>
            <span className={styles.sectionIcon}>📦</span>
            부가서비스
          </div>
          <div className={styles.cards}>
            {addons.map((addon) => (
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
                  <span className={styles.discountFee}>
                    +{formatWon(addon.monthlyFee ?? 0)}/월
                  </span>
                </div>
              </Card>
            ))}
          </div>
        </div>

        <div className={styles.skipNote}>
          선택하지 않아도 다음 단계로 진행할 수 있어요
        </div>
      </div>
      <StepNavigation canProceed={true} />
    </>
  );
}
