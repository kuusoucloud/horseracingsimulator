-- Fix countdown to racing transition and implement proper ELO-based odds calculation

-- First, create a function to calculate ELO-based odds
CREATE OR REPLACE FUNCTION calculate_elo_odds(horse_elo INTEGER, all_horse_elos INTEGER[]) RETURNS DECIMAL AS $$
DECLARE
  total_probability DECIMAL := 0;
  horse_probability DECIMAL;
  i INTEGER;
  other_elo INTEGER;
BEGIN
  -- Calculate this horse's probability using ELO ratings
  -- Higher ELO = higher probability of winning = lower odds
  
  -- Convert ELO to probability using logistic function
  -- Base probability for this horse
  horse_probability := 1.0;
  
  -- Compare against all other horses
  FOR i IN 1..array_length(all_horse_elos, 1) LOOP
    other_elo := all_horse_elos[i];
    IF other_elo != horse_elo THEN
      -- ELO difference calculation (standard chess ELO formula)
      horse_probability := horse_probability * (1.0 / (1.0 + power(10.0, (other_elo - horse_elo) / 400.0)));
    END IF;
  END LOOP;
  
  -- Normalize probability (ensure it's between 0.05 and 0.8)
  horse_probability := GREATEST(0.05, LEAST(0.8, horse_probability));
  
  -- Convert probability to odds (odds = 1 / probability)
  RETURN ROUND((1.0 / horse_probability)::DECIMAL, 2);
END;
$$ LANGUAGE plpgsql;

-- Update the start_new_race function to use ELO-based odds and ensure horses have ELO ratings
CREATE OR REPLACE FUNCTION start_new_race() RETURNS VOID AS $$
DECLARE
  new_horses JSONB;
  horse_names TEXT[] := ARRAY[
    'Thunder Bolt', 'Lightning Strike', 'Storm Chaser', 'Wind Runner',
    'Fire Storm', 'Ice Breaker', 'Star Gazer', 'Moon Walker',
    'Sun Dancer', 'Rain Maker', 'Snow Flake', 'Desert Wind',
    'Ocean Wave', 'Mountain Peak', 'Valley Runner', 'Forest Spirit',
    'Golden Arrow', 'Silver Bullet', 'Bronze Medal', 'Iron Will',
    'Steel Heart', 'Diamond Dust', 'Ruby Red', 'Emerald Green',
    'Sapphire Blue', 'Midnight Express', 'Dawn Breaker', 'Sunset Glory',
    'Aurora Borealis', 'Shooting Star', 'Comet Tail', 'Galaxy Runner',
    'Jumping Jack', 'Proud Warrior', 'Swimming Swan', 'Phoenix Rising',
    'Wild Mustang', 'Swift Arrow', 'Desert Wind'
  ];
  selected_names TEXT[];
  horse_name TEXT;
  horse_data JSONB;
  speed_attr INTEGER;
  stamina_attr INTEGER;
  acceleration_attr INTEGER;
  horse_elo INTEGER;
  calculated_odds DECIMAL;
  weather_conditions JSONB;
  all_horse_elos INTEGER[];
  horse_id TEXT;
  existing_horse RECORD;
  lane_number INTEGER := 1;
BEGIN
  -- Select 8 random horse names
  selected_names := (
    SELECT ARRAY(
      SELECT horse_names[i] 
      FROM generate_series(1, array_length(horse_names, 1)) i 
      ORDER BY random() 
      LIMIT 8
    )
  );
  
  -- Generate weather conditions
  weather_conditions := jsonb_build_object(
    'condition', (ARRAY['sunny', 'cloudy', 'rainy', 'windy'])[floor(random() * 4 + 1)],
    'temperature', floor(random() * 20 + 15), -- 15-35°C
    'humidity', floor(random() * 40 + 40), -- 40-80%
    'windSpeed', floor(random() * 15 + 5) -- 5-20 km/h
  );
  
  -- Initialize horses array and ELO array
  new_horses := '[]'::JSONB;
  all_horse_elos := ARRAY[]::INTEGER[];
  
  -- First pass: Get or create horses and collect ELO ratings
  FOREACH horse_name IN ARRAY selected_names
  LOOP
    -- Check if horse exists in database
    SELECT * INTO existing_horse FROM horses WHERE name = horse_name LIMIT 1;
    
    IF existing_horse IS NOT NULL THEN
      -- Use existing horse with current ELO
      horse_id := existing_horse.id;
      horse_elo := existing_horse.elo;
      speed_attr := existing_horse.speed;
      stamina_attr := existing_horse.stamina;
      acceleration_attr := existing_horse.acceleration;
    ELSE
      -- Create new horse with default ELO of 500
      horse_id := gen_random_uuid()::text;
      horse_elo := 500;
      speed_attr := floor(random() * 56 + 40);
      stamina_attr := floor(random() * 56 + 40);
      acceleration_attr := floor(random() * 56 + 40);
      
      -- Insert new horse into database
      INSERT INTO horses (id, name, speed, stamina, acceleration, elo, position, velocity, updated_at)
      VALUES (horse_id, horse_name, speed_attr, stamina_attr, acceleration_attr, horse_elo, 0, 0, NOW());
    END IF;
    
    -- Reset position for race
    UPDATE horses SET position = 0, velocity = 0, updated_at = NOW() WHERE id = horse_id;
    
    -- Collect ELO for odds calculation
    all_horse_elos := array_append(all_horse_elos, horse_elo);
  END LOOP;
  
  -- Second pass: Calculate odds based on ELO and build horse lineup
  lane_number := 1;
  FOREACH horse_name IN ARRAY selected_names
  LOOP
    -- Get horse data again
    SELECT * INTO existing_horse FROM horses WHERE name = horse_name LIMIT 1;
    
    -- Calculate ELO-based odds
    calculated_odds := calculate_elo_odds(existing_horse.elo, all_horse_elos);
    
    -- Build horse object with ELO-based odds
    horse_data := jsonb_build_object(
      'id', existing_horse.id,
      'name', horse_name,
      'speed', existing_horse.speed,
      'stamina', existing_horse.stamina,
      'acceleration', existing_horse.acceleration,
      'elo', existing_horse.elo,
      'odds', calculated_odds,
      'position', 0,
      'lane', lane_number
    );
    
    -- Add horse to array
    new_horses := new_horses || horse_data;
    lane_number := lane_number + 1;
  END LOOP;
  
  -- Insert new race state with proper lineup
  INSERT INTO race_state (
    race_state,
    horses,
    horse_lineup,
    pre_race_timer,
    countdown_timer,
    race_timer,
    race_results,
    show_photo_finish,
    show_results,
    photo_finish_results,
    weather_conditions,
    created_at,
    updated_at
  ) VALUES (
    'pre-race',
    new_horses,
    (SELECT array_agg((horse->>'id')::text) FROM jsonb_array_elements(new_horses) AS horse),
    10,
    0,
    0,
    '[]'::JSONB,
    false,
    false,
    '[]'::JSONB,
    weather_conditions,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'New race started with % horses and ELO-based odds', jsonb_array_length(new_horses);
END;
$$ LANGUAGE plpgsql;

-- Fix the race tick function to properly handle countdown to racing transition
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
  -- First check if we need to auto-restart a finished race
  PERFORM auto_restart_race();

  -- Handle PRE-RACE state (countdown from 10 to 0)
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'pre-race'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NOT NULL THEN
    -- Calculate time since race was created
    race_duration_ms := EXTRACT(EPOCH FROM (current_time - current_race.created_at)) * 1000;
    
    -- Update pre-race timer (countdown from 10 to 0)
    UPDATE race_state 
    SET 
      pre_race_timer = GREATEST(0, 10 - FLOOR(race_duration_ms / 1000)),
      updated_at = current_time
    WHERE id = current_race.id;
    
    -- Transition to countdown when pre-race timer reaches 0
    IF race_duration_ms >= 10000 THEN -- 10 seconds
      UPDATE race_state 
      SET 
        race_state = 'countdown',
        countdown_timer = 5,
        updated_at = current_time
      WHERE id = current_race.id;
      
      RAISE NOTICE 'Race transitioned from pre-race to countdown';
    END IF;
    
    RETURN;
  END IF;

  -- Handle COUNTDOWN state (countdown from 5 to 0, then start racing)
  SELECT * INTO current_race
  FROM race_state 
  WHERE race_state = 'countdown'
  ORDER BY created_at DESC
  LIMIT 1;

  IF current_race IS NOT NULL THEN
    -- Calculate time since countdown started (use updated_at when state changed to countdown)
    countdown_duration_ms := EXTRACT(EPOCH FROM (current_time - current_race.updated_at)) * 1000;
    
    -- Update countdown timer (countdown from 5 to 0)
    UPDATE race_state 
    SET 
      countdown_timer = GREATEST(0, 5 - FLOOR(countdown_duration_ms / 1000)),
      updated_at = current_time
    WHERE id = current_race.id;
    
    -- START RACING when countdown reaches 0
    IF countdown_duration_ms >= 5000 THEN -- 5 seconds
      UPDATE race_state 
      SET 
        race_state = 'racing',
        race_start_time = current_time,
        race_timer = 0,
        updated_at = current_time
      WHERE id = current_race.id;
      
      RAISE NOTICE 'Race STARTED! Transitioning from countdown to racing';
    END IF;
    
    RETURN;
  END IF;

  -- Handle RACING state (the actual race)
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

  -- Count total horses in race
  SELECT array_length(current_race.horse_lineup, 1) INTO total_horses;

  -- Update each horse position
  FOR horse_record IN 
    SELECT * FROM horses 
    WHERE id = ANY(current_race.horse_lineup)
  LOOP
    -- Calculate realistic horse speed (18-25 m/s range) with ELO influence
    base_speed := (horse_record.speed * 0.8 + horse_record.acceleration * 0.2) / 100.0;
    
    -- ELO-based performance modifier - higher ELO = better performance
    speed_variation := 0.85 + (((horse_record.elo - 400) / 400.0) * 0.3); -- ELO 400-800 maps to 0.85-1.15x
    speed_variation := GREATEST(0.7, LEAST(1.4, speed_variation)); -- Clamp between 0.7x and 1.4x
    
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
      updated_at = current_time
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
      updated_at = current_time
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
      race_end_time = current_time,
      race_results = race_results,
      show_photo_finish = true,
      show_results = true,
      updated_at = current_time
    WHERE id = current_race.id;
    
    -- Update ELO ratings for all horses based on race results
    PERFORM update_horse_elos_after_race(current_race.horse_lineup, race_results);
    
    RAISE NOTICE 'Race ended with results: %', race_results;
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