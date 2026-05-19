import { useQuoteStore } from '../../store/useQuoteStore';
import styles from './Header.module.css';

const NAV_STEPS = [1, 2, 3, 4, 5];

export function Header() {
  const reset = useQuoteStore((s) => s.reset);
  const currentStep = useQuoteStore((s) => s.currentStep);
  const setStep = useQuoteStore((s) => s.setStep);
  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const carrierId = useQuoteStore((s) => s.carrierId);

  const handleBack = () => {
    if (currentStep === 1) return reset();
    // 키즈 경로: 제조사(3) → 통신사(1)로 직행
    if (selectedBrand === '키즈' && currentStep === 3) return setStep(1);
    // 키즈 경로에서 뒤로가기 시 carrierId 초기화 (모델 선택으로 오염된 통신사 제거)
    if (selectedBrand === '키즈' && carrierId !== null) {
      useQuoteStore.setState({ carrierId: null, selectedPhoneId: null, selectedStorage: null, selectedColor: null, selectedPlanId: null, selectedDiscountIds: [] });
    }
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
        <div className={styles.navTitleWrap}>
          <span className={styles.navTitle}>오늘의 시세</span>
          <span className={styles.navDate}>{new Date().toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' })} 기준</span>
        </div>
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
