import type { CarrierId } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { Card } from '../ui/Card';
import { StepNavigation } from '../layout/StepNavigation';
import carriersData from '../../data/carriers.json';
import styles from './Step2Carrier.module.css';

export function Step2Carrier() {
  const selected = useQuoteStore((s) => s.carrierId);
  const setCarrier = useQuoteStore((s) => s.setCarrier);

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>통신사 선택</h2>
        <p className={styles.subtitle}>이용하실 통신사를 선택해주세요</p>
        <div className={styles.cards}>
          {carriersData.map((carrier) => (
            <Card
              key={carrier.id}
              selected={selected === carrier.id}
              onClick={() => setCarrier(carrier.id as CarrierId)}
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
      <StepNavigation canProceed={selected !== null} />
    </>
  );
}
