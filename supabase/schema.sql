-- =============================================================================
-- LIFE MAKER Multi-Tenant School ERP & Smart Learning — Supabase Schema
-- Run this entire script ONCE inside Supabase Dashboard -> SQL Editor -> Run
-- Supports 100–200+ schools with strict school_id indexing & Realtime updates
-- =============================================================================

-- 1. Schools registry
CREATE TABLE IF NOT EXISTS public.schools (
  id TEXT PRIMARY KEY,
  code TEXT DEFAULT '',
  name TEXT DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_schools_code ON public.schools (code);

-- 2. Users (Admins, Principals, Teachers, Accountants, Parents, Students, Drivers)
CREATE TABLE IF NOT EXISTS public.users (
  id TEXT PRIMARY KEY,
  email TEXT DEFAULT '',
  mobile TEXT DEFAULT '',
  school_id TEXT DEFAULT '',
  role TEXT DEFAULT 'STUDENT',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_users_school ON public.users (school_id);
CREATE INDEX IF NOT EXISTS idx_users_email ON public.users (email);
CREATE INDEX IF NOT EXISTS idx_users_mobile ON public.users (mobile);

-- 3. Firebase Cloud Messaging (FCM) Device Tokens (Used ONLY for Android Lock-Screen Voice & Push)
CREATE TABLE IF NOT EXISTS public.fcm_tokens (
  token_key TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  student_id TEXT DEFAULT '',
  school_id TEXT DEFAULT '',
  class_id TEXT DEFAULT '',
  class_name TEXT DEFAULT '',
  role TEXT DEFAULT '',
  platform TEXT DEFAULT 'pwa',
  token TEXT NOT NULL,
  device_id TEXT DEFAULT '',
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_school ON public.fcm_tokens (school_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_user ON public.fcm_tokens (user_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_student ON public.fcm_tokens (student_id);
CREATE INDEX IF NOT EXISTS idx_fcm_tokens_platform ON public.fcm_tokens (platform);

-- 4. Web Push Subscriptions & Monthly Fee Dues Snapshot
CREATE TABLE IF NOT EXISTS public.webpush_subs (
  id TEXT PRIMARY KEY,
  user_id TEXT DEFAULT '',
  school_id TEXT DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webpush_subs_school ON public.webpush_subs (school_id);

CREATE TABLE IF NOT EXISTS public.webpush_dues (
  due_key TEXT PRIMARY KEY,
  student_id TEXT DEFAULT '',
  school_id TEXT DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_webpush_dues_school ON public.webpush_dues (school_id);

-- 5. Unified Multi-Tenant Document & Realtime Store (Replaces Firestore & RTDB limits)
CREATE TABLE IF NOT EXISTS public.kv_documents (
  path TEXT PRIMARY KEY,
  collection_path TEXT NOT NULL,
  doc_id TEXT NOT NULL,
  school_id TEXT NOT NULL DEFAULT '',
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_kv_collection ON public.kv_documents (collection_path);
CREATE INDEX IF NOT EXISTS idx_kv_school_collection ON public.kv_documents (school_id, collection_path);
CREATE INDEX IF NOT EXISTS idx_kv_updated_at ON public.kv_documents (updated_at DESC);

-- 6. Enable Realtime on Core Tables (Idempotent)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'kv_documents'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.kv_documents;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'schools'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.schools;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'users'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.users;
  END IF;
END $$;

-- 7. Row-Level Security (RLS) Baseline
-- Enables RLS across all tables while allowing client + server operations during Firebase->Supabase transition.
ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.fcm_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webpush_subs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.webpush_dues ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.kv_documents ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['schools', 'users', 'fcm_tokens', 'webpush_subs', 'webpush_dues', 'kv_documents']
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = tbl AND policyname = 'life_maker_rw_policy'
    ) THEN
      EXECUTE format(
        'CREATE POLICY life_maker_rw_policy ON public.%I FOR ALL USING (true) WITH CHECK (true);',
        tbl
      );
    END IF;
  END LOOP;
END $$;
