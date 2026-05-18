import type { SubscriptionType, CarrierId } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import carriersData from '../../data/carriers.json';
import { hapticLight, hapticMedium } from '../../utils/haptic';
import styles from './Step1SubscriptionType.module.css';

const OPTIONS: readonly {
  type: SubscriptionType;
  label: string;
  desc: string;
  icon: string;
}[] = [
  { type: '번호이동', label: '통신사변경',  desc: '다른 통신사로 변경해요',       icon: '↻' },
  { type: '기기변경', label: '기기변경',   desc: '같은 통신사에서 기기만 바꿔요', icon: '↔' },
];

const CARRIER_NAMES: Record<string, string> = {
  SKT: 'SK텔레콤',
  KT:  'KT',
  LGU: 'LG U+',
};

const TOTAL_STEPS = 6;
const CURRENT_STEP = 2;

export function Step1SubscriptionType() {
  const selected        = useQuoteStore((s) => s.subscriptionType);
  const setType         = useQuoteStore((s) => s.setSubscriptionType);
  const carrierId       = useQuoteStore((s) => s.carrierId);
  const previousCarrier = useQuoteStore((s) => s.previousCarrier);
  const setPreviousCarrier = useQuoteStore((s) => s.setPreviousCarrier);
  const switchCarrier   = useQuoteStore((s) => s.switchCarrier);
  const setStep         = useQuoteStore((s) => s.setStep);
  const currentStep     = useQuoteStore((s) => s.currentStep);
  const reset           = useQuoteStore((s) => s.reset);

  const originalCarrier = previousCarrier ?? carrierId;
  const otherCarriers   = carriersData.filter((c) => c.id !== originalCarrier);

  const handleSelectNewCarrier = (newCarrierId: CarrierId) => {
    if (!previousCarrier && carrierId) {
      setPreviousCarrier(carrierId);
    }
    switchCarrier(newCarrierId);
  };

  const newCarrierSelected = carrierId !== null && carrierId !== originalCarrier;
  const validType   = selected === '번호이동' || selected === '기기변경';
  const canProceed  = validType && (selected !== '번호이동' || newCarrierSelected);

  const handleBack = () => {
    hapticMedium();
    setStep(currentStep - 1);
  };

  const handleNext = () => {
    if (!canProceed) return;
    hapticMedium();
    setStep(currentStep + 1);
  };

  const progress = (CURRENT_STEP / TOTAL_STEPS) * 100;
  const carrierLabel = originalCarrier ? CARRIER_NAMES[originalCarrier] ?? originalCarrier : '';

  return (
    <div className={styles.overlay}>

      {/* 헤더 */}
      <div className={styles.header}>
        <button className={styles.backBtn} onClick={handleBack}>‹</button>
        <span className={styles.headerTitle}>오늘의 시세</span>
        <button className={styles.resetBtn} onClick={reset}>처음부터</button>
      </div>

      {/* 스텝 진행 */}
      <div className={styles.stepBar}>
        <div className={styles.stepRow}>
          <span className={styles.stepCounter}>
            STEP <strong>{String(CURRENT_STEP).padStart(2, '0')}</strong> / {String(TOTAL_STEPS).padStart(2, '0')}
          </span>
          <span className={styles.stepLabel}>가입유형</span>
        </div>
        <div className={styles.stepTrack}>
          <div className={styles.stepFill} style={{ width: `${progress}%` }} />
        </div>
      </div>

      {/* 본문 */}
      <div className={styles.content}>
        {carrierLabel && (
          <p className={styles.context}>현재 통신사 · {carrierLabel}</p>
        )}
        <h2 className={styles.heading}>
          어떻게<br />가입하시겠어요?
        </h2>
        <p className={styles.subtitle}>
          현재 통신사를 유지하거나, 더 좋은 조건의<br />통신사로 변경할 수 있어요.
        </p>

        <div className={styles.cards}>
          {OPTIONS.map((opt) => {
            const isSelected = selected === opt.type;
            return (
              <div
                key={opt.type}
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''}`}
                onClick={() => { hapticLight(); setType(opt.type); }}
              >
                <div className={`${styles.iconBox} ${isSelected ? styles.iconBoxSelected : ''}`}>
                  <span className={styles.iconText}>{opt.icon}</span>
                </div>
                <div className={styles.cardCenter}>
                  <span className={styles.cardName}>{opt.label}</span>
                  <span className={`${styles.cardDesc} ${isSelected ? styles.cardDescSelected : ''}`}>
                    {opt.desc}
                  </span>
                </div>
                <div className={`${styles.radio} ${isSelected ? styles.radioSelected : ''}`} />
              </div>
            );
          })}
        </div>

        {/* 기기변경 안내 박스 */}
        {selected === '기기변경' && (
          <div className={styles.infoBox}>
            <p className={styles.infoText}>· 현재 이용 중인 통신사를 그대로 유지해요</p>
            <p className={styles.infoText}>· 번호와 요금제를 유지하며 기기만 교체해요</p>
          </div>
        )}

        {/* 번호이동 시 타 통신사 선택 */}
        {selected === '번호이동' && (
          <div className={styles.newCarrierSection}>
            <p className={styles.newCarrierTitle}>변경할 통신사를 선택해주세요</p>
            <div className={styles.newCarrierCards}>
              {otherCarriers.map((carrier) => {
                const isActive = carrierId === carrier.id;
                return (
                  <div
                    key={carrier.id}
                    className={`${styles.carrierCard} ${isActive ? styles.carrierCardSelected : ''}`}
                    onClick={() => { hapticMedium(); handleSelectNewCarrier(carrier.id as CarrierId); }}
                  >
                    <span className={`${styles.carrierName} ${isActive ? styles.carrierNameSelected : ''}`}>
                      {carrier.name}
                    </span>
                    <div className={`${styles.radio} ${isActive ? styles.radioSelected : ''}`} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* 하단 버튼 */}
      <div className={styles.bottomBar}>
        <button
          className={`${styles.nextBtn} ${canProceed ? '' : styles.nextBtnDisabled}`}
          onClick={handleNext}
          disabled={!canProceed}
        >
          다음으로 →
        </button>
      </div>

    </div>
  );
}
