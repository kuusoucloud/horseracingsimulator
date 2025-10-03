-- Insert some initial horses if none exist
INSERT INTO horses (name, elo, total_races, wins, recent_form)
SELECT * FROM (VALUES
  ('Thunder Bolt', 520, 0, 0, ARRAY[]::integer[]),
  ('Lightning Strike', 480, 0, 0, ARRAY[]::integer[]),
  ('Storm Chaser', 510, 0, 0, ARRAY[]::integer[]),
  ('Wind Runner', 490, 0, 0, ARRAY[]::integer[]),
  ('Fire Spirit', 530, 0, 0, ARRAY[]::integer[]),
  ('Golden Arrow', 470, 0, 0, ARRAY[]::integer[]),
  ('Silver Bullet', 500, 0, 0, ARRAY[]::integer[]),
  ('Midnight Express', 540, 0, 0, ARRAY[]::integer[]),
  ('Dawn Breaker', 460, 0, 0, ARRAY[]::integer[]),
  ('Star Gazer', 515, 0, 0, ARRAY[]::integer[]),
  ('Ocean Wave', 485, 0, 0, ARRAY[]::integer[]),
  ('Mountain Peak', 525, 0, 0, ARRAY[]::integer[])
) AS new_horses(name, elo, total_races, wins, recent_form)
WHERE NOT EXISTS (SELECT 1 FROM horses LIMIT 1);