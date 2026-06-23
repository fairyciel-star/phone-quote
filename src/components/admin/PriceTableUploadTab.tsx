import { useState, useCallback, useEffect } from 'react';
import { usePriceTableStore, type PriceTableRow } from '../../store/usePriceTableStore';
import { useRebateStore } from '../../store/useRebateStore';
import { modelNameToPhoneId } from '../../utils/modelMatch';
import type { CarrierId } from '../../types';
import styles from './AdminPage.module.css';

const SHEET_ID = import.meta.env.VITE_GOOGLE_SHEET_ID || '1MI7Fn521lWI74Y8IUqKncA5hV-ztd1OwzW4EyAnI9BQ';
const CARRIERS: CarrierId[] = ['SKT', 'KT', 'LGU'];

function formatWon(n: number): string {
  if (n === 0) return '-';
  return n.toLocaleString('ko') + '원';
}

function CarrierBtn({
  carrier,
  active,
  count,
  onClick,
}: {
  carrier: CarrierId;
  active: boolean;
  count: number;
  onClick: () => void;
}) {
  const colors: Record<CarrierId, string> = { SKT: '#e44d26', KT: '#000', LGU: '#e6007e' };
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
        fontWeight: active ? 700 : 500, fontSize: 14,
        background: active ? colors[carrier] : '#1e293b',
        color: active ? '#fff' : '#94a3b8',
        transition: 'all 0.15s',
      }}
    >
      {carrier}
      {count > 0 && (
        <span style={{ marginLeft: 6, fontSize: 11, opacity: 0.8 }}>({count}건)</span>
      )}
    </button>
  );
}

export function PriceTableUploadTab() {
  const store = usePriceTableStore();
  const rebateStore = useRebateStore();
  const [activeCarrier, setActiveCarrier] = useState<CarrierId>('SKT');

  useEffect(() => {
    if (!rebateStore.loaded && !rebateStore.loading) {
      void rebateStore.refresh();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const rows = store.getRows(activeCarrier);

  const handleLoadAll = useCallback(async () => {
    await store.loadAll(SHEET_ID);
  }, [store]);

  const handleLoadCarrier = useCallback(async (c: CarrierId) => {
    await store.loadCarrier(SHEET_ID, c);
  }, [store]);

  return (
    <>
      <h2 className={styles.pageTitle}>단가표 관리</h2>

      <div className={styles.settingsCard}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', gap: 8 }}>
            {CARRIERS.map((c) => (
              <CarrierBtn
                key={c}
                carrier={c}
                active={activeCarrier === c}
                count={store.getRows(c).length}
                onClick={() => setActiveCarrier(c)}
              />
            ))}
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            {store.lastLoaded && (
              <span style={{ fontSize: 11, color: '#64748b' }}>
                마지막 로드: {new Date(store.lastLoaded).toLocaleTimeString('ko')}
              </span>
            )}
            <button
              className={styles.settingsBtn}
              style={{
                padding: '8px 20px',
                background: store.loading ? '#334155' : '#3b82f6',
                cursor: store.loading ? 'not-allowed' : 'pointer',
              }}
              onClick={() => handleLoadCarrier(activeCarrier)}
              disabled={store.loading}
            >
              {store.loading ? '불러오는 중...' : `${activeCarrier} 불러오기`}
            </button>
            <button
              className={styles.settingsBtn}
              style={{
                padding: '8px 20px',
                background: store.loading ? '#334155' : '#16a34a',
                cursor: store.loading ? 'not-allowed' : 'pointer',
              }}
              onClick={handleLoadAll}
              disabled={store.loading}
            >
              {store.loading ? '불러오는 중...' : '3사 전체'}
            </button>
          </div>
        </div>

        {store.error && (
          <p className={styles.settingsError} style={{ marginTop: 12 }}>{store.error}</p>
        )}
      </div>

      {rows.length > 0 && (
        <div className={styles.tableWrap}>
          <div className={styles.tableHeader}>
            <span className={styles.tableTitle}>
              {activeCarrier} 단가표 — {rows.length}개 모델
            </span>
            <span style={{ fontSize: 11, color: '#64748b' }}>
              합계 = 출고가 - 총지원금 (MNP / 기변)
            </span>
          </div>

          <table className={styles.table}>
            <thead>
              <tr>
                <th>모델코드</th>
                <th>모델명</th>
                <th>출고가</th>
                <th style={{ background: '#1a2e1a', color: '#86efac' }}>MNP합계</th>
                <th style={{ background: '#1e3a5f', color: '#93c5fd' }}>기변합계</th>
                <th style={{ background: '#2a1a2e', color: '#c084fc' }}>리베이트(공시)</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row: PriceTableRow, idx: number) => {
                const phoneId = modelNameToPhoneId(row.model_name.replace(/\s+\d+G(B)?$/i, '').replace(/\s+\d+T(B)?$/i, '').trim())
                  ?? modelNameToPhoneId(row.model_name);
                const bestRebate = phoneId
                  ? rebateStore.getBestByModelTier(activeCarrier, phoneId, '고가')
                  : null;

                return (
                  <tr key={idx}>
                    <td>
                      <code style={{ fontSize: 11 }}>{row.model_code}</code>
                    </td>
                    <td style={{ fontSize: 12 }}>{row.model_name}</td>
                    <td style={{ color: '#94a3b8', fontSize: 12, whiteSpace: 'nowrap' }}>
                      {formatWon(row.retail_price)}
                    </td>
                    <td style={{ textAlign: 'center', background: '#0f1f0f', color: '#86efac', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatWon(row.mnp_price)}
                    </td>
                    <td style={{ textAlign: 'center', background: '#0f1a2f', color: '#93c5fd', fontWeight: 700, whiteSpace: 'nowrap' }}>
                      {formatWon(row.change_price)}
                    </td>
                    <td style={{ textAlign: 'center', background: '#1a0f2a' }}>
                      {bestRebate ? (
                        <span style={{ fontSize: 12, fontWeight: 700, color: '#c084fc' }}>
                          {(bestRebate.subsidy_rebate / 10000).toFixed(0)}만
                        </span>
                      ) : (
                        <span style={{ color: '#334155', fontSize: 11 }}>-</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {rows.length === 0 && !store.loading && (
        <div className={styles.settingsCard} style={{ textAlign: 'center', padding: 40 }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>📊</div>
          <p style={{ color: '#94a3b8', fontSize: 14, margin: 0 }}>
            "{activeCarrier} 불러오기" 또는 "3사 전체" 버튼을 눌러 Google Sheets에서 단가표를 불러오세요.
          </p>
        </div>
      )}

      {store.loading && (
        <div className={styles.settingsCard} style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ color: '#3b82f6', fontSize: 14, margin: 0 }}>
            Google Sheets에서 단가표를 불러오는 중...
          </p>
        </div>
      )}
    </>
  );
}
