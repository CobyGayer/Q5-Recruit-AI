-- ==========================================
-- Migration: Domain-based shared university workspace
-- ==========================================

-- 1) Utility: derive normalized email domain.
CREATE OR REPLACE FUNCTION public.email_domain(input_email TEXT)
RETURNS TEXT AS $$
  SELECT lower(split_part(coalesce(input_email, ''), '@', 2));
$$ LANGUAGE sql IMMUTABLE;

-- 2) Merge coaches by domain into one shared program/workspace.
WITH ranked_domains AS (
  SELECT
    public.email_domain(c.email) AS domain,
    c.program_id,
    row_number() OVER (
      PARTITION BY public.email_domain(c.email)
      ORDER BY
        CASE WHEN c.status = 'approved' THEN 0 ELSE 1 END,
        c.created_at ASC
    ) AS rn
  FROM public.coaches c
  WHERE c.program_id IS NOT NULL
), domain_program AS (
  SELECT domain, program_id
  FROM ranked_domains
  WHERE rn = 1
)
UPDATE public.coaches c
SET program_id = dp.program_id
FROM domain_program dp
WHERE public.email_domain(c.email) = dp.domain
  AND dp.program_id IS NOT NULL;

-- Create a fallback program for any remaining domain without an assigned program.
WITH missing_domains AS (
  SELECT DISTINCT public.email_domain(c.email) AS domain
  FROM public.coaches c
  WHERE c.program_id IS NULL
    AND public.email_domain(c.email) <> ''
), inserted AS (
  INSERT INTO public.programs (name, institution)
  SELECT
    initcap(replace(split_part(md.domain, '.', 1), '-', ' ')) || ' Program',
    md.domain
  FROM missing_domains md
  RETURNING id, institution
)
UPDATE public.coaches c
SET program_id = i.id
FROM inserted i
WHERE public.email_domain(c.email) = i.institution
  AND c.program_id IS NULL;

-- 3) Convert program_config to workspace-level config.
ALTER TABLE public.program_config
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

UPDATE public.program_config pc
SET program_id = c.program_id
FROM public.coaches c
WHERE c.id = pc.coach_id
  AND pc.program_id IS NULL;

-- Keep first approved coach's config, then oldest created config per program.
WITH ranked AS (
  SELECT
    pc.id,
    row_number() OVER (
      PARTITION BY pc.program_id
      ORDER BY
        CASE WHEN c.status = 'approved' THEN 0 ELSE 1 END,
        pc.created_at ASC
    ) AS rn
  FROM public.program_config pc
  JOIN public.coaches c ON c.id = pc.coach_id
  WHERE pc.program_id IS NOT NULL
)
DELETE FROM public.program_config pc
USING ranked r
WHERE pc.id = r.id
  AND r.rn > 1;

ALTER TABLE public.program_config
  ALTER COLUMN program_id SET NOT NULL;

ALTER TABLE public.program_config
  DROP CONSTRAINT IF EXISTS program_config_coach_id_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_program_config_program_unique
  ON public.program_config(program_id);

-- 4) Add workspace key to shared operational tables.
ALTER TABLE public.recruits
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

ALTER TABLE public.ingested_emails
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

ALTER TABLE public.recruit_dqs_scores
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

ALTER TABLE public.coach_recruit_flags
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE;

UPDATE public.recruits r
SET program_id = c.program_id
FROM public.coaches c
WHERE c.id = r.coach_id
  AND r.program_id IS NULL;

UPDATE public.ingested_emails e
SET program_id = c.program_id
FROM public.coaches c
WHERE c.id = e.coach_id
  AND e.program_id IS NULL;

UPDATE public.recruit_dqs_scores s
SET program_id = c.program_id
FROM public.coaches c
WHERE c.id = s.coach_id
  AND s.program_id IS NULL;

UPDATE public.coach_recruit_flags f
SET program_id = r.program_id
FROM public.recruits r
WHERE r.id = f.recruit_id
  AND f.program_id IS NULL;

