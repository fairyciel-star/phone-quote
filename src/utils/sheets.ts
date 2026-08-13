import type { CarrierId, PlanTier, SubscriptionType } from '../types';

// Google Sheets CSV 파싱 유틸리티
// "웹에 게시" URL에서 gid 기반으로 CSV를 가져옵니다.

function extractPubKey(input: string): string {
  const match = input.match(/\/d\/e\/([\w-]+)/);
  if (match) return match[1];
  return input;
}

function buildCsvUrl(pubKey: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/e/${pubKey}/pub?gid=${gid}&single=true&output=csv`;
}

// ★ 구글 시트에서 탭을 선택하면 URL에 #gid=숫자 가 나옵니다. 그 숫자를 여기에 넣으세요.
const SHEET_GIDS = {
  휴대폰_마스터: '579545641',
  색상_용량: '1181856077',
  공시지원금: '0',
  선택약정_지원금: '2083531528',
  제휴카드할인: '465133020',
  요금제: '882540890',
  부가서비스: '528526412',
  중고폰시세: '1666746914',
  키즈전용: '1925986786',
  단가표SKT: '265871784',
  단가표KT: '831307265',
  단가표LGU: '1018822358',
} as const;

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current.trim());
  return result;
}

const HEADER_ALIASES: Record<string, string> = {
  '고': '모델ID',
};

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => {
    const cleaned = h.replace(/^"|"$/g, '');
    return HEADER_ALIASES[cleaned] ?? cleaned;
  });
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line);
    const row: Record<string, string> = {};
    headers.forEach((header, i) => {
      row[header] = (values[i] ?? '').replace(/^"|"$/g, '');
    });
    return row;
  });
}

async function fetchCsv(pubKey: string, gid: string): Promise<Record<string, string>[]> {
  const url = buildCsvUrl(pubKey, gid);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`시트 불러오기 실패: ${res.status}`);
  const text = await res.text();
  return parseCsv(text);
}

// ── 휴대폰 마스터 (제조사, 모델명, 배지, 키즈전용 여부 등) ──

export interface PhoneMasterRow {
  readonly 모델ID: string;
  readonly 제조사: string;
  readonly 모델명: string;
  readonly 배지: string;        // 쉼표 구분 복수 배지 (예: "NEW,HOTDEAL")
  readonly 키즈전용: boolean;
  readonly 이미지URL: string;
  readonly 출시일: string;
}

export async function fetchPhoneMasters(sheetIdOrUrl: string): Promise<PhoneMasterRow[]> {
  if (!SHEET_GIDS.휴대폰_마스터) return [];
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.휴대폰_마스터);
  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    제조사: row['제조사'] ?? '',
    모델명: row['모델명'] ?? '',
    배지: row['배지'] ?? '',
    키즈전용: (() => { const v = (row['키즈전용'] ?? '').trim().toUpperCase(); return v === 'Y' || v === '키즈' || v === 'KIDS'; })(),
    이미지URL: row['이미지URL'] ?? '',
    출시일: row['출시일'] ?? '',
  }));
}

// ── 색상·용량 (출고가 포함) ──

export interface ColorStorageRow {
  readonly 모델ID: string;
  readonly 용량: string;
  readonly 출고가: number;
  readonly 색상명: string;
  readonly 색상HEX: string;
  readonly 색상이미지URL: string;
}

export async function fetchColorStorages(sheetIdOrUrl: string): Promise<ColorStorageRow[]> {
  if (!SHEET_GIDS.색상_용량) return [];
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.색상_용량);
  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    용량: row['용량'] ?? '',
    출고가: Number(row['출고가']) || 0,
    색상명: row['색상명'] ?? '',
    색상HEX: row['색상HEX'] ?? '',
    색상이미지URL: row['색상이미지URL'] ?? '',
  }));
}

// ── 공시지원금 (요금제 구간별) ──
//
// 시트 컬럼:
//   모델ID | 통신사 | 용량 | 가입유형
//   | 고가_공시지원금 | 고가_추가지원금 | 고가_특별지원금
//   | 중가_공시지원금 | 중가_추가지원금 | 중가_특별지원금
//   | 저가_공시지원금 | 저가_추가지원금 | 저가_특별지원금

export interface SubsidyRow {
  readonly 모델ID: string;
  readonly 통신사: CarrierId;
  readonly 용량: string;
  readonly 가입유형: SubscriptionType;
  readonly 고가_공시지원금: number;
  readonly 고가_추가지원금: number;
  readonly 고가_특별지원금: number;
  readonly 중가_공시지원금: number;
  readonly 중가_추가지원금: number;
  readonly 중가_특별지원금: number;
  readonly 저가_공시지원금: number;
  readonly 저가_추가지원금: number;
  readonly 저가_특별지원금: number;
}

export function getSubsidyByTier(
  row: SubsidyRow | undefined,
  tier: PlanTier
): { 공시지원금: number; 추가지원금: number; 특별지원금: number } {
  if (!row) return { 공시지원금: 0, 추가지원금: 0, 특별지원금: 0 };
  switch (tier) {
    case '고가': return { 공시지원금: row.고가_공시지원금, 추가지원금: row.고가_추가지원금, 특별지원금: row.고가_특별지원금 };
    case '중가': return { 공시지원금: row.중가_공시지원금, 추가지원금: row.중가_추가지원금, 특별지원금: row.중가_특별지원금 };
    case '저가': return { 공시지원금: row.저가_공시지원금, 추가지원금: row.저가_추가지원금, 특별지원금: row.저가_특별지원금 };
  }
}

export async function fetchSubsidies(sheetIdOrUrl: string): Promise<SubsidyRow[]> {
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.공시지원금);

  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    용량: row['용량'] ?? '',
    가입유형: (row['가입유형'] ?? '번호이동') as SubscriptionType,
    고가_공시지원금: Number(row['고가_공시지원금'] ?? row['고가_공통지원금']) || 0,
    고가_추가지원금: Number(row['고가_추가지원금']) || 0,
    고가_특별지원금: Number(row['고가_특별지원금'] ?? row['고가_특별지원']) || 0,
    중가_공시지원금: Number(row['중가_공시지원금'] ?? row['중가_공통지원금']) || 0,
    중가_추가지원금: Number(row['중가_추가지원금']) || 0,
    중가_특별지원금: Number(row['중가_특별지원금'] ?? row['중가_특별지원']) || 0,
    저가_공시지원금: Number(row['저가_공시지원금'] ?? row['저가_공통지원금']) || 0,
    저가_추가지원금: Number(row['저가_추가지원금']) || 0,
    저가_특별지원금: Number(row['저가_특별지원금'] ?? row['저가_특별지원']) || 0,
  }));
}

// ── 선택약정 지원금 (요금제 구간별) ──
//
// 시트 컬럼:
//   모델ID | 통신사 | 용량 | 가입유형
//   | 고가_추가지원금 | 고가_특별지원금
//   | 중가_추가지원금 | 중가_특별지원금
//   | 저가_추가지원금 | 저가_특별지원금

export interface SelectAgreementSubsidyRow {
  readonly 모델ID: string;
  readonly 통신사: CarrierId;
  readonly 용량: string;
  readonly 가입유형: SubscriptionType;
  readonly 고가_추가지원금: number;
  readonly 고가_특별지원금: number;
  readonly 중가_추가지원금: number;
  readonly 중가_특별지원금: number;
  readonly 저가_추가지원금: number;
  readonly 저가_특별지원금: number;
}

export function getSelectAgreementByTier(
  row: SelectAgreementSubsidyRow | undefined,
  tier: PlanTier
): { 추가지원금: number; 특별지원금: number } {
  if (!row) return { 추가지원금: 0, 특별지원금: 0 };
  switch (tier) {
    case '고가': return { 추가지원금: row.고가_추가지원금, 특별지원금: row.고가_특별지원금 };
    case '중가': return { 추가지원금: row.중가_추가지원금, 특별지원금: row.중가_특별지원금 };
    case '저가': return { 추가지원금: row.저가_추가지원금, 특별지원금: row.저가_특별지원금 };
  }
}

export async function fetchSelectAgreementSubsidies(
  sheetIdOrUrl: string
): Promise<SelectAgreementSubsidyRow[]> {
  if (!SHEET_GIDS.선택약정_지원금) return [];
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.선택약정_지원금);

  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    용량: row['용량'] ?? '',
    가입유형: (row['가입유형'] ?? '번호이동') as SubscriptionType,
    고가_추가지원금: Number(row['고가_추가지원금']) || 0,
    고가_특별지원금: Number(row['고가_특별지원금'] ?? row['고가_특별지원']) || 0,
    중가_추가지원금: Number(row['중가_추가지원금']) || 0,
    중가_특별지원금: Number(row['중가_특별지원금'] ?? row['중가_특별지원']) || 0,
    저가_추가지원금: Number(row['저가_추가지원금']) || 0,
    저가_특별지원금: Number(row['저가_특별지원금'] ?? row['저가_특별지원']) || 0,
  }));
}

// ── 제휴카드 할인 ──

export interface CardDiscountRow {
  readonly id: string;
  readonly 통신사: CarrierId;
  readonly 카드명: string;
  readonly 월할인금액: number;
  readonly 조건: string;
}

export async function fetchCardDiscounts(sheetIdOrUrl: string): Promise<CardDiscountRow[]> {
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.제휴카드할인);

  return rows.map((row) => ({
    id: row['ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    카드명: row['카드명'] ?? '',
    월할인금액: Number(row['월할인금액']) || 0,
    조건: row['조건'] ?? '',
  }));
}

// ── 요금제 (구간 포함) ──
//
// 구간: '고가' | '중가' | '저가' — 공시지원금 조회의 키로 사용됨

export interface PlanRow {
  readonly id: string;
  readonly 통신사: CarrierId;
  readonly 구간: PlanTier;
  readonly 카테고리: string;    // '5G' | 'LTE' | '키즈' 등
  readonly 요금제명: string;
  readonly 월요금: number;
  readonly 데이터: string;
  readonly 통화: string;
  readonly 문자: string;
  readonly 선택약정할인율: number;
  readonly 혜택: string;
  readonly 전용요금제: string;
}

export async function fetchPlans(sheetIdOrUrl: string): Promise<PlanRow[]> {
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.요금제);

  return rows
    .filter((row) => (row['ID'] ?? '').trim() !== '')
    .map((row) => {
      const baseId = row['ID']!.trim();
      const 구간 = ((row['구간'] ?? '고가') as PlanTier) || '고가';
      return {
        id: `${baseId}-${구간}`,
        통신사: (row['통신사'] ?? '') as CarrierId,
        구간,
        카테고리: row['카테고리'] ?? '',
        요금제명: row['요금제명'] ?? '',
        월요금: Number(row['월요금']) || 0,
        데이터: row['데이터'] ?? '',
        통화: row['통화'] ?? '',
        문자: row['문자'] ?? '',
        선택약정할인율: Number(row['선택약정할인율']) || 0.25,
        혜택: row['혜택'] ?? '',
        전용요금제: row['전용요금제'] ?? '',
      };
    });
}

// ── 부가서비스 ──

export interface AddonRow {
  readonly id: string;
  readonly 통신사: CarrierId;
  readonly 서비스명: string;
  readonly 월요금: number;
  readonly 추가할인: number;
  readonly 설명: string;
}

export async function fetchAddons(sheetIdOrUrl: string): Promise<AddonRow[]> {
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.부가서비스);

  return rows.map((row) => ({
    id: row['ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    서비스명: row['서비스명'] ?? '',
    월요금: Number(row['월요금']) || 0,
    추가할인: Number(row['추가할인']) || 0,
    설명: row['설명'] ?? '',
  }));
}

// ── 중고폰 시세 ──

export interface UsedPhoneRow {
  readonly 모델ID: string;
  readonly 모델명: string;
  readonly 용량: string;
  readonly A등급: number;
  readonly B등급: number;
  readonly C등급: number;
  readonly E등급: number;
}

export async function fetchUsedPhones(sheetIdOrUrl: string): Promise<UsedPhoneRow[]> {
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.중고폰시세);

  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    모델명: row['모델명'] ?? '',
    용량: row['용량'] ?? '',
    A등급: (Number(row['A등급']) || 0) * 10000,
    B등급: (Number(row['B등급']) || 0) * 10000,
    C등급: (Number(row['C등급']) || 0) * 10000,
    E등급: (Number(row['E등급']) || 0) * 10000,
  }));
}

// ── 키즈전용 폰 (하위 호환) ──

export interface KidsPhoneRow {
  readonly 모델ID: string;
  readonly 통신사: CarrierId;
  readonly 용량: string;
  readonly 가입유형: string;
  readonly 출고가: number;
  readonly 공통지원금: number;
  readonly 추가지원금: number;
  readonly 배지: string;
  readonly 특별지원: number;
  readonly 선택약정_추가지원금: number;
  readonly 선택약정_특별지원: number;
}

export async function fetchKidsPhones(sheetIdOrUrl: string): Promise<KidsPhoneRow[]> {
  if (!SHEET_GIDS.키즈전용) return [];
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.키즈전용);
  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    용량: row['용량'] ?? '',
    가입유형: row['가입유형'] ?? '',
    출고가: Number(row['출고가']) || 0,
    공통지원금: Number(row['공통지원금']) || 0,
    추가지원금: Number(row['추가지원금']) || 0,
    배지: row['배지'] ?? '',
    특별지원: Number(row['특별지원']) || 0,
    선택약정_추가지원금: Number(row['선택약정_추가지원금']) || 0,
    선택약정_특별지원: Number(row['선택약정_특별지원']) || 0,
  }));
}

// ── 단가표 (통신사별 단가표 시트 파싱) ──
// 새 구글 시트: https://docs.google.com/spreadsheets/d/1MI7Fn521lWI74Y8IUqKncA5hV-ztd1OwzW4EyAnI9BQ
// 각 통신사 탭에서 MNP합계 / 기변합계를 직접 읽음

export type PriceTierKr = '고가' | '중가' | '저가'; // 하위 호환용

export interface PriceTableRow {
  readonly carrier: CarrierId;
  readonly model_code: string;
  readonly model_name: string;
  readonly retail_price: number;   // 출고가 (원)
  readonly change_subsidy: number; // 공통지원금(기변), 원 단위
  readonly mnp_subsidy: number;    // 공통지원금(MNP), 원 단위
  readonly mnp_price: number;              // 공통지원금 MNP 합계 실구매가 (원)
  readonly change_price: number;           // 공통지원금 기변 합계 실구매가 (원)
  readonly agreement_mnp_price: number;    // 선택약정 MNP 합계 실구매가 (원)
  readonly agreement_change_price: number; // 선택약정 기변 합계 실구매가 (원)
  readonly price_inquiry: boolean;         // R열 "가격문의" 여부
  // 리베이트 탭에서 사용하는 확장 필드 (optional)
  readonly plan_tier?: string;
  readonly subsidy_mnp?: number;
  readonly subsidy_change?: number;
  readonly subsidy_010?: number;
  readonly agreement_mnp?: number;
  readonly agreement_change?: number;
  readonly agreement_010?: number;
}

// 새 단가표 GID (일반 편집 URL 기준)
const PRICE_TABLE_GIDS: Record<CarrierId, string> = {
  SKT: '0',
  KT: '13695407',
  LGU: '1020170609',
};

// 일반 편집 URL 또는 순수 스프레드시트 ID에서 ID 추출
function extractSpreadsheetId(urlOrId: string): string {
  const match = urlOrId.match(/\/spreadsheets\/d\/([\w-]+)/);
  return match ? match[1] : urlOrId;
}

// 일반 스프레드시트의 CSV 내보내기 URL
function buildExportCsvUrl(spreadsheetId: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}/export?format=csv&gid=${gid}`;
}

