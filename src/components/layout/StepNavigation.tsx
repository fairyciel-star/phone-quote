import { useQuoteStore } from '../../store/useQuoteStore';
import { Button } from '../ui/Button';
import { formatWon } from '../../utils/format';
import styles from './StepNavigation.module.css';

interface PriceDisplay {
  readonly 출고가: number;
  readonly 할부원금: number;
}

interface StepNavigationProps {
  readonly canProceed: boolean;
  readonly onNext?: () => void;
  readonly onSubmit?: () => void;
  readonly priceDisplay?: PriceDisplay;
}

// Steps 1,2,3,5: back button lives in the Header nav bar
// Step 4: no back button anywhere
// Step 6: back button in bottom nav
const BOTTOM_BACK_STEP = 6;

export function StepNavigation({ canProceed, onNext, onSubmit, priceDisplay }: StepNavigationProps) {
  const currentStep = useQuoteStore((s) => s.currentStep);
  const setStep = useQuoteStore((s) => s.setStep);

  const isLast = currentStep === 6;
  const showBack = currentStep === BOTTOM_BACK_STEP;

  const handlePrev = () => setStep(currentStep - 1);

  const handleNext = () => {
    if (isLast) {
      onSubmit?.();
    } else {
      onNext?.();
      setStep(currentStep + 1);
    }
  };

  if (priceDisplay) {
    return (
      <>
        <div className={styles.spacer} />
        <div className={styles.wrapper}>
          <div className={styles.priceInfo}>
            <span className={styles.priceOriginal}>{formatWon(priceDisplay.출고가)}</span>
            <span className={styles.priceMain}>{formatWon(priceDisplay.할부원금)}</span>
          </div>
          <Button variant="primary" onClick={handleNext} disabled={!canProceed}>
            신청하기
          </Button>
        </div>
      </>
    );
  }

  return (
    <>
      <div className={styles.spacer} />
      <div className={styles.wrapper}>
        {showBack && (
          <Button variant="secondary" onClick={handlePrev} fullWidth>
            이전
          </Button>
        )}
        <Button
          variant="primary"
          onClick={handleNext}
          disabled={!canProceed}
          fullWidth
        >
          {isLast ? '상담 신청하기' : '다음'}
        </Button>
      </div>
    </>
  );
}
