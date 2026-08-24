import { supabaseUntyped, isSupabaseConfigured } from '../lib/supabase';
import type { PageVisitRow } from '../lib/supabase-types';

type PageVisitInsert = Omit<PageVisitRow, 'id' | 'visited_at'>;

/**
 * 방문 기록 (fire-and-forget).
 *
 * 고객 앱 동작에 절대 영향을 주지 않는 것이 이 모듈의 유일한 제약이다.
 * - await 하지 않는다 (렌더링·초기 로딩을 막지 않음)
 * - 모든 실패를 삼킨다 (Supabase 미설정·네트워크 차단·스토리지 차단)
 * - 개인정보를 수집하지 않는다 (랜덤 UUID + 유입 도메인 + 기기 구분만)
 */

const VISITOR_KEY = 'pv_visitor_id';
const SESSION_KEY = 'pv_session_id';

const MOBILE_MAX_WIDTH = 768;
const REFERRER_MAX_LENGTH = 200;

function randomId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  // crypto.randomUUID 는 보안 컨텍스트(https/localhost)에서만 제공된다
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// 시크릿 모드·쿠키 차단 환경에서는 스토리지 접근 자체가 예외를 던진다
function safeGet(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(storage: Storage, key: string, value: string): void {
  try {
    storage.setItem(key, value);
  } catch {
    // 저장 불가 환경 — 기록은 남기되 세션 중복 제거만 포기한다
  }
}

/** 유입 도메인만 반환. 내부 이동·직접 유입은 null */
function referrerHost(): string | null {
  try {
    if (!document.referrer) return null;
    const url = new URL(document.referrer);
    if (url.hostname === window.location.hostname) return null;
    return url.hostname.slice(0, REFERRER_MAX_LENGTH);
  } catch {
    return null;
  }
}

/** 세션당 1회 방문 기록. 관리자 페이지 접속은 집계하지 않는다. */
export function logVisit(): void {
  try {
    if (!isSupabaseConfigured()) return;
    if (window.location.hash === '#/admin') return;

    // 세션 표식을 삽입 요청보다 먼저 동기적으로 기록해야
    // StrictMode 이중 실행에서도 행이 하나만 생긴다
    if (safeGet(sessionStorage, SESSION_KEY)) return;
    const sessionId = randomId();
    safeSet(sessionStorage, SESSION_KEY, sessionId);

    let visitorId = safeGet(localStorage, VISITOR_KEY);
    if (!visitorId) {
      visitorId = randomId();
      safeSet(localStorage, VISITOR_KEY, visitorId);
    }

    const payload: PageVisitInsert = {
      visitor_id: visitorId,
      session_id: sessionId,
      referrer: referrerHost(),
      device: window.innerWidth < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop',
    };

    void supabaseUntyped
      .from('page_visits')
      .insert(payload)
      .then(
        () => undefined,
        () => undefined,
      );
  } catch {
    // 방문 기록 실패가 앱을 멈추게 해서는 안 된다
  }
}
