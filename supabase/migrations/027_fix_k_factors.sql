-- Fix K-factor calculation to match specification
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
  -- K-factor based on placement (podium vs non-podium)
  IF placement <= 3 THEN
    k_factor := 192; -- Podium finishers (1st, 2nd, 3rd)
  ELSE
    k_factor := 32;  -- Positions 4-8
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