ALTER TABLE public.recruits
  ALTER COLUMN program_id SET NOT NULL;

ALTER TABLE public.ingested_emails
  ALTER COLUMN program_id SET NOT NULL;

ALTER TABLE public.recruit_dqs_scores
  ALTER COLUMN program_id SET NOT NULL;

ALTER TABLE public.coach_recruit_flags
  ALTER COLUMN program_id SET NOT NULL;

ALTER TABLE public.coach_recruit_flags
  DROP CONSTRAINT IF EXISTS coach_recruit_flags_coach_id_recruit_id_key;

-- 5) Dedupe recruits per program + email (keep most recently updated).
WITH ranked AS (
  SELECT
    r.id,
    first_value(r.id) OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS rn
  FROM public.recruits r
  WHERE r.program_id IS NOT NULL
    AND r.email IS NOT NULL
), losers AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
)
INSERT INTO public.recruit_dqs_scores (
  recruit_id,
  coach_id,
  program_id,
  overall_score,
  is_qualified,
  disqualification_reasons,
  academic_score,
  competition_score,
  physical_score,
  position_fit_score,
  grad_year_score,
  completeness_score,
  bonus_points,
  completeness_penalty,
  score_breakdown,
  ai_summary,
  calculated_at
)
SELECT
  l.keep_id,
  s.coach_id,
  s.program_id,
  s.overall_score,
  s.is_qualified,
  s.disqualification_reasons,
  s.academic_score,
  s.competition_score,
  s.physical_score,
  s.position_fit_score,
  s.grad_year_score,
  s.completeness_score,
  s.bonus_points,
  s.completeness_penalty,
  s.score_breakdown,
  s.ai_summary,
  s.calculated_at
FROM losers l
JOIN public.recruit_dqs_scores s ON s.recruit_id = l.id
ON CONFLICT (recruit_id) DO UPDATE
SET
  coach_id = EXCLUDED.coach_id,
  program_id = EXCLUDED.program_id,
  overall_score = EXCLUDED.overall_score,
  is_qualified = EXCLUDED.is_qualified,
  disqualification_reasons = EXCLUDED.disqualification_reasons,
  academic_score = EXCLUDED.academic_score,
  competition_score = EXCLUDED.competition_score,
  physical_score = EXCLUDED.physical_score,
  position_fit_score = EXCLUDED.position_fit_score,
  grad_year_score = EXCLUDED.grad_year_score,
  completeness_score = EXCLUDED.completeness_score,
  bonus_points = EXCLUDED.bonus_points,
  completeness_penalty = EXCLUDED.completeness_penalty,
  score_breakdown = EXCLUDED.score_breakdown,
  ai_summary = EXCLUDED.ai_summary,
  calculated_at = GREATEST(public.recruit_dqs_scores.calculated_at, EXCLUDED.calculated_at);

WITH ranked AS (
  SELECT
    r.id,
    first_value(r.id) OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS rn
  FROM public.recruits r
  WHERE r.program_id IS NOT NULL
    AND r.email IS NOT NULL
), losers AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.ingested_emails e
SET recruit_id = l.keep_id
FROM losers l
WHERE e.recruit_id = l.id;

WITH ranked AS (
  SELECT
    r.id,
    first_value(r.id) OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS rn
  FROM public.recruits r
  WHERE r.program_id IS NOT NULL
    AND r.email IS NOT NULL
), losers AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.coach_recruit_flags f
SET recruit_id = l.keep_id
FROM losers l
WHERE f.recruit_id = l.id;

WITH ranked AS (
  SELECT
    r.id,
    first_value(r.id) OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS rn
  FROM public.recruits r
  WHERE r.program_id IS NOT NULL
    AND r.email IS NOT NULL
), losers AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
)
UPDATE public.email_log el
SET recruit_id = l.keep_id
FROM losers l
WHERE el.recruit_id = l.id;

