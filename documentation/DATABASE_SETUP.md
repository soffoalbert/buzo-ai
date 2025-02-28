# Buzo AI Database Setup Guide

This guide provides comprehensive instructions for setting up the Supabase database for the Buzo AI application.

## Prerequisites

- Access to the Supabase project with admin privileges
- Basic knowledge of SQL

## Setup Options

There are two ways to set up the database for Buzo AI:

### Option 1: Using the Migrations System (Recommended)

Buzo AI now includes a database migrations system that automatically sets up and updates the database schema. To use this system:

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of the `src/api/migrations/setup.sql` file into the SQL Editor and run it
   - This script creates the required functions for the migrations system
   - If you don't have access to this file, use the SQL below:

```sql
-- Function to execute SQL queries from the client
-- This function is used by the migrations system to execute SQL queries
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

-- Comment on function
COMMENT ON FUNCTION execute_sql IS 'Executes SQL queries for database migrations. Requires superuser privileges to create.';

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
```

4. Launch the Buzo AI application, and it will automatically run the migrations to set up all required tables, policies, and storage buckets.

**Note:** The `execute_sql` function is a security risk in production environments as it allows authenticated users to execute arbitrary SQL. Use with caution and only in development environments.

### Option 2: Manual Setup

If you prefer to set up the database manually, follow these steps:

1. Log in to your Supabase dashboard
2. Navigate to the SQL Editor
3. Run the following SQL commands to set up the required tables, storage buckets, and security policies:

```sql
-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create profiles table
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID REFERENCES auth.users(id) PRIMARY KEY,
  first_name TEXT,
  last_name TEXT,
  full_name TEXT,
  email TEXT,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create bank_statements table
CREATE TABLE IF NOT EXISTS public.bank_statements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  status TEXT NOT NULL,
  insights JSONB
);

-- Create expenses table
CREATE TABLE IF NOT EXISTS public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  date TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT NOT NULL,
  description TEXT,
  payment_method TEXT,
  tags TEXT[],
  receipt_image_path TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create budgets table
CREATE TABLE IF NOT EXISTS public.budgets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  name TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  spent DECIMAL(12,2) DEFAULT 0,
  category TEXT NOT NULL,
  color TEXT,
  icon TEXT,
  start_date TIMESTAMP WITH TIME ZONE,
  end_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create savings_goals table
CREATE TABLE IF NOT EXISTS public.savings_goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  target_amount DECIMAL(12,2) NOT NULL,
  current_amount DECIMAL(12,2) DEFAULT 0,
  start_date TIMESTAMP WITH TIME ZONE NOT NULL,
  target_date TIMESTAMP WITH TIME ZONE NOT NULL,
  category TEXT,
  icon TEXT,
  color TEXT,
  is_completed BOOLEAN DEFAULT FALSE,
  is_shared BOOLEAN DEFAULT FALSE,
  shared_with UUID[],
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create savings_milestones table
CREATE TABLE IF NOT EXISTS public.savings_milestones (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  is_reached BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Set up Row Level Security (RLS) policies
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.savings_milestones ENABLE ROW LEVEL SECURITY;

-- Create policies for profiles (drop first if they exist)
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
CREATE POLICY "Users can view their own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile" ON public.profiles
  FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
CREATE POLICY "Users can insert their own profile" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
CREATE POLICY "Service role can manage all profiles" ON public.profiles
  USING (auth.role() = 'service_role');

-- Create policies for bank_statements
DROP POLICY IF EXISTS "Users can view their own bank statements" ON public.bank_statements;
CREATE POLICY "Users can view their own bank statements" ON public.bank_statements
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own bank statements" ON public.bank_statements;
CREATE POLICY "Users can insert their own bank statements" ON public.bank_statements
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own bank statements" ON public.bank_statements;
CREATE POLICY "Users can update their own bank statements" ON public.bank_statements
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own bank statements" ON public.bank_statements;
CREATE POLICY "Users can delete their own bank statements" ON public.bank_statements
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for expenses
DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
CREATE POLICY "Users can view their own expenses" ON public.expenses
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
CREATE POLICY "Users can insert their own expenses" ON public.expenses
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
CREATE POLICY "Users can update their own expenses" ON public.expenses
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
CREATE POLICY "Users can delete their own expenses" ON public.expenses
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for budgets
DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
CREATE POLICY "Users can view their own budgets" ON public.budgets
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own budgets" ON public.budgets;
CREATE POLICY "Users can insert their own budgets" ON public.budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own budgets" ON public.budgets;
CREATE POLICY "Users can update their own budgets" ON public.budgets
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own budgets" ON public.budgets;
CREATE POLICY "Users can delete their own budgets" ON public.budgets
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for savings_goals
DROP POLICY IF EXISTS "Users can view their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can view their own savings goals" ON public.savings_goals
  FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can insert their own savings goals" ON public.savings_goals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can update their own savings goals" ON public.savings_goals
  FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can delete their own savings goals" ON public.savings_goals;
CREATE POLICY "Users can delete their own savings goals" ON public.savings_goals
  FOR DELETE USING (auth.uid() = user_id);

-- Create policies for savings_milestones
DROP POLICY IF EXISTS "Users can view milestones for their goals" ON public.savings_milestones;
CREATE POLICY "Users can view milestones for their goals" ON public.savings_milestones
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.savings_goals
      WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can insert milestones for their goals" ON public.savings_milestones;
CREATE POLICY "Users can insert milestones for their goals" ON public.savings_milestones
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.savings_goals
      WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can update milestones for their goals" ON public.savings_milestones;
CREATE POLICY "Users can update milestones for their goals" ON public.savings_milestones
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.savings_goals
      WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Users can delete milestones for their goals" ON public.savings_milestones;
CREATE POLICY "Users can delete milestones for their goals" ON public.savings_milestones
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.savings_goals
      WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
    )
  );

-- Create storage bucket (only if it doesn't exist)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM storage.buckets WHERE id = 'user-documents'
  ) THEN
    INSERT INTO storage.buckets (id, name, public) 
    VALUES ('user-documents', 'user-documents', false);
  END IF;
END $$;

-- Set up storage RLS policies
DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
CREATE POLICY "Users can upload their own documents" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
CREATE POLICY "Users can view their own documents" ON storage.objects
  FOR SELECT USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);

DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
CREATE POLICY "Users can delete their own documents" ON storage.objects
  FOR DELETE USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
```

