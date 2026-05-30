-- Add optional per-position soft preference settings to program configs.

ALTER TABLE public.program_config
  ADD COLUMN IF NOT EXISTS preferred_foot_by_position JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS preferred_height_range_by_position JSONB NOT NULL DEFAULT '{}'::jsonb;
