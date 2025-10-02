-- Unified ELO system with consistent K-factors across all components
-- K-factor 192 for 1st, 2nd, 3rd place horses
-- K-factor 32 for 4th-8th place horses

-- Create unified ELO calculation function with specified K-factors
CREATE OR REPLACE FUNCTION calculate_elo_change_unified(
  current_elo INTEGER,
  opponent_avg_elo INTEGER,
  placement INTEGER,
  total_horses INTEGER
) RETURNS INTEGER AS $$
DECLARE
  k_factor INTEGER;
  expected_score DECIMAL;
  actual_score DECIMAL;
  elo_change INTEGER;
BEGIN
  -- K-factor based on placement (as specified by user)
  IF placement <= 3 THEN
    k_factor := 192; -- Top 3 horses get K-factor of 192
  ELSE
    k_factor := 32;  -- 4th-8th horses get K-factor of 32
  END IF;
  
  -- Expected score based on ELO difference (standard ELO formula)
  expected_score := 1.0 / (1.0 + POWER(10.0, (opponent_avg_elo - current_elo) / 400.0));
  
  -- Actual score based on placement (more granular scoring)
  CASE placement
    WHEN 1 THEN actual_score := 1.0;    -- Winner gets full score
    WHEN 2 THEN actual_score := 0.8;    -- 2nd place gets 80%
    WHEN 3 THEN actual_score := 0.6;    -- 3rd place gets 60%
    WHEN 4 THEN actual_score := 0.4;    -- 4th place gets 40%
    WHEN 5 THEN actual_score := 0.3;    -- 5th place gets 30%
    WHEN 6 THEN actual_score := 0.2;    -- 6th place gets 20%
    WHEN 7 THEN actual_score := 0.1;    -- 7th place gets 10%
    ELSE actual_score := 0.0;           -- Last place gets 0%
  END CASE;
  
  -- Calculate ELO change
  elo_change := ROUND(k_factor * (actual_score - expected_score));
  
  RETURN elo_change;
END;
$$ LANGUAGE plpgsql;

-- Update horse ELO after race with unified system
CREATE OR REPLACE FUNCTION update_horse_elos_after_race(
  horse_lineup TEXT[],
  race_results JSONB
) RETURNS VOID AS $$
DECLARE
  result JSONB;
  horse_id TEXT;
  horse_name TEXT;
  placement INTEGER;
  current_elo INTEGER;
  avg_elo INTEGER;
  elo_change INTEGER;
  new_elo INTEGER;
  total_horses INTEGER;
  horse_record RECORD;
BEGIN
  -- Get total number of horses in race
  total_horses := array_length(horse_lineup, 1);
  
  -- Calculate average ELO of all horses in race
  SELECT AVG(h.elo)::INTEGER INTO avg_elo
  FROM horses h
  WHERE h.id = ANY(horse_lineup);
  
  -- Update ELO for each horse based on race results
  FOR result IN SELECT * FROM jsonb_array_elements(race_results)
  LOOP
    horse_id := result->>'id';
    horse_name := result->>'name';
    placement := (result->>'placement')::INTEGER;
    
    -- Get current horse data
    SELECT * INTO horse_record FROM horses WHERE id = horse_id;
    
    IF horse_record IS NOT NULL THEN
      current_elo := horse_record.elo;
      
      -- Calculate ELO change using unified system
      elo_change := calculate_elo_change_unified(current_elo, avg_elo, placement, total_horses);
      new_elo := current_elo + elo_change;
      
      -- Ensure ELO doesn't go below 100
      IF new_elo < 100 THEN
        new_elo := 100;
      END IF;
      
      -- Update horse record with new ELO and stats
      UPDATE horses 
      SET 
        elo = new_elo,
        total_races = COALESCE(total_races, 0) + 1,
        wins = CASE WHEN placement = 1 THEN COALESCE(wins, 0) + 1 ELSE COALESCE(wins, 0) END,
        recent_form = (
          CASE 
            WHEN array_length(COALESCE(recent_form, ARRAY[]::INTEGER[]), 1) >= 5 THEN
              (COALESCE(recent_form, ARRAY[]::INTEGER[]))[2:5] || ARRAY[placement]
            ELSE
              COALESCE(recent_form, ARRAY[]::INTEGER[]) || ARRAY[placement]
          END
        ),
        updated_at = NOW()
      WHERE id = horse_id;
      
      -- Log ELO change for debugging
      RAISE NOTICE 'Horse % (%) ELO: % -> % (change: %+, K-factor: %)', 
        horse_name, 
        horse_id, 
        current_elo, 
        new_elo, 
        elo_change,
        CASE WHEN placement <= 3 THEN 192 ELSE 32 END;
    END IF;
  END LOOP;
  
  RAISE NOTICE 'ELO ratings updated for % horses with unified K-factor system', total_horses;
END;
$$ LANGUAGE plpgsql;

