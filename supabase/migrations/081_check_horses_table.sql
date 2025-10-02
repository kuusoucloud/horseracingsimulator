-- Check horse table structure and create working automation
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'horses' 
ORDER BY ordinal_position;