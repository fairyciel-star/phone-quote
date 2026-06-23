import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import phonesData from '../../data/phones.json';
import type { Phone, CarrierId } from '../../types';
import styles from './AdminPage.module.css';
import { useRebateStore } from '../../store/useRebateStore';
import { usePriceTableStore } from '../../store/usePriceTableStore';
import { useCarrierMarginStore } from '../../store/useCarrierMarginStore';

const phones = phonesData as unknown as Phone[];
const CARRIERS = ['SKT', 'KT', 'LGU'] as const;
const SUBSCRIPTION_TYPES = ['번호이동', '기기변경', '신규가입'] as const;
const PLAN_TIERS = ['고가', '중가', '저가'] as const;

interface RebateRow {
  id: number;
  model_id: string;
  carrier: string;
  storage: string;
  subscription_type: string;
  plan_tier: string;
  subsidy_rebate: number;
  installment_rebate: number;
  margin: number; // 만원 단위
  updated_at: string;
}

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

// ── 통신사 배지 색상 ──
const CARRIER_COLORS: Record<string, string> = { SKT: '#e44d26', KT: '#000', LGU: '#e6007e' };

export function RebateTab() {
  const [rebates, setRebates] = useState<RebateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);
  const [filterCarrier, setFilterCarrier] = useState<string>('ALL');
  const formRef = useRef<HTMLDivElement>(null);

  // ── 통신사별 마진 편집 임시값 ──
  const [marginEdits, setMarginEdits] = useState<Record<string, string>>({
    SKT: '', KT: '', LGU: '',
  });

  const [form, setForm] = useState({
    model_id: phones[0]?.id ?? '',
    carrier: 'SKT' as string,
    storage: '',
    subscription_type: '번호이동' as string,
    plan_tier: '고가' as string,
    subsidy_rebate: '',
    installment_rebate: '',
    margin: '',
  });

  const supabaseReady = isSupabaseConfigured();
  const [marginColExists, setMarginColExists] = useState<boolean | null>(null);

  // ── 스토어 ──
  const rebateStore = useRebateStore();
  const priceTableStore = usePriceTableStore();
  const carrierMarginStore = useCarrierMarginStore();

  // 마진 편집 초기값 (스토어 → 로컬 state 동기화)
  useEffect(() => {
    setMarginEdits({
      SKT: carrierMarginStore.margins.SKT > 0 ? String(carrierMarginStore.margins.SKT) : '',
      KT: carrierMarginStore.margins.KT > 0 ? String(carrierMarginStore.margins.KT) : '',
      LGU: carrierMarginStore.margins.LGU > 0 ? String(carrierMarginStore.margins.LGU) : '',
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const selectedPhone = phones.find((p) => p.id === form.model_id);
  const availableStorages = selectedPhone?.storage.map((s) => s.size) ?? [];

  // 단가표 매칭: 선택된 통신사·요금제 구간의 단가표 행
  const selectedPhoneName = selectedPhone?.name ?? '';
  const priceRows = priceTableStore.getRows(form.carrier as CarrierId);
  const matchedPriceRow = priceRows.find(
    (r) =>
      r.plan_tier === form.plan_tier &&
      selectedPhoneName !== '' &&
      (r.model_name === selectedPhoneName ||
        r.model_name.includes(selectedPhoneName) ||
        selectedPhoneName.includes(r.model_name)),
  );

  const currentStorageIdx = availableStorages.indexOf(form.storage);
  const nextStorage =
    currentStorageIdx >= 0 && currentStorageIdx < availableStorages.length - 1
      ? availableStorages[currentStorageIdx + 1]
      : null;

  useEffect(() => {
    if (availableStorages.length > 0 && !availableStorages.includes(form.storage)) {
      setForm((prev) => ({ ...prev, storage: availableStorages[0] }));
    }
  }, [form.model_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (supabaseReady) {
      loadRebates();
      checkMarginColumn();
    }
  }, [supabaseReady]); // eslint-disable-line react-hooks/exhaustive-deps

  async function loadRebates() {
    setLoading(true);
    const { data, error: dbErr } = await supabase
      .from('store_rebates')
      .select('*')
      .order('updated_at', { ascending: false });
    if (dbErr) {
      setError('리베이트 불러오기 실패: ' + dbErr.message);
    } else {
      setRebates((data as RebateRow[]) ?? []);
    }
    setLoading(false);
  }

  async function checkMarginColumn() {
    const { error: dbErr } = await supabase.from('store_rebates').select('margin').limit(1);
    setMarginColExists(!dbErr);
  }

  async function upsertWithFallback(rows: Record<string, unknown>[]) {
    const { error: dbErr } = await supabase
      .from('store_rebates')
      .upsert(rows as never[], {
        onConflict: 'store_id,model_id,carrier,storage,subscription_type,plan_tier',
      });
    if (dbErr && dbErr.message.toLowerCase().includes('margin')) {
      setMarginColExists(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const rowsWithout = rows.map(({ margin: _m, ...rest }) => rest);
      return supabase.from('store_rebates').upsert(rowsWithout as never[], {
        onConflict: 'store_id,model_id,carrier,storage,subscription_type,plan_tier',
      });
    }
    if (!dbErr) setMarginColExists(true);
    return { error: dbErr };
  }

  async function ensureDefaultStore() {
    const { data } = await supabase
      .from('stores')
      .select('id')
      .eq('id', DEFAULT_STORE_ID)
      .single();
    if (!data) {
      await supabase.from('stores').insert([{
        id: DEFAULT_STORE_ID,
        store_name: '본사',
        owner_name: '관리자',
        is_active: true,
      }] as never[]);
    }
  }

  function parseInput(val: string): number {
    const n = parseInt(val.replace(/,/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  function buildUpsertRow(storage: string): Record<string, unknown> {
    const subsidyInput = parseInput(form.subsidy_rebate);
    const installmentInput = parseInput(form.installment_rebate);
    // 개별 마진 필드 제거 → margin=0으로 저장 (기존 데이터는 수정 시 그대로 유지)
    return {
      store_id: DEFAULT_STORE_ID,
      model_id: form.model_id,
      carrier: form.carrier,
      storage,
      subscription_type: form.subscription_type,
      plan_tier: form.plan_tier,
      subsidy_rebate: subsidyInput * 10000,
      installment_rebate: installmentInput * 10000,
      margin: 0,
      updated_at: new Date().toISOString(),
    };
  }

  function validateForm(): string | null {
    if (!form.model_id || !form.carrier || !form.storage || !form.subscription_type || !form.plan_tier)
      return '모든 항목을 입력해주세요.';
    const subsidyInput = parseInput(form.subsidy_rebate);
    const installmentInput = parseInput(form.installment_rebate);
    if (subsidyInput === 0 && installmentInput === 0)
      return '공시지원금 또는 선택약정 리베이트 중 하나 이상 입력해주세요.';
    return null;
  }

  function handleEdit(row: RebateRow) {
    setEditingId(row.id);
    // 저장된 net 금액을 그대로 만원 단위로 표시 (개별 마진 필드 제거됨)
    setForm({
      model_id: row.model_id,
      carrier: row.carrier,
      storage: row.storage,
      subscription_type: row.subscription_type,
      plan_tier: row.plan_tier,
      subsidy_rebate: String(row.subsidy_rebate / 10000),
      installment_rebate: String(row.installment_rebate / 10000),
      margin: '',
    });
    setError('');
    setSuccess('');
    setTimeout(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm((prev) => ({ ...prev, subsidy_rebate: '', installment_rebate: '', margin: '' }));
    setError('');
    setSuccess('');
  }

  async function handleSave() {
    const err = validateForm();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    await ensureDefaultStore();
    const { error: dbErr } = await upsertWithFallback([buildUpsertRow(form.storage)]);
    if (dbErr) {
      setError('저장 실패: ' + dbErr.message);
    } else {
      setSuccess(editingId ? '수정되었습니다!' : '저장되었습니다!');
      setEditingId(null);
      setForm((prev) => ({ ...prev, subsidy_rebate: '', installment_rebate: '' }));
      loadRebates();
      void rebateStore.reload();
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }

  async function handleSaveBoth() {
    if (!nextStorage) return;
    const err = validateForm();
    if (err) { setError(err); return; }
    setSaving(true);
    setError('');
    setSuccess('');
    await ensureDefaultStore();
    const rows = [buildUpsertRow(form.storage), buildUpsertRow(nextStorage)];
    const { error: dbErr } = await upsertWithFallback(rows);
    if (dbErr) {
      setError('저장 실패: ' + dbErr.message);
    } else {
      setSuccess(`${form.storage} + ${nextStorage} 동시 저장 완료!`);
      setEditingId(null);
      setForm((prev) => ({ ...prev, subsidy_rebate: '', installment_rebate: '' }));
      loadRebates();
      void rebateStore.reload();
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('이 리베이트를 삭제할까요?')) return;
    const { error: dbErr } = await supabase.from('store_rebates').delete().eq('id', id);
    if (dbErr) {
      setError('삭제 실패: ' + dbErr.message);
    } else {
      if (editingId === id) handleCancelEdit();
      loadRebates();
      void rebateStore.reload();
    }
  }

  // ── 통신사별 마진 저장 ──
  function handleSaveCarrierMargins() {
    CARRIERS.forEach((c) => {
      const val = parseInt(marginEdits[c] ?? '0', 10);
      carrierMarginStore.setMargin(c, isNaN(val) ? 0 : val);
    });
    setSuccess('통신사 마진이 저장되었습니다.');
    setTimeout(() => setSuccess(''), 2000);
  }

  // 필터
  const TIER_SORT: Record<string, number> = { '고가': 0, '중가': 1, '저가': 2 };
  const filtered = rebates
    .filter((r) => {
      if (filterCarrier !== 'ALL' && r.carrier !== filterCarrier) return false;
      if (r.carrier !== form.carrier) return false;
      if (r.model_id !== form.model_id) return false;
      if (form.storage && r.storage !== form.storage) return false;
      if (r.subscription_type !== form.subscription_type) return false;
      return true;
    })
    .sort((a, b) => (TIER_SORT[a.plan_tier] ?? 9) - (TIER_SORT[b.plan_tier] ?? 9));

  const getPhoneName = (modelId: string) =>
    phones.find((p) => p.id === modelId)?.name ?? modelId;

  const subsidyInput = parseInput(form.subsidy_rebate);
  const installmentInput = parseInput(form.installment_rebate);
  const hasAmounts = form.subsidy_rebate !== '' || form.installment_rebate !== '';

  // 리베이트 목록에서 단가표 행 찾기 (carrier + plan_tier + 기기명 매칭)
  function findPriceRow(row: RebateRow) {
    const phoneName = phones.find((p) => p.id === row.model_id)?.name ?? '';
    const rows = priceTableStore.getRows(row.carrier as CarrierId);
    return rows.find(
      (r) =>
        r.plan_tier === row.plan_tier &&
        phoneName !== '' &&
        (r.model_name === phoneName ||
          r.model_name.includes(phoneName) ||
          phoneName.includes(r.model_name)),
    );
  }

  return (
    <>
      <h2 className={styles.pageTitle}>리베이트 관리</h2>

      {!supabaseReady && (
        <div className={styles.settingsCard} style={{ borderLeft: '4px solid #ef4444' }}>
          <p style={{ color: '#ef4444', margin: 0, fontSize: 14 }}>
            Supabase 미연결. .env 파일에 VITE_SUPABASE_URL과 VITE_SUPABASE_ANON_KEY를 설정하세요.
          </p>
        </div>
      )}

      {supabaseReady && marginColExists === false && (
        <div className={styles.settingsCard} style={{ borderLeft: '4px solid #f59e0b', padding: '12px 16px' }}>
          <p style={{ color: '#f59e0b', margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
            ⚠️ 마진 저장 기능을 사용하려면 Supabase SQL 실행이 필요합니다
          </p>
          <code style={{
            display: 'block', background: '#0f172a', border: '1px solid #334155',
            borderRadius: 6, padding: '8px 12px', fontSize: 13, color: '#86efac',
          }}>
            ALTER TABLE store_rebates ADD COLUMN IF NOT EXISTS margin INTEGER DEFAULT 0;
          </code>
        </div>
      )}

      {/* ── 통신사별 마진 설정 ── */}
      <div className={styles.settingsCard} style={{ borderLeft: '4px solid #7c3aed' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className={styles.settingsTitle} style={{ margin: 0, color: '#c084fc' }}>
            통신사별 마진 설정
          </h3>
          <button
            className={styles.settingsBtn}
            style={{ padding: '6px 16px', background: '#7c3aed', fontSize: 13 }}
            onClick={handleSaveCarrierMargins}
          >
            저장
          </button>
        </div>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          {CARRIERS.map((c) => {
            const stored = carrierMarginStore.margins[c];
            return (
              <div key={c} style={{ flex: 1, minWidth: 140 }}>
                <label style={{ fontSize: 12, color: '#94a3b8', display: 'block', marginBottom: 6 }}>
                  <span style={{
                    display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                    background: CARRIER_COLORS[c], color: '#fff', fontSize: 11, fontWeight: 700,
                    marginRight: 6,
                  }}>{c}</span>
                  마진 (만원)
                  {stored > 0 && (
                    <span style={{ marginLeft: 8, color: '#c084fc', fontSize: 11 }}>
                      현재 {stored}만
                    </span>
                  )}
                </label>
                <input
                  type="number"
                  className={styles.settingsInput}
                  min={0}
                  placeholder="0"
                  value={marginEdits[c]}
                  onChange={(e) =>
                    setMarginEdits((prev) => ({ ...prev, [c]: e.target.value }))
                  }
                />
              </div>
            );
          })}
        </div>
        <div style={{ fontSize: 11, color: '#64748b', marginTop: 8 }}>
          💡 단가표 기준 공시지원금에서 마진을 차감한 금액이 고객 최종 지원금으로 표시됩니다
          &nbsp;·&nbsp; 예: 공시지원금 58만 − 마진 5만 = 53만 반영
        </div>
        {success && success.includes('마진') && (
          <p className={styles.settingsSuccess} style={{ marginTop: 8 }}>{success}</p>
        )}
      </div>

      {/* ── 리베이트 입력 / 수정 폼 ── */}
      <div
        className={styles.settingsCard}
        ref={formRef}
        style={editingId ? { borderLeft: '4px solid #f59e0b' } : undefined}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 className={styles.settingsTitle} style={{ margin: 0 }}>
            {editingId ? '✏️ 리베이트 수정 중' : '리베이트 입력'}
          </h3>
          {editingId && (
            <button onClick={handleCancelEdit} style={{
              background: 'none', border: '1px solid #475569', borderRadius: 6,
              color: '#94a3b8', fontSize: 12, padding: '4px 10px', cursor: 'pointer',
            }}>취소</button>
          )}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>통신사</label>
            <select className={styles.filterSelect} style={{ width: '100%', padding: '10px 12px' }}
              value={form.carrier}
              onChange={(e) => setForm((prev) => ({ ...prev, carrier: e.target.value }))}>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>가입유형</label>
            <select className={styles.filterSelect} style={{ width: '100%', padding: '10px 12px' }}
              value={form.subscription_type}
              onChange={(e) => setForm((prev) => ({ ...prev, subscription_type: e.target.value }))}>
              {SUBSCRIPTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>기기</label>
            <select className={styles.filterSelect} style={{ width: '100%', padding: '10px 12px' }}
              value={form.model_id}
              onChange={(e) => setForm((prev) => ({ ...prev, model_id: e.target.value }))}>
              {phones.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>용량</label>
            <select className={styles.filterSelect} style={{ width: '100%', padding: '10px 12px' }}
              value={form.storage}
              onChange={(e) => setForm((prev) => ({ ...prev, storage: e.target.value }))}>
              {availableStorages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* 요금제 구간 */}
        <div className={styles.settingsField} style={{ marginTop: 12 }}>
          <label className={styles.settingsLabel}>요금제 구간</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {PLAN_TIERS.map((tier) => (
              <button key={tier}
                style={{
                  flex: 1, padding: '10px 0',
                  border: form.plan_tier === tier ? '2px solid #3b82f6' : '1px solid #334155',
                  borderRadius: 8,
                  background: form.plan_tier === tier ? '#1e3a5f' : '#0f172a',
                  color: form.plan_tier === tier ? '#93c5fd' : '#94a3b8',
                  fontWeight: form.plan_tier === tier ? 700 : 400,
                  cursor: 'pointer', fontSize: 14,
                }}
                onClick={() => setForm((prev) => ({ ...prev, plan_tier: tier }))}>
                {tier}
              </button>
            ))}
          </div>
        </div>

        {/* 단가표 기준 참조 */}
        {matchedPriceRow && (
          <div style={{
            marginTop: 12, background: '#0a1929', border: '1px solid #1e3a5f',
            borderRadius: 8, padding: '10px 14px',
          }}>
            <div style={{ fontSize: 11, color: '#60a5fa', fontWeight: 700, marginBottom: 8 }}>
              📊 단가표 기준 ({form.carrier} · {form.plan_tier})
              {carrierMarginStore.margins[form.carrier as CarrierId] > 0 && (
                <span style={{ marginLeft: 8, color: '#c084fc' }}>
                  · 마진 {carrierMarginStore.margins[form.carrier as CarrierId]}만원 차감
                </span>
              )}
            </div>
            {(() => {
              const cm = carrierMarginStore.margins[form.carrier as CarrierId];
              const items = [
                { label: '공시지원금 (번호이동)', raw: matchedPriceRow.subsidy_mnp, color: '#86efac' },
                { label: '공시지원금 (기변)', raw: matchedPriceRow.subsidy_change, color: '#86efac' },
                { label: '선택약정 (번호이동)', raw: matchedPriceRow.agreement_mnp, color: '#93c5fd' },
                { label: '선택약정 (기변)', raw: matchedPriceRow.agreement_change, color: '#93c5fd' },
              ];
              return (
                <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
                  {items.map(({ label, raw, color }) => {
                    const net = Math.max(0, raw - cm);
                    return (
                      <div key={label}>
                        <div style={{ fontSize: 10, color: '#64748b', marginBottom: 2 }}>{label}</div>
                        {raw > 0 ? (
                          <>
                            <div style={{ fontSize: 13, color, fontWeight: 700 }}>
                              {raw}만원
                            </div>
                            {cm > 0 && (
                              <div style={{ fontSize: 11, color: '#c084fc', marginTop: 1 }}>
                                → {net}만원
                              </div>
                            )}
                          </>
                        ) : (
                          <div style={{ fontSize: 13, color: '#475569' }}>-</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              );
            })()}
            <div style={{ fontSize: 10, color: '#334155', marginTop: 8 }}>
              ※ 단가표 관리에서 불러온 값 · 리베이트는 위 금액에 추가됩니다
            </div>
          </div>
        )}

        {/* 리베이트 금액 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>공시지원금 리베이트 (만원)</label>
            <input type="text" className={styles.settingsInput}
              placeholder="예: 10 → 100,000원"
              value={form.subsidy_rebate}
              onChange={(e) => setForm((prev) => ({ ...prev, subsidy_rebate: e.target.value }))} />
            {hasAmounts && form.subsidy_rebate !== '' && subsidyInput > 0 && (
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                반영: {subsidyInput}만원 ({(subsidyInput * 10000).toLocaleString()}원)
              </div>
            )}
          </div>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>선택약정 리베이트 (만원)</label>
            <input type="text" className={styles.settingsInput}
              placeholder="예: 5 → 50,000원"
              value={form.installment_rebate}
              onChange={(e) => setForm((prev) => ({ ...prev, installment_rebate: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }} />
            {hasAmounts && form.installment_rebate !== '' && installmentInput > 0 && (
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                반영: {installmentInput}만원 ({(installmentInput * 10000).toLocaleString()}원)
              </div>
            )}
          </div>
        </div>

        {error && <p className={styles.settingsError}>{error}</p>}
        {success && !success.includes('마진') && <p className={styles.settingsSuccess}>{success}</p>}

        <div style={{ marginTop: 12 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button
              className={styles.settingsBtn}
              style={{
                background: saving || !supabaseReady ? '#334155' : editingId ? '#d97706' : '#16a34a',
                flex: 1, minWidth: 80,
              }}
              onClick={handleSave}
              disabled={saving || !supabaseReady}
            >
              {saving ? '저장 중...' : editingId ? '수정 저장' : '저장'}
            </button>
            {nextStorage && hasAmounts && (
              <button
                className={styles.settingsBtn}
                style={{ background: saving || !supabaseReady ? '#334155' : '#7c3aed', flex: 1, minWidth: 160 }}
                onClick={handleSaveBoth}
                disabled={saving || !supabaseReady}
              >
                {saving ? '저장 중...' : `${form.storage} + ${nextStorage} 동시 저장`}
              </button>
            )}
          </div>
          {nextStorage && hasAmounts && (
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 6 }}>
              💡 두 용량 리베이트가 동일하면 동시 저장으로 한번에 등록하세요
            </div>
          )}
        </div>
      </div>

      {/* ── 리베이트 목록 ── */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <div>
            <span className={styles.tableTitle}>등록된 리베이트 ({filtered.length}건)</span>
            <div style={{ fontSize: 11, color: '#64748b', marginTop: 4 }}>
              {form.carrier} · {getPhoneName(form.model_id)} · {form.storage} · {form.subscription_type}
            </div>
          </div>
          <div className={styles.filterRow}>
            <select className={styles.filterSelect} value={filterCarrier}
              onChange={(e) => setFilterCarrier(e.target.value)}>
              <option value="ALL">전체 통신사</option>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button className={styles.settingsBtn}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={loadRebates}>
              새로고침
            </button>
          </div>
        </div>

        {loading ? (
          <p style={{ color: '#64748b', padding: 20, textAlign: 'center' }}>불러오는 중...</p>
        ) : (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>통신사</th>
                <th>기기명</th>
                <th>용량</th>
                <th>가입유형</th>
                <th>구간</th>
                <th>단가표 기준</th>
                <th style={{ color: '#c084fc' }}>마진 차감</th>
                <th>공시 리베이트</th>
                <th>약정 리베이트</th>
                <th>수정일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={11} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    등록된 리베이트가 없습니다
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isEditing = editingId === row.id;
                  const priceRow = findPriceRow(row);
                  // 통신사 마진 (carrier-level)
                  const cm = carrierMarginStore.margins[row.carrier as CarrierId] ?? 0;
                  // 가입유형에 따라 공시지원금 컬럼 선택 (번호이동=mnp, 기기변경=change, 신규=010)
                  const subsidyBase = priceRow
                    ? row.subscription_type === '번호이동'
                      ? priceRow.subsidy_mnp
                      : row.subscription_type === '기기변경'
                        ? priceRow.subsidy_change
                        : priceRow.subsidy_010
                    : null;
                  const agreementBase = priceRow
                    ? row.subscription_type === '번호이동'
                      ? priceRow.agreement_mnp
                      : row.subscription_type === '기기변경'
                        ? priceRow.agreement_change
                        : priceRow.agreement_010
                    : null;
                  const subsidyAfterCm = subsidyBase !== null ? Math.max(0, subsidyBase - cm) : null;
                  const agreementAfterCm = agreementBase !== null ? Math.max(0, agreementBase - cm) : null;

                  return (
                    <tr key={row.id}
                      style={isEditing ? { background: '#1c1a0e', outline: '2px solid #f59e0b' } : undefined}>
                      <td>
                        <span className={`${styles.badge} ${styles[row.carrier.toLowerCase() as 'skt' | 'kt' | 'lgu']}`}>
                          {row.carrier}
                        </span>
                      </td>
                      <td>{getPhoneName(row.model_id)}</td>
                      <td>{row.storage}</td>
                      <td>{row.subscription_type}</td>
                      <td>
                        <span style={{
                          padding: '2px 8px', borderRadius: 4, fontSize: 11, fontWeight: 600,
                          background: row.plan_tier === '고가' ? '#1e3a5f' : row.plan_tier === '중가' ? '#1e3a2f' : '#3a2f1e',
                          color: row.plan_tier === '고가' ? '#93c5fd' : row.plan_tier === '중가' ? '#86efac' : '#fcd34d',
                        }}>
                          {row.plan_tier}
                        </span>
                      </td>

                      {/* 단가표 기준 (만원 단위) */}
                      <td style={{ fontSize: 12 }}>
                        {subsidyBase !== null ? (
                          <div>
                            <div style={{ color: '#86efac', fontWeight: 600 }}>
                              공시 {subsidyBase}만원
                            </div>
                            {agreementBase !== null && agreementBase > 0 && (
                              <div style={{ color: '#93c5fd' }}>
                                약정 {agreementBase}만원
                              </div>
                            )}
                          </div>
                        ) : (
                          <span style={{ color: '#334155', fontSize: 11 }}>단가표 미로드</span>
                        )}
                      </td>

                      {/* 마진 차감 후 (만원 단위) */}
                      <td style={{ fontSize: 12 }}>
                        {cm > 0 && subsidyAfterCm !== null ? (
                          <div>
                            <div style={{ fontSize: 10, color: '#94a3b8', marginBottom: 2 }}>
                              -{cm}만원 차감
                            </div>
                            <div style={{ color: '#c084fc', fontWeight: 700 }}>
                              공시 {subsidyAfterCm}만원
                            </div>
                            {agreementAfterCm !== null && agreementAfterCm > 0 && (
                              <div style={{ color: '#a78bfa' }}>
                                약정 {agreementAfterCm}만원
                              </div>
                            )}
                          </div>
                        ) : cm === 0 && subsidyBase !== null ? (
                          <span style={{ color: '#475569', fontSize: 11 }}>마진 미설정</span>
                        ) : (
                          <span style={{ color: '#334155' }}>-</span>
                        )}
                      </td>

                      {/* 공시 리베이트 — 단가표 기준 포함 표시 */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 13 }}>
                          {row.subsidy_rebate / 10000}만원
                        </div>
                        {subsidyBase !== null && (
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                            단가표 {subsidyAfterCm ?? subsidyBase}만
                            {row.subsidy_rebate > 0 && ` + 리베이트 ${row.subsidy_rebate / 10000}만`}
                          </div>
                        )}
                      </td>

                      {/* 약정 리베이트 — 단가표 기준 포함 표시 */}
                      <td>
                        <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: 13 }}>
                          {row.installment_rebate / 10000}만원
                        </div>
                        {agreementBase !== null && agreementBase > 0 && (
                          <div style={{ fontSize: 10, color: '#64748b', marginTop: 1 }}>
                            단가표 {agreementAfterCm ?? agreementBase}만
                            {row.installment_rebate > 0 && ` + 리베이트 ${row.installment_rebate / 10000}만`}
                          </div>
                        )}
                      </td>

                      <td style={{ fontSize: 11, color: '#64748b' }}>
                        {new Date(row.updated_at).toLocaleDateString('ko-KR')}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <button
                            className={styles.resetBtn}
                            style={isEditing ? { background: '#f59e0b', color: '#000' } : undefined}
                            onClick={() => (isEditing ? handleCancelEdit() : handleEdit(row))}
                          >
                            {isEditing ? '취소' : '수정'}
                          </button>
                          <button className={styles.resetBtn} onClick={() => handleDelete(row.id)}>
                            삭제
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
