-- Fix horse racing speed to realistic 58-second race time
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
    ON CONFLICT (name) DO NOTHING;
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
      
      -- Update horse positions with REALISTIC SPEED for 58-second race
      FOR horse IN SELECT * FROM jsonb_array_elements(current_race.horses)
      LOOP
        horse_index := horse_index + 1;
        
        -- Calculate realistic horse speed for 58-second race (1200m / 58s = ~20.7 m/s average)
        -- Base speed from horse attributes (normalized to realistic range)
        base_speed := ((horse->>'speed')::DECIMAL * 0.8 + (horse->>'acceleration')::DECIMAL * 0.2) / 100.0;
        
        -- Convert to realistic racing speed (18-23 m/s range for thoroughbreds)
        realistic_speed := 18.0 + (base_speed * 5.0); -- Range: 18-23 m/s
        
        -- Add smooth speed variation during race (stamina effects, etc.)
        current_speed := realistic_speed * (0.85 + 
          (sin(delta_time_seconds * 0.3 + horse_index) * 0.15));
        
        -- Calculate position with realistic speed (1200m in ~58 seconds)
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
        END IF;
      END LOOP;
      
      -- Update race with new positions at high frequency
      UPDATE race_state 
      SET 
        horses = updated_horses,
        race_timer = delta_time_seconds,
        updated_at = NOW()
      WHERE id = current_race.id;
      
      -- Check if race is finished (extend max time to 70 seconds for realistic racing)
      IF jsonb_array_length(finish_times) >= jsonb_array_length(current_race.horses) OR delta_time_seconds >= 70 THEN
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
        
        -- Finish the race
        UPDATE race_state 
        SET 
          race_state = 'finished',
          show_photo_finish = true,
          show_results = true,
          race_results = calculated_race_results,
          photo_finish_results = calculated_race_results,
          updated_at = NOW()
        WHERE id = current_race.id;
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