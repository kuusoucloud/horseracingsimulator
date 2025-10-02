-- Fix odds calculation to handle full ELO range (1 to 2500+)

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
  horse_strength DECIMAL;
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
  
  -- Calculate total strength using proper ELO formula: 10^(ELO/400)
  total_strength := 0;
  FOR i IN 1..array_length(all_elos, 1) LOOP
    horse_strength := power(10, all_elos[i]::DECIMAL / 400.0);
    total_strength := total_strength + horse_strength;
  END LOOP;
  
  -- Generate horse data with proper ELO-based odds
  FOR i IN 1..array_length(selected_names, 1) LOOP
    current_horse_name := selected_names[i];
    horse_elo := all_elos[i];
    
    -- Calculate this horse's strength and probability using standard ELO formula
    horse_strength := power(10, horse_elo::DECIMAL / 400.0);
    probability := horse_strength / total_strength;
    
    -- Convert probability to odds with house edge
    odds_value := (1.0 / probability) * 1.05; -- 5% house edge
    
    -- Round to standard betting increments
    IF odds_value < 2 THEN
      odds_value := ROUND(odds_value::NUMERIC, 2);
    ELSIF odds_value < 5 THEN
      odds_value := ROUND((odds_value * 4)::NUMERIC) / 4.0; -- Quarter increments
    ELSIF odds_value < 10 THEN
      odds_value := ROUND((odds_value * 2)::NUMERIC) / 2.0; -- Half increments
    ELSIF odds_value < 25 THEN
      odds_value := ROUND(odds_value::NUMERIC); -- Whole numbers
    ELSE
      odds_value := ROUND((odds_value / 5)::NUMERIC) * 5; -- Round to nearest 5
    END IF;
    
    -- Ensure reasonable bounds (but allow wider range for extreme ELO differences)
    odds_value := GREATEST(1.01, LEAST(999.0, odds_value));
    
    -- Generate attributes based on ELO with proper scaling
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
  
  RETURN new_horses;
END;
$$ LANGUAGE plpgsql;