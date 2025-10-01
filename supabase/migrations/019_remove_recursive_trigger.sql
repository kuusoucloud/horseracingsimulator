-- Remove the recursive trigger that's causing stack depth issues

-- Drop the problematic trigger
DROP TRIGGER IF EXISTS race_control_trigger ON race_control;

-- Drop the trigger function
DROP FUNCTION IF EXISTS trigger_race_advance();

-- Simplify the trigger_race_tick function to directly call advance_race_state
CREATE OR REPLACE FUNCTION trigger_race_tick()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Directly call the race advancement function without updating race_control
  -- This avoids the recursive trigger loop
  PERFORM advance_race_state();
END;
$$;