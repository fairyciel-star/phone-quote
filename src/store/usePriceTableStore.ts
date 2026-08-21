import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CarrierId, SubscriptionType } from '../types';
import {
  fetchPriceTable,
  getRowRebate,
  EMPTY_BENEFITS,
  type CarrierBenefits,
  type PriceTableRow,
  type PriceTierKr,
} from '../utils/sheets';
import { modelNameToPhoneId } from '../utils/modelMatch';

export type { PriceTableRow, PriceTierKr };

// model_name에서 용량 추출 (예: "갤럭시 S26 512G" → "512GB", "갤럭시 S25엣지_256G" → "256GB")
function extractStorage(modelName: string): string {
  const mGb = modelName.match(/[\s_](\d+)GB$/i);
  if (mGb) return `${mGb[1]}GB`;
  const mG = modelName.match(/[\s_](\d+)G$/i);
  if (mG) return `${mG[1]}GB`;
  const mTb = modelName.match(/[\s_](\d+)TB$/i);
  if (mTb) return `${mTb[1]}TB`;
  const mT = modelName.match(/[\s_](\d+)T$/i);
  if (mT) return `${mT[1]}TB`;
  return '256GB';
}

// model_name에서 용량 suffix 제거 (공백 또는 언더스코어 구분자 모두 처리)
function stripStorage(name: string): string {
  return name
    .replace(/[\s_]+\d+GB$/i, '')
    .replace(/[\s_]+\d+G$/i, '')
    .replace(/[\s_]+\d+TB$/i, '')
    .replace(/[\s_]+\d+T$/i, '')
    .trim();
}

// 용량 문자열 정규화 (예: "256G" → "256GB")
function normalizeStorage(s: string): string {
  return s.replace(/^(\d+)G$/i, '$1GB').replace(/^(\d+)T$/i, '$1TB');
}

// phoneId + 용량으로 단가표 행을 찾는다 (공통지원금·상승 비교 공용)
function findRow(rows: PriceTableRow[], phoneId: string, normStorage: string): PriceTableRow | null {
  for (const row of rows) {
    const rowBase = stripStorage(row.model_name);
    const rowStorage = extractStorage(row.model_name);
    const rowPhoneId = modelNameToPhoneId(rowBase) ?? modelNameToPhoneId(row.model_name);
    if (rowPhoneId === phoneId && rowStorage === normStorage) return row;
  }
  return null;
}

// ── 지원금 상승(UP) 추적 ──
//
// 무엇을 비교하나: 기기 할인액 = 출고가 - 합계.
// 공통지원금 경로에서는 공통지원금 + 추가지원금과 같고, 선택약정 경로에서는 그 경로의 할인액이다.
// 두 경로 중 "유리한 쪽"(= 화면에 실제로 표시되는 최저가)을 기준으로 잡는다.
//
// 공통지원금만 보면 안 된다. 그 값은 통신사가 정하는 공시지원금이라 모델 수십 개에
// 고유값이 서너 개뿐이고 거의 움직이지 않는다. 실제로 매일 조정되는 건 리베이트이고,
// 리베이트를 올리면 시트의 합계가 내려가면서 추가지원금이 그만큼 올라간다.
// (예: 리베이트 40→43 → 합계 434,000→404,000 → 추가지원금 320,000→350,000, 공통지원금은 그대로)
// 할인액을 보면 리베이트·합계 수정과 공시지원금 변경을 모두 잡아낸다.
//
// 유리한 쪽만 보는 이유: 두 경로를 따로 추적해 "하나라도 오르면 UP"으로 하면,
// 표시 가격은 공통지원금 기준인데 선택약정만 좋아진 경우 가격은 그대로면서 UP만 붙는다.
// 최저가를 만드는 경로의 할인액이 올랐을 때만 붙여야 표시 가격과 뱃지가 일치한다.
//
// 언제 비교하나: 날짜와 무관하게 "직전에 본 값보다 오르면" UP이다.
// 시트를 하루 중 언제 고치든 다음 로드에서 바로 잡힌다.
//
// 상승 시각을 남기는 이유: 값 비교만 하면 상승을 감지한 그 로드에서만 뱃지가 보이고
// 새로고침하는 순간 사라진다. 상승 후 UP_BADGE_DURATION_MS 동안 유지해 실제로 노출되게 한다.
const UP_BADGE_DURATION_MS = 24 * 60 * 60 * 1000;

