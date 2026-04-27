// User-Agent Client Hints API + UA fallback으로 기기 모델 감지

export interface DetectedDevice {
  readonly raw: string;
  readonly brand: '삼성' | 'Apple' | null;
  readonly matchKeyword: string;
  readonly isMobile: boolean;
  readonly storageGB: string;
  readonly debugQuota: string;
}

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

// navigator.storage.estimate() quota → 실제 용량 추정
// Chrome Android는 기기 전체 용량의 약 60% 수준으로 quota를 반환
async function detectStorageGB(): Promise<{ storageGB: string; debugQuota: string }> {
  try {
    if (!navigator.storage?.estimate) return { storageGB: '', debugQuota: '' };
    const { quota = 0 } = await navigator.storage.estimate();
    const gb = quota / 1_000_000_000;
    const debugQuota = `${gb.toFixed(1)}GB quota`;
    let storageGB = '';
    if (gb >= 450) storageGB = '1TB';
    else if (gb >= 220) storageGB = '512GB';
    else if (gb >= 110) storageGB = '256GB';
    else if (gb >= 50)  storageGB = '128GB';
    else if (gb >= 25)  storageGB = '64GB';
    return { storageGB, debugQuota };
  } catch {
    return { storageGB: '', debugQuota: '' };
  }
}

const NO_DEVICE: DetectedDevice = { raw: '', brand: null, matchKeyword: '', isMobile: false, storageGB: '', debugQuota: '' };

export async function detectDevice(): Promise<DetectedDevice> {
  if (!isMobileDevice()) return NO_DEVICE;

  const storageResult = await detectStorageGB();

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
        return { ...resolveKeyword(data.model.trim()), isMobile: true, ...storageResult };
      }
    }
  } catch {
    // fallback
  }

  // 2) UA fallback
  return { ...detectFromUA(), isMobile: true, ...storageResult };
}

export function findMatchingUsedPhone(
  raw: string,
  usedPhones: readonly { 모델ID: string; 모델명: string }[]
): string | null {
  if (!raw) return null;

  // 삼성 SM-XXXXX 형식: 모델코드(F731, S931 등) 추출 후 모델ID 직접 매칭
  const smMatch = raw.match(/^SM-([A-Z]\d{3})/i);
  if (smMatch) {
    const baseCode = smMatch[1].toUpperCase();
    const byId = usedPhones.find((p) =>
      p.모델ID.replace(/^SM-/i, '').toUpperCase().startsWith(baseCode)
    );
    if (byId) return byId.모델ID;
  }

  // Fallback: 모델명 텍스트 검색 (Apple 등 SM- 아닌 기기)
  const normalized = raw.replace(/\s/g, '').toLowerCase();
  const exact = usedPhones.find(
    (p) => p.모델명.replace(/\s/g, '').toLowerCase() === normalized
  );
  if (exact) return exact.모델ID;
  const matches = usedPhones.filter((p) =>
    p.모델명.replace(/\s/g, '').toLowerCase().includes(normalized)
  );
  if (matches.length === 0) return null;
  return matches.reduce((a, b) => a.모델명.length <= b.모델명.length ? a : b).모델ID;
}
