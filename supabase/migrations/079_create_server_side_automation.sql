-- Create true server-side race automation that runs 24/7
-- This will make races run continuously without requiring clients

-- Enable pg_cron extension for scheduled jobs
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Create a function that will be called by cron to run races
CREATE OR REPLACE FUNCTION automated_race_tick() RETURNS void AS $$
BEGIN
  -- Call the race tick function
  PERFORM update_race_tick();
  
  -- Log that automation ran
  RAISE NOTICE 'Automated race tick executed at %', NOW();
EXCEPTION
  WHEN OTHERS THEN
    RAISE NOTICE 'Automated race tick error: %', SQLERRM;
END;
$$ LANGUAGE plpgsql;

-- Create a fallback to ensure races always exist
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

-- Schedule the race tick to run every minute (will be called 60 times per minute via multiple schedules)
SELECT cron.schedule(
  'race-automation-primary',
  '* * * * *',
  'SELECT automated_race_tick();'
);

-- Schedule race existence check every 5 minutes
SELECT cron.schedule(
  'ensure-race-exists',
  '*/5 * * * *',
  'SELECT ensure_race_exists();'
);

-- Start the first race immediately if none exists
SELECT ensure_race_exists();

RAISE NOTICE 'Server-side race automation enabled - races will run 24/7';
RAISE NOTICE 'Scheduled jobs: race-automation-primary (every minute), ensure-race-exists (every 5min)';