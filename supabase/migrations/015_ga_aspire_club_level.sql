-- Add GA Aspire as a distinct club_level value
ALTER TYPE club_level ADD VALUE IF NOT EXISTS 'ga_aspire';
ALTER TYPE club_level ADD VALUE IF NOT EXISTS 'ecrl';
ALTER TYPE club_level ADD VALUE IF NOT EXISTS 'mls_next_homegrown';
ALTER TYPE club_level ADD VALUE IF NOT EXISTS 'mls_next_academy';
