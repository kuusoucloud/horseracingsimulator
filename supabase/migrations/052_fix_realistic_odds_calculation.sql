-- Fix odds calculation to show realistic values instead of 999.00

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
  current_horse_name TEXT;
  horse_data JSONB;
  horse_elo INTEGER;
  all_elos INTEGER[];
  min_elo INTEGER;
  max_elo INTEGER;
  elo_range INTEGER;
  base_strength DECIMAL;
  total_strength DECIMAL;
  probability DECIMAL;
  odds_value DECIMAL;
  lane_counter INTEGER := 1;
  num_horses INTEGER := 8;
BEGIN
  -- Select 8 random horse names
  selected_names := (
    SELECT ARRAY(
      SELECT horse_names[i] 
      FROM generate_series(1, array_length(horse_names, 1)) i 
      ORDER BY random() 
      LIMIT num_horses
    )
  );
  
  -- Get ELO ratings for all selected horses (default to 500 if not found)
  SELECT ARRAY(
    SELECT COALESCE(
      (SELECT elo FROM horses WHERE name = selected_name), 
      500
    )
  ) INTO all_elos
  FROM unnest(selected_names) AS selected_name;
  
  -- Find ELO range for normalization
  SELECT MIN(elo), MAX(elo) INTO min_elo, max_elo FROM unnest(all_elos) AS elo;
  elo_range := GREATEST(1, max_elo - min_elo);
  
  -- Always create some variation for realistic odds, even with similar ELOs
  IF elo_range < 50 THEN
    -- Add small random variations to create realistic odds spread
    FOR i IN 1..array_length(all_elos, 1) LOOP
      all_elos[i] := all_elos[i] + (random() * 40 - 20)::INTEGER;
    END LOOP;
    SELECT MIN(elo), MAX(elo) INTO min_elo, max_elo FROM unnest(all_elos) AS elo;
    elo_range := GREATEST(1, max_elo - min_elo);
  END IF;
  
  -- Calculate total strength using simple linear scaling
  total_strength := 0;
  FOR i IN 1..array_length(all_elos, 1) LOOP
    -- Simple linear scaling: higher ELO = higher strength
    base_strength := 1.0 + (all_elos[i] - min_elo)::DECIMAL / elo_range * 2.0; -- 1.0 to 3.0 range
    total_strength := total_strength + base_strength;
  END LOOP;
  
  -- Generate horse data with realistic odds
  FOR i IN 1..array_length(selected_names, 1) LOOP
    current_horse_name := selected_names[i];
    horse_elo := all_elos[i];
    
    -- Calculate this horse's strength and probability
    base_strength := 1.0 + (horse_elo - min_elo)::DECIMAL / elo_range * 2.0;
    probability := base_strength / total_strength;
    
    -- Convert probability to odds with house edge
    odds_value := (1.0 / probability) * 1.10; -- 10% house edge for more realistic spread
    
    -- Round to standard betting increments
    IF odds_value < 2 THEN
      odds_value := ROUND(odds_value::NUMERIC, 2);
    ELSIF odds_value < 5 THEN
      odds_value := ROUND((odds_value * 4)::NUMERIC) / 4.0; -- Quarter increments
    ELSIF odds_value < 10 THEN
      odds_value := ROUND((odds_value * 2)::NUMERIC) / 2.0; -- Half increments
    ELSE
      odds_value := ROUND(odds_value::NUMERIC); -- Whole numbers
    END IF;
    
    -- Ensure reasonable bounds for horse racing
    odds_value := GREATEST(1.20, LEAST(25.0, odds_value));
    
    -- Generate attributes based on ELO
    horse_data := jsonb_build_object(
      'id', gen_random_uuid()::text,
      'name', current_horse_name,
      'elo', horse_elo,
      'odds', odds_value,
      'speed', GREATEST(65, LEAST(95, 75 + (horse_elo - 500) / 15 + (random() * 8 - 4)::INTEGER)),
      'stamina', GREATEST(65, LEAST(95, 75 + (horse_elo - 500) / 18 + (random() * 8 - 4)::INTEGER)),
      'acceleration', GREATEST(65, LEAST(95, 75 + (horse_elo - 500) / 16 + (random() * 8 - 4)::INTEGER)),
      'position', 0,
      'lane', lane_counter,
      'sprintStartPercent', 35 + random() * 30
    );
    
    new_horses := new_horses || horse_data;
    lane_counter := lane_counter + 1;
  END LOOP;
  
  RETURN new_horses;
END;
$$ LANGUAGE plpgsql;