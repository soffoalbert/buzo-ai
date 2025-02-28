import { supabase } from '../supabaseClient';

/**
 * Checks if the execute_sql function exists and creates it if it doesn't
 * This function should be called before running migrations
 */
export const checkAndCreateExecuteSqlFunction = async (): Promise<boolean> => {
  console.log('Checking if execute_sql function exists...');
  
  try {
    // Try to call the function with a simple query to check if it exists
    const { error: testError } = await supabase.rpc('execute_sql', {
      sql_query: 'SELECT 1'
    });
    
    // If no error or error is not about missing function, function exists
    if (!testError || !testError.message.includes('Could not find the function')) {
      console.log('execute_sql function exists');
      return true;
    }
    
    console.log('execute_sql function does not exist, creating it...');
    
    // Function doesn't exist, try to create it using raw SQL
    // Note: This requires admin privileges and may not work in all environments
    const { error: createError } = await supabase.rpc('create_execute_sql_function');
    
    if (createError) {
      console.error('Error creating execute_sql function:', createError);
      console.log('');
      console.log('=== MANUAL SETUP REQUIRED ===');
      console.log('Please run the following SQL in the Supabase SQL Editor:');
      console.log('');
      console.log('-- Function to create the execute_sql function');
      console.log('CREATE OR REPLACE FUNCTION create_execute_sql_function()');
      console.log('RETURNS void');
      console.log('LANGUAGE plpgsql');
      console.log('SECURITY DEFINER');
      console.log('AS $$');
      console.log('BEGIN');
      console.log('  -- Create the execute_sql function if it doesn\'t exist');
      console.log('  CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)');
      console.log('  RETURNS void');
      console.log('  LANGUAGE plpgsql');
      console.log('  SECURITY DEFINER');
      console.log('  AS $func$');
      console.log('  BEGIN');
      console.log('    EXECUTE sql_query;');
      console.log('  END;');
      console.log('  $func$;');
      console.log('');
      console.log('  -- Grant execute permission to authenticated users');
      console.log('  GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;');
      console.log('END;');
      console.log('$$;');
      console.log('');
      console.log('-- Execute the function to create execute_sql');
      console.log('SELECT create_execute_sql_function();');
      console.log('');
      console.log('-- Clean up (optional)');
      console.log('DROP FUNCTION create_execute_sql_function();');
      console.log('');
      console.log('=== END MANUAL SETUP ===');
      
      return false;
    }
    
    console.log('execute_sql function created successfully');
    return true;
  } catch (error) {
    console.error('Error checking/creating execute_sql function:', error);
    return false;
  }
};

/**
 * Creates a function to create the execute_sql function
 * This is a helper function that creates another function that can create execute_sql
 */
export const createHelperFunction = async (): Promise<boolean> => {
  console.log('Creating helper function to create execute_sql...');
  
  try {
    // Create a helper function that can create the execute_sql function
    const { error } = await supabase.sql(`
      -- Function to create the execute_sql function
      CREATE OR REPLACE FUNCTION create_execute_sql_function()
      RETURNS void
      LANGUAGE plpgsql
      SECURITY DEFINER
      AS $$
      BEGIN
        -- Create the execute_sql function if it doesn't exist
        CREATE OR REPLACE FUNCTION execute_sql(sql_query TEXT)
        RETURNS void
        LANGUAGE plpgsql
        SECURITY DEFINER
        AS $func$
        BEGIN
          EXECUTE sql_query;
        END;
        $func$;

        -- Grant execute permission to authenticated users
        GRANT EXECUTE ON FUNCTION execute_sql TO authenticated;
      END;
      $$;
    `);
    
    if (error) {
      console.error('Error creating helper function:', error);
      return false;
    }
    
    console.log('Helper function created successfully');
    return true;
  } catch (error) {
    console.error('Error creating helper function:', error);
    return false;
  }
};

/**
 * Checks for and creates all required functions for migrations
 */
export const setupMigrationFunctions = async (): Promise<boolean> => {
  try {
    // First try to directly check if execute_sql exists
    const result = await checkAndCreateExecuteSqlFunction();
    
    if (result) {
      return true;
    }
    
    // If that fails, try to create a helper function
    const helperResult = await createHelperFunction();
    
    if (!helperResult) {
      console.error('Failed to create helper function');
      return false;
    }
    
    // Now try to use the helper function to create execute_sql
    const { error } = await supabase.sql('SELECT create_execute_sql_function()');
    
    if (error) {
      console.error('Error executing helper function:', error);
      return false;
    }
    
    console.log('execute_sql function created successfully via helper');
    return true;
  } catch (error) {
    console.error('Error setting up migration functions:', error);
    return false;
  }
};

export default setupMigrationFunctions; 