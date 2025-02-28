-- =============================================
-- GLOBAL API KEYS SETUP SCRIPT
-- =============================================
-- This script creates a table for storing API keys that are not linked to specific users
-- Useful for development environments where you want to share API keys across all users

-- Create global_api_keys table for storing shared API keys
CREATE TABLE IF NOT EXISTS public.global_api_keys (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  key_type TEXT NOT NULL UNIQUE,
  api_key TEXT NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add comments for documentation
COMMENT ON TABLE public.global_api_keys IS 'Stores global API keys shared across all users';
COMMENT ON COLUMN public.global_api_keys.key_type IS 'Type of API key (e.g., openai, other services)';
COMMENT ON COLUMN public.global_api_keys.api_key IS 'The actual API key value';
COMMENT ON COLUMN public.global_api_keys.description IS 'Description of what this API key is used for';
COMMENT ON COLUMN public.global_api_keys.is_active IS 'Whether this API key is currently active';

-- Create a function to get a global API key
CREATE OR REPLACE FUNCTION public.get_global_api_key(key_type_param text)
RETURNS text AS $$
DECLARE
  api_key_value text;
BEGIN
  SELECT api_key INTO api_key_value
  FROM public.global_api_keys
  WHERE key_type = key_type_param AND is_active = TRUE;
  
  RETURN api_key_value;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a function to set a global API key
CREATE OR REPLACE FUNCTION public.set_global_api_key(key_type_param text, api_key_param text, description_param text DEFAULT NULL)
RETURNS void AS $$
BEGIN
  INSERT INTO public.global_api_keys (key_type, api_key, description)
  VALUES (key_type_param, api_key_param, description_param)
  ON CONFLICT (key_type) DO UPDATE SET 
    api_key = api_key_param,
    description = COALESCE(description_param, public.global_api_keys.description),
    updated_at = NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Insert a default OpenAI API key (replace with your actual key)
-- SELECT set_global_api_key('openai', 'YOUR_OPENAI_API_KEY', 'Default OpenAI API key for development');

-- Grant access to authenticated users to use the functions
GRANT EXECUTE ON FUNCTION public.get_global_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_global_api_key TO authenticated;

-- =============================================
-- SETUP COMPLETE
-- =============================================
RAISE NOTICE 'Global API key storage system is now ready to use.'; 