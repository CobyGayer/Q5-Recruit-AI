-- Make the preferred-foot and preferred-height fit boosts coach-configurable.
-- Defaults match the prior hardcoded magnitudes (+2 foot, +3 height).

ALTER TABLE public.program_config
  ADD COLUMN IF NOT EXISTS boost_preferred_foot INTEGER NOT NULL DEFAULT 2,
  ADD COLUMN IF NOT EXISTS boost_preferred_height INTEGER NOT NULL DEFAULT 3;