## Verifying the Setup

After setting up the database, you should:

1. Check that the tables have been created by navigating to the "Table Editor" in Supabase
2. Verify that the storage bucket has been created by going to the "Storage" section
3. Ensure that the RLS policies are in place by checking the "Authentication > Policies" section

## Database Schema Overview

The Buzo AI application uses the following database tables:

### profiles
Stores user profile information linked to the Supabase auth.users table.

### bank_statements
Stores metadata about uploaded bank statements, including file paths and analysis insights.

### expenses
Tracks user expenses with categories, payment methods, and optional receipt images.

### budgets
Manages user budgets by category with target amounts and spending tracking.

### savings_goals
Tracks user savings goals with target amounts, deadlines, and completion status.

### savings_milestones
Stores milestones for savings goals to track progress at specific points.

## Migrations System

Buzo AI includes a database migrations system that manages schema changes in a versioned way. The migrations system:

1. Automatically creates and updates database tables
2. Applies changes in a specific order
3. Tracks which migrations have been applied
4. Provides rollback functionality

For more information about the migrations system, see the README in the `src/api/migrations` directory.

## Troubleshooting

If you encounter any issues:

1. **Error: "relation already exists"** - This means the table or policy already exists. You can safely ignore this error.
2. **Error: "permission denied"** - Make sure you have admin privileges for the Supabase project.
3. **Error: "duplicate key value violates unique constraint"** - This typically happens when trying to create a resource that already exists. The script has been updated to check for existence before creation.
4. **Error: "syntax error at or near 'IF'"** - PostgreSQL doesn't support `IF NOT EXISTS` for policies. The script now uses `DROP POLICY IF EXISTS` before creating each policy.
5. **Error: "new row violates row-level security policy"** - This occurs when the application tries to insert data but doesn't have the proper permissions. Make sure you're using the correct authentication method:
   - For client-side operations, ensure the user is properly authenticated
   - For server-side operations, use the service role key instead of the anon key
   - Check that the RLS policies are correctly set up for the table
6. **App shows "Bucket not found" error** - Verify that the 'user-documents' bucket exists in the Storage section of Supabase.
7. **Error: "role-level security policy violation"** - This occurs when trying to create storage buckets without admin privileges. Contact your Supabase administrator.
8. **Error: "Could not find the function public.execute_sql"** - You need to run the setup script as described in Option 1 above. This function is required for the migrations system to work.

## Local Storage Fallback

The Buzo AI app includes a local storage fallback mechanism for situations where:

- The Supabase database tables don't exist
- The storage buckets are not properly configured
- There are permission issues with the database or storage

This allows the app to continue functioning even when the backend is not fully set up, but for the best experience, it's recommended to properly configure the Supabase backend as described above. 