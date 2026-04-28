-- Add scheduled_time column to calendar_events table
ALTER TABLE calendar_events
ADD COLUMN IF NOT EXISTS scheduled_time VARCHAR(5) DEFAULT '10:00';

-- Verify the column was added
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'calendar_events' AND column_name = 'scheduled_time';
