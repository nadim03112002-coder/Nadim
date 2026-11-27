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

const SUPABASE_FETCH_TIMEOUT_MS = 8000;

const timedSupabaseFetch: typeof fetch = async (input, init) => {
  if (typeof AbortController === 'undefined') {
    return fetch(input, init);
  }
  const controller = new AbortController();
  const callerSignal = init?.signal;
  if (callerSignal) {
    if (callerSignal.aborted) {
      controller.abort();
    } else {
      callerSignal.addEventListener('abort', () => controller.abort(), { once: true });
    }
  }
  const timer = setTimeout(() => controller.abort(), SUPABASE_FETCH_TIMEOUT_MS);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

export const supabase: SupabaseClient | null = isSupabaseConfigured()
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        fetch: timedSupabaseFetch,
      },
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
