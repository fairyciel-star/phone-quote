import { useQuoteStore } from '../../store/useQuoteStore';
import styles from './StepProgress.module.css';

const STEP_LABELS = ['제조사', '가입유형', '통신사', '모델', '요금제·할인', '가격확인', '상담신청'];

export function StepProgress() {
  const currentStep = useQuoteStore((s) => s.currentStep);

  return (
    <div className={styles.wrapper}>
      <div className={styles.steps}>
        {STEP_LABELS.map((label, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;

          return (
            <div key={label} className={styles.step}>
              {index > 0 && (
                <span className={`${styles.connector} ${isCompleted ? styles.completed : ''}`} />
              )}
              <span
                className={`${styles.stepNumber} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}
              >
                {isCompleted ? '✓' : stepNum}
              </span>
              <span
                className={`${styles.stepLabel} ${isActive ? styles.active : ''} ${isCompleted ? styles.completed : ''}`}
              >
                {label}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
