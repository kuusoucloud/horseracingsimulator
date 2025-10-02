-- Fix high-frequency race updates by updating the existing race-tick function
-- to run every 100ms instead of every 1000ms

-- Update the race-tick edge function to be called more frequently
-- This will be done by updating the client-side interval

-- First, let's make sure the race_tick function exists and works properly
CREATE OR REPLACE FUNCTION race_tick()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_race RECORD;
    horse_record RECORD;
    race_duration_ms INTEGER;
    new_position DECIMAL;
    base_speed DECIMAL;
    speed_variation DECIMAL;
    current_velocity DECIMAL;
    time_delta_ms INTEGER := 100; -- 100ms tick interval
BEGIN
    -- Get current race
    SELECT * INTO current_race 
    FROM race_state 
    WHERE race_state = 'racing' 
    LIMIT 1;
    
    IF NOT FOUND THEN
        RETURN;
    END IF;
    
    -- Calculate race progress
    race_duration_ms := EXTRACT(EPOCH FROM (NOW() - current_race.race_start_time)) * 1000;
    
    -- Update each horse position with realistic physics
    FOR horse_record IN 
        SELECT * FROM horses 
        WHERE id = ANY(current_race.horse_lineup)
        ORDER BY array_position(current_race.horse_lineup, id)
    LOOP
        -- Calculate realistic horse speed (18-25 m/s range)
        base_speed := ((horse_record.speed * 0.8 + horse_record.acceleration * 0.2) / 100.0);
        -- Use horse ID for consistent speed variation (no random())
        speed_variation := 0.85 + (((ascii(substring(horse_record.id, 1, 1)) * 7) % 100) / 100.0 * 0.3);
        current_velocity := (18.0 + (base_speed * 7.0)) * speed_variation;
        
        -- Calculate new position based on velocity and time delta
        new_position := LEAST(
            COALESCE(horse_record.position, 0) + (current_velocity * time_delta_ms / 1000.0),
            1200.0
        );
        
        -- Update horse position and velocity
        UPDATE horses 
        SET 
            position = new_position,
            velocity = current_velocity,
            updated_at = NOW()
        WHERE id = horse_record.id;
    END LOOP;
    
    -- Check if race is complete (any horse reached finish line)
    IF EXISTS (
        SELECT 1 FROM horses 
        WHERE id = ANY(current_race.horse_lineup) 
        AND position >= 1200
    ) THEN
        -- Race complete - trigger finish
        UPDATE race_state 
        SET 
            race_state = 'photo_finish',
            race_end_time = NOW(),
            updated_at = NOW()
        WHERE race_state = 'racing';
    ELSE
        -- Update race timer
        UPDATE race_state 
        SET 
            timer = GREATEST(0, 20 - EXTRACT(EPOCH FROM (NOW() - race_start_time))::INTEGER),
            updated_at = NOW()
        WHERE race_state = 'racing';
    END IF;
END;
$$;