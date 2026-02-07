-- ==========================================
-- Migration: Convert priority weights from
-- tier enum to numeric sliders (0-100)
-- ==========================================

-- Step 1: Add temporary INTEGER columns
ALTER TABLE program_config
  ADD COLUMN weight_academic_num INTEGER,
  ADD COLUMN weight_competition_num INTEGER,
  ADD COLUMN weight_physical_num INTEGER,
  ADD COLUMN weight_position_fit_num INTEGER,
  ADD COLUMN weight_grad_year_num INTEGER,
  ADD COLUMN weight_completeness_num INTEGER;

-- Step 2: Migrate existing tier data to numeric values
-- Mapping: critical=80, high=60, medium=40, low=20
-- This preserves the exact 4:3:2:1 ratio so DQS scores remain unchanged.
UPDATE program_config SET
  weight_academic_num = CASE weight_academic
    WHEN 'critical' THEN 80 WHEN 'high' THEN 60
    WHEN 'medium' THEN 40 WHEN 'low' THEN 20 END,
  weight_competition_num = CASE weight_competition
    WHEN 'critical' THEN 80 WHEN 'high' THEN 60
    WHEN 'medium' THEN 40 WHEN 'low' THEN 20 END,
  weight_physical_num = CASE weight_physical
    WHEN 'critical' THEN 80 WHEN 'high' THEN 60
    WHEN 'medium' THEN 40 WHEN 'low' THEN 20 END,
  weight_position_fit_num = CASE weight_position_fit
    WHEN 'critical' THEN 80 WHEN 'high' THEN 60
    WHEN 'medium' THEN 40 WHEN 'low' THEN 20 END,
  weight_grad_year_num = CASE weight_grad_year
    WHEN 'critical' THEN 80 WHEN 'high' THEN 60
    WHEN 'medium' THEN 40 WHEN 'low' THEN 20 END,
  weight_completeness_num = CASE weight_completeness
    WHEN 'critical' THEN 80 WHEN 'high' THEN 60
    WHEN 'medium' THEN 40 WHEN 'low' THEN 20 END;

-- Step 3: Drop old enum columns
ALTER TABLE program_config
  DROP COLUMN weight_academic,
  DROP COLUMN weight_competition,
  DROP COLUMN weight_physical,
  DROP COLUMN weight_position_fit,
  DROP COLUMN weight_grad_year,
  DROP COLUMN weight_completeness;

-- Step 4: Rename new columns to original names
ALTER TABLE program_config RENAME COLUMN weight_academic_num TO weight_academic;
ALTER TABLE program_config RENAME COLUMN weight_competition_num TO weight_competition;
ALTER TABLE program_config RENAME COLUMN weight_physical_num TO weight_physical;
ALTER TABLE program_config RENAME COLUMN weight_position_fit_num TO weight_position_fit;
ALTER TABLE program_config RENAME COLUMN weight_grad_year_num TO weight_grad_year;
ALTER TABLE program_config RENAME COLUMN weight_completeness_num TO weight_completeness;

-- Step 5: Set NOT NULL constraints and defaults for new coaches
ALTER TABLE program_config
  ALTER COLUMN weight_academic SET DEFAULT 70,
  ALTER COLUMN weight_academic SET NOT NULL,
  ALTER COLUMN weight_competition SET DEFAULT 70,
  ALTER COLUMN weight_competition SET NOT NULL,
  ALTER COLUMN weight_physical SET DEFAULT 50,
  ALTER COLUMN weight_physical SET NOT NULL,
  ALTER COLUMN weight_position_fit SET DEFAULT 80,
  ALTER COLUMN weight_position_fit SET NOT NULL,
  ALTER COLUMN weight_grad_year SET DEFAULT 50,
  ALTER COLUMN weight_grad_year SET NOT NULL,
  ALTER COLUMN weight_completeness SET DEFAULT 20,
  ALTER COLUMN weight_completeness SET NOT NULL;

-- Step 6: Add CHECK constraints to enforce 0-100 range
ALTER TABLE program_config
  ADD CONSTRAINT weight_academic_range CHECK (weight_academic >= 0 AND weight_academic <= 100),
  ADD CONSTRAINT weight_competition_range CHECK (weight_competition >= 0 AND weight_competition <= 100),
  ADD CONSTRAINT weight_physical_range CHECK (weight_physical >= 0 AND weight_physical <= 100),
  ADD CONSTRAINT weight_position_fit_range CHECK (weight_position_fit >= 0 AND weight_position_fit <= 100),
  ADD CONSTRAINT weight_grad_year_range CHECK (weight_grad_year >= 0 AND weight_grad_year <= 100),
  ADD CONSTRAINT weight_completeness_range CHECK (weight_completeness >= 0 AND weight_completeness <= 100);

-- Step 7: Drop the priority_tier enum type (no longer used)
DROP TYPE priority_tier;
