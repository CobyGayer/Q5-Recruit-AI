-- Migration: Add transcript analysis support
-- Stores AI-generated holistic transcript assessments (course rigor, grade trends, red flags)
-- Rigor grade (A+ through D) subtly modifies the existing Academic DQS component

CREATE TABLE transcript_analyses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  email_id UUID REFERENCES ingested_emails(id),
  -- Rigor grade & score
  rigor_grade TEXT NOT NULL,  -- 'A+','A','A-','B+','B','B-','C+','C','C-','D'
  rigor_score DECIMAL(5,2),   -- 0-100 internal score (maps to grade, used as Academic modifier)
  confidence confidence_level DEFAULT 'medium',
  transcript_readable BOOLEAN DEFAULT true,
  -- Course analysis
  honors_ap_ib_count INTEGER DEFAULT 0,
  total_academic_courses INTEGER DEFAULT 0,
  rigor_ratio DECIMAL(3,2) DEFAULT 0,
  strongest_subjects TEXT[] DEFAULT '{}',
  weakest_subjects TEXT[] DEFAULT '{}',
  notable_courses TEXT[] DEFAULT '{}',
  -- Grade trends
  grade_trend TEXT CHECK (grade_trend IN ('improving', 'declining', 'stable', 'inconsistent')),
  freshman_gpa_estimate DECIMAL(3,2),
  senior_gpa_estimate DECIMAL(3,2),
  grade_trend_notes TEXT,
  -- Qualitative
  red_flags TEXT[] DEFAULT '{}',
  strengths TEXT[] DEFAULT '{}',
  schedule_assessment TEXT,
  admissions_notes TEXT,
  cumulative_gpa_from_transcript DECIMAL(3,2),
  -- Raw analysis JSON for debugging
  raw_analysis JSONB DEFAULT '{}',
  analyzed_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(recruit_id)
);

-- RLS: coaches can only see their own transcript analyses
ALTER TABLE transcript_analyses ENABLE ROW LEVEL SECURITY;
CREATE POLICY transcript_coach_isolation ON transcript_analyses
  FOR ALL USING (coach_id = auth.uid());

-- Indexes for common lookups
CREATE INDEX idx_transcript_recruit ON transcript_analyses(recruit_id);
CREATE INDEX idx_transcript_coach ON transcript_analyses(coach_id);
