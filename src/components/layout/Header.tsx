import { useQuoteStore } from '../../store/useQuoteStore';
import { usePriceTableStore } from '../../store/usePriceTableStore';
import styles from './Header.module.css';

const NAV_STEPS = [1, 2, 3, 4, 5];

function formatPriceDate(isoStr: string | null): string {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' }) + ' 업데이트';
}

export function Header() {
  const reset = useQuoteStore((s) => s.reset);
  const currentStep = useQuoteStore((s) => s.currentStep);
  const setStep = useQuoteStore((s) => s.setStep);
  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const carrierId = useQuoteStore((s) => s.carrierId);

  // 단가표(Google Sheets) 마지막 로드 시각
  const lastLoaded = usePriceTableStore((s) => s.lastLoaded);
  const priceDate = formatPriceDate(lastLoaded);

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
          {priceDate && <span className={styles.navDate}>{priceDate}</span>}
        </div>
        <button className={styles.navHomeBtn} onClick={reset}>
          처음부터
        </button>
      </header>
    );
  }

  // 상담신청(6단계)은 하단 네비게이션 없이 본문에 신청 버튼이 있으므로
  // 뒤로가기를 헤더에서 제공한다.
  return (
    <header className={styles.header}>
      {currentStep > 1 && (
        <button className={styles.navBackBtn} onClick={handleBack}>
          ←
        </button>
      )}
      <h1 className={styles.title}>휴대폰 견적</h1>
      {currentStep > 1 && (
        <button className={styles.resetBtn} onClick={reset}>
          처음부터
        </button>
      )}
    </header>
  );
}
