import { useQuoteStore } from '../store/useQuoteStore';
import styles from './Landing.module.css';

export function Landing() {
  const enterQuote = useQuoteStore((s) => s.enterQuote);

  return (
    <div className={styles.landing}>
      <img
        className={styles.bgImage}
        src="/images/store.webp"
        alt="동네휴대폰마트 매장"
      />
      <div className={styles.overlay} />

      <div className={styles.content}>
        <button className={styles.ctaButton} onClick={enterQuote}>
          시세표 확인하기
          <span className={styles.ctaArrow}>→</span>
        </button>
      </div>
    </div>
  );
}
