import { supabase } from '../supabaseClient';
import * as FileSystem from 'expo-file-system';
import { Asset } from 'expo-asset';

/**
 * Runs the setup script to create the required functions for migrations
 * This can be called from a setup screen in the app
 */
export const runSetupScript = async (): Promise<{ success: boolean; message: string }> => {
  console.log('Running database setup script...');
  
  try {
    // Try to read the setup.sql file
    let sqlScript = '';
    
    try {
      // First try to load from assets
      const asset = Asset.fromModule(require('./setup.sql'));
      await asset.downloadAsync();
      sqlScript = await FileSystem.readAsStringAsync(asset.localUri!);
    } catch (error) {
      console.log('Could not load setup.sql from assets, using hardcoded script');
      
      // Fallback to hardcoded script
      sqlScript = `
        -- Function to execute SQL queries from the client
        CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $$
        BEGIN
          EXECUTE sql_query;
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
      `;
    }
    
    // Execute the script
    const { error } = await supabase.rpc('execute_sql', {
      sql: sqlScript
    });
    
    if (error) {
      console.error('Error running setup script:', error);
      return { 
        success: false, 
        message: `Setup failed: ${error.message}. Please run the setup script manually in the Supabase SQL Editor.` 
      };
    }
    
    console.log('Setup script executed successfully');
    
    // Verify that the execute_sql function was created
    const { error: testError } = await supabase.rpc('execute_sql', {
      sql_query: 'SELECT 1'
    });
    
    if (testError) {
      console.error('execute_sql function was not created properly:', testError);
      return { 
        success: false, 
        message: 'The setup script ran, but the execute_sql function is not working. Please check the Supabase logs.' 
      };
    }
    
    return { 
      success: true, 
      message: 'Database setup completed successfully. The migrations system is now ready to use.' 
    };
  } catch (error: any) {
    console.error('Error running setup script:', error);
    return { 
      success: false, 
      message: `An unexpected error occurred: ${error.message}` 
    };
  }
};

export default runSetupScript; 