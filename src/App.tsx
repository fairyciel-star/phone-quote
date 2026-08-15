import { useEffect, useLayoutEffect, useState, useRef } from 'react';
import { useQuoteStore } from './store/useQuoteStore';
import { useSheetStore } from './store/useSheetStore';
import { useRebateStore } from './store/useRebateStore';
import { usePriceTableStore } from './store/usePriceTableStore';
import { Landing } from './components/Landing';
import { PreorderPage } from './components/PreorderPage';
import { Header } from './components/layout/Header';
import { StepProgress } from './components/layout/StepProgress';
import { Step1Brand } from './components/steps/Step1Brand';
import { Step1SubscriptionType } from './components/steps/Step1SubscriptionType';
import { Step2Carrier } from './components/steps/Step2Carrier';
import { Step3Phone } from './components/steps/Step3Phone';
import { Step4PlanDiscount } from './components/steps/Step4PlanDiscount';
import { Step7Consultation } from './components/steps/Step7Consultation';
import { AdminPage } from './components/admin/AdminPage';

// 새 단가표 구글 시트 ID (고정값 - env var 불필요)
const PRICE_SHEET_ID = '1MI7Fn521lWI74Y8IUqKncA5hV-ztd1OwzW4EyAnI9BQ';

function getStepComponent(step: number) {
  switch (step) {
    case 1: return <Step2Carrier />;
    case 2: return <Step1SubscriptionType />;
    case 3: return <Step1Brand />;
    case 4: return <Step3Phone />;
    case 5: return <Step4PlanDiscount />;
    case 6: return <Step7Consultation />;
    default: return <Step2Carrier />;
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

  // 새 스텝은 항상 화면 맨 위부터 보이게 한다.
  // 그러지 않으면 이전 스텝에서 아래로 스크롤한 위치가 그대로 남아
  // 상담신청(6스텝) 진입 시 화면 중간부터 보인다.
  // 페인트 전에 처리해야 스크롤이 튀는 게 보이지 않는다.
  useLayoutEffect(() => {
    window.scrollTo(0, 0);
  }, [displayedStep]);

  return (
    <div className={fadeClass}>
      {getStepComponent(displayedStep)}
    </div>
  );
}

function App() {
  const showLanding = useQuoteStore((s) => s.showLanding);
  const showPreorder = useQuoteStore((s) => s.showPreorder);
  const setSheetLoaded = useSheetStore((s) => s.setLoaded);
  const loadPriceTable = usePriceTableStore((s) => s.loadAll);
  const [hash, setHash] = useState(window.location.hash);

  // 앱 시작 시 구글 시트에서 단가표 항상 새로 로드 (캐시 무시)
  // 제휴카드·부가서비스 혜택 조건도 같은 요청에서 함께 파싱된다
  useEffect(() => {
    usePriceTableStore.getState().clear();
    loadPriceTable(PRICE_SHEET_ID).then(() => {
      setSheetLoaded();
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 앱 시작 시 리베이트 즉시 로드 → 헤더 날짜가 스텝 1부터 표시됨
  // 공유 스토어를 통해 모든 컴포넌트가 동일한 rebateMap을 참조
  const refreshRebate = useRebateStore((s) => s.refresh);
  useEffect(() => {
    refreshRebate();
    const id = setInterval(() => refreshRebate(), 30_000);
    return () => clearInterval(id);
  }, [refreshRebate]);

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
      const { currentStep, showLanding: onLanding, showPreorder: onPreorder, exitPreorder, setStep, selectedBrand, carrierId } = useQuoteStore.getState();
      // 사전예약 페이지에서는 뒤로가기 시 페이지만 닫고 스텝은 그대로 유지
      if (onPreorder) {
        exitPreorder();
        history.pushState({ appStep: true }, '');
        return;
      }
      if (onLanding) return;
      // startKidsPath() 전용 경로(carrierId=null): 제조사(3) → 통신사(1)로 직행
      if (selectedBrand === '키즈' && carrierId === null && currentStep === 3) {
        setStep(1);
      } else if (currentStep > 1) {
        // 키즈 경로에서 뒤로가기 시 carrierId 초기화
        if (selectedBrand === '키즈' && carrierId !== null) {
          useQuoteStore.setState({ carrierId: null, selectedPhoneId: null, selectedStorage: null, selectedColor: null, selectedPlanId: null, selectedDiscountIds: [] });
        }
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

  if (showPreorder) {
    return <PreorderPage />;
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
