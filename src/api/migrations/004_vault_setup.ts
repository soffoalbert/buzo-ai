import { supabase } from '../supabaseClient';
import { registerMigration } from './index';

// Migration version
const VERSION = 4;
const NAME = 'vault_setup';

// SQL for setting up the Vault or fallback functions
const setupVaultSQL = `
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
`;

// SQL for rolling back the Vault setup
const rollbackVaultSQL = `
-- Drop the RPC functions
DROP FUNCTION IF EXISTS public.delete_secret;
DROP FUNCTION IF EXISTS public.get_secret;
DROP FUNCTION IF EXISTS public.set_secret;

-- Drop the policy on user_secrets
DROP POLICY IF EXISTS "Users can access their own secrets" ON public.user_secrets;

-- Drop the user_secrets table
DROP TABLE IF EXISTS public.user_secrets;

-- Check if vault extension is available and drop policies
DO $$
DECLARE
  vault_available boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vault'
  ) INTO vault_available;
  
  IF vault_available THEN
    -- Drop the policy on vault.secrets
    DROP POLICY IF EXISTS "Users can access their own secrets" ON vault.secrets;
  END IF;
END $$;
`;

/**
 * Run the migration to set up the Vault or fallback functions
 */
const up = async () => {
  console.log(`Running migration ${VERSION}: ${NAME}`);
  
  try {
    // Execute the SQL to set up the Vault or fallback functions
    const { error } = await supabase.rpc('execute_sql', { sql: setupVaultSQL });
    
    if (error) {
      console.error(`Error setting up Vault or fallback functions: ${error.message}`);
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
    // Execute the SQL to roll back the Vault setup
    const { error } = await supabase.rpc('execute_sql', { sql: rollbackVaultSQL });
    
    if (error) {
      console.error(`Error rolling back Vault setup: ${error.message}`);
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
  description: 'Sets up Vault extension or creates fallback functions in public schema',
  version: VERSION,
  up: async (): Promise<void> => {
    await up();
  },
  down: async (): Promise<void> => {
    await down();
  },
}); 