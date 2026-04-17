-- Add count_in_stats column to projects table
-- Default TRUE: existing Client projects are unaffected
-- Internal projects default to FALSE (excluded from stats)
ALTER TABLE projects ADD COLUMN IF NOT EXISTS count_in_stats BOOLEAN DEFAULT TRUE;
UPDATE projects SET count_in_stats = FALSE WHERE type = 'Internal';
