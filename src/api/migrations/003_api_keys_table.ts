import { supabase } from '../supabaseClient';
import { registerMigration } from './index';
import fs from 'fs';
import path from 'path';

// Migration version
const VERSION = 3;
const NAME = 'api_keys_table';

// SQL for creating the API keys table
const setupApiKeysTableSQL = `
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
`;

// SQL for rolling back the API keys table
const rollbackApiKeysTableSQL = `
-- Drop policies
DROP POLICY IF EXISTS "Users can view their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can insert their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can update their own API keys" ON public.api_keys;
DROP POLICY IF EXISTS "Users can delete their own API keys" ON public.api_keys;

-- Drop constraint
ALTER TABLE IF EXISTS public.api_keys DROP CONSTRAINT IF EXISTS unique_user_key_type;

-- Drop table
DROP TABLE IF EXISTS public.api_keys;
`;

/**
 * Run the migration to set up the API keys table
 */
const up = async () => {
  console.log(`Running migration ${VERSION}: ${NAME}`);
  
  try {
    // Execute the SQL to set up the API keys table
    const { error } = await supabase.rpc('execute_sql', { sql: setupApiKeysTableSQL });
    
    if (error) {
      console.error(`Error setting up API keys table: ${error.message}`);
      return false;
    }
    
    console.log(`Migration ${VERSION} completed successfully`);
    return true;
  } catch (error) {
    console.error(`Error in migration ${VERSION}:`, error);
    return false;
  }
};

/**
 * Roll back the migration
 */
const down = async () => {
  console.log(`Rolling back migration ${VERSION}: ${NAME}`);
  
  try {
    // Execute the SQL to roll back the API keys table
    const { error } = await supabase.rpc('execute_sql', { sql: rollbackApiKeysTableSQL });
    
    if (error) {
      console.error(`Error rolling back API keys table: ${error.message}`);
      return false;
    }
    
    console.log(`Rollback of migration ${VERSION} completed successfully`);
    return true;
  } catch (error) {
    console.error(`Error in rollback of migration ${VERSION}:`, error);
    return false;
  }
};

// Register the migration
registerMigration({
  id: `migration_${VERSION}`,
  name: NAME,
  description: 'Creates the API keys table for storing OpenAI API keys',
  version: VERSION,
  up: async (): Promise<void> => {
    await up();
  },
  down: async (): Promise<void> => {
    await down();
  },
}); 