import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Database } from './supabase-types';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL ?? '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY ?? '';

const configured = supabaseUrl !== '' && supabaseAnonKey !== '';

export const supabase: SupabaseClient<Database> = configured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey)
  : (null as unknown as SupabaseClient<Database>);

export function isSupabaseConfigured(): boolean {
  return configured;
}
