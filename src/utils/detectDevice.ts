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

// 기기 출시 용량 감지
// Chrome Android: quota는 전체 파티션 가용 공간 기준 (기기마다 다름)
// 여러 추정 방식으로 시도
async function detectStorage(): Promise<string> {
  try {
    if (navigator.storage?.estimate) {
      const { quota, usage } = await navigator.storage.estimate();
      if (quota) {
        const quotaGB = quota / (1024 * 1024 * 1024);
        const usageGB = (usage ?? 0) / (1024 * 1024 * 1024);
        const totalUsed = quotaGB + usageGB;

        // 방법 1: quota + usage 기반 전체 디스크 추정
        // Chrome Android: quota ≈ 전체 디스크의 약 60%
        // Samsung Internet: quota ≈ 전체 디스크의 약 20~50%
        // 여러 비율로 추정해서 가장 합리적인 값 선택
        const estimates = [
          totalUsed / 0.2,  // quota가 20%인 경우
          totalUsed / 0.4,  // quota가 40%인 경우
          totalUsed / 0.6,  // quota가 60%인 경우
        ];

        // 모든 추정값에서 가장 가까운 출시 용량 투표
        const capacities = [128, 256, 512, 1024];
        const votes: Record<number, number> = {};
        for (const est of estimates) {
          let best = capacities[0];
          let bestDiff = Math.abs(est - best);
          for (const cap of capacities) {
            const diff = Math.abs(est - cap);
            if (diff < bestDiff) {
              bestDiff = diff;
              best = cap;
            }
          }
          votes[best] = (votes[best] ?? 0) + 1;
        }

        // 가장 많은 표를 받은 용량
        let winner = capacities[0];
        let maxVotes = 0;
        for (const [cap, count] of Object.entries(votes)) {
          if (count > maxVotes) {
            maxVotes = count;
            winner = Number(cap);
          }
        }
        return `${winner}GB`;
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
