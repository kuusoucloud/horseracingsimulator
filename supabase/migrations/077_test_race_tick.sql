-- Test the race tick function manually and check triggers

-- Call the race tick function manually
SELECT update_race_tick();

-- Check if triggers exist
SELECT 
  trigger_name,
  event_manipulation,
  event_object_table,
  action_statement
FROM information_schema.triggers 
WHERE event_object_table = 'race_state';

-- Check current race state after tick
SELECT 
  race_state,
  pre_race_timer,
  countdown_timer,
  race_timer,
  created_at,
  updated_at,
  race_start_time
FROM race_state 
ORDER BY created_at DESC 
LIMIT 1;