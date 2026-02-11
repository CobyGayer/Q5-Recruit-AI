-- ==========================================
-- Q5 Recruit AI - Database Schema
-- ==========================================

-- Enum types
CREATE TYPE coach_status AS ENUM ('pending', 'approved', 'rejected');
CREATE TYPE processing_status AS ENUM ('pending', 'processing', 'processed', 'needs_review', 'insufficient', 'failed');
CREATE TYPE club_level AS ENUM ('mls_next', 'ecnl', 'ga', 'regional', 'other', 'unknown');
CREATE TYPE confidence_level AS ENUM ('high', 'medium', 'low');
CREATE TYPE priority_tier AS ENUM ('critical', 'high', 'medium', 'low');
CREATE TYPE flag_type AS ENUM ('interested', 'not_a_fit');

-- ==========================================
-- Programs
-- ==========================================
CREATE TABLE programs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  institution TEXT NOT NULL,
  division TEXT,
  conference TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- Coaches (extends Supabase auth.users)
-- ==========================================
CREATE TABLE coaches (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  program_id UUID REFERENCES programs(id),
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT DEFAULT 'coach' CHECK (role IN ('coach', 'admin')),
  status coach_status DEFAULT 'pending',
  api_key TEXT UNIQUE,
  onboarding_completed BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- Program Configuration
-- ==========================================
CREATE TABLE program_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  -- Section A: Minimum Thresholds
  min_gpa DECIMAL(3,2),
  min_sat INTEGER,
  min_act INTEGER,
  min_height_by_position JSONB DEFAULT '{}',
  accepted_grad_years INTEGER[] DEFAULT '{}',
  accepted_positions TEXT[] DEFAULT '{}',
  -- Section B: Priority Weights (tier system)
  weight_academic priority_tier DEFAULT 'medium',
  weight_competition priority_tier DEFAULT 'medium',
  weight_physical priority_tier DEFAULT 'medium',
  weight_position_fit priority_tier DEFAULT 'medium',
  weight_grad_year priority_tier DEFAULT 'medium',
  weight_completeness priority_tier DEFAULT 'low',
  -- Section C: Roster Context
  high_need_positions JSONB DEFAULT '[]',
  priority_grad_years JSONB DEFAULT '[]',
  roster_spots JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id)
);

-- ==========================================
-- Ingested Emails
-- ==========================================
CREATE TABLE ingested_emails (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  recruit_id UUID,
  sender_email TEXT,
  sender_name TEXT,
  subject TEXT,
  body_plain TEXT,
  body_html TEXT,
  received_at TIMESTAMPTZ,
  attachments JSONB DEFAULT '[]',
  processing_status processing_status DEFAULT 'pending',
  extracted_data JSONB,
  extraction_error TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- Recruits (independent copies per coach)
-- ==========================================
CREATE TABLE recruits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  email TEXT,
  full_name TEXT,
  phone TEXT,
  graduation_year INTEGER,
  current_school TEXT,
  city TEXT,
  state TEXT,
  country TEXT DEFAULT 'USA',
  positions TEXT[] DEFAULT '{}',
  preferred_foot TEXT,
  height_inches INTEGER,
  weight_lbs INTEGER,
  gpa DECIMAL(3,2),
  sat_score INTEGER,
  act_score INTEGER,
  club_team TEXT,
  club_level club_level DEFAULT 'unknown',
  high_school_team TEXT,
  video_url TEXT,
  extraction_confidence JSONB DEFAULT '{}',
  fields_missing TEXT[] DEFAULT '{}',
  fields_extracted INTEGER DEFAULT 0,
  fields_total INTEGER DEFAULT 16,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id, email)
);

