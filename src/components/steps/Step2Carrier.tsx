import type { CarrierId } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { Card } from '../ui/Card';
import carriersData from '../../data/carriers.json';
import { hapticMedium } from '../../utils/haptic';
import styles from './Step2Carrier.module.css';

export function Step2Carrier() {
  // 번호이동으로 carrierId가 교체된 상태에서 Step2로 돌아와도
  // "현재 통신사"(= previousCarrier)를 선택된 것으로 표시한다.
  const carrierId = useQuoteStore((s) => s.carrierId);
  const previousCarrier = useQuoteStore((s) => s.previousCarrier);
  const selected = previousCarrier ?? carrierId;
  const setCarrier = useQuoteStore((s) => s.setCarrier);
  const setStep = useQuoteStore((s) => s.setStep);
  const currentStep = useQuoteStore((s) => s.currentStep);

  const handleSelect = (carrierId: CarrierId) => {
    hapticMedium();
    setCarrier(carrierId);
    setStep(currentStep + 1);
  };

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>현재 통신사 어디세요?</h2>
        <p className={styles.subtitle}>이용하실 통신사를 선택해주세요</p>
        <div className={styles.cards}>
          {carriersData.map((carrier) => (
            <Card
              key={carrier.id}
              selected={selected === carrier.id}
              onClick={() => handleSelect(carrier.id as CarrierId)}
            >
              <div className={styles.cardContent}>
                <img
                  className={styles.carrierLogo}
                  src={`/images/${carrier.id}.png`}
                  alt={carrier.name}
                />
                <span className={styles.carrierName}>{carrier.name}</span>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </>
  );
}
