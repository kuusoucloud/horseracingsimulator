-- Fix ambiguous column references in update_race_state function
CREATE OR REPLACE FUNCTION update_race_state() RETURNS VOID AS $$
DECLARE
  current_race RECORD;
  elapsed_time INTEGER;
  countdown_elapsed INTEGER;
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

  -- Handle different race states
  CASE current_race.race_state
    WHEN 'pre-race' THEN
      -- Pre-race countdown (10 seconds)
      elapsed_time := EXTRACT(EPOCH FROM (NOW() - current_race.created_at))::INTEGER;
      
      IF elapsed_time >= 10 THEN
        -- Start countdown phase
        UPDATE race_state 
        SET 
          race_state = 'countdown',
          countdown_timer = 3,
          countdown_start_time = NOW(),
          updated_at = NOW()
        WHERE id = current_race.id;
      ELSE
        -- Update pre-race timer
        UPDATE race_state 
        SET 
          pre_race_timer = GREATEST(0, 10 - elapsed_time),
          updated_at = NOW()
        WHERE id = current_race.id;
      END IF;

    WHEN 'countdown' THEN
      -- If countdown_start_time is NULL, set it now
      IF current_race.countdown_start_time IS NULL THEN
        UPDATE race_state 
        SET countdown_start_time = NOW()
        WHERE id = current_race.id;
        countdown_elapsed := 0;
      ELSE
        countdown_elapsed := EXTRACT(EPOCH FROM (NOW() - current_race.countdown_start_time))::INTEGER;
      END IF;
      
      IF countdown_elapsed >= 3 THEN
        -- Start the race
        UPDATE race_state 
        SET 
          race_state = 'racing',
          race_timer = 0,
          countdown_timer = 0,
          race_start_time = NOW(),
          updated_at = NOW()
        WHERE id = current_race.id;
      ELSE
        -- Update countdown timer only
        UPDATE race_state 
        SET countdown_timer = GREATEST(0, 3 - countdown_elapsed)
        WHERE id = current_race.id;
      END IF;

    WHEN 'racing' THEN
      -- Race in progress
      elapsed_time := EXTRACT(EPOCH FROM (NOW() - COALESCE(current_race.race_start_time, current_race.updated_at)))::INTEGER;
      
      -- Update horse positions
      FOR horse IN SELECT * FROM jsonb_array_elements(current_race.horses)
      LOOP
        -- Calculate horse speed based on attributes
        base_speed := (horse->>'speed')::DECIMAL * 0.8 + 
                     (horse->>'acceleration')::DECIMAL * 0.2;
        
        -- Add some randomness (±15%)
        current_speed := base_speed * (0.85 + random() * 0.3);
        
        -- Calculate position (max 1200m)
        new_position := LEAST(1200, current_speed * elapsed_time);
        
        -- Update horse position
        horse := jsonb_set(horse, '{position}', to_jsonb(new_position));
        updated_horses := updated_horses || horse;
        
        -- Check if horse finished
        IF new_position >= 1200 AND NOT EXISTS (
          SELECT 1 FROM jsonb_array_elements(finish_times) ft 
          WHERE ft->>'name' = horse->>'name'
        ) THEN
          finish_times := finish_times || jsonb_build_object(
            'name', horse->>'name',
            'time', elapsed_time + (new_position - 1200) / current_speed,
            'placement', jsonb_array_length(finish_times) + 1
          );
        END IF;
      END LOOP;
      
      -- Update race with new positions
      UPDATE race_state 
      SET 
        horses = updated_horses,
        race_timer = elapsed_time,
        updated_at = NOW()
      WHERE id = current_race.id;
      
      -- Check if race is finished
      IF jsonb_array_length(finish_times) >= jsonb_array_length(current_race.horses) OR elapsed_time >= 30 THEN
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
      elapsed_time := EXTRACT(EPOCH FROM (NOW() - current_race.updated_at))::INTEGER;
      
      IF elapsed_time >= 15 THEN
        -- Start new race
        PERFORM start_new_race();
      END IF;
  END CASE;
END;
$$ LANGUAGE plpgsql;