// 쉼표 포함 숫자 문자열 → number (원 단위)
function parsePrice(val: string): number {
  return Number(val.replace(/,/g, '')) || 0;
}

// 단가표 열 구조 (SKT/KT/LGU 공통):
//   col0=모델코드, col1=모델명, col2=출고가, col3=공통지원금(기변), col4=공통지원금(MNP)
//   col5~7  = 공통지원금 리베이트 (010신규 / MNP / 기변), 만원 단위
//   col8~10 = 선택약정 리베이트   (010신규 / MNP / 기변), 만원 단위
//   col13=공통 MNP합계, col14=공통 기변합계, col15=선택약정 MNP합계, col16=선택약정 기변합계
//   col17(R열)=가격문의
//
// 리베이트가 0이면 그 조건으로는 판매할 수 없다는 뜻이므로 가격문의로 안내한다.
function parsePriceRow(cols: string[], carrier: CarrierId): PriceTableRow {
  return {
    carrier,
    model_code: cols[0]?.trim() ?? '',
    model_name: cols[1]?.trim() ?? '',
    retail_price: parsePrice(cols[2] ?? ''),
    change_subsidy: parsePrice(cols[3] ?? '') * 10000,
    mnp_subsidy: parsePrice(cols[4] ?? '') * 10000,
    subsidy_010: parsePrice(cols[5] ?? ''),
    subsidy_mnp: parsePrice(cols[6] ?? ''),
    subsidy_change: parsePrice(cols[7] ?? ''),
    agreement_010: parsePrice(cols[8] ?? ''),
    agreement_mnp: parsePrice(cols[9] ?? ''),
    agreement_change: parsePrice(cols[10] ?? ''),
    mnp_price: parsePrice(cols[13] ?? ''),
    change_price: parsePrice(cols[14] ?? ''),
    agreement_mnp_price: parsePrice(cols[15] ?? ''),
    agreement_change_price: parsePrice(cols[16] ?? ''),
    price_inquiry: cols[17]?.trim() === '가격문의',
  };
}

