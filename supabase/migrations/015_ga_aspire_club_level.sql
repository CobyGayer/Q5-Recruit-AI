-- Add GA Aspire as a distinct club_level value
ALTER TYPE club_level ADD VALUE IF NOT EXISTS 'ga_aspire';
