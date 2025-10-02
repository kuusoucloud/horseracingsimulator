-- Fix race countdown transition and proper ELO-based odds calculation

-- Create a simple ELO-based odds calculation function
CREATE OR REPLACE FUNCTION calculate_horse_odds(horse_elo INTEGER, avg_elo DECIMAL) RETURNS DECIMAL AS $$
DECLARE
  elo_diff DECIMAL;
  probability DECIMAL;
  odds DECIMAL;
BEGIN
  -- Calculate ELO difference from average
  elo_diff := horse_elo - avg_elo;
  
  -- Convert ELO difference to probability (higher ELO = higher probability)
  -- Each 100 ELO points = roughly 2x better/worse odds
  probability := 1.0 / (1.0 + power(10.0, -elo_diff / 200.0));
  
  -- Normalize probability to reasonable range (10% to 60%)
  probability := GREATEST(0.1, LEAST(0.6, probability));
  
  -- Convert to odds (odds = 1 / probability)
  odds := 1.0 / probability;
  
  -- Round to 1 decimal place and ensure minimum odds of 1.5
  RETURN GREATEST(1.5, ROUND(odds::DECIMAL, 1));
END;
$$ LANGUAGE plpgsql;

-- Update start_new_race to use proper odds calculation
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
    'Sapphire Blue', 'Midnight Express', 'Dawn Breaker', 'Sunset Glory'
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
  horse_id TEXT;
  existing_horse RECORD;
  lane_number INTEGER := 1;
  total_elo INTEGER := 0;
  avg_elo DECIMAL;
  horse_count INTEGER := 0;
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
    'temperature', floor(random() * 20 + 15),
    'humidity', floor(random() * 40 + 40),
    'windSpeed', floor(random() * 15 + 5)
  );
  
  -- Initialize horses array
  new_horses := '[]'::JSONB;
  
  -- First pass: Get or create horses and calculate average ELO
  FOREACH horse_name IN ARRAY selected_names
  LOOP
    -- Check if horse exists in database
    SELECT * INTO existing_horse FROM horses WHERE name = horse_name LIMIT 1;
    
    IF existing_horse IS NOT NULL THEN
      horse_elo := existing_horse.elo;
      speed_attr := existing_horse.speed;
      stamina_attr := existing_horse.stamina;
      acceleration_attr := existing_horse.acceleration;
      horse_id := existing_horse.id;
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
    
    -- Accumulate ELO for average calculation
    total_elo := total_elo + horse_elo;
    horse_count := horse_count + 1;
  END LOOP;
  
  -- Calculate average ELO
  avg_elo := total_elo::DECIMAL / horse_count;
  
  -- Second pass: Build horse lineup with proper odds
  lane_number := 1;
  FOREACH horse_name IN ARRAY selected_names
  LOOP
    -- Get horse data
    SELECT * INTO existing_horse FROM horses WHERE name = horse_name LIMIT 1;
    
    -- Calculate odds based on ELO vs average
    calculated_odds := calculate_horse_odds(existing_horse.elo, avg_elo);
    
    -- Build horse object
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
  
  -- Insert new race state
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
  
  RAISE NOTICE 'New race started with % horses, avg ELO: %', jsonb_array_length(new_horses), avg_elo;
END;
$$ LANGUAGE plpgsql;

-- Fix the race tick function with proper state transitions
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
      
      RAISE NOTICE 'Transitioning to countdown phase';
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
      
      RAISE NOTICE 'RACE STARTED! Horses are now racing!';
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

  -- Update horse positions
  FOR horse_record IN 
    SELECT * FROM horses 
    WHERE id = ANY(current_race.horse_lineup)
  LOOP
    -- Calculate speed with ELO influence
    base_speed := (horse_record.speed * 0.8 + horse_record.acceleration * 0.2) / 100.0;
    
    -- ELO-based performance (400-800 ELO maps to 0.8x-1.2x performance)
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
    -- Get final results
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
    
    -- Update ELO ratings
    PERFORM update_horse_elos_after_race(current_race.horse_lineup, race_results);
    
    RAISE NOTICE 'Race finished with % horses', finished_horses;
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