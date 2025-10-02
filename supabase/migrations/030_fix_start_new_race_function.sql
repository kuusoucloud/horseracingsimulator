-- Fix the start_new_race function with proper ROUND casting
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
    'Aurora Borealis', 'Shooting Star', 'Comet Tail', 'Galaxy Runner'
  ];
  selected_names TEXT[];
  horse_name TEXT;
  horse_data JSONB;
  speed_attr INTEGER;
  stamina_attr INTEGER;
  acceleration_attr INTEGER;
  calculated_odds DECIMAL;
  weather_conditions JSONB;
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
  
  -- Initialize horses array
  new_horses := '[]'::JSONB;
  
  -- Generate horse data
  FOREACH horse_name IN ARRAY selected_names
  LOOP
    -- Generate random attributes (40-95 range)
    speed_attr := floor(random() * 56 + 40);
    stamina_attr := floor(random() * 56 + 40);
    acceleration_attr := floor(random() * 56 + 40);
    
    -- Calculate odds based on attributes (lower is better)
    calculated_odds := ROUND(
      ((300.0 - (speed_attr + stamina_attr + acceleration_attr)) / 30.0 + 
      (random() * 2 - 1))::NUMERIC, -- Cast to NUMERIC for ROUND
      1
    );
    
    -- Ensure odds are reasonable (1.5 to 15.0)
    calculated_odds := GREATEST(1.5, LEAST(15.0, calculated_odds));
    
    -- Build horse object
    horse_data := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', horse_name,
      'speed', speed_attr,
      'stamina', stamina_attr,
      'acceleration', acceleration_attr,
      'odds', calculated_odds,
      'position', 0,
      'lane', array_length(jsonb_array_elements_text(new_horses), 1) + 1
    );
    
    -- Add horse to array
    new_horses := new_horses || horse_data;
  END LOOP;
  
  -- Insert new race state
  INSERT INTO race_state (
    race_state,
    horses,
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
  
  RAISE NOTICE 'New race started with % horses', jsonb_array_length(new_horses);
END;
$$ LANGUAGE plpgsql;