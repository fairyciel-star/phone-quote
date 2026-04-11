import { useQuoteStore } from '../../store/useQuoteStore';
import { hapticMedium } from '../../utils/haptic';
import styles from './Step1Brand.module.css';

const BRANDS = [
  {
    id: 'samsung',
    label: 'SAMSUNG',
    filter: '삼성',
    logo: (
      <svg viewBox="0 0 200 32" className={styles.brandSvg}>
        <text x="100" y="26" textAnchor="middle" fontFamily="Arial, sans-serif" fontWeight="700" fontSize="28" fill="#000">
          SAMSUNG
        </text>
      </svg>
    ),
  },
  {
    id: 'apple',
    label: 'Apple',
    filter: 'Apple',
    logo: (
      <svg viewBox="0 0 170 170" className={styles.brandSvgApple}>
        <path d="M150.4 130.2c-2.8 6.5-6.1 12.4-10 17.9-5.3 7.5-9.6 12.7-13 15.6-5.2 4.7-10.7 7.2-16.7 7.3-4.3 0-9.4-1.2-15.5-3.6-6.1-2.4-11.6-3.6-16.8-3.6-5.3 0-11.1 1.2-17.2 3.6-6.2 2.4-11.1 3.7-14.9 3.8-5.7.3-11.4-2.2-17-7.5-3.6-3.1-8.2-8.5-13.5-16.2-5.7-8.3-10.4-17.9-14.1-28.8C-1.8 107.6-3 97-3 86.7c0-11.8 2.5-22 7.7-30.4 4-6.7 9.4-12 16.1-15.8 6.7-3.9 14-5.8 21.8-6 4.5 0 10.5 1.4 18 4.2 7.4 2.8 12.2 4.2 14.3 4.2 1.6 0 6.9-1.7 16-5 8.6-3 15.8-4.3 21.8-3.7 16.1 1.3 28.2 7.7 36.2 19.2-14.4 8.7-21.5 20.9-21.4 36.6.2 12.2 4.6 22.4 13 30.5 3.9 3.7 8.2 6.5 13 8.5-1 3-2.1 5.8-3.2 8.5zM116.3 7.1c0 9.6-3.5 18.6-10.5 26.8-8.4 9.8-18.5 15.5-29.5 14.6-.1-1.2-.2-2.4-.2-3.6 0-9.2 4-19 11.1-27.1 3.6-4.1 8.1-7.5 13.5-10.2 5.4-2.7 10.6-4.1 15.4-4.4.2 1.3.2 2.6.2 3.9z" fill="#000"/>
      </svg>
    ),
  },
  {
    id: 'kids',
    label: '키즈폰',
    filter: '키즈',
    logo: (
      <div className={styles.kidsIcon}>
        <svg viewBox="0 0 64 64" className={styles.brandSvgKids}>
          <circle cx="32" cy="28" r="18" fill="none" stroke="#4A3AFF" strokeWidth="3"/>
          <circle cx="24" cy="24" r="2.5" fill="#4A3AFF"/>
          <circle cx="40" cy="24" r="2.5" fill="#4A3AFF"/>
          <path d="M24 34 Q32 42 40 34" fill="none" stroke="#4A3AFF" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M14 16 Q10 8 16 10" fill="none" stroke="#4A3AFF" strokeWidth="2.5" strokeLinecap="round"/>
          <path d="M50 16 Q54 8 48 10" fill="none" stroke="#4A3AFF" strokeWidth="2.5" strokeLinecap="round"/>
        </svg>
        <span className={styles.kidsLabel}>키즈폰</span>
      </div>
    ),
  },
] as const;

export function Step1Brand() {
  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const setBrand = useQuoteStore((s) => s.setBrand);
  const setStep = useQuoteStore((s) => s.setStep);
  const currentStep = useQuoteStore((s) => s.currentStep);

  const handleSelect = (filter: string) => {
    hapticMedium();
    setBrand(filter);
    setStep(currentStep + 1);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>제조사를 선택해주세요!</h2>

      <div className={styles.brandList}>
        {BRANDS.map((brand) => (
          <button
            key={brand.id}
            className={`${styles.brandCard} ${selectedBrand === brand.filter ? styles.active : ''}`}
            onClick={() => handleSelect(brand.filter)}
          >
            {brand.logo}
          </button>
        ))}
      </div>
    </div>
  );
}
