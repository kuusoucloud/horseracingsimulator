-- Fix race continuation after multiple races by ensuring clean race state management

-- Update start_new_race function to clean up old race states
CREATE OR REPLACE FUNCTION start_new_race()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
    horse_count INTEGER;
BEGIN
    -- Clean up old race states to prevent confusion
    DELETE FROM race_state WHERE race_state = 'finished' AND created_at < NOW() - INTERVAL '1 minute';
    
    -- Check if we have horses in the database
    SELECT COUNT(*) INTO horse_count FROM horses;
    
    -- If no horses exist, create initial set (this should only happen on first run)
    IF horse_count = 0 THEN
        INSERT INTO horses (name, speed, stamina, acceleration, elo_rating, lane) VALUES
        ('Thunder Bolt', 0.85, 0.80, 0.90, 500, 1),
        ('Lightning Strike', 0.75, 0.85, 0.80, 500, 2),
        ('Storm Chaser', 0.80, 0.75, 0.85, 500, 3),
        ('Wind Runner', 0.90, 0.70, 0.75, 500, 4),
        ('Fire Dash', 0.70, 0.90, 0.80, 500, 5),
        ('Star Gallop', 0.85, 0.80, 0.85, 500, 6);
    END IF;
    
    -- Reset horse positions for new race (keep existing ELO ratings)
    UPDATE horses SET 
        position = 0,
        finished = false,
        finish_time = NULL,
        final_position = NULL;
    
    -- Recalculate odds based on current ELO ratings
    UPDATE horses SET odds = calculate_elo_odds(elo_rating);
    
    -- Create new race state
    INSERT INTO race_state (
        race_state,
        pre_race_timer,
        countdown_timer,
        race_timer,
        results_countdown,
        weather_condition,
        time_of_day,
        results_shown_at
    ) VALUES (
        'pre-race',
        15,
        0,
        0,
        0,
        (ARRAY['sunny', 'cloudy', 'rain'])[floor(random() * 3 + 1)],
        (ARRAY['day', 'evening', 'night'])[floor(random() * 3 + 1)],
        NULL
    );
    
    RAISE NOTICE 'New race started with existing horses and their current ELO ratings (cleaned up old states)';
END;
$$;

-- Update race tick function with better race state management
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
    race_count INTEGER;
BEGIN
    -- Check how many active races we have
    SELECT COUNT(*) INTO race_count FROM race_state WHERE race_state != 'finished' OR created_at > NOW() - INTERVAL '2 minutes';
    
    -- If we have too many race states, clean up
    IF race_count > 3 THEN
        DELETE FROM race_state WHERE race_state = 'finished' AND created_at < NOW() - INTERVAL '1 minute';
        RAISE NOTICE 'Cleaned up old race states, count was: %', race_count;
    END IF;
    
    -- Get the current race (most recent)
    SELECT * INTO current_race
    FROM race_state 
    ORDER BY created_at DESC 
    LIMIT 1;
    
    IF current_race IS NULL THEN
        -- Create a new race if none exists
        RAISE NOTICE 'No race found, creating new race';
        PERFORM start_new_race();
        RETURN;
    END IF;
    
    -- Log current race state for debugging
    RAISE NOTICE 'Processing race state: %, ID: %, Created: %', current_race.race_state, current_race.id, current_race.created_at;
    
    -- Handle different race states
    CASE current_race.race_state
        WHEN 'pre-race' THEN
            -- Countdown pre-race timer
            IF current_race.pre_race_timer > 0 THEN
                UPDATE race_state 
                SET pre_race_timer = pre_race_timer - 1,
                    updated_at = NOW()
                WHERE id = current_race.id;
                RAISE NOTICE 'Pre-race countdown: % seconds', current_race.pre_race_timer - 1;
            ELSE
                -- Move to countdown phase
                UPDATE race_state 
                SET race_state = 'countdown',
                    countdown_timer = 5,
                    updated_at = NOW()
                WHERE id = current_race.id;
                RAISE NOTICE 'Moving to countdown phase';
            END IF;
            
        WHEN 'countdown' THEN
            -- Countdown to race start
            IF current_race.countdown_timer > 0 THEN
                UPDATE race_state 
                SET countdown_timer = countdown_timer - 1,
                    updated_at = NOW()
                WHERE id = current_race.id;
                RAISE NOTICE 'Countdown: % seconds', current_race.countdown_timer - 1;
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
                    
                RAISE NOTICE 'Race started!';
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
                
                -- Mark race as finished and start 15-second results countdown
                UPDATE race_state 
                SET race_state = 'finished',
                    results_countdown = 15,
                    updated_at = NOW()
                WHERE id = current_race.id;
                
                RAISE NOTICE 'Race finished! Starting 15-second results countdown. Race ID: %', current_race.id;
            END IF;
            
        WHEN 'finished' THEN
            -- Countdown results timer (like pre-race and countdown timers)
            IF current_race.results_countdown > 0 THEN
                UPDATE race_state 
                SET results_countdown = results_countdown - 1,
                    updated_at = NOW()
                WHERE id = current_race.id;
                
                RAISE NOTICE 'Results countdown: % seconds remaining (Race ID: %)', current_race.results_countdown - 1, current_race.id;
            ELSE
                -- Results countdown finished, start new race
                RAISE NOTICE 'Results countdown finished for Race ID: %, starting new race', current_race.id;
                PERFORM start_new_race();
            END IF;
            
    END CASE;
END;
$$;