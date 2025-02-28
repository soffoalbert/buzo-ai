# Supabase Database Migrations System

This directory contains the database migrations system for the Buzo AI application. The migrations system allows for versioned database schema changes that can be applied and rolled back as needed.

## Overview

The migrations system consists of:

1. A core migration engine (`index.ts`)
2. Individual migration files (e.g., `001_initial_schema.ts`)
3. A migration manager (`migrationManager.ts`)
4. SQL procedures for creating the migrations table and executing SQL queries

## How It Works

1. Each migration is a TypeScript file that exports a migration object with `up()` and `down()` functions.
2. The `up()` function applies the migration, creating or modifying database objects.
3. The `down()` function rolls back the migration, undoing the changes.
4. Migrations are versioned and applied in order.
5. The system tracks which migrations have been applied in a `migrations` table in Supabase.
6. If the `migrations` table doesn't exist or can't be accessed, the system falls back to using AsyncStorage.

## Setup

Before using the migrations system, you need to set up the required database functions:

### Option 1: Run the Setup Script (Recommended)

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Open the `setup.sql` file in this directory
4. Copy the entire contents and paste it into the SQL Editor
5. Run the script

This script will create:
- The `execute_sql` function needed for migrations
- The `create_migrations_table` function
- The `migrations` table (if it doesn't exist)

### Option 2: Manual Setup

If you prefer to set up only the essential function:

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the following SQL:

```sql
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
```

## Creating a New Migration

To create a new migration:

1. Create a new file in the `migrations` directory with a name like `XXX_description.ts` where `XXX` is the next number in sequence.
2. Use the following template:

```typescript
import { v4 as uuidv4 } from 'uuid';
import { Migration, registerMigration } from './index';
import { supabase } from '../supabaseClient';

const migration: Migration = {
  id: uuidv4(),
  name: 'migration_name',
  description: 'Description of what this migration does',
  version: X, // Next version number
  
  up: async () => {
    // Code to apply the migration
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Your SQL here
      `
    });
    
    if (error) {
      console.error('Error in migration:', error);
      throw error;
    }
  },
  
  down: async () => {
    // Code to roll back the migration
    const { error } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Your rollback SQL here
      `
    });
    
    if (error) {
      console.error('Error in migration rollback:', error);
      throw error;
    }
  }
};

// Register the migration
registerMigration(migration);
```

3. Import the new migration in `migrationManager.ts`

## Running Migrations

Migrations are automatically run when the app starts and connects to Supabase. You can also run them manually:

```typescript
import { initializeMigrations } from './api/migrations/migrationManager';

// Run all pending migrations
await initializeMigrations();
```

## Rolling Back Migrations

To roll back to a specific version:

```typescript
import { rollback } from './api/migrations/migrationManager';

// Roll back to version 2
await rollback(2);
```

## Checking Migration Status

To check the current migration status:

```typescript
import { getMigrationStatus } from './api/migrations/migrationManager';

const status = await getMigrationStatus();
console.log(`Current version: ${status.currentVersion}`);
console.log('Migration history:', status.history);
```

## Fallback Mechanism

If the migrations system can't access the Supabase database, it falls back to using AsyncStorage to track migrations. This allows the app to continue functioning even when the backend is not fully set up.

## Troubleshooting

- **Error: "function execute_sql does not exist"** - You need to create the `execute_sql` function in your Supabase project. See the Setup section.
- **Error: "permission denied for function execute_sql"** - The function exists but the current user doesn't have permission to execute it. Make sure you've granted execute permission to authenticated users.
- **Error: "relation migrations does not exist"** - The migrations table hasn't been created yet. This is normal on first run and the system will attempt to create it.
- **Error: "permission denied for relation migrations"** - The migrations table exists but the current user doesn't have permission to access it. Check your RLS policies.
- **Error: "Could not find the function public.execute_sql"** - Run the setup script in the Supabase SQL Editor as described in the Setup section. 