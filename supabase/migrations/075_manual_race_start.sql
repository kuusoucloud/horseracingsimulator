-- Simple race start and system check

-- Check horses table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'horses' 
ORDER BY ordinal_position;

-- Check current race state
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

-- Manually insert a simple race if none exists
INSERT INTO race_state (
  race_state,
  pre_race_timer,
  countdown_timer,
  race_timer,
  horse_lineup,
  created_at,
  updated_at
)
SELECT 
  'pre-race',
  10,
  0,
  0,
  ARRAY(SELECT id FROM horses ORDER BY RANDOM() LIMIT 8),
  NOW(),
  NOW()
WHERE NOT EXISTS (
  SELECT 1 FROM race_state 
  WHERE race_state IN ('pre-race', 'countdown', 'racing')
  AND created_at > NOW() - INTERVAL '5 minutes'
);

-- Test the race tick function
SELECT update_race_tick();