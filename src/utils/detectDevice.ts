// User-Agent Client Hints API + UA fallback으로 기기 모델 감지

export interface DetectedDevice {
  readonly raw: string;       // 감지된 원본 모델명
  readonly brand: '삼성' | 'Apple' | null;
  readonly matchKeyword: string; // 중고폰시세 시트 매칭용 키워드
  readonly isMobile: boolean; // 모바일 기기 여부
}

// 삼성 모델번호 → 시리즈 매핑
const SAMSUNG_MODEL_MAP: readonly { pattern: RegExp; keyword: string }[] = [
  // S25 시리즈
  { pattern: /SM-S938/i, keyword: 'S25 Ultra' },
  { pattern: /SM-S936/i, keyword: 'S25+' },
  { pattern: /SM-S931/i, keyword: 'S25' },
  // S24 시리즈
  { pattern: /SM-S928/i, keyword: 'S24 Ultra' },
  { pattern: /SM-S926/i, keyword: 'S24+' },
  { pattern: /SM-S921/i, keyword: 'S24' },
  // S23 시리즈
  { pattern: /SM-S918/i, keyword: 'S23 Ultra' },
  { pattern: /SM-S916/i, keyword: 'S23+' },
  { pattern: /SM-S911/i, keyword: 'S23' },
  // Z 폴드/플립 시리즈
  { pattern: /SM-F956/i, keyword: 'Z 폴드6' },
  { pattern: /SM-F741/i, keyword: 'Z 플립6' },
  { pattern: /SM-F946/i, keyword: 'Z 폴드5' },
  { pattern: /SM-F731/i, keyword: 'Z 플립5' },
  // A 시리즈
  { pattern: /SM-A556/i, keyword: 'A55' },
  { pattern: /SM-A356/i, keyword: 'A35' },
];

// 모바일 기기인지 확인
function isMobileDevice(): boolean {
  const ua = navigator.userAgent;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(ua);
}

function resolveKeyword(raw: string): Omit<DetectedDevice, 'isMobile'> {
  for (const { pattern, keyword } of SAMSUNG_MODEL_MAP) {
    if (pattern.test(raw)) {
      return { raw, brand: '삼성', matchKeyword: keyword };
    }
  }

  if (raw.startsWith('SM-')) {
    return { raw, brand: '삼성', matchKeyword: raw };
  }

  if (/iPhone/i.test(raw)) {
    return { raw, brand: 'Apple', matchKeyword: 'iPhone' };
  }

  if (raw) {
    return { raw, brand: null, matchKeyword: raw };
  }

  return { raw: '', brand: null, matchKeyword: '' };
}

// UA 문자열 파싱 (fallback)
function detectFromUA(): Omit<DetectedDevice, 'isMobile'> {
  const ua = navigator.userAgent;

  const androidMatch = ua.match(/;\s*(SM-[A-Z0-9]+|Galaxy[^;)]+)/i);
  if (androidMatch) {
    return resolveKeyword(androidMatch[1].trim());
  }

  if (/iPhone/.test(ua)) {
    return resolveKeyword('iPhone');
  }

  return { raw: '', brand: null, matchKeyword: '' };
}

const NO_DEVICE: DetectedDevice = { raw: '', brand: null, matchKeyword: '', isMobile: false };

// 메인 감지 함수
export async function detectDevice(): Promise<DetectedDevice> {
  // PC에서는 감지하지 않음
  if (!isMobileDevice()) {
    return NO_DEVICE;
  }

  // 1) Client Hints API 시도 (Chrome 90+, Edge, Samsung Internet 등)
  try {
    const nav = navigator as Navigator & {
      userAgentData?: {
        getHighEntropyValues(hints: string[]): Promise<{ model?: string }>;
      };
    };

    if (nav.userAgentData?.getHighEntropyValues) {
      const data = await nav.userAgentData.getHighEntropyValues(['model']);
      if (data.model) {
        return { ...resolveKeyword(data.model.trim()), isMobile: true };
      }
    }
  } catch {
    // Client Hints 실패 시 UA fallback
  }

  // 2) 기존 User-Agent 파싱 fallback
  return { ...detectFromUA(), isMobile: true };
}

// 시트의 모델명에서 키워드로 매칭
export function findMatchingUsedPhone(
  keyword: string,
  usedPhones: readonly { 모델ID: string; 모델명: string }[]
): string | null {
  if (!keyword) return null;

  const match = usedPhones.find((p) =>
    p.모델명.includes(keyword)
  );

  return match?.모델ID ?? null;
}
