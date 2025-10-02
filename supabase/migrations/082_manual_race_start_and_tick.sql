-- Manually test the race system by starting a race and calling tick

-- First, check current race state
SELECT 
  id,
  race_state,
  pre_race_timer,
  countdown_timer,
  race_timer,
  created_at,
  updated_at
FROM race_state 
ORDER BY created_at DESC 
LIMIT 1;

-- Call the race tick function manually to see if it works
SELECT update_race_tick();

-- Check race state after tick
SELECT 
  id,
  race_state,
  pre_race_timer,
  countdown_timer,
  race_timer,
  created_at,
  updated_at
FROM race_state 
ORDER BY created_at DESC 
LIMIT 1;