const TRACKED_SUB_TYPES = ['번호이동', '기기변경'] as const;

interface SubsidyMark {
  /** 마지막으로 확인한 기기 할인액 = 출고가 - 합계 (공통지원금·선택약정 중 유리한 쪽, 원) */
  readonly discount: number;
  /** 마지막으로 상승한 시각(ms). 상승 이력이 없거나 하락했으면 null */
  readonly upSince: number | null;
}

type SubsidyTracker = Record<string, SubsidyMark>;

function subsidyKey(carrier: CarrierId, modelCode: string, subType: SubscriptionType): string {
  return `${carrier}|${modelCode}|${subType}`;
}

/**
 * 판매 가능한 경로(공통지원금·선택약정) 중 가장 큰 기기 할인액.
 * 리베이트가 0인 경로는 판매할 수 없으므로 후보에서 뺀다. 살 수 있는 경로가 없으면 null.
 */
function bestDiscountOf(row: PriceTableRow, subType: SubscriptionType): number | null {
  if (row.retail_price <= 0 || row.price_inquiry) return null;
  const isMnp = subType === '번호이동';

  const prices: number[] = [];
  if (getRowRebate(row, '공통지원금', subType) > 0) {
    prices.push(isMnp ? row.mnp_price : row.change_price);
  }
  if (getRowRebate(row, '선택약정', subType) > 0) {
    prices.push(isMnp ? row.agreement_mnp_price : row.agreement_change_price);
  }
  if (prices.length === 0) return null;

  return row.retail_price - Math.min(...prices);
}

/**
 * 새로 불러온 행들을 직전 값과 비교해 상승 시점을 갱신한다.
 * 하락은 표시 대상이 아니므로 상승 기록을 지운다. 값이 그대로면 기존 기록을 유지한다.
 */
function trackSubsidyChanges(
  prev: SubsidyTracker,
  rows: readonly PriceTableRow[],
  now: number,
): SubsidyTracker {
  const next: SubsidyTracker = { ...prev };
  for (const row of rows) {
    if (!row.model_code) continue;
    for (const subType of TRACKED_SUB_TYPES) {
      const key = subsidyKey(row.carrier, row.model_code, subType);
      const discount = bestDiscountOf(row, subType);

      // 판매 불가 — 기준을 지운다. 다시 팔리기 시작할 때 그 값이 상승으로 잡히면 안 되므로
      // 첫 등장과 똑같이 기준만 새로 잡게 둔다.
      if (discount === null) {
        delete next[key];
        continue;
      }

      const before = prev[key];
      // 처음 보는 모델 — 비교 기준만 잡고 UP은 붙이지 않는다
      if (!before) {
        next[key] = { discount, upSince: null };
      } else if (discount === before.discount) {
        next[key] = before;
      } else {
        next[key] = { discount, upSince: discount > before.discount ? now : null };
      }
    }
  }
  return next;
}

interface PriceTableState {
  sktRows: PriceTableRow[];
  ktRows: PriceTableRow[];
  lguRows: PriceTableRow[];
  /** 기기 할인액 직전 값 + 상승 시각 (모델·가입유형별) */
  subsidyTracker: SubsidyTracker;
  /** 통신사별 부가서비스·제휴카드 혜택 조건 (단가표 탭 S~U열) */
  benefits: Record<CarrierId, CarrierBenefits>;
  readonly loading: boolean;
  readonly error: string | null;
  readonly lastLoaded: string | null;

