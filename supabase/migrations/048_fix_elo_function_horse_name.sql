-- Fix ambiguous horse_name reference in update_horse_elo_after_race function

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