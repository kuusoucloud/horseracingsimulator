-- Fix ELO-based odds calculation system

-- First, create the generate_race_horses function that properly uses ELO
CREATE OR REPLACE FUNCTION generate_race_horses() RETURNS JSONB AS $$
DECLARE
  new_horses JSONB := '[]'::JSONB;
  horse_names TEXT[] := ARRAY[
    'Thunder Strike', 'Lightning Bolt', 'Storm Chaser', 'Fire Storm',
    'Golden Arrow', 'Silver Bullet', 'Midnight Express', 'Royal Thunder',
    'Diamond Dash', 'Crimson Flash', 'Blazing Glory', 'Wind Walker',
    'Star Gazer', 'Moon Runner', 'Sun Dancer', 'Ocean Breeze',
    'Mountain Peak', 'Desert Wind', 'Forest Fire', 'River Rush',
    'Eagle Eye', 'Falcon Flight', 'Phoenix Rising', 'Dragon Heart',
    'Tiger Stripe', 'Brave Spirit', 'Wild Mustang', 'Free Runner',
    'Swift Arrow', 'Noble Knight', 'Gentle Giant', 'Proud Warrior',
    'Silent Storm', 'Dancing Queen', 'Singing Bird', 'Flying Fish',
    'Jumping Jack', 'Running Bear', 'Climbing Cat', 'Swimming Swan'
  ];
  selected_names TEXT[];
  horse_name TEXT;
  horse_data JSONB;
  horse_elo INTEGER;
  all_elos INTEGER[];
  total_strength DECIMAL;
  horse_strength DECIMAL;
  probability DECIMAL;
  odds_value DECIMAL;
  lane_counter INTEGER := 1;
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
  
  -- Get ELO ratings for all selected horses (default to 500 if not found)
  SELECT ARRAY(
    SELECT COALESCE(
      (SELECT elo FROM horses WHERE name = horse_name), 
      500
    )
  ) INTO all_elos
  FROM unnest(selected_names) AS horse_name;
  
  -- Calculate total strength for odds calculation
  total_strength := 0;
  FOR i IN 1..array_length(all_elos, 1) LOOP
    total_strength := total_strength + power(10, all_elos[i] / 400.0);
  END LOOP;
  
  -- Generate horse data with proper ELO-based odds
  FOR i IN 1..array_length(selected_names, 1) LOOP
    horse_name := selected_names[i];
    horse_elo := all_elos[i];
    
    -- Calculate this horse's strength and probability
    horse_strength := power(10, horse_elo / 400.0);
    probability := horse_strength / total_strength;
    
    -- Convert probability to odds (with 2% house edge)
    probability := probability * 0.98;
    odds_value := 1.0 / probability;
    
    -- Round odds appropriately
    IF odds_value < 1.5 THEN
      odds_value := ROUND(odds_value::NUMERIC, 2);
    ELSIF odds_value < 5 THEN
      odds_value := ROUND((odds_value * 20)::NUMERIC) / 20.0;
    ELSIF odds_value < 15 THEN
      odds_value := ROUND((odds_value * 10)::NUMERIC) / 10.0;
    ELSIF odds_value < 50 THEN
      odds_value := ROUND((odds_value * 2)::NUMERIC) / 2.0;
    ELSE
      odds_value := ROUND(odds_value::NUMERIC);
    END IF;
    
    -- Ensure reasonable bounds
    odds_value := GREATEST(1.01, LEAST(999.0, odds_value));
    
    -- Generate attributes based on ELO
    horse_data := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', horse_name,
      'elo', horse_elo,
      'odds', odds_value,
      'speed', GREATEST(60, LEAST(95, 60 + (horse_elo - 500) / 20 + (random() * 10 - 5)::INTEGER)),
      'stamina', GREATEST(60, LEAST(95, 60 + (horse_elo - 500) / 25 + (random() * 10 - 5)::INTEGER)),
      'acceleration', GREATEST(60, LEAST(95, 60 + (horse_elo - 500) / 22 + (random() * 10 - 5)::INTEGER)),
      'position', 0,
      'lane', lane_counter,
      'sprintStartPercent', 40 + random() * 35
    );
    
    new_horses := new_horses || horse_data;
    lane_counter := lane_counter + 1;
  END LOOP;
  
  RETURN new_horses;
END;
$$ LANGUAGE plpgsql;

-- Update the start_new_race function to use the new generate_race_horses function
CREATE OR REPLACE FUNCTION start_new_race() RETURNS VOID AS $$
DECLARE
  new_horses JSONB;
  weather_conditions JSONB;
  weather_condition TEXT;
  weather_options TEXT[] := ARRAY['sunny', 'cloudy', 'rainy', 'twilight'];
BEGIN
  -- Generate horses with proper ELO-based odds
  new_horses := generate_race_horses();
  
  -- Generate weather conditions
  weather_condition := weather_options[1 + (random() * (array_length(weather_options, 1) - 1))::INTEGER];
  
  weather_conditions := jsonb_build_object(
    'condition', weather_condition,
    'humidity', (30 + random() * 40)::INTEGER,
    'temperature', (15 + random() * 20)::INTEGER,
    'windSpeed', (5 + random() * 25)::INTEGER
  );
  
  -- Create new race with ELO-based horses and proper odds
  INSERT INTO race_state (
    race_state,
    horses,
    weather_conditions,
    pre_race_timer,
    countdown_timer,
    race_timer,
    show_photo_finish,
    show_results,
    race_results,
    photo_finish_results,
    created_at,
    updated_at
  ) VALUES (
    'pre-race',
    new_horses,
    weather_conditions,
    10,
    0,
    0,
    false,
    false,
    '[]'::JSONB,
    '[]'::JSONB,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'New race started with ELO-based horses and proper odds: %', new_horses;
END;
$$ LANGUAGE plpgsql;