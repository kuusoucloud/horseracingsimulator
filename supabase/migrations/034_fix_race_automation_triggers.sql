-- Fix the race automation by updating the trigger function to call update_race_state
CREATE OR REPLACE FUNCTION trigger_race_advance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the correct race automation function
  PERFORM update_race_state();
  RETURN NEW;
END;
$$;

-- Update the trigger_race_tick function to call update_race_state directly
CREATE OR REPLACE FUNCTION trigger_race_tick()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the race automation function directly
  PERFORM update_race_state();
END;
$$;