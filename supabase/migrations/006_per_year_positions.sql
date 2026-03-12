-- Migration: Convert high_need_positions from flat array to per-year record
-- Old format: [{ "position": "GK", "rank": 1 }, ...]
-- New format: { "2027": [{ "position": "GK", "rank": 1 }], ... }
--
-- Reset to empty object for coaches with old array format.
-- Coaches will reconfigure their per-year position needs via the UI.

UPDATE program_config
SET high_need_positions = '{}'::jsonb
WHERE jsonb_typeof(high_need_positions) = 'array';
