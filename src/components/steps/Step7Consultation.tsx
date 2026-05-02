import { useState } from 'react';
import { useQuoteStore } from '../../store/useQuoteStore';
import { Input, Textarea, SelectInput } from '../ui/Input';
import { Button } from '../ui/Button';
import { StepNavigation } from '../layout/StepNavigation';
import { formatPhone, formatWon } from '../../utils/format';
import { sendTelegramNotification } from '../../utils/telegram';
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

const phones = phonesData as unknown as Phone[];
const plans = plansData as unknown as Plan[];
const jsonDiscounts = discountsData as unknown as Discount[];

const TIME_OPTIONS = [
  '상관없음',
  '오전 10시~12시',
  '오후 12시~3시',
  '오후 3시~6시',
  '오후 6시~9시',
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

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};

    if (!consultation.name.trim()) {
      newErrors.name = '이름을 입력해주세요';
    }

    const phoneDigits = consultation.phone.replace(/\D/g, '');
    if (!phoneDigits) {
      newErrors.phone = '연락처를 입력해주세요';
    } else if (!/^01[016789]\d{7,8}$/.test(phoneDigits)) {
      newErrors.phone = '올바른 휴대폰 번호를 입력해주세요';
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
• 이름: ${consultation.name}
• 연락처: ${consultation.phone}
• 희망시간: ${consultation.preferredTime}
${consultation.memo ? `• 메모: ${consultation.memo}` : ''}

<b>📋 선택 정보</b>
• 가입유형: ${subscriptionType ?? '-'}
• 통신사: ${carrier?.name ?? '-'}
• 모델: ${phone?.name ?? '-'} ${selectedStorage ?? ''}${selectedColor ? ` / ${selectedColor}` : ''}
• 요금제: ${plan?.name ?? '-'}
• 할인방식: ${discountType}
• 할부: ${할부개월}개월
${quoteText}

🕐 접수시간: ${timeStr}`;

    await sendTelegramNotification(message);

    const quoteData = { ...state, submittedAt: now.toISOString() };
    const existing = JSON.parse(localStorage.getItem('phone-quotes') || '[]');
    localStorage.setItem('phone-quotes', JSON.stringify([...existing, quoteData]));

    setSending(false);
    setSubmitted(true);
  };

  const handlePhoneChange = (value: string) => {
    setConsultation({ phone: formatPhone(value) });
  };

  const canProceed = !sending && consultation.name.trim() !== '' && consultation.phone.replace(/\D/g, '').length >= 10;

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

        <div className={styles.form}>
          <Input
            label="이름"
            required
            placeholder="홍길동"
            value={consultation.name}
            onChange={(e) => setConsultation({ name: e.target.value })}
            error={errors.name}
          />

          <Input
            label="연락처"
            required
            type="tel"
            placeholder="010-0000-0000"
            value={consultation.phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            error={errors.phone}
            maxLength={13}
          />

          <SelectInput
            label="희망 연락 시간"
            value={consultation.preferredTime}
            onChange={(e) => setConsultation({ preferredTime: e.target.value })}
          >
            {TIME_OPTIONS.map((time) => (
              <option key={time} value={time}>{time}</option>
            ))}
          </SelectInput>

          <Textarea
            label="메모 (선택사항)"
            placeholder="문의사항이 있으시면 남겨주세요"
            value={consultation.memo}
            onChange={(e) => setConsultation({ memo: e.target.value })}
            rows={3}
          />
        </div>

        {/* 매장 위치 */}
        <div className={styles.storeSection}>
          <h3 className={styles.storeSectionTitle}>매장 위치</h3>
          <div className={styles.mapWrap}>
            <iframe
              src={`https://www.google.com/maps/embed/v1/place?key=${import.meta.env.VITE_GOOGLE_MAPS_KEY}&q=부천시+오정구+삼작로+385&zoom=17&language=ko`}
              width="100%"
              height="200"
              style={{ border: 0, borderRadius: '12px' }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="매장 위치"
            />
          </div>
          <div className={styles.storeInfo}>
            <div className={styles.storeName}>휴대폰성지 동네휴대폰마트</div>
            <div className={styles.storeAddress}>부천시 오정구 삼작로 385호 5호 1층</div>
          </div>
          <div className={styles.storeActions}>
            <a
              href="tel:01056812956"
              className={styles.storeBtn}
            >
              <span className={styles.storeBtnIcon}>📞</span>
              전화
            </a>
            <a
              href="https://map.naver.com/v5/search/부천시 오정구 삼작로 385"
              target="_blank"
              rel="noopener noreferrer"
              className={`${styles.storeBtn} ${styles.storeBtnPrimary}`}
            >
              <span className={styles.storeBtnIcon}>📍</span>
              길찾기
            </a>
          </div>
        </div>
      </div>

      <StepNavigation canProceed={canProceed} onSubmit={handleSubmit} />

      {submitted && (
        <div className={styles.successOverlay} onClick={() => { setSubmitted(false); reset(); }}>
          <div className={styles.successModal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.successIcon}>🎉</div>
            <h3 className={styles.successTitle}>상담 신청이 완료되었습니다!</h3>
            <p className={styles.successMessage}>
              빠른 시간 내에 연락드리겠습니다.<br />
              감사합니다.
            </p>
            <Button fullWidth onClick={() => { setSubmitted(false); reset(); }}>
              처음으로 돌아가기
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
