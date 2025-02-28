-- Enable the Vault extension
CREATE EXTENSION IF NOT EXISTS vault;

-- Enable Row Level Security on vault.secrets
ALTER TABLE vault.secrets ENABLE ROW LEVEL SECURITY;

-- Create policy to allow users to access only their own secrets
CREATE POLICY "Users can access their own secrets" ON vault.secrets
  USING (auth.uid() = user_id);

-- Create RPC function to set a secret
CREATE OR REPLACE FUNCTION set_secret(name text, value text)
RETURNS void AS $$
BEGIN
  INSERT INTO vault.secrets (name, secret, user_id)
  VALUES (name, value, auth.uid())
  ON CONFLICT (name, user_id) DO UPDATE SET secret = value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to get a secret
CREATE OR REPLACE FUNCTION get_secret(name text)
RETURNS text AS $$
DECLARE
  secret text;
BEGIN
  SELECT s.secret INTO secret
  FROM vault.secrets s
  WHERE s.name = name AND s.user_id = auth.uid();
  RETURN secret;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create RPC function to delete a secret
CREATE OR REPLACE FUNCTION delete_secret(name text)
RETURNS void AS $$
BEGIN
  DELETE FROM vault.secrets
  WHERE name = name AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to check if a secret exists
CREATE OR REPLACE FUNCTION secret_exists(name text)
RETURNS boolean AS $$
DECLARE
  exists boolean;
BEGIN
  SELECT COUNT(*) > 0 INTO exists
  FROM vault.secrets s
  WHERE s.name = name AND s.user_id = auth.uid();
  RETURN exists;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to list all secrets for the current user (names only, not values)
CREATE OR REPLACE FUNCTION list_secrets()
RETURNS TABLE (secret_name text, created_at timestamptz) AS $$
BEGIN
  RETURN QUERY
  SELECT name, created_at
  FROM vault.secrets
  WHERE user_id = auth.uid()
  ORDER BY created_at DESC;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Add comments for documentation
COMMENT ON EXTENSION vault IS 'Secure storage for sensitive information like API keys';
COMMENT ON FUNCTION set_secret IS 'Store a secret in the vault for the current user';
COMMENT ON FUNCTION get_secret IS 'Retrieve a secret from the vault for the current user';
COMMENT ON FUNCTION delete_secret IS 'Delete a secret from the vault for the current user';
COMMENT ON FUNCTION secret_exists IS 'Check if a secret exists for the current user';
COMMENT ON FUNCTION list_secrets IS 'List all secret names (not values) for the current user'; 