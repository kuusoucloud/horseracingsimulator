-- Fix the race system with a working race tick function

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
  RAISE NOTICE '🎯 Race tick started at %', current_time;

  -- Handle PRE-RACE state (10 second countdown)
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'pre-race'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NOT NULL THEN
    race_duration_ms := EXTRACT(EPOCH FROM (current_time - current_race.created_at)) * 1000;
    
    RAISE NOTICE 'PRE-RACE: Duration %ms, Timer should be %s', race_duration_ms, GREATEST(0, 10 - FLOOR(race_duration_ms / 1000));
    
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
        countdown_start_time = current_time,
        updated_at = current_time
      WHERE id = current_race.id;
      
      RAISE NOTICE '✅ PRE-RACE COMPLETE - Transitioning to COUNTDOWN at %', current_time;
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
    countdown_duration_ms := EXTRACT(EPOCH FROM (current_time - COALESCE(current_race.countdown_start_time, current_race.updated_at))) * 1000;
    
    RAISE NOTICE 'COUNTDOWN: Duration %ms, Timer should be %s', countdown_duration_ms, GREATEST(0, 5 - FLOOR(countdown_duration_ms / 1000));
    
    -- Update countdown timer
    UPDATE race_state 
    SET 
      countdown_timer = GREATEST(0, 5 - FLOOR(countdown_duration_ms / 1000)),
      updated_at = current_time
    WHERE id = current_race.id;
    
    -- Start racing after 5 seconds
    IF countdown_duration_ms >= 5000 THEN
      -- Reset all horse positions to 0
      UPDATE horses 
      SET position = 0, velocity = 0, updated_at = current_time
      WHERE id = ANY(SELECT jsonb_array_elements_text(to_jsonb(current_race.horses))::uuid);
      
      UPDATE race_state 
      SET 
        race_state = 'racing',
        race_start_time = current_time,
        race_timer = 0,
        updated_at = current_time
      WHERE id = current_race.id;
      
      RAISE NOTICE '🏁 RACE STARTED! Horses are now racing at %', current_time;
    END IF;
    
    RETURN;
  END IF;

  -- Handle RACING state - Move horses
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'racing'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NULL THEN
    RAISE NOTICE 'No active race found';
    RETURN;
  END IF;

  -- Calculate race duration
  race_duration_ms := EXTRACT(EPOCH FROM (current_time - current_race.race_start_time)) * 1000;
  total_horses := jsonb_array_length(to_jsonb(current_race.horses));

  RAISE NOTICE 'RACING: Duration %ms, Moving % horses', race_duration_ms, total_horses;

  -- Move horses
  FOR horse_record IN 
    SELECT h.* FROM horses h
    WHERE h.id = ANY(SELECT jsonb_array_elements_text(to_jsonb(current_race.horses))::uuid)
  LOOP
    -- Calculate speed with ELO influence
    base_speed := (horse_record.speed * 0.8 + horse_record.acceleration * 0.2) / 100.0;
    
    -- ELO-based performance (default to 500 if null)
    speed_variation := 0.8 + ((COALESCE(horse_record.elo, 500) - 400) / 400.0) * 0.4;
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

    RAISE NOTICE 'Horse % moved to position % (velocity: %)', horse_record.name, new_position, current_velocity;

    -- Count finished horses
    IF new_position >= 1200.0 THEN
      finished_horses := finished_horses + 1;
    END IF;
  END LOOP;

  -- Update race timer
  UPDATE race_state 
  SET 
    race_timer = FLOOR(race_duration_ms / 1000),
    updated_at = current_time
  WHERE id = current_race.id;

  -- Check if race is complete (all horses finished or timeout)
  IF finished_horses >= total_horses OR race_duration_ms > 100000 THEN
    -- End race
    UPDATE race_state 
    SET 
      race_state = 'finished',
      race_end_time = current_time,
      show_photo_finish = true,
      show_results = true,
      updated_at = current_time
    WHERE id = current_race.id;
    
    RAISE NOTICE '🏆 Race finished! % horses completed', finished_horses;
    
    -- Start a new race after 5 seconds
    INSERT INTO race_state (
      race_state,
      horses,
      pre_race_timer,
      countdown_timer,
      race_timer,
      weather_conditions,
      created_at,
      updated_at
    )
    SELECT 
      'pre-race',
      jsonb_agg(
        jsonb_build_object(
          'id', h.id,
          'name', h.name,
          'speed', h.speed,
          'stamina', h.stamina,
          'acceleration', h.acceleration,
          'elo', COALESCE(h.elo, 500),
          'position', 0,
          'lane', ROW_NUMBER() OVER (ORDER BY RANDOM()),
          'odds', 8.0 + (RANDOM() * 2.0),
          'sprintStartPercent', 40 + (RANDOM() * 30)
        )
      ),
      10,
      0,
      0,
      jsonb_build_object(
        'condition', (ARRAY['sunny', 'cloudy', 'rainy'])[FLOOR(RANDOM() * 3) + 1],
        'temperature', 10 + FLOOR(RANDOM() * 20),
        'humidity', 30 + FLOOR(RANDOM() * 40),
        'windSpeed', FLOOR(RANDOM() * 20)
      ),
      current_time + INTERVAL '5 seconds',
      current_time + INTERVAL '5 seconds'
    FROM (
      SELECT * FROM horses 
      ORDER BY RANDOM() 
      LIMIT 8
    ) h;
    
    RAISE NOTICE '🆕 New race scheduled to start in 5 seconds';
  END IF;

END;
$$ LANGUAGE plpgsql;