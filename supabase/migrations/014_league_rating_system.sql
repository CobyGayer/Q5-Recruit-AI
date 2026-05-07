-- Add league preferences and ratings to program_config
ALTER TABLE public.program_config
  ADD COLUMN IF NOT EXISTS league_preferences JSONB DEFAULT '["mls_next", "ecnl", "ga", "regional", "other", "unknown"]'::jsonb,
  ADD COLUMN IF NOT EXISTS league_ratings JSONB DEFAULT '{"mls_next": 10, "ecnl": 9, "ga": 7.5, "regional": 5.5, "other": 3.5, "unknown": 5}'::jsonb;

-- Add flag to recruits table to mark profiles with clubs outside selected leagues
ALTER TABLE public.recruits
  ADD COLUMN IF NOT EXISTS is_outside_selected_leagues BOOLEAN DEFAULT false;

-- Create index for efficient filtering by the new flag
CREATE INDEX IF NOT EXISTS idx_recruits_outside_selected_leagues ON public.recruits(program_id, is_outside_selected_leagues);
