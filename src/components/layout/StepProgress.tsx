import { useEffect, useRef } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import styles from './StepProgress.module.css';

const STEP_LABELS = ['제조사', '모델', '통신사', '가입유형', '요금제·할인', '가격확인', '상담신청'];

export function StepProgress() {
  const currentStep = useQuoteStore((s) => s.currentStep);
  const activeRef = useRef<HTMLDivElement>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);

  // 현재 단계가 보이도록 자동 스크롤
  useEffect(() => {
    if (activeRef.current && wrapperRef.current) {
      const wrapper = wrapperRef.current;
      const active = activeRef.current;
      const scrollLeft = active.offsetLeft - wrapper.offsetWidth / 2 + active.offsetWidth / 2;
      wrapper.scrollTo({ left: Math.max(0, scrollLeft), behavior: 'smooth' });
    }
  }, [currentStep]);

  return (
    <div className={styles.wrapper} ref={wrapperRef}>
      <div className={styles.steps}>
        {STEP_LABELS.map((label, index) => {
          const stepNum = index + 1;
          const isActive = stepNum === currentStep;
          const isCompleted = stepNum < currentStep;

          return (
            <div key={label} className={styles.step} ref={isActive ? activeRef : undefined}>
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