-- Update the race tick function to use the unified ELO system
CREATE OR REPLACE FUNCTION update_race_tick() RETURNS void AS $$
DECLARE
  current_race RECORD;
  horse_record RECORD;
  race_duration_ms INTEGER;
  countdown_duration_ms INTEGER;
  time_delta_ms INTEGER := 100;
  base_speed DECIMAL;
  speed_variation DECIMAL;
  current_velocity DECIMAL;
  new_position DECIMAL;
  finished_horses INTEGER := 0;
  total_horses INTEGER := 0;
  race_results JSONB := '[]'::JSONB;
  horse_result JSONB;
  current_time TIMESTAMP := NOW();
BEGIN
  -- Auto-restart finished races
  PERFORM auto_restart_race();

  -- Handle PRE-RACE state (10 second countdown)
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'pre-race'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NOT NULL THEN
    race_duration_ms := EXTRACT(EPOCH FROM (current_time - current_race.created_at)) * 1000;
    
    -- Update pre-race timer
    UPDATE race_state 
    SET 
      pre_race_timer = GREATEST(0, 10 - FLOOR(race_duration_ms / 1000)),
      updated_at = current_time
    WHERE id = current_race.id;
    
    -- Transition to countdown after 10 seconds
    IF race_duration_ms >= 10000 THEN
      UPDATE race_state 
      SET 
        race_state = 'countdown',
        countdown_timer = 5,
        updated_at = current_time
      WHERE id = current_race.id;
      
      RAISE NOTICE 'PRE-RACE COMPLETE - Transitioning to COUNTDOWN';
    END IF;
    
    RETURN;
  END IF;

  -- Handle COUNTDOWN state (5 second countdown)
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'countdown'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NOT NULL THEN
    -- Calculate time since countdown started
    countdown_duration_ms := EXTRACT(EPOCH FROM (current_time - current_race.updated_at)) * 1000;
    
    -- Update countdown timer
    UPDATE race_state 
    SET 
      countdown_timer = GREATEST(0, 5 - FLOOR(countdown_duration_ms / 1000)),
      updated_at = current_time
    WHERE id = current_race.id;
    
    -- START RACING after 5 seconds
    IF countdown_duration_ms >= 5000 THEN
      UPDATE race_state 
      SET 
        race_state = 'racing',
        race_start_time = current_time,
        race_timer = 0,
        updated_at = current_time
      WHERE id = current_race.id;
      
      RAISE NOTICE 'COUNTDOWN COMPLETE - RACE STARTED! Horses are now racing!';
    END IF;
    
    RETURN;
  END IF;

  -- Handle RACING state
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'racing'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NULL THEN
    RETURN;
  END IF;

  -- Calculate race duration
  race_duration_ms := EXTRACT(EPOCH FROM (current_time - current_race.race_start_time)) * 1000;
  total_horses := array_length(current_race.horse_lineup, 1);

  -- Update horse positions with ELO-based performance
  FOR horse_record IN 
    SELECT * FROM horses 
    WHERE id = ANY(current_race.horse_lineup)
  LOOP
    -- Calculate speed with ELO influence (ELO affects racing performance)
    base_speed := (horse_record.speed * 0.8 + horse_record.acceleration * 0.2) / 100.0;
    
    -- ELO-based performance modifier (400-800 ELO maps to 0.8x-1.2x performance)
    speed_variation := 0.8 + ((horse_record.elo - 400) / 400.0) * 0.4;
    speed_variation := GREATEST(0.7, LEAST(1.3, speed_variation));
    
    current_velocity := (18.0 + (base_speed * 7.0)) * speed_variation;
    
    -- Update position
    new_position := LEAST(
      COALESCE(horse_record.position, 0) + (current_velocity * time_delta_ms / 1000.0),
      1200.0
    );

    UPDATE horses 
    SET 
      position = new_position,
      velocity = current_velocity,
      updated_at = current_time
    WHERE id = horse_record.id;

    -- Count finished horses
    IF new_position >= 1200.0 THEN
      finished_horses := finished_horses + 1;
      
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

  -- Update race results
  IF jsonb_array_length(race_results) > 0 THEN
    UPDATE race_state 
    SET 
      race_results = COALESCE(race_results, '[]'::JSONB) || race_results,
      updated_at = current_time
    WHERE id = current_race.id;
  END IF;

  -- Check if race is complete
  IF finished_horses >= total_horses OR race_duration_ms > 100000 THEN
    -- Get final results sorted by finish order
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

    -- End race
    UPDATE race_state 
    SET 
      race_state = 'finished',
      race_end_time = current_time,
      race_results = race_results,
      show_photo_finish = true,
      show_results = true,
      updated_at = current_time
    WHERE id = current_race.id;
    
    -- Update ELO ratings using unified system
    PERFORM update_horse_elos_after_race(current_race.horse_lineup, race_results);
    
    RAISE NOTICE 'Race finished with unified ELO system - % horses completed', finished_horses;
  ELSE
    -- Update race timer
    UPDATE race_state 
    SET 
      timer = GREATEST(0, 20 - FLOOR(race_duration_ms / 1000)),
      updated_at = current_time
    WHERE id = current_race.id;
  END IF;

END;
$$ LANGUAGE plpgsql;