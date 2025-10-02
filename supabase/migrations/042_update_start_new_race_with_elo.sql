-- Update start_new_race function to use ELO-based horse generation
CREATE OR REPLACE FUNCTION start_new_race() RETURNS VOID AS $$
DECLARE
  new_horses JSONB;
  weather_conditions JSONB;
  weather_condition TEXT;
  weather_options TEXT[] := ARRAY['sunny', 'cloudy', 'rainy', 'twilight'];
BEGIN
  -- Generate horses with ELO-based attributes
  new_horses := generate_race_horses();
  
  -- Generate weather conditions
  weather_condition := weather_options[1 + (random() * (array_length(weather_options, 1) - 1))::INTEGER];
  
  weather_conditions := jsonb_build_object(
    'condition', weather_condition,
    'humidity', (30 + random() * 40)::INTEGER,
    'temperature', (15 + random() * 20)::INTEGER,
    'windSpeed', (5 + random() * 25)::INTEGER
  );
  
  -- Create new race with ELO-based horses
  INSERT INTO race_state (
    race_state,
    horses,
    weather_conditions,
    pre_race_timer,
    countdown_timer,
    race_timer,
    show_photo_finish,
    show_results,
    race_results,
    photo_finish_results,
    created_at,
    updated_at
  ) VALUES (
    'pre-race',
    new_horses,
    weather_conditions,
    10,
    0,
    0,
    false,
    false,
    '[]'::JSONB,
    '[]'::JSONB,
    NOW(),
    NOW()
  );
  
  RAISE NOTICE 'New race started with ELO-based horses: %', new_horses;
END;
$$ LANGUAGE plpgsql;