  loadCarrier: (sheetId: string, carrier: CarrierId) => Promise<void>;
  loadAll: (sheetId: string) => Promise<void>;
  getBenefits: (carrier: CarrierId) => CarrierBenefits;
  getRows: (carrier: CarrierId) => PriceTableRow[];
  updateRow: (carrier: CarrierId, idx: number, field: keyof PriceTableRow, value: number | string) => void;
  clear: (carrier?: CarrierId) => void;
  /** phone.id + 통신사로 단가표에 존재하는지 여부 */
  hasModel: (phoneId: string, carrier: CarrierId) => boolean;
  /** phone.id + 통신사 + 용량 + 가입유형으로 공통지원금 합계 가격 조회 */
  getSubsidyData: (
    phoneId: string,
    carrier: CarrierId,
    storage: string,
    subscriptionType: SubscriptionType,
  ) => { 출고가: number; 공통지원금: number; 추가지원금: number; 특별지원: number; 가격문의: boolean };
  /** phone.id + 통신사 + 용량 + 가입유형으로 기기 할인액이 직전 값 대비 상승했는지 여부 */
  isSubsidyUp: (
    phoneId: string,
    carrier: CarrierId,
    storage: string,
    subscriptionType: SubscriptionType,
  ) => boolean;
  /** phone.id + 통신사 + 용량 + 가입유형으로 선택약정 합계 가격 조회 */
  getAgreementData: (
    phoneId: string,
    carrier: CarrierId,
    storage: string,
    subscriptionType: SubscriptionType,
  ) => { 출고가: number; 추가지원금: number; 특별지원: number; 가격문의: boolean; isPriceTableData: boolean };
}

function carrierKey(carrier: CarrierId): 'sktRows' | 'ktRows' | 'lguRows' {
  switch (carrier) {
    case 'SKT': return 'sktRows';
    case 'KT': return 'ktRows';
    case 'LGU': return 'lguRows';
  }
}

