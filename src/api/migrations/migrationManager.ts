import { runMigrations, rollbackToVersion, getMigrationHistory, getCurrentVersion } from './index';
import setupMigrationFunctions from './checkSetup';

// Import all migrations
import './001_initial_schema';
import './002_savings_goals';
import './003_api_keys_table';
import './004_vault_setup';
import './005_savings_contributions';
import './006_update_milestones';

/**
 * Initialize and run all pending migrations
 * @returns A promise that resolves when all migrations are complete
 */
export const initializeMigrations = async (): Promise<boolean> => {
  console.log('Initializing database migrations...');
  
  try {
    // First, ensure the execute_sql function exists
    console.log('Setting up required database functions...');
    const setupResult = await setupMigrationFunctions();
    
    if (!setupResult) {
      console.error('Failed to set up required database functions');
      console.log('Please run the SQL commands shown above in the Supabase SQL Editor');
      console.log('Then restart the app to try again');
      return false;
    }
    
    // Run all pending migrations
    const result = await runMigrations();
    
    if (result) {
      const currentVersion = await getCurrentVersion();
      console.log(`Database is now at version ${currentVersion}`);
    } else {
      console.error('Failed to run all migrations');
    }
    
    return result;
  } catch (error) {
    console.error('Error initializing migrations:', error);
    return false;
  }
};

/**
 * Get the current migration status
 * @returns An object with the current version and migration history
 */
export const getMigrationStatus = async (): Promise<{
  currentVersion: number;
  history: any[];
}> => {
  try {
    const currentVersion = await getCurrentVersion();
    const history = await getMigrationHistory();
    
    return {
      currentVersion,
      history
    };
  } catch (error) {
    console.error('Error getting migration status:', error);
    return {
      currentVersion: 0,
      history: []
    };
  }
};

/**
 * Roll back to a specific version
 * @param targetVersion The version to roll back to
 * @returns A promise that resolves when the rollback is complete
 */
export const rollback = async (targetVersion: number): Promise<boolean> => {
  console.log(`Rolling back to version ${targetVersion}...`);
  
  try {
    // First, ensure the execute_sql function exists
    const setupResult = await setupMigrationFunctions();
    
    if (!setupResult) {
      console.error('Failed to set up required database functions');
      return false;
    }
    
    const result = await rollbackToVersion(targetVersion);
    
    if (result) {
      const currentVersion = await getCurrentVersion();
      console.log(`Database is now at version ${currentVersion}`);
    } else {
      console.error('Failed to roll back migrations');
    }
    
    return result;
  } catch (error) {
    console.error('Error rolling back migrations:', error);
    return false;
  }
}; 