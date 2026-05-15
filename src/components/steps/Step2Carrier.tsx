import type { CarrierId } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { Card } from '../ui/Card';
import carriersData from '../../data/carriers.json';
import { hapticMedium } from '../../utils/haptic';
import styles from './Step2Carrier.module.css';

export function Step2Carrier() {
  const carrierId = useQuoteStore((s) => s.carrierId);
  const previousCarrier = useQuoteStore((s) => s.previousCarrier);
  const selected = previousCarrier ?? carrierId;
  const setCarrier = useQuoteStore((s) => s.setCarrier);
  const setStep = useQuoteStore((s) => s.setStep);
  const currentStep = useQuoteStore((s) => s.currentStep);
  const startKidsPath = useQuoteStore((s) => s.startKidsPath);

  const handleSelect = (carrierId: CarrierId) => {
    hapticMedium();
    setCarrier(carrierId);
    setStep(currentStep + 1);
  };

  const handleKids = () => {
    hapticMedium();
    startKidsPath();
  };

  return (
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
        <Card onClick={handleKids}>
          <div className={styles.cardContent}>
            <div className={styles.kidsIcon}>🧸</div>
            <div className={styles.kidsTextWrap}>
              <span className={styles.kidsMain}>신규가입</span>
              <span className={styles.kidsSub}>키즈폰 전용</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
}
