-- This script sets up the required functions for the Buzo AI migrations system
-- Run this script in the Supabase SQL Editor before using the migrations system

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

-- Success message
DO $$
BEGIN
  RAISE NOTICE 'Setup completed successfully. The migrations system is now ready to use.';
END $$; 