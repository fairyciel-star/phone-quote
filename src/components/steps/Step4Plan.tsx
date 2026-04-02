import type { DiscountType, Plan } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { Card } from '../ui/Card';
import { Badge } from '../ui/Badge';
import { StepNavigation } from '../layout/StepNavigation';
import plansData from '../../data/plans.json';
import { formatWon } from '../../utils/format';
import styles from './Step4Plan.module.css';

const plans = plansData as unknown as Plan[];

export function Step4Plan() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const selectedPlanId = useQuoteStore((s) => s.selectedPlanId);
  const discountType = useQuoteStore((s) => s.discountType);
  const setPlan = useQuoteStore((s) => s.setPlan);
  const setDiscountType = useQuoteStore((s) => s.setDiscountType);

  const filteredPlans = plans.filter((p) => p.carrier === carrierId);

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>요금제 선택</h2>
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

        <div className={styles.cards}>
          {filteredPlans.map((plan) => (
            <Card
              key={plan.id}
              selected={selectedPlanId === plan.id}
              onClick={() => setPlan(plan.id)}
              className={styles.planCard}
            >
              <div className={styles.planHeader}>
                <span className={styles.planName}>{plan.name}</span>
                <div>
                  <span className={styles.planPrice}>
                    {formatWon(plan.monthlyFee)}
                  </span>
                  <span className={styles.planPriceUnit}>/월</span>
                </div>
              </div>

              <div className={styles.planDetails}>
                <span className={styles.planDetail}>
                  <span className={styles.planDetailLabel}>데이터</span>
                  {plan.data}
                </span>
                <span className={styles.planDetail}>
                  <span className={styles.planDetailLabel}>통화</span>
                  {plan.voice}
                </span>
                <span className={styles.planDetail}>
                  <span className={styles.planDetailLabel}>문자</span>
                  {plan.sms}
                </span>
              </div>

              {plan.benefits.length > 0 && (
                <div className={styles.benefits}>
                  {plan.benefits.map((benefit) => (
                    <Badge key={benefit}>{benefit}</Badge>
                  ))}
                </div>
              )}
            </Card>
          ))}
        </div>
      </div>
      <StepNavigation canProceed={selectedPlanId !== null} />
    </>
  );
}
