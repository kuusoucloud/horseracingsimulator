-- Check and fix race system structure

-- Check race_state table structure
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'race_state' 
ORDER BY ordinal_position;

-- Check horses table structure  
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'horses' 
ORDER BY ordinal_position;

-- Check current race state
SELECT * FROM race_state ORDER BY created_at DESC LIMIT 1;