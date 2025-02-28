# Global API Key Setup for Development

This document explains how to set up and use a global API key for development purposes in the Buzo AI application. A global API key is not linked to any specific user, making it easier to use during development and testing.

## Why Use a Global API Key?

During development, it's often more convenient to have a shared API key that:
- Doesn't require user authentication
- Can be used by all developers
- Simplifies testing and development

## Setup Instructions

### 1. Run the Global API Key Setup Script

First, run the SQL script to set up the global API key table and functions:

```sql
-- Run this in the Supabase SQL Editor
-- =============================================
-- GLOBAL API KEYS SETUP SCRIPT
-- =============================================

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

-- Grant access to authenticated users to use the functions
GRANT EXECUTE ON FUNCTION public.get_global_api_key TO authenticated;
GRANT EXECUTE ON FUNCTION public.set_global_api_key TO authenticated;
```

### 2. Add Your OpenAI API Key

There are three ways to add your OpenAI API key:

#### Option 1: Using the SQL Editor (Quickest)

Run this SQL command in the Supabase SQL Editor:

```sql
SELECT set_global_api_key('openai', 'YOUR_OPENAI_API_KEY', 'Global OpenAI API key for development');
```

Replace `YOUR_OPENAI_API_KEY` with your actual OpenAI API key.

#### Option 2: Using the Command Line Script

Run the provided script:

```bash
npx ts-node src/scripts/setGlobalApiKey.ts YOUR_OPENAI_API_KEY
```

#### Option 3: Using the API in Code

```typescript
import { setGlobalApiKey } from './services/devApiKeyManager';

// Call this function to set the API key
await setGlobalApiKey('YOUR_OPENAI_API_KEY');
```

### 3. Verify the API Key

To verify that the API key was stored correctly, run:

```sql
SELECT get_global_api_key('openai');
```

This should return your API key.

## How It Works

The application now checks for a global API key before trying to get a user-specific key:

1. First, it tries to get the global API key from the `global_api_keys` table
2. If that fails, it falls back to the Vault or user-specific API key
3. If all else fails, it uses SecureStore for local storage

## Security Considerations

**Important**: The global API key approach is intended for development and testing only. In production:

- Each user should have their own API key
- API keys should be linked to specific users
- Row Level Security (RLS) should be enforced

## Troubleshooting

If you encounter issues:

1. Check that the SQL script ran successfully
2. Verify that the API key was stored correctly using the SQL query above
3. Make sure the `USE_GLOBAL_API_KEYS` constant is set to `true` in the code
4. Check the console logs for any errors related to API key retrieval

For any persistent issues, contact the development team. 