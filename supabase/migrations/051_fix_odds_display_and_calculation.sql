-- Fix odds display (remove :1) and calculation (8 horses = 8.00 base odds + house edge)

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
  normalized_strength DECIMAL;
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
  
  -- If all horses have same ELO, create equal probability (1/8 each)
  IF elo_range < 10 THEN
    -- Equal odds for all horses: base odds = num_horses, then add house edge
    FOR i IN 1..array_length(selected_names, 1) LOOP
      current_horse_name := selected_names[i];
      horse_elo := all_elos[i];
      
      -- Equal probability = 1/8, so base odds = 8.00, with house edge = 8.40
      odds_value := num_horses * 1.05; -- 5% house edge
      
      -- Generate attributes based on ELO
      horse_data := jsonb_build_object(
        'id', gen_random_uuid()::text,
        'name', current_horse_name,
        'elo', horse_elo,
        'odds', ROUND(odds_value::NUMERIC, 2),
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
  ELSE
    -- Calculate varied odds based on ELO differences
    -- Calculate total strength using improved formula
    total_strength := 0;
    FOR i IN 1..array_length(all_elos, 1) LOOP
      -- Normalize ELO to 0-1 range, then apply exponential scaling
      normalized_strength := (all_elos[i] - min_elo)::DECIMAL / elo_range;
      normalized_strength := power(2, normalized_strength * 2); -- Creates 1x to 4x range
      total_strength := total_strength + normalized_strength;
    END LOOP;
    
    -- Generate horse data with ELO-based odds
    FOR i IN 1..array_length(selected_names, 1) LOOP
      current_horse_name := selected_names[i];
      horse_elo := all_elos[i];
      
      -- Calculate this horse's normalized strength and probability
      normalized_strength := (horse_elo - min_elo)::DECIMAL / elo_range;
      normalized_strength := power(2, normalized_strength * 2);
      probability := normalized_strength / total_strength;
      
      -- Convert probability to odds with house edge
      odds_value := (1.0 / probability) * 1.05; -- 5% house edge
      
      -- Round odds to realistic betting values
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
      
      -- Ensure reasonable bounds
      odds_value := GREATEST(1.1, LEAST(50.0, odds_value));
      
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
  END IF;
  
  RETURN new_horses;
END;
$$ LANGUAGE plpgsql;