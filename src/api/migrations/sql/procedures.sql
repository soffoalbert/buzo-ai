-- Create a function to create the migrations table
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