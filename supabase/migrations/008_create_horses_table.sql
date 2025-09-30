CREATE TABLE IF NOT EXISTS horses (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT UNIQUE NOT NULL,
  elo INTEGER DEFAULT 500 NOT NULL,
  total_races INTEGER DEFAULT 0 NOT NULL,
  wins INTEGER DEFAULT 0 NOT NULL,
  recent_form INTEGER[] DEFAULT '{}' NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_horses_name ON horses(name);
CREATE INDEX IF NOT EXISTS idx_horses_elo ON horses(elo DESC);

alter publication supabase_realtime add table horses;