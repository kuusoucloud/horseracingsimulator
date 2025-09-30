-- Add columns for server-side race simulation
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS horses JSONB DEFAULT '[]';
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS race_progress JSONB DEFAULT '{}';
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS race_results JSONB DEFAULT '[]';

-- Enable realtime for race_progress updates
ALTER PUBLICATION supabase_realtime ADD TABLE race_state;