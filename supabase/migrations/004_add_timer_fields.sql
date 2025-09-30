-- Add missing timer fields for complete race flow
ALTER TABLE race_state 
ADD COLUMN IF NOT EXISTS countdown_timer INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS race_timer INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS race_start_time TIMESTAMPTZ;