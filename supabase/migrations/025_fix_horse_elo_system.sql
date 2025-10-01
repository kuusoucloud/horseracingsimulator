-- Ensure all horses have proper ELO ratings (500 default)
UPDATE horses SET elo = 500 WHERE elo IS NULL OR elo = 0;

-- Create function to calculate ELO changes based on race results
CREATE OR REPLACE FUNCTION calculate_elo_change(
  current_elo INTEGER,
  opponent_avg_elo INTEGER,
  placement INTEGER,
  total_horses INTEGER
) RETURNS INTEGER AS $$
DECLARE
  k_factor INTEGER;
  expected_score DECIMAL;
  actual_score DECIMAL;
  elo_change INTEGER;
BEGIN
  -- K-factor based on current ELO (higher K for lower ELO players)
  IF current_elo < 1200 THEN
    k_factor := 32;
  ELSIF current_elo < 1600 THEN
    k_factor := 24;
  ELSE
    k_factor := 16;
  END IF;
  
  -- Expected score based on ELO difference
  expected_score := 1.0 / (1.0 + POWER(10.0, (opponent_avg_elo - current_elo) / 400.0));
  
  -- Actual score based on placement (1st = 1.0, 2nd = 0.75, 3rd = 0.5, others = 0.25)
  CASE placement
    WHEN 1 THEN actual_score := 1.0;
    WHEN 2 THEN actual_score := 0.75;
    WHEN 3 THEN actual_score := 0.5;
    ELSE actual_score := 0.25;
  END CASE;
  
  -- Calculate ELO change
  elo_change := ROUND(k_factor * (actual_score - expected_score));
  
  RETURN elo_change;
END;
$$ LANGUAGE plpgsql;

-- Function to update horse ELO after race
CREATE OR REPLACE FUNCTION update_horse_elo_after_race(
  race_results JSONB
) RETURNS VOID AS $$
DECLARE
  result JSONB;
  horse_name TEXT;
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
    horse_name := result->>'name';
    placement := (result->>'placement')::INTEGER;
    
    -- Get current ELO
    SELECT elo INTO current_elo FROM horses WHERE name = horse_name;
    
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
    WHERE name = horse_name;
    
    -- Log ELO change
    RAISE NOTICE 'Horse % ELO: % -> % (change: %)', horse_name, current_elo, new_elo, elo_change;
  END LOOP;
END;
$$ LANGUAGE plpgsql;