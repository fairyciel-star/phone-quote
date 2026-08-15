import { useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { Button } from '../ui/Button';
import { StoreLocation } from '../ui/StoreLocation';
import { STORE } from '../../data/store';
import { formatPhone, formatWon } from '../../utils/format';
import { sendTelegramNotification, escapeHtml } from '../../utils/telegram';
import { useSheetStore } from '../../store/useSheetStore';
import phonesData from '../../data/phones.json';
import plansData from '../../data/plans.json';
import carriersData from '../../data/carriers.json';
import type { Phone, Plan, PlanTier } from '../../types';
import { calculateFullQuote } from '../../utils/price';
import discountsData from '../../data/discounts.json';
import type { Discount } from '../../types';
import styles from './Step7Consultation.module.css';
import summaryStyles from './Step6Summary.module.css';
import { KakaoChannelBanner } from '../ui/KakaoChannelBanner';

const phones = phonesData as unknown as Phone[];
const plans = plansData as unknown as Plan[];
const jsonDiscounts = discountsData as unknown as Discount[];

const CALL_TIMES = [
  '상관없음',
  '오전 (10~12시)',
  '오후 (12~18시)',
  '저녁 (18~21시)',
];

export function Step7Consultation() {
  const consultation = useQuoteStore((s) => s.consultation);
  const setConsultation = useQuoteStore((s) => s.setConsultation);
  const reset = useQuoteStore((s) => s.reset);

  const subscriptionType = useQuoteStore((s) => s.subscriptionType);
  const carrierId = useQuoteStore((s) => s.carrierId);
  const selectedPhoneId = useQuoteStore((s) => s.selectedPhoneId);
  const selectedStorage = useQuoteStore((s) => s.selectedStorage);
  const selectedPlanId = useQuoteStore((s) => s.selectedPlanId);
  const discountType = useQuoteStore((s) => s.discountType);

  const phone = phones.find((p) => p.id === selectedPhoneId);
  const carrier = carriersData.find((c) => c.id === carrierId);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const [agreedPrivacy, setAgreedPrivacy] = useState(false);

  const phoneOk = /^01[016789]\d{7,8}$/.test(consultation.phone.replace(/\D/g, ''));

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!phoneOk) {
      newErrors.phone = '올바른 휴대폰 번호를 입력해주세요';
    }

    if (!agreedPrivacy) {
      newErrors.privacy = '개인정보 수집·이용에 동의해주세요';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const [sending, setSending] = useState(false);

  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);
  const getSelectAgreementSubsidy = useSheetStore((s) => s.getSelectAgreementSubsidy);
  const getSheetPlans = useSheetStore((s) => s.getPlansForCarrier);
  const getSheetCards = useSheetStore((s) => s.getCardDiscountsForCarrier);
  const getSheetAddons = useSheetStore((s) => s.getAddonsForCarrier);

  const displaySheetPlans = sheetLoaded && carrierId ? getSheetPlans(carrierId) : [];
  const plan = (displaySheetPlans.length > 0 ? displaySheetPlans : plans).find((p) => p.id === selectedPlanId);
  const handleSubmit = async () => {
    if (!validate()) return;
    setSending(true);

    const state = useQuoteStore.getState();
    const { selectedPhoneId, selectedStorage, selectedColor, carrierId, selectedPlanId, discountType, selectedDiscountIds, 할부개월, subscriptionType } = state;

    // 견적 데이터 조합
    const phone = phones.find((p) => p.id === selectedPhoneId);
    const carrier = carriersData.find((c) => c.id === carrierId);

    const sheetPlans = sheetLoaded && carrierId ? getSheetPlans(carrierId) : [];
    const allPlans = sheetPlans.length > 0 ? sheetPlans : plans;
    const plan = allPlans.find((p) => p.id === selectedPlanId);

    const sheetCards = sheetLoaded && carrierId ? getSheetCards(carrierId) : [];
    const sheetAddons = sheetLoaded && carrierId ? getSheetAddons(carrierId) : [];
    const allDiscounts = [
      ...(sheetCards.length > 0 ? sheetCards : jsonDiscounts.filter((d) => d.type === '제휴카드')),
      ...(sheetAddons.length > 0 ? sheetAddons : jsonDiscounts.filter((d) => d.type === '부가서비스')),
    ];
    const selectedDiscounts = allDiscounts.filter((d) => selectedDiscountIds.includes(d.id));

    const innerPlanTier: PlanTier = allPlans.find((p) => p.id === selectedPlanId)?.구간 ?? '고가';
    const hasConditions = sheetLoaded && !!selectedPhoneId && !!carrierId && !!selectedStorage && !!subscriptionType;
    const commonSheetSubsidy = hasConditions
      ? getSubsidy(selectedPhoneId!, carrierId!, selectedStorage!, subscriptionType!, innerPlanTier)
      : null;
    const saSheetSubsidy = hasConditions
      ? getSelectAgreementSubsidy(selectedPhoneId!, carrierId!, selectedStorage!, subscriptionType!, innerPlanTier)
      : null;
    const activeSheetSubsidy = discountType === '선택약정'
      ? (saSheetSubsidy
          ? { 출고가: saSheetSubsidy.출고가 || commonSheetSubsidy?.출고가 || 0, 공통지원금: 0, 추가지원금: saSheetSubsidy.추가지원금, 특별지원: saSheetSubsidy.특별지원 }
          : commonSheetSubsidy)
      : commonSheetSubsidy;

    let quoteText = '';
    if (phone && plan && selectedStorage && carrierId) {
      const quote = calculateFullQuote({
        phone, storage: selectedStorage, carrierId, plan, discountType, selectedDiscounts, 할부개월,
        출고가Override: activeSheetSubsidy?.출고가,
        공통지원금Override: activeSheetSubsidy?.공통지원금,
        추가지원금Override: activeSheetSubsidy?.추가지원금,
        특별지원Override: activeSheetSubsidy?.특별지원,
      });
      quoteText = `
<b>📱 견적 정보</b>
• 출고가: ${formatWon(quote.출고가)}
• 공통지원금: -${formatWon(quote.공통지원금)}
• 매장지원금: -${formatWon(quote.추가지원금)}${quote.특별지원 > 0 ? `
• 동네폰 특별지원: -${formatWon(quote.특별지원)}` : ''}
• 할부원금: <b>${formatWon(quote.할부원금)}</b>
• 월 할부금 (${할부개월}개월): <b>${formatWon(quote.월할부금)}</b>
• 월 요금제: ${formatWon(quote.월요금제)}
• 월 납입금 합계: <b>${formatWon(quote.월납입금총액)}</b>`;
    }

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const message = `🔔 <b>새 상담 신청</b>

<b>👤 고객 정보</b>
• 연락처: ${escapeHtml(consultation.phone)}
• 희망시간: ${escapeHtml(consultation.preferredTime)}

<b>📋 선택 정보</b>
• 가입유형: ${subscriptionType ?? '-'}
• 통신사: ${carrier?.name ?? '-'}
• 모델: ${phone?.name ?? '-'} ${selectedStorage ?? ''}${selectedColor ? ` / ${selectedColor}` : ''}
• 요금제: ${plan?.name ?? '-'}
• 할인방식: ${discountType}
• 할부: ${할부개월}개월
${quoteText}

🕐 접수시간: ${timeStr}`;

    try {
      const sent = await sendTelegramNotification(message);
      if (!sent) {
        setErrors({ submit: '신청 전송에 실패했습니다. 잠시 후 다시 시도해주시거나 매장으로 전화 부탁드립니다.' });
        return;
      }

      try {
        const raw = localStorage.getItem('phone-quotes');
        const existing: unknown = raw ? JSON.parse(raw) : [];
        const list = Array.isArray(existing) ? existing : [];
        const quoteData = { ...state, submittedAt: now.toISOString() };
        localStorage.setItem('phone-quotes', JSON.stringify([...list, quoteData]));
      } catch {
        // 로컬 백업 저장 실패는 신청 완료 자체를 막지 않는다
      }

      setErrors({});
      setSubmitted(true);
    } finally {
      setSending(false);
    }
  };

  const handlePhoneChange = (value: string) => {
    setConsultation({ phone: formatPhone(value) });
  };

  const canSubmit = phoneOk && agreedPrivacy && !sending;

  const submitLabel = sending
    ? '신청 접수 중...'
    : !phoneOk
      ? '휴대폰 번호를 입력해 주세요'
      : !agreedPrivacy
        ? '개인정보 동의가 필요해요'
        : '상담 신청 완료하기';

  return (
    <>
      <div className={styles.container}>
        <h2 className={styles.title}>상담 신청</h2>
        <p className={styles.subtitle}>연락 정보를 입력해주시면 빠르게 연락드릴게요</p>

        {/* 선택 정보 */}
        <div className={summaryStyles.summaryCard} style={{ marginBottom: 'var(--space-lg)' }}>
          <div className={summaryStyles.sectionTitle}>선택 정보</div>
          <div className={summaryStyles.selectedInfo}>
            <div className={summaryStyles.infoRow}>
              <span className={summaryStyles.infoLabel}>가입유형</span>
              <span className={summaryStyles.infoValue}>{subscriptionType ?? '-'}</span>
            </div>
            <div className={summaryStyles.infoRow}>
              <span className={summaryStyles.infoLabel}>통신사</span>
              <span className={summaryStyles.infoValue}>{carrier?.name ?? '-'}</span>
            </div>
            <div className={summaryStyles.infoRow}>
              <span className={summaryStyles.infoLabel}>모델</span>
              <span className={summaryStyles.infoValue}>{phone?.name ?? '-'} {selectedStorage ?? ''}</span>
            </div>
            <div className={summaryStyles.infoRow}>
              <span className={summaryStyles.infoLabel}>요금제</span>
              <span className={summaryStyles.infoValue}>{plan?.name ?? '-'}</span>
            </div>
            <div className={summaryStyles.infoRow}>
              <span className={summaryStyles.infoLabel}>할인방식</span>
              <span className={summaryStyles.infoValue}>{discountType}</span>
            </div>
          </div>
        </div>

        <p className={styles.fieldLabel}>연락받으실 번호</p>
        <input
          className={styles.phoneInput}
          type="tel"
          inputMode="numeric"
          placeholder="010-0000-0000"
          value={consultation.phone}
          onChange={(e) => handlePhoneChange(e.target.value)}
          maxLength={13}
        />
        {errors.phone && <p className={styles.privacyError}>{errors.phone}</p>}

        <p className={styles.fieldLabel}>언제 연락드릴까요?</p>
        <div className={styles.chipRow}>
          {CALL_TIMES.map((time) => (
            <button
              key={time}
              type="button"
              className={`${styles.chip} ${consultation.preferredTime === time ? styles.chipOn : ''}`}
              onClick={() => setConsultation({ preferredTime: time })}
            >
              {time}
            </button>
          ))}
        </div>

        {/* 개인정보 수집·이용 동의 */}
        <label className={styles.agree}>
          <input
            type="checkbox"
            checked={agreedPrivacy}
            onChange={(e) => {
              setAgreedPrivacy(e.target.checked);
              if (e.target.checked && errors.privacy) {
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.privacy;
                  return next;
                });
              }
            }}
          />
          <span className={styles.agreeText}>
            개인정보 수집·이용에 동의합니다
            <em>수집 항목: 휴대폰 번호 / 목적: 구매 상담 연락 / 보유 기간: 상담 완료 후 즉시 파기</em>
          </span>
        </label>
        {errors.privacy && <p className={styles.privacyError}>{errors.privacy}</p>}

        {errors.submit && (
          <p className={styles.privacyError} role="alert">{errors.submit}</p>
        )}

        <button className={styles.cta} disabled={!canSubmit} onClick={handleSubmit}>
          {submitLabel}
        </button>

        <a
          className={styles.kakaoInquiry}
          href={STORE.kakaoUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          💬 카카오톡으로 편하게 문의하기
        </a>

        {/* 매장 위치 */}
        <p className={`${styles.fieldLabel} ${styles.fieldLabelSection}`}>매장 위치</p>
        <StoreLocation store={STORE} />

        <a
          className={styles.precon}
          href={STORE.preconUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          <i className={styles.preconIcon} />
          <span className={styles.preconText}>
            이동통신 <b>사전승낙서</b> 확인
            <em>한국정보통신진흥협회(KAIT) 승낙받은 판매점입니다</em>
          </span>
          <span className={styles.preconGo}>›</span>
        </a>
      </div>

      {submitted && (
        <div className={styles.successOverlay} onClick={() => { setSubmitted(false); reset(); }}>
          <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successIcon}>🎉</div>
            <h3 className={styles.successTitle}>상담 신청이 완료되었습니다!</h3>
            <p className={styles.successMessage}>
              빠른 시간 내에 연락드리겠습니다.<br />
              감사합니다.
            </p>
            <KakaoChannelBanner
              title="채널 추가하고 혜택 받기"
              subtitle="다음 이벤트·할인 소식을 가장 먼저 받아보세요"
            />
            <div style={{ marginTop: 'var(--space-md)' }}>
              <Button fullWidth onClick={() => { setSubmitted(false); reset(); }}>
                처음으로 돌아가기
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
