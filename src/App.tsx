import { useEffect } from 'react';
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
import { Step6Summary } from './components/steps/Step6Summary';
import { Step7Consultation } from './components/steps/Step7Consultation';

// ★ 여기에 Google Sheets ID를 넣으세요
// URL이 https://docs.google.com/spreadsheets/d/XXXXX/edit 이면 XXXXX 부분
const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '';

function StepContent() {
  const currentStep = useQuoteStore((s) => s.currentStep);

  switch (currentStep) {
    case 1: return <Step1Brand />;
    case 2: return <Step3Phone />;
    case 3: return <Step1SubscriptionType />;
    case 4: return <Step2Carrier />;
    case 5: return <Step4PlanDiscount />;
    case 6: return <Step6Summary />;
    case 7: return <Step7Consultation />;
    default: return <Step1Brand />;
  }
}

function App() {
  const showLanding = useQuoteStore((s) => s.showLanding);
  const loadFromSheet = useSheetStore((s) => s.loadFromSheet);

  useEffect(() => {
    if (SHEET_ID) {
      loadFromSheet(SHEET_ID);
    }
  }, [loadFromSheet]);

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
