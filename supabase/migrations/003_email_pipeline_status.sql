-- Add email pipeline status tracking to coaches table
-- Admin manages Zapier/Gmail setup for each coach

CREATE TYPE email_pipeline_status AS ENUM ('not_started', 'pending_setup', 'active');

ALTER TABLE coaches
  ADD COLUMN email_pipeline_status email_pipeline_status DEFAULT 'not_started';

-- Backfill existing data
UPDATE coaches SET email_pipeline_status = 'active' WHERE api_key IS NOT NULL;
UPDATE coaches SET email_pipeline_status = 'pending_setup'
  WHERE api_key IS NULL AND onboarding_completed = true AND status = 'approved';
