import { useQuoteStore } from '../../store/useQuoteStore';
import { Button } from '../ui/Button';
import styles from './StepNavigation.module.css';

interface StepNavigationProps {
  readonly canProceed: boolean;
  readonly onNext?: () => void;
  readonly onSubmit?: () => void;
}

export function StepNavigation({ canProceed, onNext, onSubmit }: StepNavigationProps) {
  const currentStep = useQuoteStore((s) => s.currentStep);
  const setStep = useQuoteStore((s) => s.setStep);

  const isFirst = currentStep === 1;
  const isLast = currentStep === 6;

  const handlePrev = () => {
    if (!isFirst) setStep(currentStep - 1);
  };

  const handleNext = () => {
    if (isLast) {
      onSubmit?.();
    } else {
      onNext?.();
      setStep(currentStep + 1);
    }
  };

  return (
    <>
      <div className={styles.spacer} />
      <div className={styles.wrapper}>
        {!isFirst && (
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
