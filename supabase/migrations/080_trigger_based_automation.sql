-- Create server-side automation using triggers and edge functions
-- This will make races run continuously without requiring clients

-- Create a function to call the race automation edge function via HTTP
CREATE OR REPLACE FUNCTION call_race_automation() RETURNS void AS $$
DECLARE
  response TEXT;
  supabase_url TEXT := 'https://25783102-2d19-4c46-8b15-607b3e0a5550.supabase.co';
  service_key TEXT := current_setting('app.settings.service_role_key', true);
BEGIN
  -- Call the race automation edge function
  SELECT content INTO response FROM http((
    'POST',
    supabase_url || '/functions/v1/race-automation',
    ARRAY[http_header('Authorization', 'Bearer ' || service_key)],
    'application/json',
    '{}'
  ));
  
  RAISE NOTICE 'Race automation called: %', response;
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Race automation error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create a trigger function that automatically progresses races
CREATE OR REPLACE FUNCTION auto_progress_race() RETURNS trigger AS $$
DECLARE
  time_since_update INTEGER;
  should_progress BOOLEAN := false;
BEGIN
  -- Calculate time since last update
  time_since_update := EXTRACT(EPOCH FROM (NOW() - COALESCE(NEW.updated_at, NEW.created_at)));
  
  -- Determine if race should progress based on state and time
  IF NEW.race_state = 'pre-race' AND time_since_update >= 1 THEN
    should_progress := true;
  ELSIF NEW.race_state = 'countdown' AND time_since_update >= 1 THEN
    should_progress := true;
  ELSIF NEW.race_state = 'racing' AND time_since_update >= 0.1 THEN
    should_progress := true;
  END IF;
  
  -- Call race automation if needed
  IF should_progress THEN
    PERFORM call_race_automation();
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically progress races
DROP TRIGGER IF EXISTS auto_race_progress_trigger ON race_state;
CREATE TRIGGER auto_race_progress_trigger
  AFTER INSERT OR UPDATE ON race_state
  FOR EACH ROW
  EXECUTE FUNCTION auto_progress_race();

-- Create a function to ensure races always exist
CREATE OR REPLACE FUNCTION ensure_race_exists() RETURNS void AS $$
DECLARE
  active_race_count INTEGER;
BEGIN
  -- Check if there's any active race
  SELECT COUNT(*) INTO active_race_count
  FROM race_state
  WHERE race_state IN ('pre-race', 'countdown', 'racing')
  AND created_at > NOW() - INTERVAL '10 minutes';
  
  -- If no active race, start one
  IF active_race_count = 0 THEN
    RAISE NOTICE 'No active race found, starting new race automatically';
    
    -- Insert a new race
    INSERT INTO race_state (
      race_state,
      horses,
      pre_race_timer,
      countdown_timer,
      race_timer,
      weather_conditions,
      created_at,
      updated_at
    )
    SELECT 
      'pre-race',
      jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'name', h.name,
          'speed', h.speed,
          'stamina', h.stamina,
          'acceleration', h.acceleration,
          'elo', COALESCE(h.elo, 500),
          'position', 0,
          'lane', ROW_NUMBER() OVER (ORDER BY RANDOM()),
          'odds', 2.0 + (RANDOM() * 8.0),
          'sprintStartPercent', 40 + (RANDOM() * 30)
        )
      ),
      10,
      0,
      0,
      jsonb_build_object(
        'condition', (ARRAY['sunny', 'cloudy', 'rainy'])[FLOOR(RANDOM() * 3) + 1],
        'temperature', 10 + FLOOR(RANDOM() * 20),
        'humidity', 30 + FLOOR(RANDOM() * 40),
        'windSpeed', FLOOR(RANDOM() * 20)
      ),
      NOW(),
      NOW()
    FROM (
      SELECT * FROM horses 
      ORDER BY RANDOM() 
      LIMIT 8
    ) h;
    
    RAISE NOTICE 'New race created automatically';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Start the first race immediately if none exists
SELECT ensure_race_exists();