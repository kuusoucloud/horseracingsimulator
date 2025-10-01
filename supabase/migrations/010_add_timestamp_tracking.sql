-- Add timestamp tracking for real-time timer synchronization
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS last_update_time TIMESTAMPTZ DEFAULT NOW();