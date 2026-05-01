import type { CarrierId, SubscriptionType } from '../types';

// Google Sheets CSV 파싱 유틸리티
// "웹에 게시" URL에서 gid 기반으로 CSV를 가져옵니다.

// pubhtml URL에서 key 부분을 추출
// 예: https://docs.google.com/spreadsheets/d/e/2PACX-xxx/pubhtml → 2PACX-xxx
function extractPubKey(input: string): string {
  const match = input.match(/\/d\/e\/([\w-]+)/);
  if (match) return match[1];
  // 이미 key만 전달된 경우
  return input;
}

function buildCsvUrl(pubKey: string, gid: string): string {
  return `https://docs.google.com/spreadsheets/d/e/${pubKey}/pub?gid=${gid}&single=true&output=csv`;
}

// 시트 탭 GID 매핑
// ★ 구글 시트에서 탭을 선택하면 URL에 #gid=숫자 가 나옵니다. 그 숫자를 여기에 넣으세요.
const SHEET_GIDS = {
  공통지원금: '0',
  제휴카드할인: '465133020',
  요금제: '882540890',
  부가서비스: '528526412',
  중고폰시세: '1666746914',
  선택약정: '',
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

// ── 공통지원금 + 추가지원금 (가입유형별) ──

export interface SubsidyRow {
  readonly 모델ID: string;
  readonly 통신사: CarrierId;
  readonly 용량: string;
  readonly 가입유형: SubscriptionType;
  readonly 출고가: number;
  readonly 공통지원금: number;
  readonly 추가지원금: number;
  readonly 배지: string;
  readonly 특별지원: number;
  readonly 선택약정_추가지원금: number;
  readonly 선택약정_특별지원: number;
}

export async function fetchSubsidies(sheetIdOrUrl: string): Promise<SubsidyRow[]> {
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.공통지원금);

  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    용량: row['용량'] ?? '',
    가입유형: (row['가입유형'] ?? '번호이동') as SubscriptionType,
    출고가: Number(row['출고가']) || 0,
    공통지원금: Number(row['공통지원금']) || 0,
    추가지원금: Number(row['추가지원금']) || 0,
    배지: row['배지'] ?? '',
    특별지원: Number(row['특별지원']) || 0,
    선택약정_추가지원금: Number(row['선택약정_추가지원금']) || 0,
    선택약정_특별지원: Number(row['선택약정_특별지원금'] ?? row['선택약정_특별지원']) || 0,
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

// ── 요금제 ──

export interface PlanRow {
  readonly id: string;
  readonly 통신사: CarrierId;
  readonly 요금제명: string;
  readonly 월요금: number;
  readonly 데이터: string;
  readonly 통화: string;
  readonly 문자: string;
  readonly 선택약정할인율: number;
  readonly 혜택: string;
}

export async function fetchPlans(sheetIdOrUrl: string): Promise<PlanRow[]> {
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.요금제);

  return rows.map((row) => ({
    id: row['ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    요금제명: row['요금제명'] ?? '',
    월요금: Number(row['월요금']) || 0,
    데이터: row['데이터'] ?? '',
    통화: row['통화'] ?? '',
    문자: row['문자'] ?? '',
    선택약정할인율: Number(row['선택약정할인율']) || 0.25,
    혜택: row['혜택'] ?? '',
  }));
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

// ── 선택약정 지원금 (공통지원금과 동일 구조, 모델×통신사×용량×가입유형) ──

export interface SelectAgreementSubsidyRow {
  readonly 모델ID: string;
  readonly 통신사: CarrierId;
  readonly 용량: string;
  readonly 가입유형: SubscriptionType;
  readonly 출고가: number;
  readonly 추가지원금: number;
  readonly 특별지원: number;
}

export async function fetchSelectAgreementSubsidies(
  sheetIdOrUrl: string
): Promise<SelectAgreementSubsidyRow[]> {
  if (!SHEET_GIDS.선택약정) return [];
  const pubKey = extractPubKey(sheetIdOrUrl);
  const rows = await fetchCsv(pubKey, SHEET_GIDS.선택약정);

  return rows.map((row) => ({
    모델ID: row['모델ID'] ?? '',
    통신사: (row['통신사'] ?? '') as CarrierId,
    용량: row['용량'] ?? '',
    가입유형: (row['가입유형'] ?? '번호이동') as SubscriptionType,
    출고가: Number(row['출고가']) || 0,
    추가지원금: Number(row['추가지원금']) || 0,
    특별지원: Number(row['특별지원']) || 0,
  }));
}

// ── 키즈전용 폰 ──
// 키즈전용 시트 컬럼: 모델ID | 통신사 | 용량 | 가입유형 | 출고가 | 공통지원금 | 추가지원금 | 배지 | 특별지원 | 선택약정_추가지원금 | 선택약정_특별지원

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

// ── 부가서비스 ──

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
