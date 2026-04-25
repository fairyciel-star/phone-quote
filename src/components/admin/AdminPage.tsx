import { useState } from 'react';
import { useAdminStore, type AdminTab } from '../../store/useAdminStore';
import { useSheetStore } from '../../store/useSheetStore';
import phonesData from '../../data/phones.json';
import plansData from '../../data/plans.json';
import discountsData from '../../data/discounts.json';
import type { Phone, Plan, Discount } from '../../types';
import styles from './AdminPage.module.css';

const phones = phonesData as unknown as Phone[];
const plans = plansData as unknown as Plan[];
const jsonDiscounts = discountsData as unknown as Discount[];

const CARRIERS = ['SKT', 'KT', 'LGU'] as const;

// ────────────────────────────────────
// Login
// ────────────────────────────────────
function AdminLogin() {
  const login = useAdminStore((s) => s.login);
  const [pw, setPw] = useState('');
  const [error, setError] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const ok = login(pw);
    if (!ok) {
      setError(true);
      setPw('');
    }
  };

  return (
    <div className={styles.loginWrap}>
      <div className={styles.loginCard}>
        <div className={styles.loginLogo}>🔐</div>
        <h1 className={styles.loginTitle}>관리자 로그인</h1>
        <p className={styles.loginSubtitle}>휴대폰 견적 관리 시스템</p>
        <form onSubmit={handleSubmit}>
          <label className={styles.loginLabel}>비밀번호</label>
          <input
            type="password"
            className={`${styles.loginInput} ${error ? styles.error : ''}`}
            value={pw}
            onChange={(e) => { setPw(e.target.value); setError(false); }}
            placeholder="비밀번호 입력"
            autoFocus
          />
          {error && <p className={styles.loginError}>비밀번호가 올바르지 않습니다</p>}
          <button type="submit" className={styles.loginBtn}>로그인</button>
        </form>
      </div>
    </div>
  );
}

