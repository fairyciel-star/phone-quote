import { useState } from 'react';
import { useQuoteStore } from '../store/useQuoteStore';
import { Input, SelectInput } from './ui/Input';
import { Button } from './ui/Button';
import { formatPhone } from '../utils/format';
import { sendTelegramNotification } from '../utils/telegram';
import styles from './PreorderPage.module.css';

const CARRIER_OPTIONS = ['SKT', 'KT', 'LG U+', '알뜰폰', '없음'];
const SUB_TYPE_OPTIONS = ['기기변경', '번호이동', '신규가입', '상담 후 결정'];
const MODEL_OPTIONS = ['Z플립8', 'Z폴드8', 'Z폴드 와이드', '아직 고민 중'];

export function PreorderPage() {
  const exitPreorder = useQuoteStore((s) => s.exitPreorder);

  const [carrier, setCarrier] = useState('');
  const [subType, setSubType] = useState('');
  const [model, setModel] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [agreed, setAgreed] = useState(false);

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const clearError = (key: string) => {
    if (errors[key]) {
      setErrors((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
    }
  };

  const validate = (): boolean => {
    const next: Record<string, string> = {};
    if (!carrier) next.carrier = '현재 통신사를 선택해주세요';
    if (!subType) next.subType = '가입 유형을 선택해주세요';
    if (!model) next.model = '희망 모델을 선택해주세요';
    if (!name.trim()) next.name = '고객명을 입력해주세요';

    const digits = phone.replace(/\D/g, '');
    if (!digits) {
      next.phone = '연락처를 입력해주세요';
    } else if (!/^01[016789]\d{7,8}$/.test(digits)) {
      next.phone = '올바른 휴대폰 번호를 입력해주세요';
    }

    if (!agreed) next.agreed = '개인정보 수집·이용에 동의해주세요';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const canSubmit =
    !sending &&
    !!carrier &&
    !!subType &&
    !!model &&
    name.trim() !== '' &&
    phone.replace(/\D/g, '').length >= 10 &&
    agreed;

  const handleSubmit = async () => {
    if (!validate()) return;
    setSending(true);

    const now = new Date();
    const timeStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    const message = `🎯 <b>새 사전예약 신청</b>

<b>👤 고객 정보</b>
• 고객명: ${name}
• 연락처: ${phone}

<b>📱 사전예약 정보</b>
• 현재 통신사: ${carrier}
• 가입유형: ${subType}
• 희망 모델: ${model}

• 개인정보 수집·이용 동의: 동의함

🕐 접수시간: ${timeStr}`;

    await sendTelegramNotification(message);
    setSending(false);
    setSubmitted(true);
  };

  const handlePhoneChange = (value: string) => {
    setPhone(formatPhone(value));
    clearError('phone');
  };

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <button className={styles.backBtn} onClick={exitPreorder} aria-label="뒤로가기">
          ←
        </button>
        <span className={styles.headerTitle}>사전예약</span>
        <span className={styles.headerSpacer} />
      </header>

      <div className={styles.scroll}>
        {/* 브랜드 히어로 */}
        <div className={styles.hero}>
          <img
            className={styles.heroImg}
            src="/images/banners/preorder.png"
            alt="Galaxy Z Fold8 | Z Flip8 사전예약"
          />
        </div>

        <div className={styles.intro}>
          <h2 className={styles.introTitle}>Galaxy Z Fold8 · Z Flip8 사전예약</h2>
          <p className={styles.introSub}>
            간단한 정보만 남겨주시면 담당자가 순차적으로 상담 연락드립니다.
          </p>
        </div>

        <div className={styles.form}>
          <SelectInput
            label="현재 사용 중인 통신사"
            required
            value={carrier}
            onChange={(e) => {
              setCarrier(e.target.value);
              clearError('carrier');
            }}
            error={errors.carrier}
          >
            <option value="" disabled>선택해주세요</option>
            {CARRIER_OPTIONS.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </SelectInput>

          <SelectInput
            label="가입 유형"
            required
            value={subType}
            onChange={(e) => {
              setSubType(e.target.value);
              clearError('subType');
            }}
            error={errors.subType}
          >
            <option value="" disabled>선택해주세요</option>
            {SUB_TYPE_OPTIONS.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </SelectInput>

          <SelectInput
            label="희망 모델"
            required
            value={model}
            onChange={(e) => {
              setModel(e.target.value);
              clearError('model');
            }}
            error={errors.model}
          >
            <option value="" disabled>선택해주세요</option>
            {MODEL_OPTIONS.map((m) => (
              <option key={m} value={m}>{m}</option>
            ))}
          </SelectInput>

          <Input
            label="고객명"
            required
            placeholder="홍길동"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              clearError('name');
            }}
            error={errors.name}
          />

          <Input
            label="연락처"
            required
            type="tel"
            inputMode="numeric"
            placeholder="010-0000-0000"
            value={phone}
            onChange={(e) => handlePhoneChange(e.target.value)}
            error={errors.phone}
            maxLength={13}
          />
        </div>

        {/* 안내 문구 */}
        <div className={styles.notice}>
          <span className={styles.noticeIcon}>💡</span>
          <span>색상, 용량, 요금제, 할인 조건은 사전예약 접수 후 해피콜을 통해 자세히 안내드립니다.</span>
        </div>

        {/* 개인정보 동의 */}
        <div className={styles.privacySection}>
          <label className={styles.privacyCheck}>
            <input
              type="checkbox"
              className={styles.privacyCheckbox}
              checked={agreed}
              onChange={(e) => {
                setAgreed(e.target.checked);
                if (e.target.checked) clearError('agreed');
              }}
            />
            <span className={styles.privacyCheckLabel}>
              <b className={styles.privacyRequired}>[필수]</b> 사전예약 상담을 위한 개인정보 수집·이용에 동의합니다.
            </span>
          </label>
          {errors.agreed && <p className={styles.privacyError}>{errors.agreed}</p>}

          {!agreed && (
            <div className={styles.privacyBox}>
              <div className={styles.privacyRow}>
                <span className={styles.privacyKey}>수집 항목</span>
                <span className={styles.privacyVal}>고객명, 연락처, 현재 통신사, 가입유형, 희망 모델</span>
              </div>
              <div className={styles.privacyRow}>
                <span className={styles.privacyKey}>이용 목적</span>
                <span className={styles.privacyVal}>사전예약 접수 확인 및 상담 연락</span>
              </div>
              <div className={styles.privacyRow}>
                <span className={styles.privacyKey}>보유 기간</span>
                <span className={styles.privacyVal}>사전예약 종료 시 바로 폐기됩니다.</span>
              </div>
            </div>
          )}
        </div>

        <Button fullWidth onClick={handleSubmit} disabled={!canSubmit}>
          {sending ? '접수 중...' : '사전예약 신청하기'}
        </Button>
      </div>

      {submitted && (
        <div className={styles.successOverlay}>
          <div className={styles.successModal}>
            <div className={styles.successIcon}>🎉</div>
            <h3 className={styles.successTitle}>사전예약 신청이 완료되었습니다.</h3>
            <p className={styles.successMessage}>
              담당자가 확인 후 순차적으로<br />
              연락드리겠습니다.
            </p>
            <div style={{ marginTop: 'var(--space-md)' }}>
              <Button fullWidth onClick={exitPreorder}>
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
