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

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split('\n').filter((line) => line.trim() !== '');
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]).map((h) => h.replace(/^"|"$/g, ''));
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
    키즈전용: (row['키즈전용'] ?? '').toUpperCase() === 'Y',
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
