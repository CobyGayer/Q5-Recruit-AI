-- Add AI-generated scouting summary to DQS scores
-- Generated alongside DQS calculation, references actual scoring inputs
ALTER TABLE recruit_dqs_scores
  ADD COLUMN ai_summary TEXT;
