import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { CarrierId, SubscriptionType } from '../types';
import { fetchPriceTable, type PriceTableRow, type PriceTierKr } from '../utils/sheets';
import { modelNameToPhoneId } from '../utils/modelMatch';

export type { PriceTableRow, PriceTierKr };

// model_name에서 용량 추출 (예: "갤럭시 S26 512G" → "512GB")
function extractStorage(modelName: string): string {
  const mGb = modelName.match(/\s+(\d+)GB$/i);
  if (mGb) return `${mGb[1]}GB`;
  const mG = modelName.match(/\s+(\d+)G$/i);
  if (mG) return `${mG[1]}GB`;
  const mTb = modelName.match(/\s+(\d+)TB$/i);
  if (mTb) return `${mTb[1]}TB`;
  const mT = modelName.match(/\s+(\d+)T$/i);
  if (mT) return `${mT[1]}TB`;
  return '256GB';
}

// model_name에서 용량 suffix 제거
function stripStorage(name: string): string {
  return name
    .replace(/\s+\d+GB$/i, '')
    .replace(/\s+\d+G$/i, '')
    .replace(/\s+\d+TB$/i, '')
    .replace(/\s+\d+T$/i, '')
    .trim();
}

// 용량 문자열 정규화 (예: "256G" → "256GB")
function normalizeStorage(s: string): string {
  return s.replace(/^(\d+)G$/i, '$1GB').replace(/^(\d+)T$/i, '$1TB');
}

interface PriceTableState {
  sktRows: PriceTableRow[];
  ktRows: PriceTableRow[];
  lguRows: PriceTableRow[];
  readonly loading: boolean;
  readonly error: string | null;
  readonly lastLoaded: string | null;

  loadCarrier: (sheetId: string, carrier: CarrierId) => Promise<void>;
  loadAll: (sheetId: string) => Promise<void>;
  getRows: (carrier: CarrierId) => PriceTableRow[];
  updateRow: (carrier: CarrierId, idx: number, field: keyof PriceTableRow, value: number | string) => void;
  clear: (carrier?: CarrierId) => void;
  /** phone.id + 통신사 + 용량 + 가입유형으로 합계 가격 조회 */
  getSubsidyData: (
    phoneId: string,
    carrier: CarrierId,
    storage: string,
    subscriptionType: SubscriptionType,
  ) => { 출고가: number; 공통지원금: number; 추가지원금: number; 특별지원: number };
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
      loading: false,
      error: null,
      lastLoaded: null,

      loadCarrier: async (sheetId, carrier) => {
        set({ loading: true, error: null });
        try {
          const rows = await fetchPriceTable(sheetId, carrier);
          set({
            [carrierKey(carrier)]: rows,
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
          set({
            sktRows: skt.status === 'fulfilled' ? skt.value : get().sktRows,
            ktRows: kt.status === 'fulfilled' ? kt.value : get().ktRows,
            lguRows: lgu.status === 'fulfilled' ? lgu.value : get().lguRows,
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

      updateRow: (carrier, idx, field, value) => {
        const key = carrierKey(carrier);
        const current = get()[key];
        const updated = current.map((r, i) =>
          i === idx ? { ...r, [field]: value } : r,
        );
        set({ [key]: updated });
      },

      clear: (carrier) => {
        if (carrier) {
          set({ [carrierKey(carrier)]: [] });
        } else {
          set({ sktRows: [], ktRows: [], lguRows: [] });
        }
      },

      getSubsidyData: (phoneId, carrier, storage, subscriptionType) => {
        const rows = get().getRows(carrier);
        const normStorage = normalizeStorage(storage);

        for (const row of rows) {
          const rowBase = stripStorage(row.model_name);
          const rowStorage = extractStorage(row.model_name);
          const rowPhoneId = modelNameToPhoneId(rowBase) ?? modelNameToPhoneId(row.model_name);

          if (rowPhoneId === phoneId && rowStorage === normStorage) {
            const finalPrice = subscriptionType === '번호이동' ? row.mnp_price : row.change_price;
            const 공통지원금 = subscriptionType === '번호이동' ? row.mnp_subsidy : row.change_subsidy;
            // 추가지원금 = 합계와의 차액 (공통지원금 외 나머지 지원금, 할부원금 계산용)
            const 추가지원금 = Math.max(0, row.retail_price - 공통지원금 - finalPrice);
            return {
              출고가: row.retail_price,
              공통지원금,
              추가지원금,
              특별지원: 0,
              isPriceTableData: true as const,
            };
          }
        }

        return { 출고가: 0, 공통지원금: 0, 추가지원금: 0, 특별지원: 0, isPriceTableData: false as const };
      },
    }),
    {
      name: 'price-table-store-v3',
      partialize: (state) => ({
        sktRows: state.sktRows,
        ktRows: state.ktRows,
        lguRows: state.lguRows,
        lastLoaded: state.lastLoaded,
      }),
    },
  ),
);
