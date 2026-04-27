CREATE TABLE IF NOT EXISTS public.transcript_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id UUID NOT NULL REFERENCES public.recruits(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES public.coaches(id) ON DELETE CASCADE,
  email_id UUID REFERENCES public.ingested_emails(id),
  rigor_grade TEXT NOT NULL,
  rigor_score DECIMAL(5,2),
  confidence confidence_level DEFAULT 'medium',
  transcript_readable BOOLEAN DEFAULT true,
  honors_ap_ib_count INTEGER DEFAULT 0,
  total_academic_courses INTEGER DEFAULT 0,
  rigor_ratio DECIMAL(3,2) DEFAULT 0,
  strongest_subjects TEXT[] DEFAULT '{}',
  weakest_subjects TEXT[] DEFAULT '{}',
  notable_courses TEXT[] DEFAULT '{}',
  grade_trend TEXT CHECK (grade_trend IN ('improving', 'declining', 'stable', 'inconsistent')),
  freshman_gpa_estimate DECIMAL(3,2),
  senior_gpa_estimate DECIMAL(3,2),
  grade_trend_notes TEXT,
  red_flags TEXT[] DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  schedule_assessment TEXT,
  admissions_notes TEXT,
  cumulative_gpa_from_transcript DECIMAL(3,2),
  raw_analysis JSONB DEFAULT '{}',
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recruit_id)
);

ALTER TABLE public.transcript_analyses ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'transcript_analyses'
      AND policyname = 'transcript_coach_isolation'
  ) THEN
    CREATE POLICY transcript_coach_isolation ON public.transcript_analyses
      FOR ALL USING (coach_id = auth.uid());
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transcript_recruit ON public.transcript_analyses(recruit_id);
CREATE INDEX IF NOT EXISTS idx_transcript_coach ON public.transcript_analyses(coach_id);


INSERT INTO transcript_analyses (
  recruit_id,
  coach_id,
  rigor_grade,
  rigor_score,
  confidence,
  transcript_readable,
  honors_ap_ib_count,
  total_academic_courses,
  rigor_ratio,
  strongest_subjects,
  weakest_subjects,
  notable_courses,
  grade_trend,
  freshman_gpa_estimate,
  senior_gpa_estimate,
  grade_trend_notes,
  red_flags,
  strengths,
  schedule_assessment,
  admissions_notes,
  cumulative_gpa_from_transcript,
  raw_analysis
) VALUES (
  '332c6ccc-7d8a-49d0-8e05-22cb7d9675f5',
  '89451e92-1975-414d-85ec-b758fde2a6a4',
  'A-',
  88.5,
  'high',
  true,
  4,
  16,
  0.25,
  ARRAY['Mathematics', 'Physics'],
  ARRAY['Languages'],
  ARRAY['Calculus BC', 'AP Physics C'],
  'improving',
  3.70,
  3.92,
  'Strong upward trend across junior and senior year.',
  ARRAY[]::text[],
  ARRAY['Strong STEM rigor', 'Consistent performance'],
  'Balanced schedule with several advanced academic courses.',
  'Prepared for college-level academics.',
  3.84,
  '{"source":"manual_test","notes":"faux transcript analysis"}'::jsonb
);