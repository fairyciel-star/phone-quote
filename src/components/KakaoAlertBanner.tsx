// 만나픽 카카오 가격 알림 배너
//
// 사용 위치: 요금제·할인 페이지(5스텝) 하단.
// 원래는 기기선택(4스텝) 상단에 있었지만, 기기를 고르기도 전에 가격 알림을 권하는 건
// 순서가 뒤집힌 제안이라 최종 견적을 다 본 직후로 옮겼다. 4스텝 그 자리는
// 오늘 베스트 TOP N 배너(BestTop3Roller)가 쓴다.

import styles from './KakaoAlertBanner.module.css';

const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_xmpfxcn';

interface KakaoAlertBannerProps {
  /** "받기" 버튼 클릭 시 실행할 함수. 기본값은 카카오 채널 열기 */
  readonly onConfirm?: () => void;
  /** 배너 표시 여부 */
  readonly visible?: boolean;
}

export default function KakaoAlertBanner({ onConfirm, visible = true }: KakaoAlertBannerProps) {
  if (!visible) return null;

  const handleClick = () => {
    if (onConfirm) {
      onConfirm();
      return;
    }
    window.open(KAKAO_CHANNEL_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className={styles.wrap}>
      <div className={styles.card}>
        <div className={styles.icon}>
          <svg width="21" height="21" viewBox="0 0 24 24" fill="#3A1D1D" aria-hidden="true">
            <path d="M12 3C7 3 3 6.3 3 10.4c0 2.6 1.7 4.9 4.3 6.2-.2.7-.7 2.4-.8 2.8 0 0-.02.1.05.16.07.05.15.02.15.02.2-.03 2.5-1.65 3.5-2.34.6.08 1.2.13 1.8.13 5 0 9-3.3 9-7.4S17 3 12 3z" />
          </svg>
        </div>

        <div className={styles.text}>
          <div className={styles.title}>지금 가격이 아쉬우신가요?</div>
          <div className={styles.subtitle}>가격변동 알림 받기</div>
        </div>

        <button type="button" className={styles.button} onClick={handleClick}>
          받기
        </button>
      </div>
    </div>
  );
}
