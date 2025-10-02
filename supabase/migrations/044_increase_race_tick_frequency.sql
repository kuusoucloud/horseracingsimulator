-- Increase race tick frequency to 10 times per second (100ms intervals)
-- This will make horse movement much smoother

-- Drop existing race tick function
DROP FUNCTION IF EXISTS race_tick();

-- Create new high-frequency race tick function
CREATE OR REPLACE FUNCTION race_tick()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_race RECORD;
    horse_record RECORD;
    race_duration_ms INTEGER;
    progress_ratio DECIMAL;
    new_position DECIMAL;
    base_speed DECIMAL;
    speed_variation DECIMAL;
    current_velocity DECIMAL;
    time_delta_ms INTEGER := 100; -- 100ms tick interval (10 FPS)
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
    progress_ratio := LEAST(race_duration_ms::DECIMAL / 20000.0, 1.0); -- 20 second race
    
    -- Update each horse position with realistic physics
    FOR horse_record IN 
        SELECT * FROM horses 
        WHERE id = ANY(current_race.horse_lineup)
        ORDER BY array_position(current_race.horse_lineup, id)
    LOOP
        -- Calculate realistic horse speed (18-25 m/s range)
        base_speed := ((horse_record.speed * 0.8 + horse_record.acceleration * 0.2) / 100.0);
        speed_variation := 0.85 + (random() * 0.3); -- ±15% speed variation
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

-- Create high-frequency race automation trigger (every 100ms during racing)
CREATE OR REPLACE FUNCTION trigger_high_frequency_race_tick()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
    -- Only trigger during racing state
    IF NEW.race_state = 'racing' THEN
        -- Use pg_notify to trigger external tick system
        PERFORM pg_notify('race_tick_needed', json_build_object(
            'race_id', NEW.id,
            'timestamp', extract(epoch from now()) * 1000
        )::text);
    END IF;
    
    RETURN NEW;
END;
$$;

-- Drop existing trigger
DROP TRIGGER IF EXISTS race_automation_trigger ON race_state;

-- Create new high-frequency trigger
CREATE TRIGGER race_automation_trigger
    AFTER UPDATE ON race_state
    FOR EACH ROW
    EXECUTE FUNCTION trigger_high_frequency_race_tick();

-- Add velocity column to horses table if it doesn't exist
ALTER TABLE horses ADD COLUMN IF NOT EXISTS velocity DECIMAL DEFAULT 0;