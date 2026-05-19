import { useState, useEffect, useRef } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import phonesData from '../../data/phones.json';
import type { Phone } from '../../types';
import styles from './AdminPage.module.css';

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

export function RebateTab() {
  const [rebates, setRebates] = useState<RebateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [editingId, setEditingId] = useState<number | null>(null);

  const [filterCarrier, setFilterCarrier] = useState<string>('ALL');
  const formRef = useRef<HTMLDivElement>(null);

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
  // margin 컬럼 존재 여부 (Supabase SQL 실행 전까지 false)
  const [marginColExists, setMarginColExists] = useState<boolean | null>(null);

  const selectedPhone = phones.find((p) => p.id === form.model_id);
  const availableStorages = selectedPhone?.storage.map((s) => s.size) ?? [];

  // 현재 용량 다음 용량 (256GB → 512GB 복사용)
  const currentStorageIdx = availableStorages.indexOf(form.storage);
  const nextStorage = currentStorageIdx >= 0 && currentStorageIdx < availableStorages.length - 1
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
    const { data, error } = await supabase
      .from('store_rebates')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) {
      setError('리베이트 불러오기 실패: ' + error.message);
    } else {
      setRebates((data as RebateRow[]) ?? []);
    }
    setLoading(false);
  }

  // margin 컬럼 존재 여부 확인
  async function checkMarginColumn() {
    const { error } = await supabase
      .from('store_rebates')
      .select('margin')
      .limit(1);
    setMarginColExists(!error);
  }

  // margin 포함해서 upsert 시도 → 컬럼 없으면 margin 제외 후 재시도
  async function upsertWithFallback(rows: Record<string, unknown>[]) {
    const { error } = await supabase
      .from('store_rebates')
      .upsert(rows as never[], {
        onConflict: 'store_id,model_id,carrier,storage,subscription_type,plan_tier',
      });

    if (error && error.message.toLowerCase().includes('margin')) {
      // margin 컬럼 없음 → 제외 후 재시도
      setMarginColExists(false);
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const rowsWithout = rows.map(({ margin: _m, ...rest }) => rest);
      return supabase.from('store_rebates').upsert(rowsWithout as never[], {
        onConflict: 'store_id,model_id,carrier,storage,subscription_type,plan_tier',
      });
    }

    if (!error) setMarginColExists(true);
    return { error };
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

  // 파싱 헬퍼
  function parseInput(val: string): number {
    const n = parseInt(val.replace(/,/g, ''), 10);
    return isNaN(n) ? 0 : n;
  }

  // DB에 upsert할 데이터 생성 (항상 margin 포함 — 컬럼 없으면 upsertWithFallback이 처리)
  function buildUpsertRow(storage: string): Record<string, unknown> {
    const subsidyInput = parseInput(form.subsidy_rebate);
    const installmentInput = parseInput(form.installment_rebate);
    const marginInput = parseInput(form.margin);
    const subsidyAmt = Math.max(0, subsidyInput - marginInput) * 10000;
    const installmentAmt = Math.max(0, installmentInput - marginInput) * 10000;
    return {
      store_id: DEFAULT_STORE_ID,
      model_id: form.model_id,
      carrier: form.carrier,
      storage,
      subscription_type: form.subscription_type,
      plan_tier: form.plan_tier,
      subsidy_rebate: subsidyAmt,
      installment_rebate: installmentAmt,
      margin: marginInput, // 항상 포함 (만원 단위)
      updated_at: new Date().toISOString(),
    };
  }

  function validateForm(): string | null {
    if (!form.model_id || !form.carrier || !form.storage || !form.subscription_type || !form.plan_tier)
      return '모든 항목을 입력해주세요.';
    const marginInput = parseInput(form.margin);
    if (marginInput < 0) return '마진은 0 이상이어야 합니다.';
    const subsidyNet = Math.max(0, parseInput(form.subsidy_rebate) - marginInput);
    const installmentNet = Math.max(0, parseInput(form.installment_rebate) - marginInput);
    if (subsidyNet === 0 && installmentNet === 0)
      return '공시지원금 또는 선택약정 리베이트 중 하나 이상 입력해주세요.';
    return null;
  }

  // 수정 버튼 클릭: 기존 row 값을 폼에 로드
  function handleEdit(row: RebateRow) {
    setEditingId(row.id);
    const storedMargin = row.margin ?? 0;
    // 역산: 저장된 net 금액 + 마진 = 원래 입력값
    const subsidyGross = row.subsidy_rebate / 10000 + storedMargin;
    const installmentGross = row.installment_rebate / 10000 + storedMargin;
    setForm({
      model_id: row.model_id,
      carrier: row.carrier,
      storage: row.storage,
      subscription_type: row.subscription_type,
      plan_tier: row.plan_tier,
      subsidy_rebate: String(subsidyGross),
      installment_rebate: String(installmentGross),
      margin: storedMargin > 0 ? String(storedMargin) : '',
    });
    // 마진이 0인 기존 데이터는 안내 메시지 표시
    if (storedMargin === 0) {
      setError('⚠️ 이 항목은 마진이 기록되지 않은 이전 데이터입니다. 마진과 원래 리베이트 금액을 직접 입력 후 수정 저장해주세요.');
    } else {
      setError('');
    }
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

  // 저장 (현재 storage만)
  async function handleSave() {
    const err = validateForm();
    if (err) { setError(err); return; }

    setSaving(true);
    setError('');
    setSuccess('');
    await ensureDefaultStore();

    const { error } = await upsertWithFallback([buildUpsertRow(form.storage)]);

    if (error) {
      setError('저장 실패: ' + error.message);
    } else {
      setSuccess(editingId ? '수정되었습니다!' : '저장되었습니다!');
      setEditingId(null);
      setForm((prev) => ({ ...prev, subsidy_rebate: '', installment_rebate: '', margin: '' }));
      loadRebates();
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }

  // 현재 storage + 다음 storage 동시에 저장
  async function handleSaveBoth() {
    if (!nextStorage) return;
    const err = validateForm();
    if (err) { setError(err); return; }

    setSaving(true);
    setError('');
    setSuccess('');
    await ensureDefaultStore();

    const rows = [buildUpsertRow(form.storage), buildUpsertRow(nextStorage)];
    const { error } = await upsertWithFallback(rows);

    if (error) {
      setError('저장 실패: ' + error.message);
    } else {
      setSuccess(`${form.storage} + ${nextStorage} 동시 저장 완료!`);
      setEditingId(null);
      setForm((prev) => ({ ...prev, subsidy_rebate: '', installment_rebate: '', margin: '' }));
      loadRebates();
      setTimeout(() => setSuccess(''), 3000);
    }
    setSaving(false);
  }

  async function handleDelete(id: number) {
    if (!confirm('이 리베이트를 삭제할까요?')) return;
    const { error } = await supabase.from('store_rebates').delete().eq('id', id);
    if (error) {
      setError('삭제 실패: ' + error.message);
    } else {
      if (editingId === id) handleCancelEdit();
      loadRebates();
    }
  }

  // 폼 선택값 기준 자동 필터
  const filtered = rebates.filter((r) => {
    if (filterCarrier !== 'ALL' && r.carrier !== filterCarrier) return false;
    if (r.carrier !== form.carrier) return false;
    if (r.model_id !== form.model_id) return false;
    if (form.storage && r.storage !== form.storage) return false;
    if (r.subscription_type !== form.subscription_type) return false;
    return true;
  });

  const getPhoneName = (modelId: string) =>
    phones.find((p) => p.id === modelId)?.name ?? modelId;

  const subsidyInput = parseInput(form.subsidy_rebate);
  const installmentInput = parseInput(form.installment_rebate);
  const marginInput = parseInput(form.margin);
  const subsidyNet = Math.max(0, subsidyInput - marginInput);
  const installmentNet = Math.max(0, installmentInput - marginInput);
  const hasAmounts = form.subsidy_rebate !== '' || form.installment_rebate !== '';

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

      {/* margin 컬럼 미설치 안내 */}
      {supabaseReady && marginColExists === false && (
        <div className={styles.settingsCard} style={{ borderLeft: '4px solid #f59e0b', padding: '12px 16px' }}>
          <p style={{ color: '#f59e0b', margin: '0 0 8px', fontSize: 13, fontWeight: 600 }}>
            ⚠️ 마진 저장 기능을 사용하려면 Supabase SQL 실행이 필요합니다
          </p>
          <p style={{ color: '#94a3b8', margin: '0 0 8px', fontSize: 12 }}>
            Supabase 대시보드 → SQL Editor에서 아래 SQL을 실행하세요:
          </p>
          <code style={{
            display: 'block',
            background: '#0f172a',
            border: '1px solid #334155',
            borderRadius: 6,
            padding: '8px 12px',
            fontSize: 13,
            color: '#86efac',
            letterSpacing: 0.3,
          }}>
            ALTER TABLE store_rebates ADD COLUMN IF NOT EXISTS margin INTEGER DEFAULT 0;
          </code>
          <p style={{ color: '#64748b', margin: '8px 0 0', fontSize: 11 }}>
            * SQL 실행 전까지 마진 없이 저장됩니다 (리베이트 금액 반영은 정상 동작)
          </p>
        </div>
      )}

      {/* 입력 / 수정 폼 */}
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
            <button
              onClick={handleCancelEdit}
              style={{
                background: 'none',
                border: '1px solid #475569',
                borderRadius: 6,
                color: '#94a3b8',
                fontSize: 12,
                padding: '4px 10px',
                cursor: 'pointer',
              }}
            >
              취소
            </button>
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

        {/* 마진 */}
        <div className={styles.settingsField} style={{ marginTop: 12 }}>
          <label className={styles.settingsLabel}>마진 (만원) — 리베이트에서 차감됨</label>
          <input type="text" className={styles.settingsInput}
            placeholder="예: 10 → 리베이트에서 100,000원 차감"
            value={form.margin}
            onChange={(e) => setForm((prev) => ({ ...prev, margin: e.target.value }))} />
        </div>

        {/* 리베이트 금액 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>공시지원금 리베이트 (만원)</label>
            <input type="text" className={styles.settingsInput}
              placeholder="예: 10 → 100,000원"
              value={form.subsidy_rebate}
              onChange={(e) => setForm((prev) => ({ ...prev, subsidy_rebate: e.target.value }))} />
            {hasAmounts && form.subsidy_rebate !== '' && (
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                실제 반영: {subsidyNet}만원 ({(subsidyNet * 10000).toLocaleString()}원)
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
            {hasAmounts && form.installment_rebate !== '' && (
              <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>
                실제 반영: {installmentNet}만원 ({(installmentNet * 10000).toLocaleString()}원)
              </div>
            )}
          </div>
        </div>

        {error && <p className={styles.settingsError}>{error}</p>}
        {success && <p className={styles.settingsSuccess}>{success}</p>}

        {/* 버튼 영역 */}
        <div style={{ marginTop: 12 }}>
          {/* 저장 / 수정 저장 */}
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

            {/* 다음 용량 동시 저장 버튼 (입력값 있을 때만 표시) */}
            {nextStorage && hasAmounts && (
              <button
                className={styles.settingsBtn}
                style={{
                  background: saving || !supabaseReady ? '#334155' : '#7c3aed',
                  flex: 1, minWidth: 160,
                }}
                onClick={handleSaveBoth}
                disabled={saving || !supabaseReady}
              >
                {saving ? '저장 중...' : `${form.storage} + ${nextStorage} 동시 저장`}
              </button>
            )}
          </div>

          {/* 동시 저장 안내 */}
          {nextStorage && hasAmounts && (
            <div style={{ fontSize: 11, color: '#7c3aed', marginTop: 6 }}>
              💡 두 용량 리베이트가 동일하면 동시 저장 버튼으로 한번에 등록하세요
            </div>
          )}
        </div>
      </div>

      {/* 리베이트 목록 */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <div>
            <span className={styles.tableTitle}>
              등록된 리베이트 ({filtered.length}건)
            </span>
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
                <th>마진</th>
                <th>공시 리베이트</th>
                <th>약정 리베이트</th>
                <th>수정일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={10} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    등록된 리베이트가 없습니다
                  </td>
                </tr>
              ) : (
                filtered.map((row) => {
                  const isEditing = editingId === row.id;
                  const rowMargin = row.margin ?? 0;
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
                      {/* 마진 컬럼 */}
                      <td style={{ fontSize: 12 }}>
                        {rowMargin > 0 ? (
                          <span style={{ color: '#f59e0b', fontWeight: 600 }}>
                            {rowMargin}만원
                          </span>
                        ) : (
                          <span style={{ color: '#475569' }}>-</span>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#16a34a', fontSize: 13 }}>
                          {row.subsidy_rebate.toLocaleString()}원
                        </div>
                        {rowMargin > 0 && (
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            입력: {row.subsidy_rebate / 10000 + rowMargin}만원
                          </div>
                        )}
                      </td>
                      <td>
                        <div style={{ fontWeight: 700, color: '#3b82f6', fontSize: 13 }}>
                          {row.installment_rebate.toLocaleString()}원
                        </div>
                        {rowMargin > 0 && (
                          <div style={{ fontSize: 10, color: '#64748b' }}>
                            입력: {row.installment_rebate / 10000 + rowMargin}만원
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
                            onClick={() => isEditing ? handleCancelEdit() : handleEdit(row)}
                          >
                            {isEditing ? '취소' : '수정'}
                          </button>
                          <button className={styles.resetBtn}
                            onClick={() => handleDelete(row.id)}>
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
