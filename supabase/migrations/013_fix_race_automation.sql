-- Fix the UPDATE statement that's missing WHERE clause in advance_race_state function

CREATE OR REPLACE FUNCTION advance_race_state()
RETURNS void
LANGUAGE plpgsql
AS $$
DECLARE
  current_race RECORD;
  new_timer INTEGER;
  updated_horses JSONB;
  horse JSONB;
  finished_count INTEGER;
  race_timeout BOOLEAN;
BEGIN
  -- Get the current race
  SELECT * INTO current_race FROM race_state ORDER BY created_at DESC LIMIT 1;
  
  -- If no race exists, create one
  IF current_race IS NULL THEN
    INSERT INTO race_state (
      race_state,
      horses,
      race_progress,
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
        {"id": "3", "name": "Storm Chaser", "speed": 0.9, "stamina": 0.6, "acceleration": 0.7, "elo": 1300, "odds": 2.8, "position": 0, "lane": 3, "finishTime": null, "placement": null},
        {"id": "4", "name": "Wind Runner", "speed": 0.6, "stamina": 0.9, "acceleration": 0.8, "elo": 1100, "odds": 5.1, "position": 0, "lane": 4, "finishTime": null, "placement": null},
        {"id": "5", "name": "Fire Dash", "speed": 0.8, "stamina": 0.7, "acceleration": 0.7, "elo": 1250, "odds": 3.2, "position": 0, "lane": 5, "finishTime": null, "placement": null},
        {"id": "6", "name": "Ice Breaker", "speed": 0.7, "stamina": 0.8, "acceleration": 0.9, "elo": 1180, "odds": 4.0, "position": 0, "lane": 6, "finishTime": null, "placement": null},
        {"id": "7", "name": "Star Gazer", "speed": 0.9, "stamina": 0.5, "acceleration": 0.8, "elo": 1320, "odds": 2.5, "position": 0, "lane": 7, "finishTime": null, "placement": null},
        {"id": "8", "name": "Moon Walker", "speed": 0.5, "stamina": 0.9, "acceleration": 0.6, "elo": 1080, "odds": 6.0, "position": 0, "lane": 8, "finishTime": null, "placement": null}
      ]'::jsonb,
      '{}'::jsonb,
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

  -- Handle different race states
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
    
  ELSIF current_race.race_state = 'racing' THEN
    new_timer := COALESCE(current_race.race_timer, 0) + 1;
    
    -- Simulate horse progress
    updated_horses := '[]'::jsonb;
    finished_count := 0;
    race_timeout := new_timer >= 60;
    
    FOR horse IN SELECT * FROM jsonb_array_elements(current_race.horses)
    LOOP
      IF horse->>'finishTime' IS NOT NULL THEN
        -- Horse already finished
        updated_horses := updated_horses || horse;
        finished_count := finished_count + 1;
      ELSE
        DECLARE
          current_position NUMERIC := COALESCE((horse->>'position')::NUMERIC, 0);
          base_speed NUMERIC := COALESCE((horse->>'speed')::NUMERIC, 0.5) * 15;
          stamina_factor NUMERIC := GREATEST(0.5, COALESCE((horse->>'stamina')::NUMERIC, 0.5));
          random_variation NUMERIC := (RANDOM() - 0.5) * 8 * stamina_factor;
          acceleration_boost NUMERIC := CASE WHEN new_timer < 5 THEN COALESCE((horse->>'acceleration')::NUMERIC, 0.5) * 5 ELSE 0 END;
          progress NUMERIC := LEAST(1200, current_position + base_speed + random_variation + acceleration_boost);
          finished BOOLEAN := progress >= 1200;
          updated_horse JSONB;
        BEGIN
          updated_horse := horse || jsonb_build_object(
            'position', progress,
            'finishTime', CASE WHEN finished OR race_timeout THEN new_timer ELSE null END,
            'placement', null
          );
          
          updated_horses := updated_horses || updated_horse;
          
          IF finished OR race_timeout THEN
            finished_count := finished_count + 1;
          END IF;
        END;
      END IF;
    END LOOP;
    
    -- Check if race is complete
    IF finished_count >= jsonb_array_length(current_race.horses) OR race_timeout THEN
      -- Sort horses by finish time and position, assign placements
      WITH sorted_horses AS (
        SELECT 
          horse,
          ROW_NUMBER() OVER (
            ORDER BY 
              COALESCE((horse->>'finishTime')::INTEGER, 999),
              (horse->>'position')::NUMERIC DESC
          ) as placement
        FROM jsonb_array_elements(updated_horses) as horse
      )
      SELECT jsonb_agg(horse || jsonb_build_object('placement', placement))
      INTO updated_horses
      FROM sorted_horses;
      
      UPDATE race_state 
      SET 
        race_state = 'finished',
        race_timer = new_timer,
        horses = updated_horses,
        race_results = (SELECT jsonb_agg(horse) FROM jsonb_array_elements(updated_horses) horse ORDER BY (horse->>'placement')::INTEGER LIMIT 3),
        show_results = true,
        show_photo_finish = true,
        photo_finish_results = (SELECT jsonb_agg(horse) FROM jsonb_array_elements(updated_horses) horse ORDER BY (horse->>'placement')::INTEGER LIMIT 3)
      WHERE id = current_race.id;
    ELSE
      UPDATE race_state 
      SET race_timer = new_timer, horses = updated_horses
      WHERE id = current_race.id;
    END IF;
    
  ELSIF current_race.race_state = 'finished' THEN
    -- After 30 seconds, start a new race
    IF COALESCE(current_race.race_timer, 0) > 30 THEN
      -- Delete current race and let the function create a new one
      DELETE FROM race_state WHERE id = current_race.id;
    END IF;
  END IF;
  
  -- FIX: Add WHERE clause to the race_control update
  UPDATE race_control 
  SET last_tick = NOW() 
  WHERE is_active = true;
END;
$$;