export const usePriceTableStore = create<PriceTableState>()(
  persist(
    (set, get) => ({
      sktRows: [],
      ktRows: [],
      lguRows: [],
      subsidyTracker: {},
      benefits: { SKT: EMPTY_BENEFITS, KT: EMPTY_BENEFITS, LGU: EMPTY_BENEFITS },
      loading: false,
      error: null,
      lastLoaded: null,

      loadCarrier: async (sheetId, carrier) => {
        set({ loading: true, error: null });
        try {
          const { rows, benefits } = await fetchPriceTable(sheetId, carrier);
          set({
            [carrierKey(carrier)]: rows,
            benefits: { ...get().benefits, [carrier]: benefits },
            subsidyTracker: trackSubsidyChanges(get().subsidyTracker, rows, Date.now()),
            loading: false,
            lastLoaded: new Date().toISOString(),
          });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : '불러오기 실패',
            loading: false,
          });
        }
      },

      loadAll: async (sheetId) => {
        set({ loading: true, error: null });
        try {
          const [skt, kt, lgu] = await Promise.allSettled([
            fetchPriceTable(sheetId, 'SKT'),
            fetchPriceTable(sheetId, 'KT'),
            fetchPriceTable(sheetId, 'LGU'),
          ]);
          const prev = get();
          // 불러오기에 성공한 통신사만 직전 값과 비교해 상승 여부를 갱신한다
          const now = Date.now();
          let tracker = prev.subsidyTracker;
          for (const result of [skt, kt, lgu]) {
            if (result.status === 'fulfilled') {
              tracker = trackSubsidyChanges(tracker, result.value.rows, now);
            }
          }
          set({
            sktRows: skt.status === 'fulfilled' ? skt.value.rows : prev.sktRows,
            ktRows: kt.status === 'fulfilled' ? kt.value.rows : prev.ktRows,
            lguRows: lgu.status === 'fulfilled' ? lgu.value.rows : prev.lguRows,
            benefits: {
              SKT: skt.status === 'fulfilled' ? skt.value.benefits : prev.benefits.SKT,
              KT: kt.status === 'fulfilled' ? kt.value.benefits : prev.benefits.KT,
              LGU: lgu.status === 'fulfilled' ? lgu.value.benefits : prev.benefits.LGU,
            },
            subsidyTracker: tracker,
            loading: false,
            lastLoaded: new Date().toISOString(),
          });
          const errors: string[] = [];
          if (skt.status === 'rejected') errors.push(`SKT: ${skt.reason}`);
          if (kt.status === 'rejected') errors.push(`KT: ${kt.reason}`);
          if (lgu.status === 'rejected') errors.push(`LGU: ${lgu.reason}`);
          if (errors.length > 0) set({ error: errors.join(' / ') });
        } catch (err) {
          set({
            error: err instanceof Error ? err.message : '불러오기 실패',
            loading: false,
          });
        }
      },

      getRows: (carrier) => get()[carrierKey(carrier)],

      getBenefits: (carrier) => get().benefits?.[carrier] ?? EMPTY_BENEFITS,

      hasModel: (phoneId, carrier) => {
        const rows = get().getRows(carrier);
        return rows.some((row) => {
          const rowBase = stripStorage(row.model_name);
          const rowPhoneId = modelNameToPhoneId(rowBase) ?? modelNameToPhoneId(row.model_name);
          return rowPhoneId === phoneId;
        });
      },

      updateRow: (carrier, idx, field, value) => {
        const key = carrierKey(carrier);
        const current = get()[key];
        const updated = current.map((r, i) =>
          i === idx ? { ...r, [field]: value } : r,
        );
        set({ [key]: updated });
      },

      // 행만 비운다. 상승 추적(subsidyTracker)은 비교 기준이므로 유지한다.
      clear: (carrier) => {
        if (carrier) {
          set({ [carrierKey(carrier)]: [] });
        } else {
          set({ sktRows: [], ktRows: [], lguRows: [] });
        }
      },

      getSubsidyData: (phoneId, carrier, storage, subscriptionType) => {
        const normStorage = normalizeStorage(storage);
        const row = findRow(get().getRows(carrier), phoneId, normStorage);

        if (row) {
          const finalPrice = subscriptionType === '번호이동' ? row.mnp_price : row.change_price;
          const 공통지원금 = subscriptionType === '번호이동' ? row.mnp_subsidy : row.change_subsidy;
          // 단가표 합계에는 마진이 더해져 있어 추가지원금이 음수가 될 수 있다.
          // 0으로 자르면 합계보다 싼 가격이 표시되므로 음수를 그대로 둔다.
          const 추가지원금 = row.retail_price - 공통지원금 - finalPrice;
          // 판매 가능 여부는 리베이트로만 판단한다.
          // 합계가 0원인 것은 "0원 판매"라는 뜻이지 판매 불가가 아니다.
          const rebate = getRowRebate(row, '공통지원금', subscriptionType);
          return {
            출고가: row.retail_price,
            공통지원금,
            추가지원금,
            특별지원: 0,
            가격문의: row.price_inquiry || rebate <= 0,
            isPriceTableData: true as const,
          };
        }

        return { 출고가: 0, 공통지원금: 0, 추가지원금: 0, 특별지원: 0, 가격문의: false, isPriceTableData: false as const };
      },

      isSubsidyUp: (phoneId, carrier, storage, subscriptionType) => {
        const state = get();
        const row = findRow(state.getRows(carrier), phoneId, normalizeStorage(storage));
        if (!row?.model_code) return false;

        const mark = state.subsidyTracker[subsidyKey(carrier, row.model_code, subscriptionType)];
        if (!mark?.upSince) return false;
        return Date.now() - mark.upSince < UP_BADGE_DURATION_MS;
      },

      getAgreementData: (phoneId, carrier, storage, subscriptionType) => {
        const rows = get().getRows(carrier);
        const normStorage = normalizeStorage(storage);

        for (const row of rows) {
          const rowBase = stripStorage(row.model_name);
          const rowStorage = extractStorage(row.model_name);
          const rowPhoneId = modelNameToPhoneId(rowBase) ?? modelNameToPhoneId(row.model_name);

          if (rowPhoneId === phoneId && rowStorage === normStorage) {
            // 선택약정 합계 = 기기 실구매가. 추가지원금 = 출고가 - 합계 (공통지원금은 0)
            const finalPrice = subscriptionType === '번호이동'
              ? row.agreement_mnp_price
              : row.agreement_change_price;
            // 판매 가능 여부는 리베이트로만 판단한다.
            // 합계가 0원인 것은 "0원 판매"라는 뜻이지 판매 불가가 아니다.
            const rebate = getRowRebate(row, '선택약정', subscriptionType);
            return {
              출고가: row.retail_price,
              추가지원금: Math.max(0, row.retail_price - finalPrice),
              특별지원: 0,
              가격문의: row.price_inquiry || rebate <= 0,
              isPriceTableData: row.retail_price > 0,
            };
          }
        }

        return { 출고가: 0, 추가지원금: 0, 특별지원: 0, 가격문의: false, isPriceTableData: false };
      },
    }),
    {
      name: 'price-table-store-v3',
      partialize: (state) => ({
        sktRows: state.sktRows,
        ktRows: state.ktRows,
        lguRows: state.lguRows,
        subsidyTracker: state.subsidyTracker,
        lastLoaded: state.lastLoaded,
      }),
    },
  ),
);
