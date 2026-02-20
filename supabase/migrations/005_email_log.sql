-- ==========================================
-- Email Log — tracks outreach emails sent via compose links
-- ==========================================

CREATE TABLE email_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  coach_id UUID NOT NULL REFERENCES coaches(id) ON DELETE CASCADE,
  recruit_id UUID NOT NULL REFERENCES recruits(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  body TEXT NOT NULL,
  method TEXT NOT NULL CHECK (method IN ('gmail', 'outlook', 'mailto', 'clipboard')),
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_email_log_coach ON email_log(coach_id);
CREATE INDEX idx_email_log_recruit ON email_log(recruit_id);

-- RLS: coaches can only see and create their own log entries
ALTER TABLE email_log ENABLE ROW LEVEL SECURITY;
CREATE POLICY email_log_coach_isolation ON email_log FOR ALL USING (coach_id = auth.uid());
