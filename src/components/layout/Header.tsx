import { useQuoteStore } from '../../store/useQuoteStore';
import styles from './Header.module.css';

export function Header() {
  const reset = useQuoteStore((s) => s.reset);
  const currentStep = useQuoteStore((s) => s.currentStep);

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
