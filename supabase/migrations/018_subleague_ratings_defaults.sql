-- Normalize division defaults and remove divisions from league preference selections
ALTER TABLE public.program_config
  ALTER COLUMN league_preferences SET DEFAULT '["mls_next", "ecnl", "ga", "nal", "dpl", "other", "unknown"]'::jsonb,
  ALTER COLUMN league_ratings SET DEFAULT '{"mls_next": 10, "mls_next_homegrown": 10, "mls_next_academy": 9, "ecnl": 9, "ecrl": 8.5, "ga": 7.5, "ga_aspire": 7, "nal": 5.5, "dpl": 5.5, "other": 3.5, "unknown": 5}'::jsonb;

UPDATE public.program_config
SET league_preferences = '["mls_next", "ecnl", "ga", "nal", "dpl", "other", "unknown"]'::jsonb
WHERE league_preferences IS NULL;

UPDATE public.program_config
SET league_preferences = (
  SELECT COALESCE(jsonb_agg(value), '[]'::jsonb)
  FROM jsonb_array_elements_text(league_preferences) AS value
  WHERE value NOT IN ('mls_next_homegrown', 'mls_next_academy', 'ga_aspire', 'ecrl')
)
WHERE league_preferences ? 'mls_next_homegrown'
   OR league_preferences ? 'mls_next_academy'
   OR league_preferences ? 'ga_aspire'
   OR league_preferences ? 'ecrl';

UPDATE public.program_config
SET league_ratings = '{"mls_next": 10, "mls_next_homegrown": 10, "mls_next_academy": 9, "ecnl": 9, "ecrl": 8.5, "ga": 7.5, "ga_aspire": 7, "nal": 5.5, "dpl": 5.5, "other": 3.5, "unknown": 5}'::jsonb
WHERE league_ratings IS NULL;

UPDATE public.program_config
SET league_ratings = league_ratings || '{"mls_next_homegrown": 10}'::jsonb
WHERE league_ratings IS NOT NULL
  AND NOT (league_ratings ? 'mls_next_homegrown');

UPDATE public.program_config
SET league_ratings = league_ratings || '{"mls_next_academy": 9}'::jsonb
WHERE league_ratings IS NOT NULL
  AND NOT (league_ratings ? 'mls_next_academy');

UPDATE public.program_config
SET league_ratings = league_ratings || '{"ga_aspire": 7}'::jsonb
WHERE league_ratings IS NOT NULL
  AND NOT (league_ratings ? 'ga_aspire');

UPDATE public.program_config
SET league_ratings = league_ratings || '{"ecrl": 8.5}'::jsonb
WHERE league_ratings IS NOT NULL
  AND NOT (league_ratings ? 'ecrl');
