import { useQuoteStore } from '../../store/useQuoteStore';
import styles from './StepProgress.module.css';

const STEP_LABELS = ['통신사', '가입유형', '제조사', '모델', '요금제·가격', '상담신청'];
const TOTAL_STEPS = STEP_LABELS.length;

export function StepProgress() {
  const currentStep = useQuoteStore((s) => s.currentStep);
  const label = STEP_LABELS[currentStep - 1] ?? '';
  const progress = (currentStep / TOTAL_STEPS) * 100;

  return (
    <div className={styles.wrapper}>
      <div className={styles.header}>
        <span className={styles.counter}>
          STEP <strong>{String(currentStep).padStart(2, '0')}</strong> / {String(TOTAL_STEPS).padStart(2, '0')}
        </span>
        <span className={styles.label}>{label}</span>
      </div>
      <div className={styles.track}>
        <div className={styles.fill} style={{ width: `${progress}%` }} />
      </div>
    </div>
  );
}
