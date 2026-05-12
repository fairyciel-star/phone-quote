import styles from './KakaoChannelBanner.module.css';

const KAKAO_CHANNEL_URL = 'https://pf.kakao.com/_xmpfxcn';

interface KakaoChannelBannerProps {
  title?: string;
  subtitle?: string;
}

export function KakaoChannelBanner({
  title = '가격 변동 알림 받기',
  subtitle = '가격이 내려가면 카카오톡으로 알려드려요',
}: KakaoChannelBannerProps) {
  return (
    <a
      href={KAKAO_CHANNEL_URL}
      target="_blank"
      rel="noopener noreferrer"
      className={styles.banner}
    >
      <div className={styles.iconWrap}>
        <svg className={styles.kakaoIcon} viewBox="0 0 48 48" fill="none">
          <path d="M24 4C12.954 4 4 11.163 4 20c0 5.727 3.794 10.742 9.486 13.574-.418 1.55-1.514 5.616-1.736 6.488-.272 1.07.393 1.056.826.768.34-.226 5.413-3.674 7.614-5.166A25.482 25.482 0 0024 36c11.046 0 20-7.163 20-16S35.046 4 24 4z" fill="#3C1E1E"/>
        </svg>
      </div>
      <div className={styles.textWrap}>
        <div className={styles.title}>{title}</div>
        <div className={styles.subtitle}>{subtitle}</div>
      </div>
      <span className={styles.arrow}>{'>'}</span>
    </a>
  );
}
