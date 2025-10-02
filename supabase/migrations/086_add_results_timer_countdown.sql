-- Add results_timer field to sync client with server for results display

-- Add results_timer field to race_state table
ALTER TABLE race_state 
ADD COLUMN IF NOT EXISTS results_timer INTEGER DEFAULT 0;

-- Update the race tick function to include results timer countdown
CREATE OR REPLACE FUNCTION update_race_tick()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_race RECORD;
    horse_record RECORD;
    race_progress REAL;
    finish_time REAL;
    total_horses INTEGER;
    finished_horses INTEGER;
BEGIN
    -- Get the current race
    SELECT * INTO current_race
    FROM race_state 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF current_race IS NULL THEN
        -- Create a new race if none exists
        PERFORM start_new_race();
        RETURN;
    END IF;
    
    -- Handle different race states
    CASE current_race.race_state
        WHEN 'pre-race' THEN
            -- Countdown pre-race timer
            IF current_race.pre_race_timer > 0 THEN
                UPDATE race_state 
                SET pre_race_timer = pre_race_timer - 1,
                    updated_at = NOW()
                WHERE id = current_race.id;
            ELSE
                -- Move to countdown phase
                UPDATE race_state 
                SET race_state = 'countdown',
                    countdown_timer = 5,
                    updated_at = NOW()
                WHERE id = current_race.id;
            END IF;
            
        WHEN 'countdown' THEN
            -- Countdown to race start
            IF current_race.countdown_timer > 0 THEN
                UPDATE race_state 
                SET countdown_timer = countdown_timer - 1,
                    updated_at = NOW()
                WHERE id = current_race.id;
            ELSE
                -- Start the race
                UPDATE race_state 
                SET race_state = 'racing',
                    race_timer = 0,
                    updated_at = NOW()
                WHERE id = current_race.id;
                
                -- Reset all horse positions
                UPDATE horses SET 
                    position = 0,
                    finished = false,
                    finish_time = NULL,
                    final_position = NULL;
            END IF;
            
        WHEN 'racing' THEN
            -- Update race timer
            UPDATE race_state 
            SET race_timer = race_timer + 0.1,
                updated_at = NOW()
            WHERE id = current_race.id;
            
            -- Update horse positions
            FOR horse_record IN SELECT * FROM horses WHERE NOT finished LOOP
                -- Calculate race progress with realistic speed variation
                race_progress := (current_race.race_timer + 0.1) * 
                               (horse_record.speed * (0.8 + RANDOM() * 0.4)) * 
                               (horse_record.acceleration * (0.9 + RANDOM() * 0.2)) *
                               (horse_record.stamina * (0.85 + RANDOM() * 0.3)) * 
                               60; -- Speed multiplier for 1200m in ~20 seconds
                
                -- Update position (max 1200m)
                UPDATE horses 
                SET position = LEAST(race_progress, 1200)
                WHERE id = horse_record.id;
                
                -- Check if horse finished
                IF race_progress >= 1200 AND NOT horse_record.finished THEN
                    finish_time := current_race.race_timer + 0.1;
                    
                    UPDATE horses 
                    SET finished = true,
                        finish_time = finish_time
                    WHERE id = horse_record.id;
                END IF;
            END LOOP;
            
            -- Check if race is complete (all horses finished or 30 seconds elapsed)
            SELECT COUNT(*) INTO total_horses FROM horses;
            SELECT COUNT(*) INTO finished_horses FROM horses WHERE finished = true;
            
            IF finished_horses >= total_horses OR (current_race.race_timer + 0.1) >= 30 THEN
                -- Mark any unfinished horses as finished
                UPDATE horses 
                SET finished = true,
                    finish_time = current_race.race_timer + 0.1
                WHERE NOT finished;
                
                -- Assign final positions based on finish time
                UPDATE horses 
                SET final_position = (
                    SELECT COUNT(*) + 1 
                    FROM horses h2 
                    WHERE h2.finish_time < horses.finish_time
                );
                
                -- Update ELO ratings based on final positions
                UPDATE horses SET elo_rating = calculate_elo_change(elo_rating, final_position);
                
                -- Mark race as finished and start 15-second results timer
                UPDATE race_state 
                SET race_state = 'finished',
                    results_timer = 15,
                    updated_at = NOW()
                WHERE id = current_race.id;
                
                RAISE NOTICE 'Race finished, starting 15-second results timer';
            END IF;
            
        WHEN 'finished' THEN
            -- Countdown results timer
            IF current_race.results_timer > 0 THEN
                UPDATE race_state 
                SET results_timer = results_timer - 1,
                    updated_at = NOW()
                WHERE id = current_race.id;
                
                RAISE NOTICE 'Results timer: % seconds remaining', current_race.results_timer - 1;
            ELSE
                -- Results timer finished, start new race
                RAISE NOTICE 'Results timer finished, starting new race';
                PERFORM start_new_race();
            END IF;
            
    END CASE;
END;
$$;