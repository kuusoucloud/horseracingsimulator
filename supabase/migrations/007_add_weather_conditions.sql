-- Add weather conditions column for server-managed weather
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS weather_conditions JSONB DEFAULT '{}';