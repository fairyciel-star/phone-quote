import { useEffect, useRef, useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { hapticMedium } from '../../utils/haptic';
import styles from './Step1Brand.module.css';

const BRANDS = [
  {
    id: 'samsung',
    label: 'SAMSUNG',
    filter: '삼성',
    logo: <span className={styles.samsungText}>SAMSUNG</span>,
  },
  {
    id: 'apple',
    label: 'Apple',
    filter: 'Apple',
    logo: (
      <div className={styles.appleLogo}>
        <svg viewBox="0 0 170 170" className={styles.appleIcon} aria-hidden="true">
          <path d="M150.4 130.2c-2.8 6.5-6.1 12.4-10 17.9-5.3 7.5-9.6 12.7-13 15.6-5.2 4.7-10.7 7.2-16.7 7.3-4.3 0-9.4-1.2-15.5-3.6-6.1-2.4-11.6-3.6-16.8-3.6-5.3 0-11.1 1.2-17.2 3.6-6.2 2.4-11.1 3.7-14.9 3.8-5.7.3-11.4-2.2-17-7.5-3.6-3.1-8.2-8.5-13.5-16.2-5.7-8.3-10.4-17.9-14.1-28.8C-1.8 107.6-3 97-3 86.7c0-11.8 2.5-22 7.7-30.4 4-6.7 9.4-12 16.1-15.8 6.7-3.9 14-5.8 21.8-6 4.5 0 10.5 1.4 18 4.2 7.4 2.8 12.2 4.2 14.3 4.2 1.6 0 6.9-1.7 16-5 8.6-3 15.8-4.3 21.8-3.7 16.1 1.3 28.2 7.7 36.2 19.2-14.4 8.7-21.5 20.9-21.4 36.6.2 12.2 4.6 22.4 13 30.5 3.9 3.7 8.2 6.5 13 8.5-1 3-2.1 5.8-3.2 8.5zM116.3 7.1c0 9.6-3.5 18.6-10.5 26.8-8.4 9.8-18.5 15.5-29.5 14.6-.1-1.2-.2-2.4-.2-3.6 0-9.2 4-19 11.1-27.1 3.6-4.1 8.1-7.5 13.5-10.2 5.4-2.7 10.6-4.1 15.4-4.4.2 1.3.2 2.6.2 3.9z" fill="currentColor"/>
        </svg>
        <span className={styles.appleText}>Apple</span>
      </div>
    ),
  },
  // TODO: 키즈폰 기능 추가 후 아래 주석 해제
  // {
  //   id: 'kids',
  //   label: '키즈폰',
  //   filter: '키즈',
  //   logo: (
  //     <div className={styles.kidsLogo}>
  //       <span style={{ fontSize: 26, lineHeight: 1 }}>🧒</span>
  //       <span className={styles.kidsText}>키즈폰</span>
  //     </div>
  //   ),
  // },
] as const;

// 로딩 중 차례로 채워지는 "없음" 조건 목록
const NO_CONDITIONS = [
  '부가서비스 가입 조건',
  '제휴카드 발급 조건',
  '기기 반납 조건',
  '워치·태블릿 개통 조건',
] as const;

const CHARGE_MS = 380; // 조건 1개가 채워지는 간격
const DONE_HOLD_MS = 720; // NO 조건 완성 후 다음 스텝까지 여운

export function Step1Brand() {
  const selectedBrand = useQuoteStore((s) => s.selectedBrand);
  const carrierId = useQuoteStore((s) => s.carrierId);
  const setBrand = useQuoteStore((s) => s.setBrand);
  const setSubscriptionType = useQuoteStore((s) => s.setSubscriptionType);
  const setStep = useQuoteStore((s) => s.setStep);
  const currentStep = useQuoteStore((s) => s.currentStep);

  // startKidsPath()는 carrierId=null로 시작 → carrierId가 없을 때만 키즈 전용 경로
  const isKidsPath = selectedBrand === '키즈' && carrierId === null;

  const [searching, setSearching] = useState(false);
  const [charged, setCharged] = useState(0); // 채워진 조건 개수
  const [complete, setComplete] = useState(false); // NO 조건 완성 여부
  const pendingFilter = useRef<string | null>(null);
  const timersRef = useRef<number[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach((t) => window.clearTimeout(t));
    timersRef.current = [];
  };

  // 조건이 하나씩 채워지는 시퀀스
  useEffect(() => {
    if (!searching) return;
    setCharged(0);
    setComplete(false);

    const interval = window.setInterval(() => {
      setCharged((prev) => {
        const next = prev + 1;
        if (next >= NO_CONDITIONS.length) {
          window.clearInterval(interval);
          const doneTimer = window.setTimeout(() => setComplete(true), CHARGE_MS);
          timersRef.current.push(doneTimer);
        }
        return next;
      });
    }, CHARGE_MS);

    return () => window.clearInterval(interval);
  }, [searching]);

  // NO 조건 완성 → 다음 스텝으로 이동
  useEffect(() => {
    if (!complete) return;
    const filter = pendingFilter.current;
    const navTimer = window.setTimeout(() => {
      if (isKidsPath) {
        setSubscriptionType('신규가입');
      } else if (filter) {
        setBrand(filter);
        if (filter === '키즈') setSubscriptionType('신규가입');
      }
      setStep(currentStep + 1);
    }, DONE_HOLD_MS);
    timersRef.current.push(navTimer);
    return () => window.clearTimeout(navTimer);
  }, [complete, isKidsPath, setBrand, setSubscriptionType, setStep, currentStep]);

  useEffect(() => () => clearTimers(), []);

  const handleSelect = (filter: string) => {
    if (searching) return;
    hapticMedium();
    pendingFilter.current = filter;
    setSearching(true);
  };

  return (
    <div className={styles.container}>
      <h2 className={styles.title}>제조사를 선택해주세요!</h2>

      <div className={styles.brandList}>
        {BRANDS.filter((b) => !isKidsPath || b.id !== 'kids' as string).map((brand) => (
          <button
            key={brand.id}
            className={`${styles.brandCard} ${selectedBrand === brand.filter ? styles.active : ''}`}
            onClick={() => handleSelect(brand.filter)}
          >
            {brand.logo}
          </button>
        ))}
      </div>

      {searching && (
        <div className={styles.searchOverlay} role="status" aria-live="polite">
          <div className={`${styles.noCard} ${complete ? styles.noCardDone : ''}`}>
            <div className={styles.noCardHeader}>
              <div className={styles.noCardTitle}>
                <span className={styles.noCardTitleSub}>조건은 깔끔하게</span>
                <strong className={styles.noCardTitleMain}>
                  {complete ? '전부 없음' : '조건 확인 중'}
                </strong>
              </div>
              <div className={`${styles.noBadge} ${complete ? styles.noBadgeDone : ''}`}>
                {complete ? (
                  <>
                    <svg className={styles.noBadgeCheck} viewBox="0 0 24 24" fill="none">
                      <path
                        d="M5 12.5l4.5 4.5L19 7.5"
                        stroke="currentColor"
                        strokeWidth="2.6"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                    <span className={styles.noBadgeLabel}>NO 조건</span>
                  </>
                ) : (
                  <span className={styles.noBadgeCount}>{charged}/{NO_CONDITIONS.length}</span>
                )}
              </div>
            </div>

            <div className={styles.noSubtitle}>
              {complete ? '숨은 조건 0 · 이 가격 그대로' : '숨은 조건이 있는지 살펴보는 중…'}
            </div>

            <div className={styles.condList}>
              {NO_CONDITIONS.map((label, i) => {
                const isDone = charged > i;
                return (
                  <div
                    key={label}
                    className={`${styles.condRow} ${isDone ? styles.condRowDone : ''}`}
                  >
                    <span className={styles.condFill} aria-hidden="true" />
                    <span className={styles.condCheck} aria-hidden="true">
                      <svg viewBox="0 0 24 24" fill="none">
                        <path
                          d="M5 12.5l4.5 4.5L19 7.5"
                          stroke="currentColor"
                          strokeWidth="2.6"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>
                    <span className={styles.condLabel}>{label}</span>
                    <span className={styles.condValue}>없음</span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
