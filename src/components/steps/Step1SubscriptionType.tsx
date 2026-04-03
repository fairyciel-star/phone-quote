import type { SubscriptionType, CarrierId } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { StepNavigation } from '../layout/StepNavigation';
import carriersData from '../../data/carriers.json';
import styles from './Step1SubscriptionType.module.css';

const OPTIONS: readonly { type: SubscriptionType; icon: string; label: string; desc: string }[] = [
  { type: '번호이동', icon: '🔄', label: '통신사변경', desc: '다른 통신사로 변경해요' },
  { type: '기기변경', icon: '📱', label: '기기변경', desc: '같은 통신사에서 기기만 바꿔요' },
];

export function Step1SubscriptionType() {
  const selected = useQuoteStore((s) => s.subscriptionType);
  const setType = useQuoteStore((s) => s.setSubscriptionType);
  const carrierId = useQuoteStore((s) => s.carrierId);
  const previousCarrier = useQuoteStore((s) => s.previousCarrier);
  const setPreviousCarrier = useQuoteStore((s) => s.setPreviousCarrier);

  // 통신사변경 시 기존 통신사를 제외한 목록
  const otherCarriers = carriersData.filter((c) => c.id !== carrierId);

  const canProceed = selected !== null && (selected !== '번호이동' || previousCarrier !== null);

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>가입유형 선택</h2>
        <p className={styles.subtitle}>원하시는 가입 유형을 선택해주세요</p>

        <div className={styles.buttons}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              className={`${styles.typeBtn} ${selected === opt.type ? styles.typeBtnActive : ''}`}
              onClick={() => setType(opt.type)}
            >
              <span className={styles.typeIcon}>{opt.icon}</span>
              <span className={styles.typeLabel}>{opt.label}</span>
              <span className={styles.typeDesc}>{opt.desc}</span>
            </button>
          ))}
        </div>

        {selected === '번호이동' && (
          <div className={styles.previousCarrier}>
            <div className={styles.previousCarrierTitle}>현재 사용 중인 통신사</div>
            <div className={styles.carrierOptions}>
              {otherCarriers.map((carrier) => (
                <button
                  key={carrier.id}
                  className={`${styles.carrierBtn} ${previousCarrier === carrier.id ? styles.carrierBtnActive : ''}`}
                  onClick={() => setPreviousCarrier(carrier.id as CarrierId)}
                >
                  <img
                    src={`/images/${carrier.id}.png`}
                    alt={carrier.name}
                    className={styles.carrierLogo}
                  />
                  <span className={styles.carrierName}>{carrier.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
      <StepNavigation canProceed={canProceed} />
    </>
  );
}
