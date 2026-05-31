-- Add NAL and DPL as distinct club_level values and update defaults
ALTER TYPE club_level ADD VALUE IF NOT EXISTS 'nal';
ALTER TYPE club_level ADD VALUE IF NOT EXISTS 'dpl';

ALTER TABLE public.program_config
  ALTER COLUMN league_preferences SET DEFAULT '["mls_next", "ecnl", "ga", "nal", "dpl", "regional", "other", "unknown"]'::jsonb,
  ALTER COLUMN league_ratings SET DEFAULT '{"mls_next": 10, "ecnl": 9, "ga": 7.5, "nal": 5.5, "dpl": 5.5, "regional": 5.5, "other": 3.5, "unknown": 5}'::jsonb;

UPDATE public.program_config
SET league_preferences = '["mls_next", "ecnl", "ga", "nal", "dpl", "regional", "other", "unknown"]'::jsonb
WHERE league_preferences IS NULL;

UPDATE public.program_config
SET league_preferences = league_preferences || '["nal"]'::jsonb
WHERE league_preferences IS NOT NULL
  AND NOT (league_preferences ? 'nal');

UPDATE public.program_config
SET league_preferences = league_preferences || '["dpl"]'::jsonb
WHERE league_preferences IS NOT NULL
  AND NOT (league_preferences ? 'dpl');

UPDATE public.program_config
SET league_ratings = '{"mls_next": 10, "ecnl": 9, "ga": 7.5, "nal": 5.5, "dpl": 5.5, "regional": 5.5, "other": 3.5, "unknown": 5}'::jsonb
WHERE league_ratings IS NULL;

UPDATE public.program_config
SET league_ratings = league_ratings || '{"nal": 5.5}'::jsonb
WHERE league_ratings IS NOT NULL
  AND NOT (league_ratings ? 'nal');

UPDATE public.program_config
SET league_ratings = league_ratings || '{"dpl": 5.5}'::jsonb
WHERE league_ratings IS NOT NULL
  AND NOT (league_ratings ? 'dpl');
