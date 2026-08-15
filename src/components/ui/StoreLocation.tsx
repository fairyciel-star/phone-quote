import { useEffect, useRef, useState } from 'react';
import { mapLinks, telHref, type StoreInfo } from '../../data/store';
import styles from './StoreLocation.module.css';

interface StoreLocationProps {
  readonly store: StoreInfo;
}

/** 클립보드 복사. 인앱 브라우저는 Clipboard API를 막는 경우가 있어 execCommand로 폴백한다. */
async function copyText(value: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(value);
    return true;
  } catch {
    try {
      const area = document.createElement('textarea');
      area.value = value;
      area.style.position = 'fixed';
      area.style.opacity = '0';
      document.body.appendChild(area);
      area.select();
      const ok = document.execCommand('copy');
      document.body.removeChild(area);
      return ok;
    } catch {
      return false;
    }
  }
}

export function StoreLocation({ store }: StoreLocationProps) {
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<number | undefined>(undefined);

  useEffect(() => () => window.clearTimeout(timerRef.current), []);

  const handleCopy = async () => {
    if (!(await copyText(store.addr))) return;
    setCopied(true);
    window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => setCopied(false), 1800);
  };

  const links = mapLinks(store);

  return (
    <div className={styles.card}>
      <div className={styles.name}>{store.name}</div>
      {store.hours && <div className={styles.hours}>{store.hours}</div>}

      <div className={styles.addrRow}>
        <span className={styles.addrText}>📍 {store.addr}</span>
        <button className={styles.copyBtn} onClick={() => void handleCopy()}>
          {copied ? '복사됨' : '주소 복사'}
        </button>
      </div>

      <div className={styles.actions}>
        <a className={styles.actionBtn} href={links.kakao} target="_blank" rel="noopener noreferrer">
          <i className={`${styles.icon} ${styles.iconKakao}`} />
          카카오맵
        </a>
        <a className={styles.actionBtn} href={links.naver} target="_blank" rel="noopener noreferrer">
          <i className={`${styles.icon} ${styles.iconNaver}`} />
          네이버지도
        </a>
        {store.phone && (
          <a className={`${styles.actionBtn} ${styles.actionCall}`} href={telHref(store.phone)}>
            <i className={`${styles.icon} ${styles.iconCall}`} />
            전화하기
          </a>
        )}
      </div>
    </div>
  );
}
