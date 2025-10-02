-- Fix race completion and ensure all horses finish properly
CREATE OR REPLACE FUNCTION update_race_state_high_frequency() RETURNS VOID AS $$
DECLARE
  current_race RECORD;
  elapsed_time_ms BIGINT;
  countdown_elapsed_ms BIGINT;
  horse JSONB;
  horse_name TEXT;
  new_position DECIMAL;
  base_speed DECIMAL;
  current_speed DECIMAL;
  race_progress DECIMAL;
  finish_times JSONB := '[]'::JSONB;
  calculated_race_results JSONB := '[]'::JSONB;
  placement INTEGER := 1;
  temp_result JSONB;
  horse_index INTEGER := 0;
  updated_horses JSONB := '[]'::JSONB;
  delta_time_seconds DECIMAL;
  realistic_speed DECIMAL;
  elo_factor DECIMAL;
  stamina_factor DECIMAL;
  acceleration_factor DECIMAL;
  random_variation DECIMAL;
  finished_horses_count INTEGER := 0;
BEGIN
  -- Get the most recent race
  SELECT * INTO current_race 
  FROM race_state 
  ORDER BY created_at DESC 
  LIMIT 1;
  
  IF current_race IS NULL THEN
    RETURN;
  END IF;

  -- Ensure all horses exist in database with proper ELO
  FOR horse IN SELECT * FROM jsonb_array_elements(current_race.horses)
  LOOP
    horse_name := horse->>'name';
    
    -- Insert horse if doesn't exist (with default 500 ELO)
    INSERT INTO horses (name, elo, total_races, wins, recent_form)
    VALUES (horse_name, 500, 0, 0, '{}')
    ON CONFLICT (name) DO UPDATE SET 
      elo = CASE WHEN horses.elo IS NULL OR horses.elo = 0 THEN 500 ELSE horses.elo END;
  END LOOP;

  -- Handle different race states with high precision timing
  CASE current_race.race_state
    WHEN 'pre-race' THEN
      -- Pre-race countdown (10 seconds) - use milliseconds for precision
      elapsed_time_ms := EXTRACT(EPOCH FROM (NOW() - current_race.created_at))::BIGINT * 1000;
      
      IF elapsed_time_ms >= 10000 THEN
        -- Start countdown phase
        UPDATE race_state 
        SET 
          race_state = 'countdown',
          countdown_timer = 3,
          countdown_start_time = NOW(),
          updated_at = NOW()
        WHERE id = current_race.id;
      ELSE
        -- Update pre-race timer with millisecond precision
        UPDATE race_state 
        SET 
          pre_race_timer = GREATEST(0, (10000 - elapsed_time_ms) / 1000.0),
          updated_at = NOW()
        WHERE id = current_race.id;
      END IF;

    WHEN 'countdown' THEN
      -- If countdown_start_time is NULL, set it now
      IF current_race.countdown_start_time IS NULL THEN
        UPDATE race_state 
        SET countdown_start_time = NOW()
        WHERE id = current_race.id;
        countdown_elapsed_ms := 0;
      ELSE
        countdown_elapsed_ms := EXTRACT(EPOCH FROM (NOW() - current_race.countdown_start_time))::BIGINT * 1000;
      END IF;
      
      IF countdown_elapsed_ms >= 3000 THEN
        -- Start the race with high precision timing
        UPDATE race_state 
        SET 
          race_state = 'racing',
          race_timer = 0,
          countdown_timer = 0,
          race_start_time = NOW(),
          updated_at = NOW()
        WHERE id = current_race.id;
      ELSE
        -- Update countdown timer with millisecond precision
        UPDATE race_state 
        SET countdown_timer = GREATEST(0, (3000 - countdown_elapsed_ms) / 1000.0)
        WHERE id = current_race.id;
      END IF;

    WHEN 'racing' THEN
      -- High-frequency race updates with millisecond precision
      elapsed_time_ms := EXTRACT(EPOCH FROM (NOW() - COALESCE(current_race.race_start_time, current_race.updated_at)))::BIGINT * 1000;
      delta_time_seconds := elapsed_time_ms / 1000.0;
      
      -- Update horse positions with ELO-BASED REALISTIC SPEED for 58-second race
      FOR horse IN SELECT * FROM jsonb_array_elements(current_race.horses)
      LOOP
        horse_index := horse_index + 1;
        
        -- ELO-based speed calculation (500 ELO = baseline)
        elo_factor := ((horse->>'elo')::DECIMAL - 500.0) / 500.0; -- -1 to +1 range for 0-1000 ELO
        
        -- Attribute factors (normalized 0-1)
        stamina_factor := (horse->>'stamina')::DECIMAL / 100.0;
        acceleration_factor := (horse->>'acceleration')::DECIMAL / 100.0;
        base_speed := (horse->>'speed')::DECIMAL / 100.0;
        
        -- Calculate realistic horse speed for 58-second race (1200m / 58s = ~20.7 m/s average)
        -- Base speed: 18-23 m/s range, modified by ELO and attributes
        realistic_speed := 18.0 + (base_speed * 5.0); -- Base range from attributes
        
        -- ELO modifier: ±2 m/s based on ELO (500 ELO = no change)
        realistic_speed := realistic_speed + (elo_factor * 2.0);
        
        -- Stamina affects consistency (reduces speed variation over time)
        -- Acceleration affects early race performance
        IF delta_time_seconds < 10.0 THEN
          -- Early race: acceleration matters more
          realistic_speed := realistic_speed * (0.8 + acceleration_factor * 0.4);
        ELSE
          -- Mid/late race: stamina matters more
          realistic_speed := realistic_speed * (0.7 + stamina_factor * 0.5);
        END IF;
        
        -- Add realistic speed variation during race (reduced by stamina)
        random_variation := 0.85 + (sin(delta_time_seconds * 0.3 + horse_index) * 0.15);
        random_variation := random_variation * (0.5 + stamina_factor * 0.5); -- High stamina = less variation
        
        current_speed := realistic_speed * random_variation;
        
        -- Ensure speed stays in realistic range (15-25 m/s for thoroughbreds)
        current_speed := GREATEST(15.0, LEAST(25.0, current_speed));
        
        -- Calculate position with ELO-based realistic speed (1200m in ~58 seconds)
        new_position := LEAST(1200, current_speed * delta_time_seconds);
        
        -- Update horse position
        horse := jsonb_set(horse, '{position}', to_jsonb(new_position));
        horse := jsonb_set(horse, '{velocity}', to_jsonb(current_speed));
        horse := jsonb_set(horse, '{lastUpdateTime}', to_jsonb(EXTRACT(EPOCH FROM NOW()) * 1000));
        updated_horses := updated_horses || horse;
        
        -- Check if horse finished
        IF new_position >= 1200 AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(finish_times) ft 
          WHERE ft->>'name' = horse->>'name'
        ) THEN
          finish_times := finish_times || jsonb_build_object(
            'name', horse->>'name',
            'time', delta_time_seconds,
            'placement', jsonb_array_length(finish_times) + 1
          );
          finished_horses_count := finished_horses_count + 1;
        END IF;
      END LOOP;
      
      -- Update race with new positions at high frequency
      UPDATE race_state 
      SET 
        horses = updated_horses,
        race_timer = delta_time_seconds,
        updated_at = NOW()
      WHERE id = current_race.id;
      
      -- Check if race is finished - be more aggressive about finishing
      IF finished_horses_count >= 3 OR delta_time_seconds >= 65 THEN
        -- Force finish remaining horses if time limit reached
        IF delta_time_seconds >= 65 THEN
          FOR horse IN SELECT * FROM jsonb_array_elements(updated_horses)
          LOOP
            IF NOT EXISTS (
              SELECT 1 FROM jsonb_array_elements(finish_times) ft 
              WHERE ft->>'name' = horse->>'name'
            ) THEN
              finish_times := finish_times || jsonb_build_object(
                'name', horse->>'name',
                'time', delta_time_seconds,
                'placement', jsonb_array_length(finish_times) + 1
              );
            END IF;
          END LOOP;
        END IF;
        
        -- Create race results from finish times
        FOR temp_result IN 
          SELECT * FROM jsonb_array_elements(finish_times) ORDER BY (value->>'time')::DECIMAL
        LOOP
          calculated_race_results := calculated_race_results || jsonb_build_object(
            'id', temp_result->>'name',
            'name', temp_result->>'name', 
            'placement', placement,
            'finishTime', (temp_result->>'time')::DECIMAL
          );
          placement := placement + 1;
        END LOOP;
        
        -- Update ELO ratings
        PERFORM update_horse_elo_after_race(calculated_race_results);
        
        -- Finish the race with FORCED results display
        UPDATE race_state 
        SET 
          race_state = 'finished',
          show_photo_finish = true,
          show_results = true,
          race_results = calculated_race_results,
          photo_finish_results = calculated_race_results,
          updated_at = NOW()
        WHERE id = current_race.id;
        
        RAISE NOTICE 'Race finished with % horses, results: %', finished_horses_count, calculated_race_results;
      END IF;

    WHEN 'finished' THEN
      -- Results shown for 15 seconds, then auto-restart
      elapsed_time_ms := EXTRACT(EPOCH FROM (NOW() - current_race.updated_at))::BIGINT * 1000;
      
      IF elapsed_time_ms >= 15000 THEN
        -- Start new race
        PERFORM start_new_race();
      END IF;
  END CASE;
END;
$$ LANGUAGE plpgsql;