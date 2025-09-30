-- Create race_state table for synchronized racing
CREATE TABLE race_state (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  race_state TEXT NOT NULL DEFAULT 'pre-race',
  horses JSONB NOT NULL DEFAULT '[]',
  race_progress JSONB NOT NULL DEFAULT '{}',
  pre_race_timer INTEGER NOT NULL DEFAULT 10,
  race_results JSONB NOT NULL DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE race_state ENABLE ROW LEVEL SECURITY;

-- Allow all users to read race state
CREATE POLICY "Allow read access to race state" ON race_state
  FOR SELECT USING (true);

-- Allow all users to update race state (for demo purposes)
CREATE POLICY "Allow update access to race state" ON race_state
  FOR UPDATE USING (true);

-- Allow all users to insert race state
CREATE POLICY "Allow insert access to race state" ON race_state
  FOR INSERT WITH CHECK (true);

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at
CREATE TRIGGER update_race_state_updated_at 
  BEFORE UPDATE ON race_state 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Insert initial race state
INSERT INTO race_state (race_state, horses, race_progress, pre_race_timer, race_results)
VALUES ('pre-race', '[]', '{}', 10, '[]');