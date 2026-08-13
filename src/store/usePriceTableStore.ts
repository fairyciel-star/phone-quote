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

interface PriceTableState {
  sktRows: PriceTableRow[];
  ktRows: PriceTableRow[];
  lguRows: PriceTableRow[];
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
          set({
            sktRows: skt.status === 'fulfilled' ? skt.value.rows : prev.sktRows,
            ktRows: kt.status === 'fulfilled' ? kt.value.rows : prev.ktRows,
            lguRows: lgu.status === 'fulfilled' ? lgu.value.rows : prev.lguRows,
            benefits: {
              SKT: skt.status === 'fulfilled' ? skt.value.benefits : prev.benefits.SKT,
              KT: kt.status === 'fulfilled' ? kt.value.benefits : prev.benefits.KT,
              LGU: lgu.status === 'fulfilled' ? lgu.value.benefits : prev.benefits.LGU,
            },
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
            // 단가표 합계에는 마진이 더해져 있어 추가지원금이 음수가 될 수 있다.
            // 0으로 자르면 합계보다 싼 가격이 표시되므로 음수를 그대로 둔다.
            const 추가지원금 = row.retail_price - 공통지원금 - finalPrice;
            // 리베이트가 0이면 합계와 상관없이 판매 불가 조건이므로 가격문의로 안내한다
            const rebate = getRowRebate(row, '공통지원금', subscriptionType);
            return {
              출고가: row.retail_price,
              공통지원금,
              추가지원금,
              특별지원: 0,
              가격문의: row.price_inquiry || finalPrice <= 0 || rebate <= 0,
              isPriceTableData: true as const,
            };
          }
        }

        return { 출고가: 0, 공통지원금: 0, 추가지원금: 0, 특별지원: 0, 가격문의: false, isPriceTableData: false as const };
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
            // 리베이트가 0이면 합계와 상관없이 판매 불가 조건이므로 가격문의로 안내한다
            const rebate = getRowRebate(row, '선택약정', subscriptionType);
            return {
              출고가: row.retail_price,
              추가지원금: Math.max(0, row.retail_price - finalPrice),
              특별지원: 0,
              가격문의: row.price_inquiry || finalPrice <= 0 || rebate <= 0,
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
        lastLoaded: state.lastLoaded,
      }),
    },
  ),
);
