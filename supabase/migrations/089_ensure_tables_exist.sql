-- Ensure horses table exists with correct structure
CREATE TABLE IF NOT EXISTS horses (
  id SERIAL PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  elo INTEGER DEFAULT 500,
  total_races INTEGER DEFAULT 0,
  wins INTEGER DEFAULT 0,
  recent_form INTEGER[] DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure race_state table exists with correct structure
CREATE TABLE IF NOT EXISTS race_state (
  id SERIAL PRIMARY KEY,
  race_state TEXT NOT NULL DEFAULT 'pre-race',
  pre_race_timer INTEGER DEFAULT 10,
  countdown_timer INTEGER DEFAULT 0,
  race_timer INTEGER DEFAULT 0,
  results_countdown INTEGER DEFAULT 0,
  horses JSONB DEFAULT '[]',
  show_photo_finish BOOLEAN DEFAULT FALSE,
  show_results BOOLEAN DEFAULT FALSE,
  race_results JSONB DEFAULT '[]',
  photo_finish_results JSONB DEFAULT '[]',
  weather_conditions JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable realtime for both tables
ALTER PUBLICATION supabase_realtime ADD TABLE horses;
ALTER PUBLICATION supabase_realtime ADD TABLE race_state;

-- Insert some initial horses if none exist
INSERT INTO horses (name, elo, total_races, wins, recent_form)
SELECT * FROM (VALUES
  ('Thunder Bolt', 520, 0, 0, '{}'),
  ('Lightning Strike', 480, 0, 0, '{}'),
  ('Storm Chaser', 510, 0, 0, '{}'),
  ('Wind Runner', 490, 0, 0, '{}'),
  ('Fire Spirit', 530, 0, 0, '{}'),
  ('Golden Arrow', 470, 0, 0, '{}'),
  ('Silver Bullet', 500, 0, 0, '{}'),
  ('Midnight Express', 540, 0, 0, '{}'),
  ('Dawn Breaker', 460, 0, 0, '{}'),
  ('Star Gazer', 515, 0, 0, '{}'),
  ('Ocean Wave', 485, 0, 0, '{}'),
  ('Mountain Peak', 525, 0, 0, '{}')
) AS new_horses(name, elo, total_races, wins, recent_form)
WHERE NOT EXISTS (SELECT 1 FROM horses LIMIT 1);