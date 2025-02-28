# Secure API Key Storage with Supabase

This document explains how Buzo AI securely stores OpenAI API keys using Supabase.

## Overview

Buzo AI uses a multi-layered approach to store API keys securely:

1. **Supabase Vault** - Primary storage for API keys (most secure, if available)
2. **Supabase Database** - Secondary storage with RLS protection
3. **Expo SecureStore** - Local fallback for offline access

This approach ensures that API keys are:
- Never stored in the codebase or committed to version control
- Protected by Row Level Security (RLS) policies
- Only accessible to the authenticated user who owns them

## Setup Instructions for Administrators

### 1. Set Up Supabase Vault (Recommended)

Supabase Vault is the most secure way to store API keys. If the Vault extension is not available on your PostgreSQL server, the app will automatically create fallback functions in the public schema:

```sql
-- Enable the Vault extension if available
CREATE EXTENSION IF NOT EXISTS vault;

-- If Vault is available, set up policies
ALTER TABLE vault.secrets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can access their own secrets" ON vault.secrets
  USING (auth.uid() = user_id);

-- If Vault is not available, create fallback functions
CREATE TABLE IF NOT EXISTS public.user_secrets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  secret TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, name)
);

ALTER TABLE public.user_secrets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their own secrets" ON public.user_secrets
  USING (auth.uid() = user_id);

-- Create RPC functions that work with either implementation
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

CREATE OR REPLACE FUNCTION public.delete_secret(name text)
RETURNS void AS $$
BEGIN
  DELETE FROM public.user_secrets
  WHERE name = name AND user_id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

### 2. Create the API Keys Table (Fallback)

As a fallback to the Vault, create an API keys table:

```sql
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
```

### 3. Set Up Encryption for Database Storage (Optional but Recommended)

For additional security for the database fallback, you can encrypt the API keys:

```sql
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
```

## For Developers

### How API Keys Are Stored

The application uses a fallback mechanism for storing API keys:

1. First, it tries to store the key in Supabase Vault (if available)
2. If that fails, it stores the key in the Supabase database table
3. It also stores the key in SecureStore for offline access

### How API Keys Are Retrieved

When retrieving an API key:

1. First, it tries to get the key from Supabase Vault (if available)
2. If that fails, it tries to get the key from the Supabase database
3. If that fails, it falls back to SecureStore
4. If all methods fail, it uses a default key (if configured)

### Migration Process

The app automatically migrates API keys from SecureStore to Supabase when:

1. The app starts
2. The user is authenticated
3. An API key exists in SecureStore

The migration process will attempt to store the key in the Vault first, then fall back to the database if needed.

## Security Considerations

- API keys are never stored in the codebase or committed to version control
- Vault provides the highest level of security for storing sensitive information (when available)
- Keys are protected by Row Level Security in both implementations
- SecureStore provides secure local storage on the device

## Troubleshooting

If you encounter issues with API key storage:

1. Check if the user is properly authenticated
2. Verify that either the Vault extension is enabled or the fallback functions are properly set up
3. Check if the api_keys table exists and has the correct schema
4. Ensure the RLS policies are correctly set up
5. Look for errors in the console logs related to API key storage

### Common Errors

- `extension "vault" is not available`: This means the Vault extension is not installed on your PostgreSQL server. The app will automatically use the fallback implementation.
- `Could not find the function public.get_secret`: This indicates that the fallback functions haven't been properly created. Run the migration to set up the fallback functions.

For any persistent issues, contact the development team. 