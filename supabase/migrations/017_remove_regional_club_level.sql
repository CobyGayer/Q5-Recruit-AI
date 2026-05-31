-- Remove regional club level and remap existing data to unknown
UPDATE public.recruits
SET club_level = 'unknown'
WHERE club_level = 'regional';

UPDATE public.program_config
SET league_preferences = (
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  FROM jsonb_array_elements_text(league_preferences) AS value
  WHERE value <> 'regional'
)
WHERE league_preferences ? 'regional';

UPDATE public.program_config
SET league_ratings = league_ratings - 'regional'
WHERE league_ratings ? 'regional';

ALTER TABLE public.program_config
  ALTER COLUMN league_preferences SET DEFAULT '["mls_next", "ecnl", "ga", "nal", "dpl", "other", "unknown"]'::jsonb,
  ALTER COLUMN league_ratings SET DEFAULT '{"mls_next": 10, "ecnl": 9, "ga": 7.5, "nal": 5.5, "dpl": 5.5, "other": 3.5, "unknown": 5}'::jsonb;

ALTER TYPE club_level RENAME TO club_level_old;

CREATE TYPE club_level AS ENUM (
  'mls_next',
  'mls_next_homegrown',
  'mls_next_academy',
  'ecnl',
  'ecrl',
  'ga',
  'ga_aspire',
  'nal',
  'dpl',
  'other',
  'unknown'
);

ALTER TABLE public.recruits
  ALTER COLUMN club_level TYPE club_level USING club_level::text::club_level,
  ALTER COLUMN club_level SET DEFAULT 'unknown';

DROP TYPE club_level_old;