/** 가입유형별 리베이트 조회. 0이면 해당 조건으로 판매 불가 → 가격문의 */
export function getRowRebate(
  row: PriceTableRow,
  discountType: '공통지원금' | '선택약정',
  subscriptionType: SubscriptionType
): number {
  if (discountType === '공통지원금') {
    if (subscriptionType === '번호이동') return row.subsidy_mnp ?? 0;
    if (subscriptionType === '신규가입') return row.subsidy_010 ?? 0;
    return row.subsidy_change ?? 0;
  }
  if (subscriptionType === '번호이동') return row.agreement_mnp ?? 0;
  if (subscriptionType === '신규가입') return row.agreement_010 ?? 0;
  return row.agreement_change ?? 0;
}

function parseSktRows(lines: string[]): PriceTableRow[] {
  const rows: PriceTableRow[] = [];
  for (const line of lines) {
    const cols = parseCsvLine(line);
    const code = cols[0]?.trim() ?? '';
    if (!code || code.startsWith('▶') || code.startsWith('SKT') || code === '모델코드') continue;
    if (parsePrice(cols[2] ?? '') === 0) continue;
    rows.push(parsePriceRow(cols, 'SKT'));
  }
  return rows;
}

function parseKtRows(lines: string[]): PriceTableRow[] {
  const rows: PriceTableRow[] = [];
  for (const line of lines) {
    const cols = parseCsvLine(line);
    const code = cols[0]?.trim() ?? '';
    if (!code || code.startsWith('▶') || code.startsWith('KT') || code === '모델코드') continue;
    if (parsePrice(cols[2] ?? '') === 0) continue;
    rows.push(parsePriceRow(cols, 'KT'));
  }
  return rows;
}