WITH ranked AS (
  SELECT
    r.id,
    first_value(r.id) OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS keep_id,
    row_number() OVER (
      PARTITION BY r.program_id, lower(r.email)
      ORDER BY r.updated_at DESC NULLS LAST, r.created_at DESC
    ) AS rn
  FROM public.recruits r
  WHERE r.program_id IS NOT NULL
    AND r.email IS NOT NULL
), losers AS (
  SELECT id, keep_id
  FROM ranked
  WHERE rn > 1
)
DELETE FROM public.recruits r
USING losers l
WHERE r.id = l.id;

ALTER TABLE public.recruits
  DROP CONSTRAINT IF EXISTS recruits_coach_id_email_key;

CREATE UNIQUE INDEX IF NOT EXISTS idx_recruits_program_email_unique
  ON public.recruits(program_id, email)
  WHERE email IS NOT NULL;

-- Keep one shared flag per recruit in each workspace, preferring the most recent.
WITH ranked_flags AS (
  SELECT
    f.id,
    row_number() OVER (
      PARTITION BY f.program_id, f.recruit_id
      ORDER BY f.created_at DESC, f.id DESC
    ) AS rn
  FROM public.coach_recruit_flags f
)
DELETE FROM public.coach_recruit_flags f
USING ranked_flags rf
WHERE f.id = rf.id
  AND rf.rn > 1;

CREATE UNIQUE INDEX IF NOT EXISTS idx_flags_program_recruit_unique
  ON public.coach_recruit_flags(program_id, recruit_id);

CREATE INDEX IF NOT EXISTS idx_recruits_program_id
  ON public.recruits(program_id);

CREATE INDEX IF NOT EXISTS idx_ingested_emails_program_id
  ON public.ingested_emails(program_id);

CREATE INDEX IF NOT EXISTS idx_recruit_scores_program_id
  ON public.recruit_dqs_scores(program_id);

CREATE INDEX IF NOT EXISTS idx_flags_program_id
  ON public.coach_recruit_flags(program_id);

-- 6) Replace coach-isolated RLS with workspace-scoped RLS.
DROP POLICY IF EXISTS config_own_access ON public.program_config;
CREATE POLICY config_program_isolation ON public.program_config
FOR ALL USING (
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

DROP POLICY IF EXISTS recruits_coach_isolation ON public.recruits;
CREATE POLICY recruits_program_isolation ON public.recruits
FOR ALL USING (
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

DROP POLICY IF EXISTS emails_coach_isolation ON public.ingested_emails;
CREATE POLICY emails_program_isolation ON public.ingested_emails
FOR ALL USING (
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

DROP POLICY IF EXISTS scores_coach_isolation ON public.recruit_dqs_scores;
CREATE POLICY scores_program_isolation ON public.recruit_dqs_scores
FOR ALL USING (
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

-- Flags are workspace-shared; email logs remain coach-personal.
DROP POLICY IF EXISTS flags_coach_isolation ON public.coach_recruit_flags;
CREATE POLICY flags_program_isolation ON public.coach_recruit_flags
FOR ALL USING (
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

DROP POLICY IF EXISTS email_log_coach_isolation ON public.email_log;
CREATE POLICY email_log_coach_isolation ON public.email_log
FOR ALL USING (coach_id = auth.uid())
WITH CHECK (coach_id = auth.uid());

-- 7) Update signup trigger: auto-assign by domain and keep approval flow.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  matched_program_id UUID;
BEGIN
  SELECT c.program_id
  INTO matched_program_id
  FROM public.coaches c
  WHERE public.email_domain(c.email) = public.email_domain(NEW.email)
    AND c.program_id IS NOT NULL
  ORDER BY
    CASE WHEN c.status = 'approved' THEN 0 ELSE 1 END,
    c.created_at ASC
  LIMIT 1;

  INSERT INTO public.coaches (id, email, full_name, status, program_id)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'pending',
    matched_program_id
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;