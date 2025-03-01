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

-- Optional: Set up encryption for API keys
-- Uncomment if you want to use encryption (requires pgcrypto extension)

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

-- Add comments for documentation
COMMENT ON TABLE public.api_keys IS 'Stores API keys for users';
COMMENT ON COLUMN public.api_keys.key_type IS 'Type of API key (e.g., openai, other services)';
COMMENT ON COLUMN public.api_keys.api_key IS 'The actual API key value'; 