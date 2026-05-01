import { useQuoteStore } from '../../store/useQuoteStore';
import styles from './Header.module.css';

const NAV_STEPS = [1, 2, 3, 4, 5];

export function Header() {
  const reset = useQuoteStore((s) => s.reset);
  const currentStep = useQuoteStore((s) => s.currentStep);
  const setStep = useQuoteStore((s) => s.setStep);
  const selectedBrand = useQuoteStore((s) => s.selectedBrand);

  const handleBack = () => {
    if (currentStep === 1) return reset();
    if (selectedBrand === '키즈' && currentStep === 4) return reset();
    setStep(currentStep - 1);
  };

  if (NAV_STEPS.includes(currentStep)) {
    return (
      <header className={styles.header}>
        <button
          className={styles.navBackBtn}
          onClick={handleBack}
        >
          ←
        </button>
        <span className={styles.navTitle}>오늘 실시간 시세 확인하기</span>
        <button className={styles.navHomeBtn} onClick={reset}>
          처음부터
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
