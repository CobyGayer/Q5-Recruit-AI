-- ==========================================
-- Migration: program_config attribution field
-- ==========================================

-- Rename ownership-like column to attribution-only metadata.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'program_config'
      AND column_name = 'coach_id'
  ) THEN
    ALTER TABLE public.program_config
      RENAME COLUMN coach_id TO updated_by_coach_id;
  END IF;
END $$;

ALTER TABLE public.program_config
  DROP CONSTRAINT IF EXISTS program_config_coach_id_fkey;

ALTER TABLE public.program_config
  DROP CONSTRAINT IF EXISTS program_config_updated_by_coach_id_fkey;

ALTER TABLE public.program_config
  ALTER COLUMN updated_by_coach_id DROP NOT NULL;

ALTER TABLE public.program_config
  ADD CONSTRAINT program_config_updated_by_coach_id_fkey
  FOREIGN KEY (updated_by_coach_id)
  REFERENCES public.coaches(id)
  ON DELETE SET NULL;