// ────────────────────────────────────
// Dashboard
// ────────────────────────────────────
function Dashboard() {
  const sheetLoaded = useSheetStore((s) => s.loaded);
  const sheetPlans = useSheetStore((s) => s.plans);
  const sheetSubsidies = useSheetStore((s) => s.subsidies);
  const sheetCards = useSheetStore((s) => s.cardDiscounts);
  const sheetAddons = useSheetStore((s) => s.addons);
  const overrides = useAdminStore((s) => s.subsidyOverrides);

  const stats = [
    { icon: '📱', value: phones.length, label: '등록 기기' },
    { icon: '📋', value: sheetLoaded ? sheetPlans.length : plans.length, label: '요금제' },
    { icon: '💳', value: sheetLoaded ? sheetCards.length + sheetAddons.length : jsonDiscounts.length, label: '할인 항목' },
    { icon: '📊', value: sheetLoaded ? sheetSubsidies.length : 0, label: '시트 지원금 행' },
    { icon: '✏️', value: overrides.length, label: '수동 지원금 수정' },
  ];

  return (
    <>
      <h2 className={styles.pageTitle}>대시보드</h2>

      <div className={`${styles.sheetStatus}`}>
        <div className={`${styles.statusDot} ${sheetLoaded ? styles.connected : styles.disconnected}`} />
        <div>
          <div className={styles.statusText}>
            Google Sheets {sheetLoaded ? '연결됨' : '미연결 (JSON 기본값 사용 중)'}
          </div>
          <div className={styles.statusSub}>
            {sheetLoaded
              ? `지원금 ${sheetSubsidies.length}건 · 요금제 ${sheetPlans.length}건 · 카드 ${sheetCards.length}건 · 부가서비스 ${sheetAddons.length}건`
              : '환경변수 VITE_GOOGLE_SHEET_ID를 설정하면 시트 연동이 활성화됩니다'}
          </div>
        </div>
      </div>

      <div className={styles.statGrid}>
        {stats.map((s) => (
          <div key={s.label} className={styles.statCard}>
            <div className={styles.statIcon}>{s.icon}</div>
            <p className={styles.statValue}>{s.value}</p>
            <p className={styles.statLabel}>{s.label}</p>
          </div>
        ))}
      </div>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>📱 등록 기기 목록</span>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>브랜드</th>
              <th>모델명</th>
              <th>용량</th>
              <th>출고가</th>
              <th>지원 통신사</th>
            </tr>
          </thead>
          <tbody>
            {phones.map((phone) =>
              phone.storage.map((s, i) => (
                <tr key={`${phone.id}-${s.size}`}>
                  {i === 0 && (
                    <>
                      <td rowSpan={phone.storage.length}>
                        <span className={`${styles.badge} ${phone.brand === '삼성' ? styles.samsung : styles.apple}`}>
                          {phone.brand}
                        </span>
                      </td>
                      <td rowSpan={phone.storage.length}>{phone.name}</td>
                    </>
                  )}
                  <td>{s.size}</td>
                  <td>{s.price.toLocaleString()}원</td>
                  {i === 0 && (
                    <td rowSpan={phone.storage.length}>
                      {phone.carriers.map((c) => (
                        <span key={c} className={`${styles.badge} ${styles[c.toLowerCase() as 'skt' | 'kt' | 'lgu']}`} style={{ marginRight: 4 }}>
                          {c}
                        </span>
                      ))}
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ────────────────────────────────────
// Phone Subsidy Management
// ────────────────────────────────────
function SubsidyCell({ phone, carrier, storage }: { phone: Phone; carrier: string; storage: string }) {
  const getOverride = useAdminStore((s) => s.getSubsidyOverride);
  const setOverride = useAdminStore((s) => s.setSubsidyOverride);
  const resetOverride = useAdminStore((s) => s.resetSubsidyOverride);
  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSubsidy = useSheetStore((s) => s.getSubsidy);

  const overrideVal = getOverride(phone.id, carrier, storage);
  const jsonVal = (phone.공통지원금 as Record<string, Record<string, number>>)[carrier]?.[storage] ?? 0;

  // Use sheet value if loaded, else JSON
  const sheetVal = sheetLoaded
    ? getSubsidy(phone.id, carrier as 'SKT' | 'KT' | 'LGU', storage, '번호이동').공통지원금
    : null;

  const baseVal = sheetVal ?? jsonVal;
  const displayVal = overrideVal ?? baseVal;

  const [editing, setEditing] = useState(false);
  const [inputVal, setInputVal] = useState('');
  const [saved, setSaved] = useState(false);

  const startEdit = () => {
    setInputVal(String(displayVal));
    setEditing(true);
    setSaved(false);
  };

  const save = () => {
    const num = parseInt(inputVal.replace(/,/g, ''));
    if (isNaN(num) || num < 0) return;
    setOverride({ phoneId: phone.id, carrier, storage, 공통지원금: num });
    setEditing(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  const reset = () => {
    resetOverride(phone.id, carrier, storage);
    setEditing(false);
  };

  return (
    <td>
      {editing ? (
        <div className={styles.editCell}>
          <input
            className={styles.editInput}
            type="text"
            value={inputVal}
            onChange={(e) => setInputVal(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEditing(false); }}
            autoFocus
          />
          <button className={styles.saveBtn} onClick={save}>저장</button>
          <button className={styles.resetBtn} onClick={() => setEditing(false)}>취소</button>
        </div>
      ) : (
        <div className={styles.editCell}>
          <span style={{ cursor: 'pointer', textDecoration: 'underline dotted' }} onClick={startEdit}>
            {displayVal.toLocaleString()}원
          </span>
          {saved && <span className={styles.overrideTag}>✓ 저장</span>}
          {overrideVal !== null && (
            <>
              <span className={styles.overrideTag}>수정됨</span>
              <button className={styles.resetBtn} onClick={reset} title="초기화">↺</button>
            </>
          )}
        </div>
      )}
    </td>
  );
}

function PhonesTab() {
  const [filterCarrier, setFilterCarrier] = useState<string>('ALL');
  const [filterBrand, setFilterBrand] = useState<string>('ALL');

  const filtered = phones.filter((p) => {
    const brandOk = filterBrand === 'ALL' || p.brand === filterBrand;
    const carrierOk = filterCarrier === 'ALL' || p.carriers.includes(filterCarrier as 'SKT' | 'KT' | 'LGU');
    return brandOk && carrierOk;
  });

  const displayCarriers = filterCarrier === 'ALL' ? CARRIERS : [filterCarrier as 'SKT' | 'KT' | 'LGU'];

  return (
    <>
      <h2 className={styles.pageTitle}>📱 기기 / 공통지원금 관리</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, marginTop: -16 }}>
        금액을 클릭하면 수정할 수 있어요. 수정값은 브라우저에 저장됩니다. (Google Sheets와는 별개)
      </p>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>공통지원금 현황</span>
          <div className={styles.filterRow}>
            <select className={styles.filterSelect} value={filterBrand} onChange={(e) => setFilterBrand(e.target.value)}>
              <option value="ALL">전체 브랜드</option>
              <option value="삼성">삼성</option>
              <option value="Apple">Apple</option>
            </select>
            <select className={styles.filterSelect} value={filterCarrier} onChange={(e) => setFilterCarrier(e.target.value)}>
              <option value="ALL">전체 통신사</option>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>브랜드</th>
              <th>모델명</th>
              <th>용량</th>
              {displayCarriers.map((c) => <th key={c}>{c} 공통지원금</th>)}
            </tr>
          </thead>
          <tbody>
            {filtered.flatMap((phone) =>
              phone.storage.map((s, i) => (
                <tr key={`${phone.id}-${s.size}`}>
                  {i === 0 && (
                    <>
                      <td rowSpan={phone.storage.length}>
                        <span className={`${styles.badge} ${phone.brand === '삼성' ? styles.samsung : styles.apple}`}>
                          {phone.brand}
                        </span>
                      </td>
                      <td rowSpan={phone.storage.length}>{phone.name}</td>
                    </>
                  )}
                  <td>{s.size}</td>
                  {displayCarriers.map((carrier) =>
                    phone.carriers.includes(carrier) ? (
                      <SubsidyCell key={carrier} phone={phone} carrier={carrier} storage={s.size} />
                    ) : (
                      <td key={carrier} style={{ color: '#334155' }}>—</td>
                    )
                  )}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ────────────────────────────────────
// Plans Tab
// ────────────────────────────────────
function PlansTab() {
  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSheetPlans = useSheetStore((s) => s.getPlansForCarrier);
  const [filterCarrier, setFilterCarrier] = useState<string>('ALL');

  const allPlans: Plan[] = [];
  for (const c of CARRIERS) {
    const sp = sheetLoaded ? getSheetPlans(c) : [];
    const source = sp.length > 0 ? sp : plans.filter((p) => p.carrier === c);
    allPlans.push(...source);
  }

  const filtered = filterCarrier === 'ALL' ? allPlans : allPlans.filter((p) => p.carrier === filterCarrier);

  return (
    <>
      <h2 className={styles.pageTitle}>📋 요금제 관리</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, marginTop: -16 }}>
        {sheetLoaded ? '✅ Google Sheets 데이터 표시 중' : '⚠️ JSON 기본 데이터 표시 중 (시트 미연결)'}
      </p>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>요금제 목록 ({filtered.length}건)</span>
          <div className={styles.filterRow}>
            <select className={styles.filterSelect} value={filterCarrier} onChange={(e) => setFilterCarrier(e.target.value)}>
              <option value="ALL">전체 통신사</option>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>통신사</th>
              <th>요금제명</th>
              <th>월요금</th>
              <th>데이터</th>
              <th>선택약정할인율</th>
              <th>혜택</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((plan) => (
              <tr key={plan.id}>
                <td>
                  <span className={`${styles.badge} ${styles[plan.carrier.toLowerCase() as 'skt' | 'kt' | 'lgu']}`}>
                    {plan.carrier}
                  </span>
                </td>
                <td>{plan.name}</td>
                <td>{plan.monthlyFee.toLocaleString()}원</td>
                <td>{plan.data}</td>
                <td>{(plan.선택약정할인율 * 100).toFixed(0)}%</td>
                <td style={{ fontSize: 12, color: '#94a3b8' }}>
                  {plan.benefits?.join(', ') || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ────────────────────────────────────
// Discounts Tab
// ────────────────────────────────────
function DiscountsTab() {
  const sheetLoaded = useSheetStore((s) => s.loaded);
  const getSheetCards = useSheetStore((s) => s.getCardDiscountsForCarrier);
  const getSheetAddons = useSheetStore((s) => s.getAddonsForCarrier);
  const [filterCarrier, setFilterCarrier] = useState<string>('ALL');
  const [filterType, setFilterType] = useState<string>('ALL');

  const allDiscounts: Discount[] = [];
  for (const c of CARRIERS) {
    const cards = sheetLoaded ? getSheetCards(c) : jsonDiscounts.filter((d) => d.type === '제휴카드' && d.carrier === c);
    const addons = sheetLoaded ? getSheetAddons(c) : jsonDiscounts.filter((d) => d.type === '부가서비스' && d.carrier === c);
    allDiscounts.push(...cards, ...addons);
  }

  const filtered = allDiscounts.filter((d) => {
    const cOk = filterCarrier === 'ALL' || d.carrier === filterCarrier;
    const tOk = filterType === 'ALL' || d.type === filterType;
    return cOk && tOk;
  });

  return (
    <>
      <h2 className={styles.pageTitle}>💳 할인 관리</h2>
      <p style={{ color: '#64748b', fontSize: 13, marginBottom: 20, marginTop: -16 }}>
        {sheetLoaded ? '✅ Google Sheets 데이터 표시 중' : '⚠️ JSON 기본 데이터 표시 중 (시트 미연결)'}
      </p>

      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>할인 목록 ({filtered.length}건)</span>
          <div className={styles.filterRow}>
            <select className={styles.filterSelect} value={filterType} onChange={(e) => setFilterType(e.target.value)}>
              <option value="ALL">전체 유형</option>
              <option value="제휴카드">제휴카드</option>
              <option value="부가서비스">부가서비스</option>
            </select>
            <select className={styles.filterSelect} value={filterCarrier} onChange={(e) => setFilterCarrier(e.target.value)}>
              <option value="ALL">전체 통신사</option>
              {CARRIERS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>통신사</th>
              <th>유형</th>
              <th>이름</th>
              <th>월 할인금</th>
              <th>월 요금</th>
              <th>추가할인</th>
              <th>조건/설명</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((d) => (
              <tr key={d.id}>
                <td>
                  <span className={`${styles.badge} ${styles[d.carrier.toLowerCase() as 'skt' | 'kt' | 'lgu']}`}>
                    {d.carrier}
                  </span>
                </td>
                <td style={{ fontSize: 12 }}>{d.type}</td>
                <td>{d.name}</td>
                <td>{d.monthlyDiscount ? `${d.monthlyDiscount.toLocaleString()}원` : '—'}</td>
                <td>{d.monthlyFee ? `${d.monthlyFee.toLocaleString()}원` : '—'}</td>
                <td>{d.추가할인 ? `${d.추가할인.toLocaleString()}원` : '—'}</td>
                <td style={{ fontSize: 12, color: '#94a3b8' }}>{d.conditions ?? d.description ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

// ────────────────────────────────────
// Sheet Debug Tab
// ────────────────────────────────────
function SheetDebugTab() {
  const sheetLoaded = useSheetStore((s) => s.loaded);
  const subsidies = useSheetStore((s) => s.subsidies);
  const [filterModelId, setFilterModelId] = useState('');

  const phoneIds = new Set(phones.map((p) => p.id));
  const sheetModelIds = [...new Set(subsidies.map((r) => r.모델ID))].sort();

  const matched = sheetModelIds.filter((id) => phoneIds.has(id));
  const unmatched = sheetModelIds.filter((id) => !phoneIds.has(id));
  const missingInSheet = phones.map((p) => p.id).filter((id) => !sheetModelIds.includes(id));

  const filtered = subsidies.filter((r) =>
    filterModelId === '' || r.모델ID === filterModelId
  );

  return (
    <>
      <h2 className={styles.pageTitle}>🔍 시트 진단</h2>
      {!sheetLoaded && (
        <p style={{ color: '#ef4444', marginBottom: 16 }}>⚠️ 시트가 연결되지 않았습니다.</p>
      )}

      {/* ID 매칭 현황 */}
      <div className={styles.tableWrap} style={{ marginBottom: 24 }}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>모델ID 매칭 현황</span>
        </div>
        <table className={styles.table}>
          <thead>
            <tr><th>상태</th><th>phones.json ID</th><th>시트 매칭</th></tr>
          </thead>
          <tbody>
            {phones.map((p) => {
              const inSheet = sheetModelIds.includes(p.id);
              return (
                <tr key={p.id}>
                  <td>
                    <span style={{ fontWeight: 700, color: inSheet ? '#16a34a' : '#ef4444' }}>
                      {inSheet ? '✅ 매칭' : '❌ 불일치'}
                    </span>
                  </td>
                  <td><code style={{ fontSize: 12 }}>{p.id}</code></td>
                  <td style={{ fontSize: 12, color: '#64748b' }}>
                    {inSheet ? `${subsidies.filter(r => r.모델ID === p.id).length}행` : '시트에 해당 ID 없음'}
                  </td>
                </tr>
              );
            })}
            {unmatched.map((id) => (
              <tr key={id}>
                <td><span style={{ fontWeight: 700, color: '#f59e0b' }}>⚠️ 시트에만 있음</span></td>
                <td><code style={{ fontSize: 12, color: '#f59e0b' }}>{id}</code></td>
                <td style={{ fontSize: 12, color: '#64748b' }}>{subsidies.filter(r => r.모델ID === id).length}행</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* 시트 원본 데이터 */}
      <div className={styles.tableWrap}>
        <div className={styles.tableHeader}>
          <span className={styles.tableTitle}>공통지원금 시트 원본 ({filtered.length}행)</span>
          <div className={styles.filterRow}>
            <select className={styles.filterSelect} value={filterModelId} onChange={(e) => setFilterModelId(e.target.value)}>
              <option value="">전체 모델</option>
              {sheetModelIds.map((id) => (
                <option key={id} value={id}>{id}</option>
              ))}
            </select>
          </div>
        </div>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>모델ID</th>
              <th>통신사</th>
              <th>용량</th>
              <th>가입유형</th>
              <th>출고가</th>
              <th>공통지원금</th>
              <th>추가지원금</th>
              <th>특별지원</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r, i) => {
              const isMatched = phoneIds.has(r.모델ID);
              return (
                <tr key={i} style={{ background: isMatched ? undefined : '#fef2f2' }}>
                  <td>
                    <code style={{ fontSize: 11, color: isMatched ? '#16a34a' : '#ef4444' }}>{r.모델ID}</code>
                  </td>
                  <td><span className={`${styles.badge} ${styles[r.통신사.toLowerCase() as 'skt' | 'kt' | 'lgu']}`}>{r.통신사}</span></td>
                  <td>{r.용량}</td>
                  <td>{r.가입유형}</td>
                  <td>{r.출고가.toLocaleString()}</td>
                  <td style={{ fontWeight: r.공통지원금 > 0 ? 700 : undefined, color: r.공통지원금 > 0 ? '#16a34a' : '#94a3b8' }}>
                    {r.공통지원금.toLocaleString()}
                  </td>
                  <td style={{ color: r.추가지원금 > 0 ? '#16a34a' : '#94a3b8' }}>{r.추가지원금.toLocaleString()}</td>
                  <td style={{ color: r.특별지원 > 0 ? '#f59e0b' : '#94a3b8' }}>{r.특별지원.toLocaleString()}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {missingInSheet.length > 0 && sheetLoaded && (
        <div style={{ marginTop: 16, padding: '12px 16px', background: '#fef2f2', borderRadius: 8, fontSize: 13 }}>
          <strong style={{ color: '#ef4444' }}>phones.json에는 있으나 시트에 없는 ID:</strong>
          {' '}{missingInSheet.map((id) => <code key={id} style={{ marginRight: 8, color: '#ef4444' }}>{id}</code>)}
        </div>
      )}
    </>
  );
}

// ────────────────────────────────────
// Settings Tab
// ────────────────────────────────────
function SettingsTab() {
  const changePassword = useAdminStore((s) => s.changePassword);
  const overrides = useAdminStore((s) => s.subsidyOverrides);

  const [oldPw, setOldPw] = useState('');
  const [newPw, setNewPw] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  const [pwMsg, setPwMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const handlePwChange = () => {
    if (newPw !== confirmPw) { setPwMsg({ ok: false, text: '새 비밀번호가 일치하지 않습니다' }); return; }
    if (newPw.length < 4) { setPwMsg({ ok: false, text: '비밀번호는 4자 이상이어야 합니다' }); return; }
    const ok = changePassword(oldPw, newPw);
    if (ok) {
      setPwMsg({ ok: true, text: '비밀번호가 변경되었습니다' });
      setOldPw(''); setNewPw(''); setConfirmPw('');
    } else {
      setPwMsg({ ok: false, text: '현재 비밀번호가 올바르지 않습니다' });
    }
  };

  const clearAllOverrides = () => {
    if (confirm(`수동으로 수정한 공통지원금 ${overrides.length}건을 모두 초기화할까요?`)) {
      localStorage.removeItem('admin_subsidy_overrides');
      window.location.reload();
    }
  };

  return (
    <>
      <h2 className={styles.pageTitle}>⚙️ 설정</h2>

      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>🔑 비밀번호 변경</h3>
        <div className={styles.settingsField}>
          <label className={styles.settingsLabel}>현재 비밀번호</label>
          <input type="password" className={styles.settingsInput} value={oldPw} onChange={(e) => setOldPw(e.target.value)} placeholder="현재 비밀번호" />
        </div>
        <div className={styles.settingsField}>
          <label className={styles.settingsLabel}>새 비밀번호</label>
          <input type="password" className={styles.settingsInput} value={newPw} onChange={(e) => setNewPw(e.target.value)} placeholder="새 비밀번호 (4자 이상)" />
        </div>
        <div className={styles.settingsField}>
          <label className={styles.settingsLabel}>새 비밀번호 확인</label>
          <input type="password" className={styles.settingsInput} value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} placeholder="새 비밀번호 재입력" />
        </div>
        <button className={styles.settingsBtn} onClick={handlePwChange}>비밀번호 변경</button>
        {pwMsg && (
          <p className={pwMsg.ok ? styles.settingsSuccess : styles.settingsError}>{pwMsg.text}</p>
        )}
      </div>

      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>📊 Google Sheets 안내</h3>
        <p style={{ color: '#94a3b8', fontSize: 13, lineHeight: 1.7, margin: 0 }}>
          시트 연동은 프로젝트의 <code style={{ background: '#0f172a', padding: '1px 6px', borderRadius: 4 }}>.env</code> 파일에서 설정합니다.<br />
          <code style={{ background: '#0f172a', padding: '1px 6px', borderRadius: 4 }}>VITE_GOOGLE_SHEET_ID=YOUR_SHEET_ID</code><br /><br />
          시트에서 데이터를 불러오면 요금제·지원금·할인 항목이 자동으로 업데이트됩니다.
        </p>
      </div>

      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>✏️ 수동 지원금 수정 초기화</h3>
        <p style={{ color: '#94a3b8', fontSize: 13, marginBottom: 16 }}>
          현재 {overrides.length}건의 수동 수정이 저장되어 있습니다.
        </p>
        <button
          className={styles.settingsBtn}
          style={{ background: overrides.length === 0 ? '#334155' : '#ef4444', cursor: overrides.length === 0 ? 'not-allowed' : 'pointer' }}
          onClick={clearAllOverrides}
          disabled={overrides.length === 0}
        >
          전체 초기화
        </button>
      </div>

      <div className={styles.settingsCard}>
        <h3 className={styles.settingsTitle}>ℹ️ 시스템 정보</h3>
        <table className={styles.table} style={{ marginTop: 0 }}>
          <tbody>
            <tr><td style={{ color: '#64748b', width: 160 }}>기본 비밀번호</td><td>admin1234</td></tr>
            <tr><td style={{ color: '#64748b' }}>관리자 URL</td><td>#/admin</td></tr>
            <tr><td style={{ color: '#64748b' }}>데이터 저장</td><td>브라우저 localStorage</td></tr>
          </tbody>
        </table>
      </div>
    </>
  );
}

// ────────────────────────────────────
// Main Admin Page
// ────────────────────────────────────
const NAV_ITEMS: { tab: AdminTab; icon: string; label: string }[] = [
  { tab: 'dashboard', icon: '📊', label: '대시보드' },
  { tab: 'phones', icon: '📱', label: '기기 관리' },
  { tab: 'plans', icon: '📋', label: '요금제' },
  { tab: 'discounts', icon: '💳', label: '할인 관리' },
  { tab: 'sheet-debug', icon: '🔍', label: '시트 진단' },
  { tab: 'settings', icon: '⚙️', label: '설정' },
];

export function AdminPage() {
  const isLoggedIn = useAdminStore((s) => s.isLoggedIn);
  const activeTab = useAdminStore((s) => s.activeTab);
  const setTab = useAdminStore((s) => s.setTab);
  const logout = useAdminStore((s) => s.logout);

  if (!isLoggedIn) return <AdminLogin />;

  return (
    <div className={styles.adminPage}>
      <div className={styles.shell}>
        {/* Sidebar */}
        <aside className={styles.sidebar}>
          <div className={styles.sidebarBrand}>
            <p className={styles.sidebarBrandTitle}>📱 관리자</p>
            <p className={styles.sidebarBrandSub}>휴대폰 견적 시스템</p>
          </div>

          {NAV_ITEMS.map((item) => (
            <button
              key={item.tab}
              className={`${styles.navItem} ${activeTab === item.tab ? styles.active : ''}`}
              onClick={() => setTab(item.tab)}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              {item.label}
            </button>
          ))}

          <div className={styles.sidebarLogout}>
            <button className={styles.logoutBtn} onClick={logout}>로그아웃</button>
          </div>
        </aside>

        {/* Main */}
        <main className={styles.main}>
          {activeTab === 'dashboard' && <Dashboard />}
          {activeTab === 'phones' && <PhonesTab />}
          {activeTab === 'plans' && <PlansTab />}
          {activeTab === 'discounts' && <DiscountsTab />}
          {activeTab === 'sheet-debug' && <SheetDebugTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </main>
      </div>
    </div>
  );
}