-- ==========================================
-- DQS Scores
-- ==========================================
CREATE TABLE recruit_dqs_scores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE UNIQUE,
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  overall_score DECIMAL(5,2),
  is_qualified BOOLEAN DEFAULT true,
  disqualification_reasons TEXT[] DEFAULT '{}',
  academic_score DECIMAL(5,2),
  competition_score DECIMAL(5,2),
  physical_score DECIMAL(5,2),
  position_fit_score DECIMAL(5,2),
  grad_year_score DECIMAL(5,2),
  completeness_score DECIMAL(5,2),
  bonus_points DECIMAL(5,2) DEFAULT 0,
  completeness_penalty DECIMAL(5,2) DEFAULT 0,
  score_breakdown JSONB DEFAULT '{}',
  calculated_at TIMESTAMPTZ DEFAULT now()
);

-- ==========================================
-- Coach-Recruit Flags
-- ==========================================
CREATE TABLE coach_recruit_flags (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  flag flag_type NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(coach_id, recruit_id)
);

-- ==========================================
-- Indexes
-- ==========================================
CREATE INDEX idx_recruits_coach ON recruits(coach_id);
CREATE INDEX idx_recruits_email ON recruits(email);
CREATE INDEX idx_recruits_positions ON recruits USING GIN(positions);
CREATE INDEX idx_recruits_grad_year ON recruits(graduation_year);
CREATE INDEX idx_ingested_emails_coach ON ingested_emails(coach_id);
CREATE INDEX idx_ingested_emails_status ON ingested_emails(processing_status);
CREATE INDEX idx_dqs_scores_coach ON recruit_dqs_scores(coach_id);
CREATE INDEX idx_dqs_scores_overall ON recruit_dqs_scores(overall_score DESC);
CREATE INDEX idx_flags_coach ON coach_recruit_flags(coach_id);

-- ==========================================
-- Row Level Security
-- ==========================================

-- Coaches table: coaches can read their own row
ALTER TABLE coaches ENABLE ROW LEVEL SECURITY;
CREATE POLICY coaches_own_read ON coaches FOR SELECT USING (id = auth.uid());
CREATE POLICY coaches_own_update ON coaches FOR UPDATE USING (id = auth.uid());

-- Program config: coaches can manage their own config
ALTER TABLE program_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY config_own_access ON program_config FOR ALL USING (coach_id = auth.uid());

-- Recruits: coaches can only see their own recruits
ALTER TABLE recruits ENABLE ROW LEVEL SECURITY;
CREATE POLICY recruits_coach_isolation ON recruits FOR ALL USING (coach_id = auth.uid());

-- Ingested emails: coaches can only see their own emails
ALTER TABLE ingested_emails ENABLE ROW LEVEL SECURITY;
CREATE POLICY emails_coach_isolation ON ingested_emails FOR ALL USING (coach_id = auth.uid());

-- DQS scores: coaches can only see their own scores
ALTER TABLE recruit_dqs_scores ENABLE ROW LEVEL SECURITY;
CREATE POLICY scores_coach_isolation ON recruit_dqs_scores FOR ALL USING (coach_id = auth.uid());

-- Flags: coaches can manage their own flags
ALTER TABLE coach_recruit_flags ENABLE ROW LEVEL SECURITY;
CREATE POLICY flags_coach_isolation ON coach_recruit_flags FOR ALL USING (coach_id = auth.uid());

-- Programs: readable by all authenticated users
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;
CREATE POLICY programs_read ON programs FOR SELECT USING (auth.role() = 'authenticated');

-- ==========================================
-- Auto-update timestamp trigger
-- ==========================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER coaches_updated_at BEFORE UPDATE ON coaches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER program_config_updated_at BEFORE UPDATE ON program_config
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER recruits_updated_at BEFORE UPDATE ON recruits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
CREATE TRIGGER programs_updated_at BEFORE UPDATE ON programs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ==========================================
-- Auto-create coach row on signup
-- ==========================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.coaches (id, email, full_name, status)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', ''),
    'pending'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ==========================================
-- Seed data: Amherst College program
-- ==========================================
INSERT INTO programs (name, institution, division, conference)
VALUES ('Amherst College Men''s Soccer', 'Amherst College', 'D3', 'NESCAC');
