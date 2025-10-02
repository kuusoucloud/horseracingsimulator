-- Debug and fix the race system

-- Check current race state
SELECT 
  id,
  race_state,
  pre_race_timer,
  countdown_timer,
  race_timer,
  created_at,
  updated_at,
  race_start_time,
  race_end_time
FROM race_state 
ORDER BY created_at DESC 
LIMIT 3;

-- Check if there are any horses
SELECT COUNT(*) as horse_count FROM horses;

-- Check if there's an active race
SELECT 
  race_state,
  COUNT(*) as count,
  MAX(created_at) as latest_race
FROM race_state 
WHERE race_state IN ('pre-race', 'countdown', 'racing')
GROUP BY race_state;

-- Force start a new race if none exists
DO $$
DECLARE
  active_race_count INTEGER;
BEGIN
  -- Check for active races
  SELECT COUNT(*) INTO active_race_count
  FROM race_state
  WHERE race_state IN ('pre-race', 'countdown', 'racing')
  AND created_at > NOW() - INTERVAL '10 minutes';
  
  -- If no active race, start one
  IF active_race_count = 0 THEN
    RAISE NOTICE 'No active race found, starting new race';
    PERFORM start_new_race();
    RAISE NOTICE 'New race started successfully';
  ELSE
    RAISE NOTICE 'Found % active races', active_race_count;
  END IF;
END $$;