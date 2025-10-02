-- Add automatic race restart after results are shown

-- Create function to automatically start new race after results timeout
CREATE OR REPLACE FUNCTION auto_restart_race() RETURNS void AS $$
DECLARE
  current_race RECORD;
  time_since_finish INTEGER;
BEGIN
  -- Get the most recent finished race
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'finished' OR race_state = 'photo_finish'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NULL THEN
    RETURN;
  END IF;

  -- Calculate time since race ended (in seconds)
  time_since_finish := EXTRACT(EPOCH FROM (NOW() - current_race.race_end_time));

  -- If race has been finished for more than 15 seconds, start a new race
  IF time_since_finish > 15 THEN
    RAISE NOTICE 'Auto-restarting race after % seconds', time_since_finish;
    
    -- Start a new race
    PERFORM start_new_race();
    
    RAISE NOTICE 'New race automatically started!';
  END IF;

END;
$$ LANGUAGE plpgsql;

-- Update the race tick function to also handle auto-restart
CREATE OR REPLACE FUNCTION update_race_tick() RETURNS void AS $$
DECLARE
  current_race RECORD;
  horse_record RECORD;
  race_duration_ms INTEGER;
  time_delta_ms INTEGER := 100;
  base_speed DECIMAL;
  speed_variation DECIMAL;
  current_velocity DECIMAL;
  new_position DECIMAL;
  finished_horses INTEGER := 0;
  total_horses INTEGER := 0;
  race_results JSONB := '[]'::JSONB;
  horse_result JSONB;
BEGIN
  -- First check if we need to auto-restart a finished race
  PERFORM auto_restart_race();

  -- Get current racing state
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'racing'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NULL THEN
    RETURN;
  END IF;

  -- Calculate race duration
  race_duration_ms := EXTRACT(EPOCH FROM (NOW() - current_race.race_start_time)) * 1000;

  -- Count total horses in race
  SELECT array_length(current_race.horse_lineup, 1) INTO total_horses;

  -- Update each horse position
  FOR horse_record IN 
    SELECT * FROM horses 
    WHERE id = ANY(current_race.horse_lineup)
  LOOP
    -- Calculate realistic horse speed (18-25 m/s range)
    base_speed := (horse_record.speed * 0.8 + horse_record.acceleration * 0.2) / 100.0;
    
    -- Use horse ID for consistent speed variation
    speed_variation := 0.85 + (((ascii(substring(horse_record.id, 1, 1)) * 7) % 100) / 100.0 * 0.3);
    current_velocity := (18.0 + (base_speed * 7.0)) * speed_variation;
    
    -- Calculate new position
    new_position := LEAST(
      COALESCE(horse_record.position, 0) + (current_velocity * time_delta_ms / 1000.0),
      1200.0
    );

    -- Update horse position
    UPDATE horses 
    SET 
      position = new_position,
      velocity = current_velocity,
      updated_at = NOW()
    WHERE id = horse_record.id;

    -- Count finished horses (reached 1200m)
    IF new_position >= 1200.0 THEN
      finished_horses := finished_horses + 1;
      
      -- Add to race results if not already added
      IF NOT EXISTS (
        SELECT 1 FROM jsonb_array_elements(current_race.race_results) AS result
        WHERE result->>'id' = horse_record.id
      ) THEN
        horse_result := jsonb_build_object(
          'id', horse_record.id,
          'name', horse_record.name,
          'position', new_position,
          'finishTime', race_duration_ms / 1000.0,
          'placement', finished_horses
        );
        race_results := race_results || horse_result;
      END IF;
    END IF;
  END LOOP;

  -- Update race results in real-time
  IF jsonb_array_length(race_results) > 0 THEN
    UPDATE race_state 
    SET 
      race_results = COALESCE(race_results, '[]'::JSONB) || race_results,
      updated_at = NOW()
    WHERE id = current_race.id;
  END IF;

  -- Check if ALL horses have finished OR race has been running too long (100 second timeout)
  IF finished_horses >= total_horses OR race_duration_ms > 100000 THEN -- 100 second timeout
    RAISE NOTICE 'Race complete: % of % horses finished', finished_horses, total_horses;
    
    -- Get final results sorted by finish time
    SELECT jsonb_agg(
      jsonb_build_object(
        'id', h.id,
        'name', h.name,
        'position', h.position,
        'finishTime', CASE 
          WHEN h.position >= 1200 THEN race_duration_ms / 1000.0
          ELSE NULL 
        END,
        'placement', ROW_NUMBER() OVER (ORDER BY 
          CASE WHEN h.position >= 1200 THEN h.position ELSE 0 END DESC,
          h.position DESC
        )
      )
    ) INTO race_results
    FROM horses h
    WHERE h.id = ANY(current_race.horse_lineup);

    -- End race with complete results
    UPDATE race_state 
    SET 
      race_state = 'finished',
      race_end_time = NOW(),
      race_results = race_results,
      show_photo_finish = true,
      show_results = true,
      updated_at = NOW()
    WHERE id = current_race.id;
    
    RAISE NOTICE 'Race ended with results: %', race_results;
  ELSE
    -- Update race timer
    UPDATE race_state 
    SET 
      timer = GREATEST(0, 20 - FLOOR(race_duration_ms / 1000)),
      updated_at = NOW()
    WHERE id = current_race.id;
  END IF;

END;
$$ LANGUAGE plpgsql;