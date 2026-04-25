import { useEffect, useState, useRef } from 'react';
import { useQuoteStore } from './store/useQuoteStore';
import { useSheetStore } from './store/useSheetStore';
import { Landing } from './components/Landing';
import { Header } from './components/layout/Header';
import { StepProgress } from './components/layout/StepProgress';
import { Step1Brand } from './components/steps/Step1Brand';
import { Step1SubscriptionType } from './components/steps/Step1SubscriptionType';
import { Step2Carrier } from './components/steps/Step2Carrier';
import { Step3Phone } from './components/steps/Step3Phone';
import { Step4PlanDiscount } from './components/steps/Step4PlanDiscount';
import { Step7Consultation } from './components/steps/Step7Consultation';
import { AdminPage } from './components/admin/AdminPage';

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '';

function getStepComponent(step: number) {
  switch (step) {
    case 1: return <Step1Brand />;
    case 2: return <Step3Phone />;
    case 3: return <Step2Carrier />;
    case 4: return <Step1SubscriptionType />;
    case 5: return <Step4PlanDiscount />;
    case 6: return <Step7Consultation />;
    default: return <Step1Brand />;
  }
}

function StepContent() {
  const currentStep = useQuoteStore((s) => s.currentStep);
  const [displayedStep, setDisplayedStep] = useState(currentStep);
  const [fadeClass, setFadeClass] = useState('step-fade-in');
  const prevStep = useRef(currentStep);

  useEffect(() => {
    if (currentStep !== prevStep.current) {
      // fade out
      setFadeClass('step-fade-out');
      const timer = setTimeout(() => {
        setDisplayedStep(currentStep);
        setFadeClass('step-fade-in');
        prevStep.current = currentStep;
      }, 150);
      return () => clearTimeout(timer);
    }
  }, [currentStep]);

  return (
    <div className={fadeClass}>
      {getStepComponent(displayedStep)}
    </div>
  );
}

function App() {
  const showLanding = useQuoteStore((s) => s.showLanding);
  const loadFromSheet = useSheetStore((s) => s.loadFromSheet);
  const [hash, setHash] = useState(window.location.hash);

  useEffect(() => {
    if (SHEET_ID) {
      loadFromSheet(SHEET_ID);
    }
  }, [loadFromSheet]);

  useEffect(() => {
    const handleHash = () => setHash(window.location.hash);
    window.addEventListener('hashchange', handleHash);
    return () => window.removeEventListener('hashchange', handleHash);
  }, []);

  // 하드웨어/브라우저 뒤로가기 → 앱 종료 대신 이전 단계로
  useEffect(() => {
    if (window.location.hash === '#/admin') return;
    // 현재 히스토리 위에 sentinel 항목 추가 — 뒤로가기가 소비할 대상
    history.pushState({ appStep: true }, '');

    const handlePopState = () => {
      if (window.location.hash === '#/admin') return;
      const { currentStep, showLanding: onLanding, setStep } = useQuoteStore.getState();
      if (onLanding) return; // 랜딩에서는 자연스럽게 종료
      if (currentStep > 1) {
        setStep(currentStep - 1);
      } else {
        useQuoteStore.setState({ showLanding: true });
      }
      // sentinel 재추가 — 다음 뒤로가기도 처리할 수 있도록
      history.pushState({ appStep: true }, '');
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Admin route: /#/admin
  if (hash === '#/admin') {
    return <AdminPage />;
  }

  if (showLanding) {
    return <Landing />;
  }

  return (
    <>
      <Header />
      <StepProgress />
      <main>
        <StepContent />
      </main>
    </>
  );
}

export default App;
