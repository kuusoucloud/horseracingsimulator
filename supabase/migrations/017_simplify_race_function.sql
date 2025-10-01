-- Create a much simpler race function to avoid stack depth issues

CREATE OR REPLACE FUNCTION advance_race_state()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_race RECORD;
  new_timer INTEGER;
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
      timer_owner
    ) VALUES (
      'pre-race',
      '[
        {"id": "1", "name": "Thunder Bolt", "speed": 0.8, "stamina": 0.7, "acceleration": 0.9, "elo": 1200, "odds": 3.5, "position": 0, "lane": 1, "finishTime": null, "placement": null},
        {"id": "2", "name": "Lightning Strike", "speed": 0.7, "stamina": 0.8, "acceleration": 0.6, "elo": 1150, "odds": 4.2, "position": 0, "lane": 2, "finishTime": null, "placement": null},
        {"id": "3", "name": "Storm Chaser", "speed": 0.9, "stamina": 0.6, "acceleration": 0.7, "elo": 1300, "odds": 2.8, "position": 0, "lane": 3, "finishTime": null, "placement": null}
      ]'::jsonb,
      10,
      0,
      0,
      '[]'::jsonb,
      false,
      false,
      '[]'::jsonb,
      '{"timeOfDay": "day", "weather": "clear", "skyColor": "#87ceeb", "ambientIntensity": 0.4, "directionalIntensity": 1.0, "trackColor": "#8B4513", "grassColor": "#32cd32"}'::jsonb,
      'database'
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
    
  -- Handle racing state - simplified
  ELSIF current_race.race_state = 'racing' THEN
    new_timer := COALESCE(current_race.race_timer, 0) + 1;
    
    -- Simple race completion after 20 seconds
    IF new_timer >= 20 THEN
      UPDATE race_state 
      SET 
        race_state = 'finished',
        race_timer = new_timer,
        show_results = true,
        show_photo_finish = true,
        race_results = '[
          {"id": "1", "name": "Thunder Bolt", "placement": 1},
          {"id": "2", "name": "Lightning Strike", "placement": 2},
          {"id": "3", "name": "Storm Chaser", "placement": 3}
        ]'::jsonb,
        photo_finish_results = '[
          {"id": "1", "name": "Thunder Bolt", "placement": 1},
          {"id": "2", "name": "Lightning Strike", "placement": 2},
          {"id": "3", "name": "Storm Chaser", "placement": 3}
        ]'::jsonb
      WHERE id = current_race.id;
    ELSE
      UPDATE race_state 
      SET race_timer = new_timer
      WHERE id = current_race.id;
    END IF;
    
  -- Handle finished state
  ELSIF current_race.race_state = 'finished' THEN
    -- After 10 seconds, start a new race
    IF COALESCE(current_race.race_timer, 0) > 30 THEN
      DELETE FROM race_state WHERE id = current_race.id;
    END IF;
  END IF;
  
  -- Update the race_control timestamp
  UPDATE race_control 
  SET last_tick = NOW() 
  WHERE is_active = true;
END;
$$;