-- Create a trigger function that calls our race advancement
CREATE OR REPLACE FUNCTION trigger_race_advance()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  -- Call the race advancement function
  PERFORM advance_race_state();
  RETURN NEW;
END;
$$;

-- Create a trigger that fires when race_control is updated
DROP TRIGGER IF EXISTS race_control_trigger ON race_control;
CREATE TRIGGER race_control_trigger
  AFTER UPDATE ON race_control
  FOR EACH ROW
  EXECUTE FUNCTION trigger_race_advance();

-- Create a simple function to trigger the race tick from the client
CREATE OR REPLACE FUNCTION trigger_race_tick()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Just update the race_control table to trigger the race advancement
  UPDATE race_control SET last_tick = NOW() WHERE is_active = true;
END;
$$;