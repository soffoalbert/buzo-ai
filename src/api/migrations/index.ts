import { supabase } from '../supabaseClient';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Interface for migration metadata
export interface Migration {
  id: string;
  name: string;
  description: string;
  version: number;
  up: () => Promise<void>;
  down?: () => Promise<void>; // Optional rollback function
}

// Migration registry to store all available migrations
const migrations: Migration[] = [];

// Register a migration to be run
export const registerMigration = (migration: Migration) => {
  migrations.push(migration);
  // Sort migrations by version to ensure they run in the correct order
  migrations.sort((a, b) => a.version - b.version);
};

// Get the current migration version from storage
export const getCurrentVersion = async (): Promise<number> => {
  try {
    const version = await AsyncStorage.getItem('dbMigrationVersion');
    return version ? parseInt(version, 10) : 0;
  } catch (error) {
    console.error('Error getting current migration version:', error);
    return 0;
  }
};

// Set the current migration version in storage
export const setCurrentVersion = async (version: number): Promise<void> => {
  try {
    await AsyncStorage.setItem('dbMigrationVersion', version.toString());
  } catch (error) {
    console.error('Error setting migration version:', error);
  }
};

// Create migrations table in Supabase if it doesn't exist
export const ensureMigrationsTable = async (): Promise<boolean> => {
  try {
    // Check if the migrations table exists
    const { error: checkError } = await supabase
      .from('migrations')
      .select('count', { count: 'exact', head: true });
    
    if (checkError) {
      console.log('Migrations table does not exist, attempting to create it...');
      
      // Try to create the migrations table
      const { error: createError } = await supabase.rpc('create_migrations_table');
      
      if (createError) {
        console.error('Error creating migrations table:', createError);
        console.log('Will use local storage for migration tracking instead.');
        return false;
      }
      
      console.log('Migrations table created successfully');
      return true;
    }
    
    console.log('Migrations table exists');
    return true;
  } catch (error) {
    console.error('Error ensuring migrations table:', error);
    return false;
  }
};

// Record a migration in the database
export const recordMigration = async (migration: Migration, success: boolean): Promise<void> => {
  try {
    // Try to record in Supabase first
    const { error } = await supabase
      .from('migrations')
      .insert([{
        id: migration.id,
        name: migration.name,
        description: migration.description,
        version: migration.version,
        executed_at: new Date().toISOString(),
        success
      }]);
    
    if (error) {
      console.warn('Could not record migration in database:', error);
      // Fall back to local storage
      const migrationsHistory = await AsyncStorage.getItem('migrationsHistory') || '[]';
      const history = JSON.parse(migrationsHistory);
      history.push({
        id: migration.id,
        name: migration.name,
        version: migration.version,
        executed_at: new Date().toISOString(),
        success
      });
      await AsyncStorage.setItem('migrationsHistory', JSON.stringify(history));
    }
  } catch (error) {
    console.error('Error recording migration:', error);
  }
};

// Run all pending migrations
export const runMigrations = async (): Promise<boolean> => {
  console.log('Checking for pending migrations...');
  
  try {
    // Ensure migrations table exists
    const tableExists = await ensureMigrationsTable();
    
    // Get current version
    const currentVersion = await getCurrentVersion();
    console.log(`Current database version: ${currentVersion}`);
    
    // Get pending migrations
    const pendingMigrations = migrations.filter(m => m.version > currentVersion);
    
    if (pendingMigrations.length === 0) {
      console.log('No pending migrations found.');
      return true;
    }
    
    console.log(`Found ${pendingMigrations.length} pending migrations to run.`);
    
    // Run each pending migration in order
    for (const migration of pendingMigrations) {
      try {
        console.log(`Running migration: ${migration.name} (v${migration.version})`);
        await migration.up();
        await recordMigration(migration, true);
        await setCurrentVersion(migration.version);
        console.log(`Migration ${migration.name} completed successfully.`);
      } catch (error) {
        console.error(`Error running migration ${migration.name}:`, error);
        await recordMigration(migration, false);
        return false;
      }
    }
    
    console.log('All migrations completed successfully.');
    return true;
  } catch (error) {
    console.error('Error running migrations:', error);
    return false;
  }
};

// Rollback to a specific version
export const rollbackToVersion = async (targetVersion: number): Promise<boolean> => {
  try {
    const currentVersion = await getCurrentVersion();
    
    if (targetVersion >= currentVersion) {
      console.log(`Current version (${currentVersion}) is already at or below target version (${targetVersion}).`);
      return true;
    }
    
    // Get migrations to roll back (in reverse order)
    const migrationsToRollback = migrations
      .filter(m => m.version <= currentVersion && m.version > targetVersion && m.down)
      .sort((a, b) => b.version - a.version);
    
    if (migrationsToRollback.length === 0) {
      console.log('No migrations to roll back.');
      return true;
    }
    
    console.log(`Rolling back ${migrationsToRollback.length} migrations.`);
    
    // Roll back each migration in reverse order
    for (const migration of migrationsToRollback) {
      try {
        console.log(`Rolling back migration: ${migration.name} (v${migration.version})`);
        if (migration.down) {
          await migration.down();
          console.log(`Rollback of ${migration.name} completed successfully.`);
        } else {
          console.warn(`Migration ${migration.name} has no rollback function.`);
        }
      } catch (error) {
        console.error(`Error rolling back migration ${migration.name}:`, error);
        return false;
      }
    }
    
    // Update version
    await setCurrentVersion(targetVersion);
    console.log(`Rolled back to version ${targetVersion}.`);
    return true;
  } catch (error) {
    console.error('Error rolling back migrations:', error);
    return false;
  }
};

// Get migration history
export const getMigrationHistory = async (): Promise<any[]> => {
  try {
    // Try to get from Supabase first
    const { data, error } = await supabase
      .from('migrations')
      .select('*')
      .order('executed_at', { ascending: false });
    
    if (error || !data) {
      console.warn('Could not get migration history from database:', error);
      // Fall back to local storage
      const migrationsHistory = await AsyncStorage.getItem('migrationsHistory') || '[]';
      return JSON.parse(migrationsHistory);
    }
    
    return data;
  } catch (error) {
    console.error('Error getting migration history:', error);
    return [];
  }
}; 