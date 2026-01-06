-- Migration to add encryption support for sensitive data in app_config

-- Update app_config table to support encrypted values
ALTER TABLE app_config 
  ADD COLUMN IF NOT EXISTS is_encrypted BOOLEAN DEFAULT false;

-- Function to securely store encrypted config value
CREATE OR REPLACE FUNCTION upsert_encrypted_config(
  p_key TEXT,
  p_value TEXT,
  p_should_encrypt BOOLEAN DEFAULT true
)
RETURNS void AS $$
DECLARE
  v_stored_value TEXT;
BEGIN
  -- Encrypt if requested
  IF p_should_encrypt THEN
    v_stored_value := encrypt_value(p_value);
  ELSE
    v_stored_value := p_value;
  END IF;

  -- Upsert the config
  INSERT INTO app_config (key, value, is_encrypted, updated_at)
  VALUES (p_key, v_stored_value, p_should_encrypt, NOW())
  ON CONFLICT (key)
  DO UPDATE SET
    value = v_stored_value,
    is_encrypted = p_should_encrypt,
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to retrieve and decrypt config value
CREATE OR REPLACE FUNCTION get_decrypted_config(p_key TEXT)
RETURNS TEXT AS $$
DECLARE
  v_config RECORD;
  v_decrypted_value TEXT;
BEGIN
  SELECT * INTO v_config
  FROM app_config
  WHERE key = p_key;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  -- Decrypt if encrypted
  IF v_config.is_encrypted THEN
    v_decrypted_value := decrypt_value(v_config.value);
  ELSE
    v_decrypted_value := v_config.value;
  END IF;

  RETURN v_decrypted_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add RLS policies for app_config if not exists
ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Service role can read app_config" ON app_config;
DROP POLICY IF EXISTS "Service role can insert app_config" ON app_config;
DROP POLICY IF EXISTS "Service role can update app_config" ON app_config;

-- Allow service role full access
CREATE POLICY "Service role can read app_config"
  ON app_config FOR SELECT
  TO service_role
  USING (true);

CREATE POLICY "Service role can insert app_config"
  ON app_config FOR INSERT
  TO service_role
  WITH CHECK (true);

CREATE POLICY "Service role can update app_config"
  ON app_config FOR UPDATE
  TO service_role
  USING (true);

-- Authenticated users can only read non-sensitive config
CREATE POLICY "Authenticated users can read non-encrypted config"
  ON app_config FOR SELECT
  TO authenticated
  USING (is_encrypted = false);

-- Create a view for safe config access (excluding encrypted values)
CREATE OR REPLACE VIEW public_app_config AS
SELECT 
  id,
  key,
  CASE 
    WHEN is_encrypted THEN NULL
    ELSE value
  END as value,
  is_encrypted,
  updated_at
FROM app_config;

-- Grant access to the view
GRANT SELECT ON public_app_config TO authenticated;

-- Helper function to check if token is valid
CREATE OR REPLACE FUNCTION is_speed_token_valid()
RETURNS BOOLEAN AS $$
DECLARE
  v_token_expiry TEXT;
  v_expiry_date TIMESTAMP;
BEGIN
  -- Get token expiry from config
  SELECT value INTO v_token_expiry
  FROM app_config
  WHERE key = 'speed_token_expiry';

  IF v_token_expiry IS NULL THEN
    RETURN false;
  END IF;

  -- Parse and compare dates
  v_expiry_date := v_token_expiry::TIMESTAMP;
  
  -- Token is valid if it expires more than 1 hour from now
  RETURN v_expiry_date > (NOW() + INTERVAL '1 hour');
EXCEPTION
  WHEN OTHERS THEN
    RETURN false;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add helpful comments
COMMENT ON FUNCTION upsert_encrypted_config IS 
  'Stores a config value, optionally encrypting it first';

COMMENT ON FUNCTION get_decrypted_config IS 
  'Retrieves a config value, decrypting it if necessary';

COMMENT ON FUNCTION is_speed_token_valid IS 
  'Checks if the Speed API authentication token is still valid';

COMMENT ON COLUMN app_config.is_encrypted IS 
  'Indicates whether the value column contains encrypted data';
