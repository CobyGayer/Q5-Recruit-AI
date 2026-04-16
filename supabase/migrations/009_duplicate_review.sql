-- ==========================================
-- Migration: Duplicate recruit review system
-- ==========================================
-- Adds name_key to recruits, a transient group-level review queue,
-- and the supporting indexes, triggers, and RLS policies.

-- 1) Unaccent extension for accent-folding in normalization.
CREATE EXTENSION IF NOT EXISTS unaccent;

-- 2) Shared normalization function — same logic mirrored in TypeScript.
--    Rules (v1):
--      - coalesce NULL to empty string
--      - unaccent (fold accented chars to base ASCII)
--      - lowercase
--      - replace any run of non-[a-z] characters with a single space
--      - trim leading/trailing whitespace
--    Suffixes like "jr", "sr", "ii" are NOT stripped — they remain significant.
CREATE OR REPLACE FUNCTION public.normalize_name_key(name TEXT)
RETURNS TEXT
LANGUAGE SQL
STABLE
AS $$
  SELECT trim(
    regexp_replace(
      regexp_replace(
        lower(unaccent(coalesce(name, ''))),
        '[^a-z]+', ' ', 'g'
      ),
      '\s+', ' ', 'g'
    )
  )
$$;

-- 3) Add name_key column to recruits.
ALTER TABLE public.recruits
  ADD COLUMN IF NOT EXISTS name_key TEXT;

-- 4) Backfill existing recruits immediately so the admin scan works on day one.
UPDATE public.recruits
SET name_key = public.normalize_name_key(full_name)
WHERE name_key IS NULL;

-- 5) Index for fast same-name lookups within a program.
CREATE INDEX IF NOT EXISTS idx_recruits_program_name_key
  ON public.recruits(program_id, name_key)
  WHERE name_key IS NOT NULL;

-- 6) Trigger function to keep name_key in sync on every write.
CREATE OR REPLACE FUNCTION public.set_recruit_name_key()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.name_key := public.normalize_name_key(NEW.full_name);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS recruit_name_key_sync ON public.recruits;
CREATE TRIGGER recruit_name_key_sync
  BEFORE INSERT OR UPDATE ON public.recruits
  FOR EACH ROW EXECUTE FUNCTION public.set_recruit_name_key();

-- 7) Duplicate review group table.
CREATE TABLE IF NOT EXISTS public.recruit_duplicate_review_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id  UUID        NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  name_key    TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'resolved', 'dismissed')),
  source      TEXT        NOT NULL
                          CHECK (source IN ('ingest', 'admin_scan')),
  resolved_at TIMESTAMPTZ,
  dismissed_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now(),
  updated_at  TIMESTAMPTZ DEFAULT now()
);

-- 8) Only one active (pending) group allowed per (program_id, name_key).
--    Concurrent ingests must use INSERT ... ON CONFLICT DO UPDATE to refresh
--    the existing group rather than creating a duplicate.
CREATE UNIQUE INDEX IF NOT EXISTS idx_duplicate_review_groups_active
  ON public.recruit_duplicate_review_groups(program_id, name_key)
  WHERE status = 'pending';

-- 9) Group members table — which recruits belong to each review group.
CREATE TABLE IF NOT EXISTS public.recruit_duplicate_review_group_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id    UUID        NOT NULL
                          REFERENCES public.recruit_duplicate_review_groups(id)
                          ON DELETE CASCADE,
  recruit_id  UUID        NOT NULL
                          REFERENCES public.recruits(id)
                          ON DELETE CASCADE,
  added_at    TIMESTAMPTZ DEFAULT now(),
  UNIQUE(group_id, recruit_id)
);

CREATE INDEX IF NOT EXISTS idx_review_group_members_group
  ON public.recruit_duplicate_review_group_members(group_id);

CREATE INDEX IF NOT EXISTS idx_review_group_members_recruit
  ON public.recruit_duplicate_review_group_members(recruit_id);

-- 10) Auto-update timestamp trigger for review groups.
DROP TRIGGER IF EXISTS duplicate_review_groups_updated_at ON public.recruit_duplicate_review_groups;
CREATE TRIGGER duplicate_review_groups_updated_at
  BEFORE UPDATE ON public.recruit_duplicate_review_groups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 11) RLS — program-scoped, matching the workspace isolation used everywhere else.
ALTER TABLE public.recruit_duplicate_review_groups ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS duplicate_review_groups_program_isolation ON public.recruit_duplicate_review_groups;
CREATE POLICY duplicate_review_groups_program_isolation
  ON public.recruit_duplicate_review_groups
  FOR ALL
  USING (
    program_id = (
      SELECT c.program_id
      FROM public.coaches c
      WHERE c.id = auth.uid()
    )
  )
  WITH CHECK (
    program_id = (
      SELECT c.program_id
      FROM public.coaches c
      WHERE c.id = auth.uid()
    )
  );

ALTER TABLE public.recruit_duplicate_review_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS duplicate_review_group_members_program_isolation ON public.recruit_duplicate_review_group_members;
CREATE POLICY duplicate_review_group_members_program_isolation
  ON public.recruit_duplicate_review_group_members
  FOR ALL
  USING (
    group_id IN (
      SELECT g.id
      FROM public.recruit_duplicate_review_groups g
      WHERE g.program_id = (
        SELECT c.program_id
        FROM public.coaches c
        WHERE c.id = auth.uid()
      )
    )
  )
  WITH CHECK (
    group_id IN (
      SELECT g.id
      FROM public.recruit_duplicate_review_groups g
      WHERE g.program_id = (
        SELECT c.program_id
        FROM public.coaches c
        WHERE c.id = auth.uid()
      )
    )
  );
