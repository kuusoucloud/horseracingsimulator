-- Add missing race_end_time field and fix auto-restart function

-- Add race_end_time field if it doesn't exist
ALTER TABLE race_state ADD COLUMN IF NOT EXISTS race_end_time TIMESTAMP WITH TIME ZONE;

-- Fix the auto_restart_race function to use updated_at instead of race_end_time for finished races
CREATE OR REPLACE FUNCTION auto_restart_race() RETURNS void AS $$
DECLARE
  current_race RECORD;
  time_since_finish INTEGER;
BEGIN
  -- Get the most recent finished race
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'finished' OR race_state = 'photo_finish'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NULL THEN
    RETURN;
  END IF;

  -- Calculate time since race ended (use updated_at as fallback if race_end_time is null)
  time_since_finish := EXTRACT(EPOCH FROM (NOW() - COALESCE(current_race.race_end_time, current_race.updated_at)));

  -- If race has been finished for more than 15 seconds, start a new race
  IF time_since_finish > 15 THEN
    RAISE NOTICE 'Auto-restarting race after % seconds', time_since_finish;
    
    -- Start a new race
    PERFORM start_new_race();
    
    RAISE NOTICE 'New race automatically started!';
  END IF;

END;
$$ LANGUAGE plpgsql;