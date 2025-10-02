-- Create a working race manually and test the system

-- First, let's see what's in the race_state table
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
LIMIT 3;

-- Delete any old races to start fresh
DELETE FROM race_state WHERE created_at < NOW() - INTERVAL '1 hour';

-- Create a simple race manually
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
VALUES (
  'pre-race',
  '[
    {"id": "1", "name": "Thunder Bolt", "speed": 75, "stamina": 80, "acceleration": 70, "elo": 600, "position": 0, "lane": 1, "odds": 3.5},
    {"id": "2", "name": "Lightning Strike", "speed": 80, "stamina": 75, "acceleration": 85, "elo": 650, "position": 0, "lane": 2, "odds": 2.8},
    {"id": "3", "name": "Storm Runner", "speed": 70, "stamina": 90, "acceleration": 65, "elo": 550, "position": 0, "lane": 3, "odds": 4.2},
    {"id": "4", "name": "Wind Walker", "speed": 85, "stamina": 70, "acceleration": 80, "elo": 700, "position": 0, "lane": 4, "odds": 2.1},
    {"id": "5", "name": "Fire Dash", "speed": 78, "stamina": 85, "acceleration": 75, "elo": 580, "position": 0, "lane": 5, "odds": 3.8},
    {"id": "6", "name": "Ice Breaker", "speed": 72, "stamina": 88, "acceleration": 68, "elo": 520, "position": 0, "lane": 6, "odds": 4.5},
    {"id": "7", "name": "Shadow Sprint", "speed": 88, "stamina": 65, "acceleration": 90, "elo": 720, "position": 0, "lane": 7, "odds": 1.8},
    {"id": "8", "name": "Golden Gallop", "speed": 76, "stamina": 82, "acceleration": 73, "elo": 590, "position": 0, "lane": 8, "odds": 3.6}
  ]'::jsonb,
  10,
  0,
  0,
  '{"condition": "sunny", "temperature": 22, "humidity": 45, "windSpeed": 8}'::jsonb,
  NOW(),
  NOW()
);

-- Test the race tick function
SELECT update_race_tick();