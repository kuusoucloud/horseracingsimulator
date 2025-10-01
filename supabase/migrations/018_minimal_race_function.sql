-- Create the most minimal race function possible to avoid stack depth issues

CREATE OR REPLACE FUNCTION advance_race_state()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Just update the race_control timestamp - nothing else
  UPDATE race_control 
  SET last_tick = NOW() 
  WHERE is_active = true;
  
  -- If no active control exists, create one
  IF NOT FOUND THEN
    INSERT INTO race_control (is_active, last_tick) 
    VALUES (true, NOW());
  END IF;
END;
$$;