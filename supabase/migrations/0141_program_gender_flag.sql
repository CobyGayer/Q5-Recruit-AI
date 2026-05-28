-- ==========================================
-- Add gender flag to programs table
-- ==========================================

-- Add is_boys_team boolean column to programs table
-- Default to true (boys) as a safe default for backward compatibility
ALTER TABLE programs
ADD COLUMN is_boys_team BOOLEAN DEFAULT true;

-- Add a comment explaining the field
COMMENT ON COLUMN programs.is_boys_team IS 'true = boys team, false = girls team; controls which club directory list is used for lookups';
