import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const configured = supabaseUrl !== '' && supabaseAnonKey !== '';

export const supabase: SupabaseClient<Database> = configured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient<Database>);

/**
 * 스키마 추론을 끈 동일 클라이언트 참조.
 *
 * Database 의 Row 들이 interface 로 선언되어 있어 postgrest-js 의
 * `Record<string, unknown>` 제약을 만족하지 못한다(인터페이스에는 암묵적
 * 인덱스 시그니처가 없음). 그 결과 insert 인자와 rpc 인자 타입이 never 로
 * 좁혀져 호출 자체가 불가능하다. 기존 쿼리들이 결과를 `as` 로 캐스팅해 온
 * 것도 같은 이유다.
 *
 * 타입 정의를 전면 교체하기 전까지 insert/rpc 는 이 참조로 호출하고,
 * 인자와 결과는 호출부에서 명시적으로 타입을 지정한다.
 */
export const supabaseUntyped = supabase as unknown as SupabaseClient;

export function isSupabaseConfigured(): boolean {
  return configured;
}
