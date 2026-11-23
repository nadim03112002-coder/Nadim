import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_URL = (
  import.meta.env.VITE_SUPABASE_URL ||
  'https://mcdwtjpiekqpusnfjnco.supabase.co'
).trim();

// Scoped public publishable browser key (safe for browser/Android WebView with RLS enabled)
export const SUPABASE_ANON_KEY = (
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  'sb_publishable_n5m3wcMptKipbj1uOI4jSg_YmhdwnXB'
).trim();

export const isSupabaseConfigured = (): boolean =>
  Boolean(SUPABASE_URL && SUPABASE_ANON_KEY && !SUPABASE_URL.includes('placeholder'));

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
      realtime: {
        params: {
          eventsPerSecond: 10,
        },
      },
    })
  : null;

export const extractSchoolIdFromPath = (rawPath: string): string => {
  const parts = String(rawPath || '')
    .split('/')
    .map((p) => p.trim())
    .filter(Boolean);
  const idx = parts.indexOf('schools');
  if (idx !== -1 && parts[idx + 1]) {
    return parts[idx + 1];
  }
  return '';
};