function parseLguRows(lines: string[]): PriceTableRow[] {
  const rows: PriceTableRow[] = [];
  for (const line of lines) {
    const cols = parseCsvLine(line);
    const code = cols[0]?.trim() ?? '';
    if (!code || code.startsWith('▶') || code.startsWith('LG') || code === '모델코드') continue;
    if (parsePrice(cols[2] ?? '') === 0) continue;
    rows.push(parsePriceRow(cols, 'LGU'));
  }
  return rows;
}

// ── 혜택 조건 (부가서비스 / 제휴카드) ──
//
// 각 통신사 단가표 탭 우측 S~U열에 들어 있는 작은 블록에서 읽는다.
//   T열(19) = 부가서비스, U열(20) = 제휴카드   ← 제목 행
//   S열(18) = '금액' 행        → 기기값에서 차감할 할인액 (원 단위, 이미 최종 금액)
//   S열(18) = '유지 및 조건' 행 → 사용자에게 보여줄 조건 문구
//
// 행 위치가 바뀌어도 동작하도록 행 번호를 고정하지 않고 제목·라벨을 찾아서 읽는다.
// 부가서비스/제휴카드 열 순서가 바뀌어도 제목 행 기준으로 매칭된다.
const BENEFIT_LABEL_COL = 18;
const BENEFIT_TITLE_ROW_SCAN = 5; // 제목 행은 시트 상단에 있으므로 앞부분만 훑는다

