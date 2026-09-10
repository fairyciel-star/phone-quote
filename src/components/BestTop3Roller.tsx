import { useEffect, useState } from 'react';
import { formatWon } from '../utils/format';
import styles from './BestTop3Roller.module.css';

/** 한 항목이 머무는 시간 */
const ROLL_INTERVAL_MS = 3500;

export interface BestItem {
  readonly phoneId: string;
  readonly name: string;
  /** 판매량 증가율(%). 시트에 사람이 직접 적는다. 0이면 배지를 붙이지 않는다 */
  readonly salesUpPercent: number;
  readonly price: number;
  readonly priceInquiry: boolean;
}

interface BestTop3RollerProps {
  readonly items: readonly BestItem[];
  readonly onSelect: (phoneId: string) => void;
}

function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false,
  );

  useEffect(() => {
    const mq = window.matchMedia?.('(prefers-reduced-motion: reduce)');
    if (!mq) return;
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

/**
 * 오늘 베스트 TOP N — 지원금이 많이 오른 기기를 한 건씩 굴려 보여준다.
 *
 * 1·2·3위를 한꺼번에 펼치지 않는 이유: 이 배너는 목록 위 좁은 자리를 쓰고,
 * 세 줄을 펼치면 정작 기기 카드가 첫 화면에서 밀려난다.
 *
 * 항목이 3개에 못 미치면 모자란 만큼만 돌린다. 최저가 순으로 빈자리를 채우면
 * "베스트"가 상승폭과 최저가 두 가지를 뜻하게 되어 배지를 믿을 수 없게 된다.
 */
export function BestTop3Roller({ items, onSelect }: BestTop3RollerProps) {
  const itemsKey = items.map((item) => item.phoneId).join('|');
  // 목록이 통째로 바뀌면(통신사·가입유형 변경) 1위부터 다시 보여준다.
  // 개수가 같으면 effect로는 잡히지 않아 렌더 중에 맞춘다.
  const [cursor, setCursor] = useState({ key: itemsKey, index: 0 });
  if (cursor.key !== itemsKey) {
    setCursor({ key: itemsKey, index: 0 });
  }

  // 읽는 중에 넘어가 버리지 않도록 짚거나 포커스가 들어오면 멈춘다
  const [paused, setPaused] = useState(false);

  const reducedMotion = usePrefersReducedMotion();
  const rolling = !reducedMotion && items.length > 1;

  useEffect(() => {
    if (!rolling || paused) return;
    const timer = window.setInterval(() => {
      setCursor((prev) => ({ key: prev.key, index: (prev.index + 1) % items.length }));
    }, ROLL_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [rolling, paused, items.length]);

  // 오른 기기가 없으면 빈 껍데기나 "준비중" 대신 배너 자체를 띄우지 않는다
  if (items.length === 0) return null;

  const activeIndex = cursor.index < items.length ? cursor.index : 0;

  return (
    <div
      className={styles.roller}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      <div className={styles.head}>
        <span className={styles.flame} aria-hidden="true">🔥</span>
        <span className={styles.title}>오늘 베스트 TOP {items.length}</span>
        {rolling && (
          <span className={styles.dots} aria-hidden="true">
            {items.map((item, i) => (
              <span
                key={item.phoneId}
                className={`${styles.dot} ${i === activeIndex ? styles.dotOn : ''}`}
              />
            ))}
          </span>
        )}
      </div>

      <div className={`${styles.view} ${rolling ? '' : styles.viewStatic}`}>
        <div
          className={`${styles.track} ${rolling ? '' : styles.trackStatic}`}
          style={
            rolling
              ? { transform: `translateY(calc(var(--roll-item-h) * -${activeIndex}))` }
              : undefined
          }
        >
          {items.map((item, i) => {
            const hidden = rolling && i !== activeIndex;
            return (
              <button
                key={item.phoneId}
                type="button"
                className={styles.item}
                onClick={() => onSelect(item.phoneId)}
                tabIndex={hidden ? -1 : 0}
                aria-hidden={hidden || undefined}
              >
                <span className={styles.rank}>{i + 1}</span>
                <span className={styles.body}>
                  <span className={styles.name}>{item.name}</span>
                  {item.salesUpPercent > 0 && (
                    <span className={styles.delta}>
                      판매량
                      <span className={styles.up}>▲ {item.salesUpPercent}%</span>
                    </span>
                  )}
                </span>
                <span className={styles.right}>
                  {item.priceInquiry ? (
                    <span className={styles.priceInquiry}>가격문의</span>
                  ) : (
                    <span className={styles.price}>{formatWon(item.price)}</span>
                  )}
                  <span className={styles.chev} aria-hidden="true">›</span>
                </span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
