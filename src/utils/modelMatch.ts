import phonesData from '../data/phones.json';
import type { Phone } from '../types';

const phones = phonesData as unknown as Phone[];

/**
 * 단가표 model_name의 용량 표기 제거
 * "갤럭시 Z 폴드7 256G" → "갤럭시 Z 폴드7"
 * "아이폰 17 프로 512GB" → "아이폰 17 프로"
 */
function stripStorage(name: string): string {
  return name
    .replace(/[\s_]*(1T|2T|128G|256G|512G|1TB|2TB|128GB|256GB|512GB)\b/gi, '')
    .trim();
}

/**
 * 한글 모델명 → phones.json 표준 영문명 변환
 * "갤럭시 Z 폴드7" → "갤럭시 Z Fold 7"
 * "아이폰 17 프로" → "iPhone 17 Pro"
 */
function normalizeModelName(name: string): string {
  return name
    // 아이폰 계열
    .replace(/아이폰/gi, 'iPhone')
    .replace(/\bIPhone\b/g, 'iPhone')
    // 갤럭시 Z 시리즈 (순서 중요: 폴드/플립 먼저 처리)
    .replace(/갤럭시\s+z\s+폴드/gi, '갤럭시 Z Fold')
    .replace(/갤럭시\s+z\s+플립/gi, '갤럭시 Z Flip')
    // 나머지 한글 → 영문
    .replace(/폴드/gi, 'Fold')
    .replace(/플립/gi, 'Flip')
    .replace(/울트라/gi, 'Ultra')
    .replace(/프로/gi, 'Pro')
    .replace(/에어/gi, 'Air')
    .replace(/맥스/gi, 'Max')
    .replace(/플러스/gi, '+')
    // "Fold7" → "Fold 7", "Flip7" → "Flip 7", "Pro128" 등 영문+숫자 사이 공백
    .replace(/([a-zA-Z])(\d)/g, '$1 $2')
    // 연속 공백 정리
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * 단가표 model_name → phones.json id 매핑
 *
 * 매칭 원칙: 용량(256G, 512GB 등)을 제거한 뒤 전체 모델명이 정확히 일치해야 함.
 * "갤럭시 S25" ≠ "갤럭시 S25 FE" — 뒤에 붙는 variant(FE, Ultra, + 등)까지 반드시 일치.
 *
 * 1. 정규화 후 정확 매치  (한글→영문 변환 후 비교)
 * 2. 원본 정확 매치        (변환 없이 그대로 비교)
 */
export function modelNameToPhoneId(modelName: string): string | null {
  if (!modelName) return null;

  const normalized = normalizeModelName(modelName);
  const cleanNorm = stripStorage(normalized);
  const cleanOrig = stripStorage(modelName);

  // 1. 정규화된 이름으로 정확 매치
  const exactNorm = phones.find(
    (p) => p.name === normalized || p.name === cleanNorm,
  );
  if (exactNorm) return exactNorm.id;

  // 2. 원본 이름으로 정확 매치
  const exactOrig = phones.find(
    (p) => p.name === modelName || p.name === cleanOrig,
  );
  if (exactOrig) return exactOrig.id;

  return null;
}

/**
 * phones.json id → 표시 이름
 */
export function phoneIdToName(modelId: string): string {
  return phones.find((p) => p.id === modelId)?.name ?? modelId;
}
