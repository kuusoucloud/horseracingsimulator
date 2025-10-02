-- Auto-generate new race after 15 seconds of showing race results

-- First, add a results_shown_at timestamp to track when results were first displayed
ALTER TABLE race_state 
ADD COLUMN IF NOT EXISTS results_shown_at TIMESTAMP WITH TIME ZONE;

-- Function to automatically start a new race after results have been shown for 15 seconds
CREATE OR REPLACE FUNCTION auto_start_new_race_after_results()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    current_race RECORD;
    time_since_results INTEGER;
BEGIN
    -- Get the current race state
    SELECT * INTO current_race
    FROM race_state 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    -- Only proceed if we have a race in finished state
    IF current_race IS NULL OR current_race.race_state != 'finished' THEN
        RETURN;
    END IF;
    
    -- Set results_shown_at if not already set
    IF current_race.results_shown_at IS NULL THEN
        UPDATE race_state 
        SET results_shown_at = NOW()
        WHERE id = current_race.id;
        RETURN;
    END IF;
    
    -- Calculate time since results were shown
    time_since_results := EXTRACT(EPOCH FROM (NOW() - current_race.results_shown_at));
    
    -- If 15 seconds have passed, start a new race
    IF time_since_results >= 15 THEN
        -- Generate new horses with random ELO ratings between 400-600
        DELETE FROM horses;
        
        INSERT INTO horses (name, speed, stamina, acceleration, elo_rating, lane) VALUES
        ('Thunder Bolt', 0.85 + (RANDOM() * 0.3), 0.80 + (RANDOM() * 0.4), 0.90 + (RANDOM() * 0.2), 400 + (RANDOM() * 200)::INTEGER, 1),
        ('Lightning Strike', 0.75 + (RANDOM() * 0.4), 0.85 + (RANDOM() * 0.3), 0.80 + (RANDOM() * 0.4), 400 + (RANDOM() * 200)::INTEGER, 2),
        ('Storm Chaser', 0.80 + (RANDOM() * 0.35), 0.75 + (RANDOM() * 0.45), 0.85 + (RANDOM() * 0.3), 400 + (RANDOM() * 200)::INTEGER, 3),
        ('Wind Runner', 0.90 + (RANDOM() * 0.2), 0.70 + (RANDOM() * 0.5), 0.75 + (RANDOM() * 0.45), 400 + (RANDOM() * 200)::INTEGER, 4),
        ('Fire Dash', 0.70 + (RANDOM() * 0.5), 0.90 + (RANDOM() * 0.2), 0.80 + (RANDOM() * 0.4), 400 + (RANDOM() * 200)::INTEGER, 5),
        ('Star Gallop', 0.85 + (RANDOM() * 0.3), 0.80 + (RANDOM() * 0.4), 0.85 + (RANDOM() * 0.3), 400 + (RANDOM() * 200)::INTEGER, 6);
        
        -- Calculate odds based on ELO ratings
        UPDATE horses SET odds = calculate_elo_odds(elo_rating);
        
        -- Create new race state
        INSERT INTO race_state (
            race_state,
            pre_race_timer,
            countdown_timer,
            race_timer,
            weather_condition,
            time_of_day,
            results_shown_at
        ) VALUES (
            'pre-race',
            15,
            0,
            0,
            (ARRAY['sunny', 'cloudy', 'rain'])[floor(random() * 3 + 1)],
            (ARRAY['day', 'evening', 'night'])[floor(random() * 3 + 1)],
            NULL
        );
        
        RAISE NOTICE 'New race automatically started after 15 seconds of results display';
    END IF;
END;
$$;

-- Update the race tick function to include auto race generation
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
                
                -- Mark race as finished
                UPDATE race_state 
                SET race_state = 'finished',
                    updated_at = NOW()
                WHERE id = current_race.id;
            END IF;
            
        WHEN 'finished' THEN
            -- Try to auto-start new race after 15 seconds
            PERFORM auto_start_new_race_after_results();
            
    END CASE;
END;
$$;