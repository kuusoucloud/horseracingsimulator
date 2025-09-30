-- Add columns for server-managed UI states
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS show_photo_finish BOOLEAN DEFAULT FALSE;
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS show_results BOOLEAN DEFAULT FALSE;
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS photo_finish_results JSONB DEFAULT '[]';