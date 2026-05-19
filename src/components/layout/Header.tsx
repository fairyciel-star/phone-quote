import { useEffect, useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { lastRebateUpdatedAt } from '../../lib/supabase-rebate';
import styles from './Header.module.css';

const NAV_STEPS = [1, 2, 3, 4, 5];

function formatRebateDate(isoStr: string | null): string {
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

  // 리베이트 최종 수정일 (1초 간격 폴링으로 갱신 감지)
  const [rebateDate, setRebateDate] = useState(() => formatRebateDate(lastRebateUpdatedAt));
  useEffect(() => {
    const id = setInterval(() => {
      const next = formatRebateDate(lastRebateUpdatedAt);
      setRebateDate((prev) => prev !== next ? next : prev);
    }, 1000);
    return () => clearInterval(id);
  }, []);

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
          {rebateDate && <span className={styles.navDate}>{rebateDate}</span>}
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
