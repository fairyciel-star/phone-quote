// User-Agent Client Hints API + UA fallback으로 기기 모델 감지

export interface DetectedDevice {
  readonly raw: string;
  readonly brand: '삼성' | 'Apple' | null;
  readonly matchKeyword: string;
  readonly isMobile: boolean;
  readonly storage: string; // '256GB', '512GB' 등
}

// 삼성 모델번호 → 시리즈 매핑
const SAMSUNG_MODEL_MAP: readonly { pattern: RegExp; keyword: string }[] = [
  { pattern: /SM-S938/i, keyword: 'S25 Ultra' },
  { pattern: /SM-S936/i, keyword: 'S25+' },
  { pattern: /SM-S931/i, keyword: 'S25' },
  { pattern: /SM-S928/i, keyword: 'S24 Ultra' },
  { pattern: /SM-S926/i, keyword: 'S24+' },
  { pattern: /SM-S921/i, keyword: 'S24' },
  { pattern: /SM-S918/i, keyword: 'S23 Ultra' },
  { pattern: /SM-S916/i, keyword: 'S23+' },
  { pattern: /SM-S911/i, keyword: 'S23' },
  { pattern: /SM-F956/i, keyword: 'Z폴드6' },
  { pattern: /SM-F741/i, keyword: 'Z플립6' },
  { pattern: /SM-F946/i, keyword: 'Z폴드5' },
  { pattern: /SM-F731/i, keyword: 'Z플립5' },
  { pattern: /SM-A556/i, keyword: 'A55' },
  { pattern: /SM-A356/i, keyword: 'A35' },
];

function isMobileDevice(): boolean {
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}

interface ResolvedModel {
  readonly raw: string;
  readonly brand: '삼성' | 'Apple' | null;
  readonly matchKeyword: string;
}

function resolveKeyword(raw: string): ResolvedModel {
  for (const { pattern, keyword } of SAMSUNG_MODEL_MAP) {
    if (pattern.test(raw)) {
      return { raw, brand: '삼성', matchKeyword: keyword };
    }
  }
  if (raw.startsWith('SM-')) return { raw, brand: '삼성', matchKeyword: raw };
  if (/iPhone/i.test(raw)) return { raw, brand: 'Apple', matchKeyword: 'iPhone' };
  if (raw) return { raw, brand: null, matchKeyword: raw };
  return { raw: '', brand: null, matchKeyword: '' };
}

function detectFromUA(): ResolvedModel {
  const ua = navigator.userAgent;
  const androidMatch = ua.match(/;\s*(SM-[A-Z0-9]+|Galaxy[^;)]+)/i);
  if (androidMatch) return resolveKeyword(androidMatch[1].trim());
  if (/iPhone/.test(ua)) return resolveKeyword('iPhone');
  return { raw: '', brand: null, matchKeyword: '' };
}

// 기기 저장용량 감지 (navigator.storage.estimate)
async function detectStorage(): Promise<string> {
  try {
    if (navigator.storage?.estimate) {
      const { quota } = await navigator.storage.estimate();
      if (quota) {
        const gb = quota / (1024 * 1024 * 1024);
        // 실제 사용가능 용량 기준으로 총 용량 추정
        if (gb > 400) return '512GB';
        if (gb > 200) return '256GB';
        if (gb > 100) return '128GB';
        if (gb > 50) return '64GB';
      }
    }
  } catch {
    // 감지 실패
  }
  return '';
}

const NO_DEVICE: DetectedDevice = { raw: '', brand: null, matchKeyword: '', isMobile: false, storage: '' };

export async function detectDevice(): Promise<DetectedDevice> {
  if (!isMobileDevice()) return NO_DEVICE;

  const storage = await detectStorage();

  // 1) Client Hints API
  try {
    const nav = navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues(hints: string[]): Promise<{ model?: string }>;
      };
    };
    if (nav.userAgentData?.getHighEntropyValues) {
      const data = await nav.userAgentData.getHighEntropyValues(['model']);
      if (data.model) {
        return { ...resolveKeyword(data.model.trim()), isMobile: true, storage };
      }
    }
  } catch {
    // fallback
  }

  // 2) UA fallback
  return { ...detectFromUA(), isMobile: true, storage };
}

// 시트의 모델명에서 키워드로 매칭 (공백 무시)
export function findMatchingUsedPhone(
  keyword: string,
  usedPhones: readonly { 모델ID: string; 모델명: string }[]
): string | null {
  if (!keyword) return null;
  const normalized = keyword.replace(/\s/g, '').toLowerCase();
  const match = usedPhones.find((p) =>
    p.모델명.replace(/\s/g, '').toLowerCase().includes(normalized)
  );
  return match?.모델ID ?? null;
}
