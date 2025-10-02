-- Reset ALL horses to 500 ELO (not just NULL/0 ones)
UPDATE horses SET 
  elo = 500,
  total_races = 0,
  wins = 0,
  recent_form = '{}',
  updated_at = NOW();

-- Also reset any existing race results to ensure clean slate
DELETE FROM race_state WHERE race_state != 'racing';

-- Create function to generate horses with proper ELO-based attributes and racing logic
CREATE OR REPLACE FUNCTION generate_race_horses() RETURNS JSONB AS $$
DECLARE
  horse_names TEXT[] := ARRAY[
    'Thunder Bolt', 'Lightning Strike', 'Storm Chaser', 'Wind Runner', 
    'Fire Storm', 'Golden Arrow', 'Silver Bullet', 'Midnight Express',
    'Royal Thunder', 'Desert Wind', 'Ocean Breeze', 'Mountain Peak',
    'Blazing Star', 'Swift Arrow', 'Iron Horse', 'Diamond Dust',
    'Crimson Flash', 'Azure Sky', 'Emerald Dream', 'Ruby Fire'
  ];
  horse_colors TEXT[] := ARRAY[
    '#8B4513', '#A0522D', '#D2691E', '#CD853F', '#F4A460',
    '#DEB887', '#D2B48C', '#BC8F8F', '#F5DEB3', '#FFE4B5',
    '#FFDAB9', '#EEE8AA', '#F0E68C', '#BDB76B', '#9ACD32',
    '#6B8E23', '#556B2F', '#8FBC8F', '#90EE90', '#98FB98'
  ];
  generated_horses JSONB := '[]'::JSONB;
  horse_name TEXT;
  horse_color TEXT;
  base_elo INTEGER;
  speed_attr INTEGER;
  stamina_attr INTEGER;
  acceleration_attr INTEGER;
  odds_value DECIMAL;
  sprint_start DECIMAL;
  i INTEGER;
BEGIN
  -- Generate 8 horses with ELO-based attributes
  FOR i IN 1..8 LOOP
    -- Select random name and color
    horse_name := horse_names[1 + (random() * (array_length(horse_names, 1) - 1))::INTEGER];
    horse_color := horse_colors[1 + (random() * (array_length(horse_colors, 1) - 1))::INTEGER];
    
    -- Get or create horse with 500 ELO
    INSERT INTO horses (name, elo, total_races, wins, recent_form)
    VALUES (horse_name, 500, 0, 0, '{}')
    ON CONFLICT (name) DO UPDATE SET 
      elo = 500,
      total_races = 0,
      wins = 0,
      recent_form = '{}';
    
    -- Get the ELO (should be 500 for all)
    SELECT elo INTO base_elo FROM horses WHERE name = horse_name;
    
    -- Generate attributes based on ELO with variation (500 ELO = balanced stats)
    -- Base stats around 50 for 500 ELO, with ±20 variation
    speed_attr := GREATEST(20, LEAST(80, 50 + (random() * 40 - 20)::INTEGER));
    stamina_attr := GREATEST(20, LEAST(80, 50 + (random() * 40 - 20)::INTEGER));
    acceleration_attr := GREATEST(20, LEAST(80, 50 + (random() * 40 - 20)::INTEGER));
    
    -- Calculate odds based on overall ability (lower = better odds)
    -- Average the attributes and convert to odds (50 avg = 5.0 odds)
    odds_value := GREATEST(2.0, LEAST(15.0, 
      10.0 - ((speed_attr + stamina_attr + acceleration_attr) / 3.0 - 50.0) * 0.1
    ));
    
    -- Random sprint start percentage (40-80%)
    sprint_start := 40 + random() * 40;
    
    -- Add horse to generated list
    generated_horses := generated_horses || jsonb_build_object(
      'id', horse_name,
      'name', horse_name,
      'lane', i,
      'color', horse_color,
      'elo', base_elo,
      'speed', speed_attr,
      'stamina', stamina_attr,
      'acceleration', acceleration_attr,
      'odds', odds_value,
      'sprintStartPercent', sprint_start,
      'position', 0,
      'velocity', 0
    );
  END LOOP;
  
  RETURN generated_horses;
END;
$$ LANGUAGE plpgsql;

-- Update the race function to use ELO-based speed calculations
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