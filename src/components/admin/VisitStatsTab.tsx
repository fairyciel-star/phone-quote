import { useEffect } from 'react';
import { useVisitStatsStore, STATS_DAYS } from '../../store/useVisitStatsStore';
import type { VisitStatRow } from '../../lib/supabase-types';
import styles from './AdminPage.module.css';

/** 한국 시간 기준 날짜 문자열('YYYY-MM-DD'). offsetDays 만큼 이동 가능 */
function seoulDate(offsetDays = 0): string {
  const shifted = new Date(Date.now() + offsetDays * 86_400_000);
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(shifted);
}

/** 최근 days 일(오늘 포함)의 방문 수 합계 */
function sumRecentVisits(daily: readonly VisitStatRow[], days: number): number {
  const cutoff = seoulDate(-(days - 1));
  return daily
    .filter((row) => row.day >= cutoff)
    .reduce((total, row) => total + row.visits, 0);
}

function formatDay(day: string): string {
  const [, month, date] = day.split('-');
  return `${Number(month)}월 ${Number(date)}일`;
}

export function VisitStatsTab() {
  const daily = useVisitStatsStore((s) => s.daily);
  const totalVisits = useVisitStatsStore((s) => s.totalVisits);
  const loading = useVisitStatsStore((s) => s.loading);
  const loaded = useVisitStatsStore((s) => s.loaded);
  const error = useVisitStatsStore((s) => s.error);
  const refresh = useVisitStatsStore((s) => s.refresh);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const today = seoulDate();
  const todayRow = daily.find((row) => row.day === today);
  const peakVisits = daily.reduce((max, row) => Math.max(max, row.visits), 0);

  const stats = [
    { icon: '👣', value: todayRow?.visits ?? 0, label: '오늘 방문' },
    { icon: '🙋', value: todayRow?.visitors ?? 0, label: '오늘 순방문자' },
    { icon: '📅', value: sumRecentVisits(daily, 7), label: '최근 7일 방문' },
    { icon: '🗓️', value: sumRecentVisits(daily, 30), label: '최근 30일 방문' },
    { icon: '📈', value: totalVisits, label: '전체 누적 방문' },
  ];

  return (
    <>
      <h2 className={styles.pageTitle}>📈 방문 통계</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, marginTop: -16 }}>
        고객 앱 방문 기록입니다. 브라우저 세션 1회를 방문 1건으로 집계하며, 관리자 페이지 접속은 제외됩니다.
      </p>

      {error && <p className={styles.settingsError}>⚠️ {error}</p>}

      <div className={styles.statGrid}>
        {stats.map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statIcon}>{s.icon}</div>
            <p className={styles.statValue}>{loaded ? s.value.toLocaleString() : '—'}</p>
            <p className={styles.statLabel}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>일자별 방문 (최근 {STATS_DAYS}일)</span>
          <button className={styles.saveBtn} onClick={() => void refresh()} disabled={loading}>
            {loading ? '불러오는 중...' : '새로고침'}
          </button>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>날짜</th>
              <th>방문</th>
              <th>순방문자</th>
              <th style={{ width: '50%' }}>추이</th>
            </tr>
          </thead>
          <tbody>
            {daily.map((row) => (
              <tr key={row.day}>
                <td>{formatDay(row.day)}{row.day === today && ' (오늘)'}</td>
                <td style={{ fontWeight: 700 }}>{row.visits.toLocaleString()}</td>
                <td>{row.visitors.toLocaleString()}</td>
                <td>
                  <div
                    style={{
                      height: 10,
                      borderRadius: 5,
                      background: '#3182F6',
                      width: `${peakVisits > 0 ? (row.visits / peakVisits) * 100 : 0}%`,
                      minWidth: 4,
                    }}
                  />
                </td>
              </tr>
            ))}
            {loaded && daily.length === 0 && !error && (
              <tr>
                <td colSpan={4} style={{ color: '#64748b' }}>
                  아직 기록된 방문이 없습니다.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}
