-- Add weather conditions column for server-managed weather
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS weather_conditions JSONB DEFAULT '{}';

-- Update existing race states with default weather
UPDATE race_state 
SET weather_conditions = '{
  "timeOfDay": "day",
  "weather": "clear", 
  "skyColor": "#87ceeb",
  "ambientIntensity": 0.4,
  "directionalIntensity": 1.0,
  "trackColor": "#8B4513",
  "grassColor": "#32cd32"
}'::jsonb
WHERE weather_conditions = '{}'::jsonb OR weather_conditions IS NULL;