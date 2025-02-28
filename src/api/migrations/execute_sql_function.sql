-- Function to execute SQL queries from the client
-- This function is used by the migrations system to execute SQL queries
-- It requires superuser privileges to create
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

-- Note: This function should be created by a superuser in the Supabase SQL editor
-- It allows authenticated users to execute SQL queries, which is a security risk
-- Use with caution and only in development environments 