-- Add force_logout_at column to users table
-- This tracks when all sessions for a user should be invalidated

ALTER TABLE users
ADD COLUMN IF NOT EXISTS force_logout_at TIMESTAMP;

-- Add system-wide force_logout_at to a new settings table
-- This allows forcing ALL users to logout
CREATE TABLE IF NOT EXISTS system_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key VARCHAR(255) UNIQUE NOT NULL,
  setting_value JSONB NOT NULL,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_by UUID
);

-- Insert the global force_logout_at setting if it doesn't exist
INSERT INTO system_settings (setting_key, setting_value, updated_at)
VALUES ('force_logout_at', '{"timestamp": null}', CURRENT_TIMESTAMP)
ON CONFLICT (setting_key) DO NOTHING;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_users_force_logout_at ON users(force_logout_at);
