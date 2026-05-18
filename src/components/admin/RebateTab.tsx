import { useState, useEffect } from 'react';
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
  updated_at: string;
}

const DEFAULT_STORE_ID = '00000000-0000-0000-0000-000000000001';

export function RebateTab() {
  const [rebates, setRebates] = useState<RebateRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [filterCarrier, setFilterCarrier] = useState<string>('ALL');

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

  const selectedPhone = phones.find((p) => p.id === form.model_id);
  const availableStorages = selectedPhone?.storage.map((s) => s.size) ?? [];

  useEffect(() => {
    if (availableStorages.length > 0 && !availableStorages.includes(form.storage)) {
      setForm((prev) => ({ ...prev, storage: availableStorages[0] }));
    }
  }, [form.model_id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (supabaseReady) loadRebates();
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

  async function handleSave() {
    if (!form.model_id || !form.carrier || !form.storage || !form.subscription_type || !form.plan_tier) {
      setError('모든 항목을 입력해주세요.');
      return;
    }
    const subsidyInput = parseInt((form.subsidy_rebate || '0').replace(/,/g, ''), 10);
    const installmentInput = parseInt((form.installment_rebate || '0').replace(/,/g, ''), 10);
    const marginInput = parseInt((form.margin || '0').replace(/,/g, ''), 10);
    if (isNaN(subsidyInput) || isNaN(installmentInput) || isNaN(marginInput) || marginInput < 0) {
      setError('금액을 올바르게 입력해주세요.');
      return;
    }
    const subsidyAmt = Math.max(0, subsidyInput - marginInput) * 10000;
    const installmentAmt = Math.max(0, installmentInput - marginInput) * 10000;
    if (subsidyAmt === 0 && installmentAmt === 0) {
      setError('공시지원금 또는 선택약정 리베이트 중 하나 이상 입력해주세요.');
      return;
    }

    setSaving(true);
    setError('');
    setSuccess('');

    await ensureDefaultStore();

    const { error } = await supabase
      .from('store_rebates')
      .upsert([{
        store_id: DEFAULT_STORE_ID,
        model_id: form.model_id,
        carrier: form.carrier,
        storage: form.storage,
        subscription_type: form.subscription_type,
        plan_tier: form.plan_tier,
        subsidy_rebate: subsidyAmt,
        installment_rebate: installmentAmt,
      }] as never[], {
        onConflict: 'store_id,model_id,carrier,storage,subscription_type,plan_tier',
      });

    if (error) {
      setError('저장 실패: ' + error.message);
    } else {
      setSuccess('저장되었습니다!');
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
      loadRebates();
    }
  }

  // 폼 선택값 기준 자동 필터 + 통신사 필터 조합
  const filtered = rebates.filter((r) => {
    if (filterCarrier !== 'ALL' && r.carrier !== filterCarrier) return false;
    if (r.carrier !== form.carrier) return false;
    if (r.model_id !== form.model_id) return false;
    if (form.storage && r.storage !== form.storage) return false;
    if (r.subscription_type !== form.subscription_type) return false;
    return true;
  });

  const getPhoneName = (modelId: string) => {
    const phone = phones.find((p) => p.id === modelId);
    return phone?.name ?? modelId;
  };

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

      {/* 입력 폼 */}
      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>리베이트 입력</h3>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>통신사</label>
            <select
              className={styles.filterSelect}
              style={{ width: '100%', padding: '10px 12px' }}
              value={form.carrier}
              onChange={(e) => setForm((prev) => ({ ...prev, carrier: e.target.value }))}
            >
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>

          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>가입유형</label>
            <select
              className={styles.filterSelect}
              style={{ width: '100%', padding: '10px 12px' }}
              value={form.subscription_type}
              onChange={(e) => setForm((prev) => ({ ...prev, subscription_type: e.target.value }))}
            >
              {SUBSCRIPTION_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>기기</label>
            <select
              className={styles.filterSelect}
              style={{ width: '100%', padding: '10px 12px' }}
              value={form.model_id}
              onChange={(e) => setForm((prev) => ({ ...prev, model_id: e.target.value }))}
            >
              {phones.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>

          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>용량</label>
            <select
              className={styles.filterSelect}
              style={{ width: '100%', padding: '10px 12px' }}
              value={form.storage}
              onChange={(e) => setForm((prev) => ({ ...prev, storage: e.target.value }))}
            >
              {availableStorages.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
        </div>

        {/* 요금제 구간 */}
        <div className={styles.settingsField} style={{ marginTop: 12 }}>
          <label className={styles.settingsLabel}>요금제 구간</label>
          <div style={{ display: 'flex', gap: 8 }}>
            {PLAN_TIERS.map((tier) => (
              <button
                key={tier}
                style={{
                  flex: 1,
                  padding: '10px 0',
                  border: form.plan_tier === tier ? '2px solid #3b82f6' : '1px solid #334155',
                  borderRadius: 8,
                  background: form.plan_tier === tier ? '#1e3a5f' : '#0f172a',
                  color: form.plan_tier === tier ? '#93c5fd' : '#94a3b8',
                  fontWeight: form.plan_tier === tier ? 700 : 400,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
                onClick={() => setForm((prev) => ({ ...prev, plan_tier: tier }))}
              >
                {tier}
              </button>
            ))}
          </div>
        </div>

        {/* 마진 */}
        <div className={styles.settingsField} style={{ marginTop: 12 }}>
          <label className={styles.settingsLabel}>마진 (만원) — 리베이트에서 차감됨</label>
          <input
            type="text"
            className={styles.settingsInput}
            placeholder="예: 10 → 리베이트에서 100,000원 차감"
            value={form.margin}
            onChange={(e) => setForm((prev) => ({ ...prev, margin: e.target.value }))}
          />
        </div>

        {/* 리베이트 금액 2개 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 12 }}>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>공시지원금 리베이트 (만원)</label>
            <input
              type="text"
              className={styles.settingsInput}
              placeholder="예: 10 → 100,000원"
              value={form.subsidy_rebate}
              onChange={(e) => setForm((prev) => ({ ...prev, subsidy_rebate: e.target.value }))}
            />
            {(() => {
              const s = parseInt(form.subsidy_rebate || '0', 10);
              const m = parseInt(form.margin || '0', 10);
              if (!isNaN(s) && !isNaN(m) && (s > 0 || m > 0)) {
                const net = Math.max(0, s - m);
                return <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>실제 반영: {net}만원 ({(net * 10000).toLocaleString()}원)</div>;
              }
              return null;
            })()}
          </div>
          <div className={styles.settingsField}>
            <label className={styles.settingsLabel}>선택약정 리베이트 (만원)</label>
            <input
              type="text"
              className={styles.settingsInput}
              placeholder="예: 5 → 50,000원"
              value={form.installment_rebate}
              onChange={(e) => setForm((prev) => ({ ...prev, installment_rebate: e.target.value }))}
              onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
            />
            {(() => {
              const s = parseInt(form.installment_rebate || '0', 10);
              const m = parseInt(form.margin || '0', 10);
              if (!isNaN(s) && !isNaN(m) && (s > 0 || m > 0)) {
                const net = Math.max(0, s - m);
                return <div style={{ fontSize: 11, color: '#3b82f6', marginTop: 4 }}>실제 반영: {net}만원 ({(net * 10000).toLocaleString()}원)</div>;
              }
              return null;
            })()}
          </div>
        </div>

        {error && <p className={styles.settingsError}>{error}</p>}
        {success && <p className={styles.settingsSuccess}>{success}</p>}

        <button
          className={styles.settingsBtn}
          style={{
            background: saving || !supabaseReady ? '#334155' : '#16a34a',
            marginTop: 8,
          }}
          onClick={handleSave}
          disabled={saving || !supabaseReady}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
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
            <select
              className={styles.filterSelect}
              value={filterCarrier}
              onChange={(e) => setFilterCarrier(e.target.value)}
            >
              <option value="ALL">전체 통신사</option>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button
              className={styles.settingsBtn}
              style={{ padding: '6px 12px', fontSize: 12 }}
              onClick={loadRebates}
            >
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
                <th>공시 리베이트</th>
                <th>약정 리베이트</th>
                <th>수정일</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={9} style={{ textAlign: 'center', color: '#64748b', padding: 24 }}>
                    등록된 리베이트가 없습니다
                  </td>
                </tr>
              ) : (
                filtered.map((row) => (
                  <tr key={row.id}>
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
                        padding: '2px 8px',
                        borderRadius: 4,
                        fontSize: 11,
                        fontWeight: 600,
                        background: row.plan_tier === '고가' ? '#1e3a5f' : row.plan_tier === '중가' ? '#1e3a2f' : '#3a2f1e',
                        color: row.plan_tier === '고가' ? '#93c5fd' : row.plan_tier === '중가' ? '#86efac' : '#fcd34d',
                      }}>
                        {row.plan_tier}
                      </span>
                    </td>
                    <td style={{ fontWeight: 700, color: '#16a34a' }}>
                      {row.subsidy_rebate.toLocaleString()}원
                    </td>
                    <td style={{ fontWeight: 700, color: '#3b82f6' }}>
                      {row.installment_rebate.toLocaleString()}원
                    </td>
                    <td style={{ fontSize: 11, color: '#64748b' }}>
                      {new Date(row.updated_at).toLocaleDateString('ko-KR')}
                    </td>
                    <td>
                      <button
                        className={styles.resetBtn}
                        onClick={() => handleDelete(row.id)}
                        title="삭제"
                      >
                        삭제
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
