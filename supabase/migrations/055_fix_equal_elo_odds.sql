-- Fix odds calculation when horses have equal or similar ELOs

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
  odds_value DECIMAL;
  lane_counter INTEGER := 1;
  num_horses INTEGER := 8;
  min_elo INTEGER;
  max_elo INTEGER;
  elo_range INTEGER;
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
  
  -- Check ELO range
  SELECT MIN(elo), MAX(elo) INTO min_elo, max_elo FROM unnest(all_elos) AS elo;
  elo_range := max_elo - min_elo;
  
  RAISE NOTICE 'ELO Range: Min=%, Max=%, Range=%', min_elo, max_elo, elo_range;
  
  -- If horses have similar ELOs (within 100 points), give them equal odds
  IF elo_range <= 100 THEN
    RAISE NOTICE 'Using equal odds for similar ELOs';
    -- Equal probability = 1/8, so base odds = 8.00, with house edge = 8.40
    odds_value := 8.40;
    
    FOR i IN 1..array_length(selected_names, 1) LOOP
      current_horse_name := selected_names[i];
      horse_elo := all_elos[i];
      
      -- Add tiny random variation (±0.20) to make odds slightly different
      odds_value := 8.40 + (random() * 0.4 - 0.2);
      odds_value := ROUND(odds_value::NUMERIC, 2);
      
      RAISE NOTICE 'Equal odds for %: %', current_horse_name, odds_value;
      
      horse_data := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'name', current_horse_name,
        'elo', horse_elo,
        'odds', odds_value,
        'speed', GREATEST(70, LEAST(85, 75 + (random() * 10 - 5)::INTEGER)),
        'stamina', GREATEST(70, LEAST(85, 75 + (random() * 10 - 5)::INTEGER)),
        'acceleration', GREATEST(70, LEAST(85, 75 + (random() * 10 - 5)::INTEGER)),
        'position', 0,
        'lane', lane_counter,
        'sprintStartPercent', 35 + random() * 30
      );
      
      new_horses := new_horses || horse_data;
      lane_counter := lane_counter + 1;
    END LOOP;
  ELSE
    -- Use ELO-based odds for horses with significant ELO differences
    DECLARE
      horse_strength DECIMAL;
      total_strength DECIMAL := 0;
      probability DECIMAL;
    BEGIN
      RAISE NOTICE 'Using ELO-based odds for different ELOs';
      
      -- Calculate total strength using moderate ELO scaling
      FOR i IN 1..array_length(all_elos, 1) LOOP
        -- Use linear scaling with ELO differences for more predictable results
        horse_strength := 1.0 + (all_elos[i] - min_elo)::DECIMAL / GREATEST(1, elo_range) * 3.0;
        total_strength := total_strength + horse_strength;
      END LOOP;
      
      -- Generate horse data with ELO-based odds
      FOR i IN 1..array_length(selected_names, 1) LOOP
        current_horse_name := selected_names[i];
        horse_elo := all_elos[i];
        
        horse_strength := 1.0 + (horse_elo - min_elo)::DECIMAL / GREATEST(1, elo_range) * 3.0;
        probability := horse_strength / total_strength;
        odds_value := (1.0 / probability) * 1.05; -- 5% house edge
        
        -- Round to standard betting increments
        IF odds_value < 2 THEN
          odds_value := ROUND(odds_value::NUMERIC, 2);
        ELSIF odds_value < 5 THEN
          odds_value := ROUND((odds_value * 4)::NUMERIC) / 4.0;
        ELSIF odds_value < 10 THEN
          odds_value := ROUND((odds_value * 2)::NUMERIC) / 2.0;
        ELSE
          odds_value := ROUND(odds_value::NUMERIC);
        END IF;
        
        odds_value := GREATEST(1.20, LEAST(25.0, odds_value));
        
        RAISE NOTICE 'ELO-based odds for % (ELO %): %', current_horse_name, horse_elo, odds_value;
        
        horse_data := jsonb_build_object(
          'id', gen_random_uuid()::text,
          'name', current_horse_name,
          'elo', horse_elo,
          'odds', odds_value,
          'speed', GREATEST(50, LEAST(99, 50 + (horse_elo - 500) / 25 + (random() * 10 - 5)::INTEGER)),
          'stamina', GREATEST(50, LEAST(99, 50 + (horse_elo - 500) / 30 + (random() * 10 - 5)::INTEGER)),
          'acceleration', GREATEST(50, LEAST(99, 50 + (horse_elo - 500) / 28 + (random() * 10 - 5)::INTEGER)),
          'position', 0,
          'lane', lane_counter,
          'sprintStartPercent', 35 + random() * 30
        );
        
        new_horses := new_horses || horse_data;
        lane_counter := lane_counter + 1;
      END LOOP;
    END;
  END IF;
  
  RETURN new_horses;
END;
$$ LANGUAGE plpgsql;