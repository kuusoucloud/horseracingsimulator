-- Fix race_state table issues

-- Drop existing policies
DROP POLICY IF EXISTS "Allow read access to race state" ON race_state;
DROP POLICY IF EXISTS "Allow update access to race state" ON race_state;
DROP POLICY IF EXISTS "Allow insert access to race state" ON race_state;

-- Disable RLS temporarily for debugging
ALTER TABLE race_state DISABLE ROW LEVEL SECURITY;

-- Add DELETE policy for cleanup
CREATE POLICY "Allow all operations on race state" ON race_state
  FOR ALL USING (true) WITH CHECK (true);

-- Re-enable RLS
ALTER TABLE race_state ENABLE ROW LEVEL SECURITY;

-- Clear existing data and ensure we have a clean state
DELETE FROM race_state;

-- Insert a single initial race state with proper structure
INSERT INTO race_state (
  id,
  race_state, 
  horses, 
  race_progress, 
  pre_race_timer, 
  race_results,
  timer_owner
) VALUES (
  '00000000-0000-0000-0000-000000000001',
  'pre-race',
  '[]'::jsonb,
  '{}'::jsonb,
  10,
  '[]'::jsonb,
  NULL
);