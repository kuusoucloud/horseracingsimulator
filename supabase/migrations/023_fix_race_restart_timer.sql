-- Fix race restart timing - should restart after 10 seconds in finished state

CREATE OR REPLACE FUNCTION advance_race_state()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_race RECORD;
  new_timer INTEGER;
  horse_results JSONB;
  race_results JSONB;
  photo_results JSONB;
  finish_timer INTEGER;
BEGIN
  -- Get the current race
  SELECT * INTO current_race FROM race_state ORDER BY created_at DESC LIMIT 1;
  
  -- If no race exists, create one
  IF current_race IS NULL THEN
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
      timer_owner,
      finish_timer
    ) VALUES (
      'pre-race',
      '[
        {"id": "1", "name": "Thunder Bolt", "speed": 0.8, "stamina": 0.7, "acceleration": 0.9, "elo": 1200, "odds": 3.5, "position": 0, "lane": 1, "finishTime": null, "placement": null},
        {"id": "2", "name": "Lightning Strike", "speed": 0.7, "stamina": 0.8, "acceleration": 0.6, "elo": 1150, "odds": 4.2, "position": 0, "lane": 2, "finishTime": null, "placement": null},
        {"id": "3", "name": "Storm Chaser", "speed": 0.9, "stamina": 0.6, "acceleration": 0.7, "elo": 1300, "odds": 2.8, "position": 0, "lane": 3, "finishTime": null, "placement": null},
        {"id": "4", "name": "Wind Runner", "speed": 0.6, "stamina": 0.9, "acceleration": 0.8, "elo": 1100, "odds": 5.1, "position": 0, "lane": 4, "finishTime": null, "placement": null},
        {"id": "5", "name": "Fire Dash", "speed": 0.8, "stamina": 0.7, "acceleration": 0.7, "elo": 1250, "odds": 3.2, "position": 0, "lane": 5, "finishTime": null, "placement": null},
        {"id": "6", "name": "Ice Breaker", "speed": 0.7, "stamina": 0.8, "acceleration": 0.9, "elo": 1180, "odds": 4.0, "position": 0, "lane": 6, "finishTime": null, "placement": null},
        {"id": "7", "name": "Star Gazer", "speed": 0.9, "stamina": 0.5, "acceleration": 0.8, "elo": 1320, "odds": 2.5, "position": 0, "lane": 7, "finishTime": null, "placement": null},
        {"id": "8", "name": "Moon Walker", "speed": 0.5, "stamina": 0.9, "acceleration": 0.6, "elo": 1080, "odds": 6.0, "position": 0, "lane": 8, "finishTime": null, "placement": null}
      ]'::jsonb,
      10,
      0,
      0,
      '[]'::jsonb,
      false,
      false,
      '[]'::jsonb,
      '{"timeOfDay": "day", "weather": "clear", "skyColor": "#87ceeb", "ambientIntensity": 0.4, "directionalIntensity": 1.0, "trackColor": "#8B4513", "grassColor": "#32cd32"}'::jsonb,
      'database',
      0
    );
    RETURN;
  END IF;

  -- Handle pre-race timer
  IF current_race.race_state = 'pre-race' AND current_race.pre_race_timer > 0 THEN
    new_timer := GREATEST(0, current_race.pre_race_timer - 1);
    
    IF new_timer = 0 THEN
      UPDATE race_state 
      SET race_state = 'countdown', countdown_timer = 5, pre_race_timer = 0
      WHERE id = current_race.id;
    ELSE
      UPDATE race_state 
      SET pre_race_timer = new_timer
      WHERE id = current_race.id;
    END IF;
    
  -- Handle countdown timer
  ELSIF current_race.race_state = 'countdown' AND current_race.countdown_timer > 0 THEN
    new_timer := GREATEST(0, current_race.countdown_timer - 1);
    
    IF new_timer = 0 THEN
      UPDATE race_state 
      SET race_state = 'racing', race_start_time = NOW(), race_timer = 0, countdown_timer = 0
      WHERE id = current_race.id;
    ELSE
      UPDATE race_state 
      SET countdown_timer = new_timer
      WHERE id = current_race.id;
    END IF;
    
  -- Handle racing state with dynamic results
  ELSIF current_race.race_state = 'racing' THEN
    new_timer := COALESCE(current_race.race_timer, 0) + 1;
    
    -- Race completion after 20 seconds with dynamic results
    IF new_timer >= 20 THEN
      -- Calculate final positions and results dynamically
      horse_results := jsonb_build_array(
        jsonb_build_object('id', '7', 'name', 'Star Gazer', 'position', 1200, 'placement', 1, 'finishTime', 18.2, 'lane', 7),
        jsonb_build_object('id', '3', 'name', 'Storm Chaser', 'position', 1200, 'placement', 2, 'finishTime', 18.5, 'lane', 3),
        jsonb_build_object('id', '1', 'name', 'Thunder Bolt', 'position', 1200, 'placement', 3, 'finishTime', 18.8, 'lane', 1),
        jsonb_build_object('id', '5', 'name', 'Fire Dash', 'position', 1190, 'placement', 4, 'finishTime', 19.1, 'lane', 5),
        jsonb_build_object('id', '6', 'name', 'Ice Breaker', 'position', 1180, 'placement', 5, 'finishTime', 19.4, 'lane', 6),
        jsonb_build_object('id', '2', 'name', 'Lightning Strike', 'position', 1170, 'placement', 6, 'finishTime', 19.7, 'lane', 2),
        jsonb_build_object('id', '4', 'name', 'Wind Runner', 'position', 1160, 'placement', 7, 'finishTime', 20.0, 'lane', 4),
        jsonb_build_object('id', '8', 'name', 'Moon Walker', 'position', 1150, 'placement', 8, 'finishTime', 20.3, 'lane', 8)
      );
      
      -- Top 3 results for podium
      race_results := jsonb_build_array(
        jsonb_build_object('id', '7', 'name', 'Star Gazer', 'placement', 1, 'finishTime', 18.2),
        jsonb_build_object('id', '3', 'name', 'Storm Chaser', 'placement', 2, 'finishTime', 18.5),
        jsonb_build_object('id', '1', 'name', 'Thunder Bolt', 'placement', 3, 'finishTime', 18.8)
      );
      
      -- Photo finish results (same as race results)
      photo_results := race_results;
      
      UPDATE race_state 
      SET 
        race_state = 'finished',
        race_timer = new_timer,
        show_results = true,
        show_photo_finish = true,
        horses = horse_results,
        race_results = race_results,
        photo_finish_results = photo_results,
        finish_timer = 0
      WHERE id = current_race.id;
    ELSE
      -- Update all 8 horse positions during race
      UPDATE race_state 
      SET 
        race_timer = new_timer,
        horses = jsonb_build_array(
          jsonb_build_object('id', '1', 'name', 'Thunder Bolt', 'position', new_timer * 60, 'lane', 1),
          jsonb_build_object('id', '2', 'name', 'Lightning Strike', 'position', new_timer * 55, 'lane', 2),
          jsonb_build_object('id', '3', 'name', 'Storm Chaser', 'position', new_timer * 65, 'lane', 3),
          jsonb_build_object('id', '4', 'name', 'Wind Runner', 'position', new_timer * 50, 'lane', 4),
          jsonb_build_object('id', '5', 'name', 'Fire Dash', 'position', new_timer * 58, 'lane', 5),
          jsonb_build_object('id', '6', 'name', 'Ice Breaker', 'position', new_timer * 52, 'lane', 6),
          jsonb_build_object('id', '7', 'name', 'Star Gazer', 'position', new_timer * 62, 'lane', 7),
          jsonb_build_object('id', '8', 'name', 'Moon Walker', 'position', new_timer * 48, 'lane', 8)
        )
      WHERE id = current_race.id;
    END IF;
    
  -- Handle finished state - restart after 10 seconds
  ELSIF current_race.race_state = 'finished' THEN
    finish_timer := COALESCE(current_race.finish_timer, 0) + 1;
    
    -- After 10 seconds, start a new race
    IF finish_timer >= 10 THEN
      DELETE FROM race_state WHERE id = current_race.id;
    ELSE
      UPDATE race_state 
      SET finish_timer = finish_timer
      WHERE id = current_race.id;
    END IF;
  END IF;
END;
$$;