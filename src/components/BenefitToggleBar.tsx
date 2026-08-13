// BenefitToggleBar.tsx
// 제휴카드·부가서비스 조건 스위치 바 컴포넌트
// 사용 위치: 기기선택 페이지(4스텝) 카카오 배너 바로 아래 (기존 CardBenefitBanner 자리)
// 한 줄에 두 버튼을 나란히 배치하고, 켜면 아래로 해당 조건의 설명이 펼쳐진다

import styles from './BenefitToggleBar.module.css';

interface ToggleButtonProps {
  /** 좌측 이모지 아이콘 */
  icon: string;
  /** 조건 제목 (예: 제휴카드) */
  label: string;
  /** 조건이 현재 적용된 상태인지 */
  on: boolean;
  /** 버튼 클릭 시 실행할 함수 */
  onToggle: () => void;
}

function ToggleButton({ icon, label, on, onToggle }: ToggleButtonProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={`${label} ${on ? '있음' : '없음'}`}
      className={`${styles.btn} ${on ? styles.btnOn : ''}`}
      onClick={onToggle}
    >
      <span className={styles.icon}>{icon}</span>
      <span className={styles.texts}>
        <span className={styles.label}>{label}</span>
        <span className={`${styles.state} ${on ? styles.stateOn : ''}`}>
          {on ? '있음' : '없음'}
        </span>
      </span>
      <span className={`${styles.switch} ${on ? styles.switchOn : ''}`}>
        <span className={styles.knob} />
      </span>
    </button>
  );
}

interface BenefitToggleBarProps {
  /** 제휴카드 조건 적용 여부 */
  cardOn: boolean;
  /** 제휴카드 버튼 클릭 시 실행할 함수 */
  onCardToggle: () => void;
  /** 부가서비스 조건 적용 여부 */
  addonOn: boolean;
  /** 부가서비스 버튼 클릭 시 실행할 함수 */
  onAddonToggle: () => void;
  /** 부가서비스를 켰을 때 아래에 표시할 유지 조건 (비어 있으면 표시하지 않음) */
  addonCondition: string;
}

export default function BenefitToggleBar({
  cardOn,
  onCardToggle,
  addonOn,
  onAddonToggle,
  addonCondition,
}: BenefitToggleBarProps) {
  // 제휴카드는 설명을 노출하지 않는다. 부가서비스만 유지 조건을 펼쳐서 보여준다.
  const showAddonCondition = addonOn && addonCondition.trim() !== '';

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.row}>
          <ToggleButton icon="💳" label="제휴카드" on={cardOn} onToggle={onCardToggle} />
          <ToggleButton icon="📦" label="부가서비스" on={addonOn} onToggle={onAddonToggle} />
        </div>

        {showAddonCondition && (
          <div className={styles.details}>
            <div className={styles.detail}>
              <span className={styles.detailIcon}>📦</span>
              <span className={styles.detailBody}>
                <span className={styles.detailTitle}>부가서비스 유지 조건</span>
                <span className={styles.detailText}>{addonCondition}</span>
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