export interface Benefit {
  readonly amount: number;
  readonly condition: string;
}

export interface CarrierBenefits {
  readonly 부가서비스: Benefit;
  readonly 제휴카드: Benefit;
}

export const EMPTY_BENEFITS: CarrierBenefits = {
  부가서비스: { amount: 0, condition: '' },
  제휴카드: { amount: 0, condition: '' },
};

function parseBenefitBlock(lines: string[]): CarrierBenefits {
  const grid = lines.slice(0, BENEFIT_TITLE_ROW_SCAN + 3).map(parseCsvLine);

  // 1) 제목 행에서 '부가서비스'·'제휴카드'가 각각 몇 번째 열인지 찾는다
  let addonCol = -1;
  let cardCol = -1;
  for (const cols of grid.slice(0, BENEFIT_TITLE_ROW_SCAN)) {
    for (let c = BENEFIT_LABEL_COL; c < cols.length; c++) {
      const cell = (cols[c] ?? '').trim();
      if (cell === '부가서비스') addonCol = c;
      if (cell === '제휴카드') cardCol = c;
    }
    if (addonCol >= 0 || cardCol >= 0) break;
  }
  if (addonCol < 0 && cardCol < 0) return EMPTY_BENEFITS;

  // 2) S열 라벨('금액' / '유지 및 조건')로 값 행을 찾아 읽는다
  const read = (col: number): Benefit => {
    if (col < 0) return { amount: 0, condition: '' };
    let amount = 0;
    let condition = '';
    for (const cols of grid) {
      const label = (cols[BENEFIT_LABEL_COL] ?? '').trim();
      const value = (cols[col] ?? '').trim();
      if (label === '금액') amount = parsePrice(value);
      else if (label.startsWith('유지')) condition = value;
    }
    return { amount, condition };
  };

  return { 부가서비스: read(addonCol), 제휴카드: read(cardCol) };
}

export async function fetchPriceTable(
  sheetIdOrUrl: string,
  carrier: CarrierId
): Promise<{ rows: PriceTableRow[]; benefits: CarrierBenefits }> {
  const gid = PRICE_TABLE_GIDS[carrier];
  const spreadsheetId = extractSpreadsheetId(sheetIdOrUrl);
  const url = buildExportCsvUrl(spreadsheetId, gid);
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`단가표(${carrier}) 불러오기 실패: ${res.status}`);
  const text = await res.text();
  const lines = text.split('\n').filter((l) => l.trim() !== '');

  const benefits = parseBenefitBlock(lines);
  switch (carrier) {
    case 'SKT': return { rows: parseSktRows(lines), benefits };
    case 'KT': return { rows: parseKtRows(lines), benefits };
    case 'LGU': return { rows: parseLguRows(lines), benefits };
  }
}
