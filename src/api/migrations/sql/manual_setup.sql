-- =============================================
-- MANUAL SETUP SCRIPT FOR BUZO AI API KEY STORAGE
-- =============================================
-- Run this script in the Supabase SQL Editor to set up
-- the necessary tables, functions, and policies for API key storage

-- =============================================
-- PART 1: MIGRATIONS SETUP
-- =============================================

-- Function to execute SQL queries from the client
CREATE OR REPLACE FUNCTION execute_sql(sql TEXT)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  EXECUTE sql;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;

-- Function to create the migrations table
CREATE OR REPLACE FUNCTION create_migrations_table()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Check if the migrations table already exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'migrations'
  ) THEN
    -- Create the migrations table
    CREATE TABLE public.migrations (
      id UUID PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      version INTEGER NOT NULL,
      executed_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      success BOOLEAN NOT NULL
    );

    -- Add indexes
    CREATE INDEX idx_migrations_version ON public.migrations(version);
    CREATE INDEX idx_migrations_executed_at ON public.migrations(executed_at);

    -- Enable RLS
    ALTER TABLE public.migrations ENABLE ROW LEVEL SECURITY;

    -- Create policies
    CREATE POLICY "Allow authenticated users to select migrations" 
      ON public.migrations FOR SELECT
      USING (auth.role() = 'authenticated');

    CREATE POLICY "Allow authenticated users to insert migrations" 
      ON public.migrations FOR INSERT
      WITH CHECK (auth.role() = 'authenticated');

    RAISE NOTICE 'Migrations table created successfully';
  ELSE
    RAISE NOTICE 'Migrations table already exists';
  END IF;
END;
$$;

-- Execute the function to create the migrations table
SELECT create_migrations_table();

-- =============================================
-- PART 2: API KEYS TABLE SETUP
-- =============================================

-- Create api_keys table for storing OpenAI API keys
CREATE TABLE IF NOT EXISTS public.api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  key_type TEXT NOT NULL,
  api_key TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add a unique constraint to ensure one key type per user
ALTER TABLE public.api_keys 
  ADD CONSTRAINT unique_user_key_type UNIQUE (user_id, key_type);

-- Enable Row Level Security
ALTER TABLE public.api_keys ENABLE ROW LEVEL SECURITY;

-- Create policies for api_keys
CREATE POLICY "Users can view their own API keys" ON public.api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own API keys" ON public.api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own API keys" ON public.api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own API keys" ON public.api_keys
  FOR DELETE USING (auth.uid() = user_id);

-- Add comments for documentation
COMMENT ON TABLE public.api_keys IS 'Stores API keys for users';
COMMENT ON COLUMN public.api_keys.key_type IS 'Type of API key (e.g., openai, other services)';
COMMENT ON COLUMN public.api_keys.api_key IS 'The actual API key value';

-- =============================================
-- PART 3: VAULT OR FALLBACK SETUP
-- =============================================

-- First try to enable the Vault extension
DO $$
BEGIN
  BEGIN
    CREATE EXTENSION IF NOT EXISTS vault;
    RAISE NOTICE 'Vault extension enabled successfully';
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Vault extension not available, creating fallback functions in public schema';
    
    -- Create a table to store secrets if vault extension is not available
    CREATE TABLE IF NOT EXISTS public.user_secrets (
      id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
      user_id UUID NOT NULL,
      name TEXT NOT NULL,
      secret TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW(),
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(user_id, name)
    );
    
    -- Enable RLS on the secrets table
    ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;
    
    -- Create policy to allow users to access only their own secrets
    DROP POLICY IF EXISTS "Users can access their own secrets" ON public.user_secrets;
    CREATE POLICY "Users can access their own secrets" ON public.user_secrets
      USING (auth.uid() = user_id);
    
    -- Create RPC function to set a secret
    CREATE OR REPLACE FUNCTION public.set_secret(name text, value text)
    RETURNS void AS $$
    BEGIN
      INSERT INTO public.user_secrets (name, secret, user_id)
      VALUES (name, value, auth.uid())
      ON CONFLICT (user_id, name) DO UPDATE SET 
        secret = value,
        updated_at = NOW();
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Create RPC function to get a secret
    CREATE OR REPLACE FUNCTION public.get_secret(name text)
    RETURNS text AS $$
    DECLARE
      secret_value text;
    BEGIN
      SELECT s.secret INTO secret_value
      FROM public.user_secrets s
      WHERE s.name = name AND s.user_id = auth.uid();
      RETURN secret_value;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
    
    -- Create RPC function to delete a secret
    CREATE OR REPLACE FUNCTION public.delete_secret(name text)
    RETURNS void AS $$
    BEGIN
      DELETE FROM public.user_secrets
      WHERE name = name AND user_id = auth.uid();
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  END;
END $$;

-- Check if vault extension is available
DO $$
DECLARE
  vault_available boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vault'
  ) INTO vault_available;
  
  IF vault_available THEN
    -- If vault is available, set up policies
    RAISE NOTICE 'Setting up policies for vault.secrets';
    
    -- Enable RLS on vault.secrets
    ALTER TABLE vault.secrets ENABLE ROW LEVEL SECURITY;
    
    -- Create policy to allow users to access only their own secrets
    DROP POLICY IF EXISTS "Users can access their own secrets" ON vault.secrets;
    CREATE POLICY "Users can access their own secrets" ON vault.secrets
      USING (auth.uid() = user_id);
  ELSE
    RAISE NOTICE 'Vault extension not available, using fallback functions in public schema';
  END IF;
END $$;

-- =============================================
-- PART 4: OPTIONAL ENCRYPTION SETUP
-- =============================================

-- Uncomment this section if you want to enable encryption for API keys

/*
-- Make sure pgcrypto extension is enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- Create a function to encrypt API keys before storing
CREATE OR REPLACE FUNCTION encrypt_api_key() RETURNS TRIGGER AS $$
BEGIN
  -- Only encrypt if the key is being inserted or updated
  IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND NEW.api_key <> OLD.api_key) THEN
    -- Use pgcrypto extension to encrypt the API key
    NEW.api_key = pgp_sym_encrypt(NEW.api_key, current_setting('app.settings.jwt_secret'));
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create a function to decrypt API keys when retrieving
CREATE OR REPLACE FUNCTION decrypt_api_key() RETURNS TRIGGER AS $$
BEGIN
  -- Decrypt the API key when it's being retrieved
  NEW.api_key = pgp_sym_decrypt(NEW.api_key::bytea, current_setting('app.settings.jwt_secret'));
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create triggers to automatically encrypt/decrypt API keys
CREATE TRIGGER encrypt_api_key_trigger
  BEFORE INSERT OR UPDATE ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION encrypt_api_key();

CREATE TRIGGER decrypt_api_key_trigger
  AFTER SELECT ON public.api_keys
  FOR EACH ROW EXECUTE FUNCTION decrypt_api_key();
*/

-- =============================================
-- SETUP COMPLETE
-- =============================================
RAISE NOTICE 'Setup complete. The API key storage system is now ready to use.'; 