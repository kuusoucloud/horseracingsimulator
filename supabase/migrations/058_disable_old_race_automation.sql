-- Disable old race automation that was ending races prematurely

-- Drop the old race automation function that was ending races after 30 seconds
DROP FUNCTION IF EXISTS update_race_state();

-- Drop any triggers that might be calling the old function
DROP TRIGGER IF EXISTS race_state_trigger ON race_state;

-- Make sure only our new update_race_tick() function handles race completion
-- This function waits for ALL horses to finish before ending the race

-- Log that we've disabled the old automation
DO $$
BEGIN
  RAISE NOTICE 'Disabled old race automation - now only update_race_tick() handles race completion';
END $$;