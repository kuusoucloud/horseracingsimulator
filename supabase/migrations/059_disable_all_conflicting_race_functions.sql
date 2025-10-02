-- Disable all conflicting race automation functions

-- Drop the old race_tick function that high-frequency-tick was calling
DROP FUNCTION IF EXISTS race_tick();

-- Drop any other race automation functions that might conflict
DROP FUNCTION IF EXISTS update_race_state();

-- Make sure we only have our update_race_tick function handling races
-- This is the only function that waits for ALL horses to finish

-- Log what we've disabled
DO $$
BEGIN
  RAISE NOTICE 'Disabled all conflicting race functions:';
  RAISE NOTICE '- race_tick() (called by high-frequency-tick)';
  RAISE NOTICE '- update_race_state() (called by race-automation)';
  RAISE NOTICE 'Only update_race_tick() should handle race completion now';
END $$;