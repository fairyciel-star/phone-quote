import { useQuoteStore } from '../../store/useQuoteStore';
import styles from './Header.module.css';

const NAV_STEPS = [1, 2, 3, 5];

export function Header() {
  const reset = useQuoteStore((s) => s.reset);
  const currentStep = useQuoteStore((s) => s.currentStep);
  const setStep = useQuoteStore((s) => s.setStep);

  if (NAV_STEPS.includes(currentStep)) {
    return (
      <header className={styles.header}>
        <button
          className={styles.navBackBtn}
          onClick={() => currentStep === 1 ? reset() : setStep(currentStep - 1)}
        >
          ←
        </button>
        <span className={styles.navTitle}>오늘 실시간 시세 확인하기</span>
        <button className={styles.navHomeBtn} onClick={reset}>
          🏠
        </button>
      </header>
    );
  }

  return (
    <header className={styles.header}>
      <h1 className={styles.title}>휴대폰 견적</h1>
      {currentStep > 1 && (
        <button className={styles.resetBtn} onClick={reset}>
          처음부터
        </button>
      )}
    </header>
  );
}
