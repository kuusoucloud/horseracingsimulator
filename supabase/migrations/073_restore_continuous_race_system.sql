-- Restore automatic race system with continuous operation
-- This ensures races run constantly without requiring clients

-- Enable the http extension if not already enabled
CREATE EXTENSION IF NOT EXISTS http;

-- Create a function to invoke the race automation edge function
CREATE OR REPLACE FUNCTION invoke_race_automation() RETURNS void AS $$
DECLARE
  response TEXT;
BEGIN
  -- Call the race automation edge function
  SELECT content INTO response FROM http((
    'POST',
    'https://25783102-2d19-4c46-8b15-607b3e0a5550.supabase.co/functions/v1/race-automation',
    ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))],
    'application/json',
    '{}'
  ));
  
  RAISE NOTICE 'Race automation invoked: %', response;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Race automation error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create a function to invoke the high-frequency tick edge function
CREATE OR REPLACE FUNCTION invoke_high_frequency_tick() RETURNS void AS $$
DECLARE
  response TEXT;
BEGIN
  -- Call the high-frequency tick edge function
  SELECT content INTO response FROM http((
    'POST',
    'https://25783102-2d19-4c46-8b15-607b3e0a5550.supabase.co/functions/v1/high-frequency-tick',
    ARRAY[http_header('Authorization', 'Bearer ' || current_setting('app.settings.service_role_key', true))],
    'application/json',
    '{}'
  ));
  
  RAISE NOTICE 'High-frequency tick invoked: %', response;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'High-frequency tick error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function that runs race automation on any race_state change
CREATE OR REPLACE FUNCTION trigger_race_automation() RETURNS trigger AS $$
BEGIN
  -- Invoke race automation whenever race state changes
  PERFORM invoke_race_automation();
  
  -- Also invoke high-frequency tick for racing states
  IF NEW.race_state = 'racing' THEN
    PERFORM invoke_high_frequency_tick();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically run race automation
DROP TRIGGER IF EXISTS race_state_automation_trigger ON race_state;
CREATE TRIGGER race_state_automation_trigger
  AFTER INSERT OR UPDATE ON race_state
  FOR EACH ROW
  EXECUTE FUNCTION trigger_race_automation();

-- Create a periodic job to ensure races keep running (fallback)
CREATE OR REPLACE FUNCTION ensure_race_running() RETURNS void AS $$
DECLARE
  race_count INTEGER;
BEGIN
  -- Check if there's any active race
  SELECT COUNT(*) INTO race_count
  FROM race_state
  WHERE race_state IN ('pre-race', 'countdown', 'racing')
  AND created_at > NOW() - INTERVAL '5 minutes';
  
  -- If no active race, start a new one
  IF race_count = 0 THEN
    RAISE NOTICE 'No active race found, starting new race';
    PERFORM start_new_race();
  END IF;
  
  -- Always invoke race automation to keep things moving
  PERFORM invoke_race_automation();
END;
$$ LANGUAGE plpgsql;