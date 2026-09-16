import type { PhoneSeries } from '../types';

/** 시리즈 헤더에 쓰는 표시 정보. mark는 22px 정사각 안에 들어가야 해서 3글자까지만 쓴다. */
export interface SeriesMeta {
  readonly label: string;
  readonly mark: string;
  /**
   * 최저가와 무관하게 목록 맨 위에 고정한다.
   * 사전예약은 아직 개통 전이라 값이 비싼데, 가격순으로 두면 맨 아래로 내려가
   * "새로 나온 기기를 먼저 보여준다"는 목적을 못 한다.
   */
  readonly pinTop?: boolean;
}

export const SERIES_META: Readonly<Record<PhoneSeries, SeriesMeta>> = {
  사전예약: { label: '사전예약', mark: '예약', pinTop: true },
  S: { label: 'S 시리즈', mark: 'S' },
  폴더블: { label: '폴더블', mark: 'Z' },
  실속형: { label: '실속형', mark: 'FE' },
  Pro: { label: 'Pro', mark: 'Pro' },
  기본: { label: '기본', mark: '17' },
  보급형: { label: '보급형', mark: 'SE' },
};

export interface SeriesGroup<T> {
  readonly series: PhoneSeries;
  readonly meta: SeriesMeta;
  readonly items: readonly T[];
  /**
   * 그룹 안에서 가장 낮은 기기값. 섹션 정렬과 헤더의 "최저 ~원" 표시에 쓴다.
   * 가격을 아는 기기가 하나도 없으면 null — 호출부가 "가격문의"로 처리해야 한다.
   */
  readonly lowestPrice: number | null;
}

/**
 * phones.json은 `as unknown as Phone[]`로 들어오기 때문에 series 값이 오타여도
 * 컴파일러가 잡지 못한다. 모르는 값이 와도 화면이 죽지 않도록 원래 문자열을 그대로
 * 이름으로 쓰고 개발 중에만 알린다 — 조용히 삼키면 데이터 오류가 그대로 배포된다.
 */
function resolveMeta(series: PhoneSeries): SeriesMeta {
  const meta = SERIES_META[series];
  if (meta) return meta;

  if (import.meta.env.DEV) {
    console.error(
      `[series] phones.json에 알 수 없는 series 값이 있습니다: "${series}". ` +
        `허용값: ${Object.keys(SERIES_META).join(', ')}`,
    );
  }
  return { label: String(series), mark: '기타' };
}

/**
 * 목록을 시리즈로 묶는다.
 *
 * 섹션 순서는 각 시리즈의 자기 최저가 오름차순이다. 그래야 전체 최저가 1위 기기가
 * 여전히 화면 맨 위 섹션에 남는다 — 그룹핑 때문에 최저가가 아래로 밀리면
 * "오늘의 시세"라는 앱의 약속이 깨진다.
 *
 * 예외는 pinTop 시리즈(사전예약)다. 신제품 홍보가 목적이라 가격순 규칙보다 앞선다.
 *
 * 가격을 못 구한 항목(가격문의·준비중)은 정렬 기준에서 빼되 그룹에는 남긴다.
 * 이미 상위에서 목록 맨 아래로 정렬해 두었으므로 순서는 입력 순서를 그대로 따른다.
 */
export function groupBySeries<T>(
  items: readonly T[],
  getSeries: (item: T) => PhoneSeries,
  getPrice: (item: T) => number | null,
): SeriesGroup<T>[] {
  const buckets = new Map<PhoneSeries, T[]>();

  for (const item of items) {
    const key = getSeries(item);
    const bucket = buckets.get(key);
    if (bucket) {
      bucket.push(item);
    } else {
      buckets.set(key, [item]);
    }
  }

  const groups: SeriesGroup<T>[] = [];
  for (const [series, bucketItems] of buckets) {
    const prices = bucketItems
      .map(getPrice)
      .filter((p): p is number => p !== null);

    groups.push({
      series,
      meta: resolveMeta(series),
      items: bucketItems,
      lowestPrice: prices.length > 0 ? Math.min(...prices) : null,
    });
  }

  // 고정 시리즈가 맨 앞, 그다음 가격을 아는 시리즈, 전부 가격문의인 시리즈는 맨 뒤로
  const pinRank = (g: SeriesGroup<T>): number => (g.meta.pinTop ? 0 : 1);
  return groups.sort((a, b) => {
    if (pinRank(a) !== pinRank(b)) return pinRank(a) - pinRank(b);
    if (a.lowestPrice === null) return b.lowestPrice === null ? 0 : 1;
    if (b.lowestPrice === null) return -1;
    return a.lowestPrice - b.lowestPrice;
  });
}
