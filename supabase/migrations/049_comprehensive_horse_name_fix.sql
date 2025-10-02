-- Comprehensive fix for all ambiguous horse_name references

-- Drop and recreate all functions to ensure no ambiguous references remain

-- 1. Fix generate_race_horses function
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
      (SELECT elo FROM horses WHERE name = selected_name), 
      500
    )
  ) INTO all_elos
  FROM unnest(selected_names) AS selected_name;
  
  -- Calculate total strength for odds calculation
  total_strength := 0;
  FOR i IN 1..array_length(all_elos, 1) LOOP
    total_strength := total_strength + power(10, all_elos[i] / 400.0);
  END LOOP;
  
  -- Generate horse data with proper ELO-based odds
  FOR i IN 1..array_length(selected_names, 1) LOOP
    current_horse_name := selected_names[i];
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
      'name', current_horse_name,
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

-- 2. Ensure update_horse_elo_after_race is completely clean
CREATE OR REPLACE FUNCTION update_horse_elo_after_race(
  race_results JSONB
) RETURNS VOID AS $$
DECLARE
  result JSONB;
  current_horse_name TEXT;
  placement INTEGER;
  current_elo INTEGER;
  avg_elo INTEGER;
  elo_change INTEGER;
  new_elo INTEGER;
  total_horses INTEGER;
BEGIN
  -- Get total number of horses in race
  total_horses := jsonb_array_length(race_results);
  
  -- Calculate average ELO of all horses in race
  SELECT AVG(h.elo)::INTEGER INTO avg_elo
  FROM horses h
  WHERE h.name = ANY(
    SELECT jsonb_extract_path_text(value, 'name')
    FROM jsonb_array_elements(race_results)
  );
  
  -- Update ELO for each horse
  FOR result IN SELECT * FROM jsonb_array_elements(race_results)
  LOOP
    current_horse_name := result->>'name';
    placement := (result->>'placement')::INTEGER;
    
    -- Get current ELO
    SELECT elo INTO current_elo FROM horses WHERE name = current_horse_name;
    
    -- Calculate ELO change
    elo_change := calculate_elo_change(current_elo, avg_elo, placement, total_horses);
    new_elo := current_elo + elo_change;
    
    -- Ensure ELO doesn't go below 100
    IF new_elo < 100 THEN
      new_elo := 100;
    END IF;
    
    -- Update horse record
    UPDATE horses 
    SET 
      elo = new_elo,
      total_races = total_races + 1,
      wins = CASE WHEN placement = 1 THEN wins + 1 ELSE wins END,
      recent_form = (
        CASE 
          WHEN array_length(recent_form, 1) >= 5 THEN
            recent_form[2:5] || ARRAY[placement]
          ELSE
            recent_form || ARRAY[placement]
        END
      ),
      updated_at = NOW()
    WHERE name = current_horse_name;
    
    -- Log ELO change
    RAISE NOTICE 'Horse % ELO: % -> % (change: %)', current_horse_name, current_elo, new_elo, elo_change;
  END LOOP;
END;
$$ LANGUAGE plpgsql;