import { useState, useEffect, useCallback } from 'react';
import type { SubscriptionType } from '../../types';
import { useQuoteStore } from '../../store/useQuoteStore';
import { StepNavigation } from '../layout/StepNavigation';
import styles from './Step1SubscriptionType.module.css';

const OPTIONS: readonly { type: SubscriptionType; icon: string; label: string; desc: string }[] = [
  { type: '번호이동', icon: '🔄', label: '번호이동', desc: '기존 번호 그대로 통신사를 바꿔요' },
  { type: '기기변경', icon: '📱', label: '기기변경', desc: '같은 통신사에서 기기만 바꿔요' },
];

// 슬라이드 광고 배너 이미지 (public/images/banners/ 폴더에 추가)
const BANNER_IMAGES = [
  '/images/banners/배너1.webp',
  '/images/banners/배너2.webp',
];

export function Step1SubscriptionType() {
  const selected = useQuoteStore((s) => s.subscriptionType);
  const setType = useQuoteStore((s) => s.setSubscriptionType);

  const [currentSlide, setCurrentSlide] = useState(0);
  const [validBanners, setValidBanners] = useState<string[]>([]);

  // 존재하는 배너 이미지만 필터링
  useEffect(() => {
    const checkImages = async () => {
      const results = await Promise.all(
        BANNER_IMAGES.map(async (src) => {
          try {
            const res = await fetch(src, { method: 'HEAD' });
            return res.ok ? src : null;
          } catch {
            return null;
          }
        })
      );
      setValidBanners(results.filter((s): s is string => s !== null));
    };
    checkImages();
  }, []);

  const nextSlide = useCallback(() => {
    if (validBanners.length > 1) {
      setCurrentSlide((prev) => (prev + 1) % validBanners.length);
    }
  }, [validBanners.length]);

  // 자동 슬라이드 (4초)
  useEffect(() => {
    if (validBanners.length <= 1) return;
    const timer = setInterval(nextSlide, 4000);
    return () => clearInterval(timer);
  }, [nextSlide, validBanners.length]);

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>가입유형 선택</h2>
        <p className={styles.subtitle}>원하시는 가입 유형을 선택해주세요</p>

        {/* 슬라이드 광고 영역 */}
        <div className={styles.slider}>
          {validBanners.length > 0 ? (
            <>
              <div className={styles.slideTrack} style={{ transform: `translateX(-${currentSlide * 100}%)` }}>
                {validBanners.map((src, i) => (
                  <div key={src} className={styles.slide}>
                    <img src={src} alt={`배너 ${i + 1}`} className={styles.slideImage} />
                  </div>
                ))}
              </div>
              {validBanners.length > 1 && (
                <div className={styles.dots}>
                  {validBanners.map((_, i) => (
                    <button
                      key={i}
                      className={`${styles.dot} ${currentSlide === i ? styles.dotActive : ''}`}
                      onClick={() => setCurrentSlide(i)}
                    />
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className={styles.sliderPlaceholder}>
              <span className={styles.placeholderText}>광고 배너 영역</span>
              <span className={styles.placeholderSub}>public/images/banners/ 에 이미지를 추가하세요</span>
            </div>
          )}
        </div>

        {/* 가입유형 버튼 */}
        <div className={styles.buttons}>
          {OPTIONS.map((opt) => (
            <button
              key={opt.type}
              className={`${styles.typeBtn} ${selected === opt.type ? styles.typeBtnActive : ''}`}
              onClick={() => setType(opt.type)}
            >
              <span className={styles.typeIcon}>{opt.icon}</span>
              <span className={styles.typeLabel}>{opt.label}</span>
              <span className={styles.typeDesc}>{opt.desc}</span>
            </button>
          ))}
        </div>
      </div>
      <StepNavigation canProceed={selected !== null} />
    </>
  );
}
