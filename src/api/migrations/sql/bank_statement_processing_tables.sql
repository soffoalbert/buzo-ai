-- SQL functions to create tables for bank statement processing

-- Function to create the transactions table if it doesn't exist
CREATE OR REPLACE FUNCTION create_transactions_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'transactions'
  ) THEN
    -- Create the transactions table
    CREATE TABLE public.transactions (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      statement_id UUID NOT NULL,
      date DATE NOT NULL,
      description TEXT NOT NULL,
      amount NUMERIC(10, 2) NOT NULL,
      category TEXT NOT NULL,
      is_expense BOOLEAN NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Add foreign key to bank_statements if it exists
    IF EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'bank_statements'
    ) THEN
      ALTER TABLE public.transactions
      ADD CONSTRAINT fk_transactions_bank_statements
      FOREIGN KEY (statement_id) REFERENCES public.bank_statements(id) ON DELETE CASCADE;
    END IF;

    -- Create index on user_id for faster queries
    CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
    
    -- Create index on statement_id for faster queries
    CREATE INDEX idx_transactions_statement_id ON public.transactions(statement_id);
    
    -- Create index on date for faster queries
    CREATE INDEX idx_transactions_date ON public.transactions(date);
    
    -- Create index on category for faster queries
    CREATE INDEX idx_transactions_category ON public.transactions(category);

    -- Enable Row Level Security
    ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

    -- Create policy for users to select only their own transactions
    CREATE POLICY select_own_transactions ON public.transactions
    FOR SELECT USING (auth.uid() = user_id);

    -- Create policy for users to insert only their own transactions
    CREATE POLICY insert_own_transactions ON public.transactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Create policy for users to update only their own transactions
    CREATE POLICY update_own_transactions ON public.transactions
    FOR UPDATE USING (auth.uid() = user_id);

    -- Create policy for users to delete only their own transactions
    CREATE POLICY delete_own_transactions ON public.transactions
    FOR DELETE USING (auth.uid() = user_id);
    
    RAISE NOTICE 'Created transactions table';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create the bank_statement_analyses table if it doesn't exist
CREATE OR REPLACE FUNCTION create_bank_statement_analyses_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'bank_statement_analyses'
  ) THEN
    -- Create the bank_statement_analyses table
    CREATE TABLE public.bank_statement_analyses (
      id UUID PRIMARY KEY,
      statement_id UUID NOT NULL,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      total_income NUMERIC(10, 2) NOT NULL,
      total_expenses NUMERIC(10, 2) NOT NULL,
      category_breakdown JSONB NOT NULL,
      insights TEXT[] NOT NULL,
      processed_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
    );

    -- Add foreign key to bank_statements if it exists
    IF EXISTS (
      SELECT FROM pg_tables
      WHERE schemaname = 'public'
      AND tablename = 'bank_statements'
    ) THEN
      ALTER TABLE public.bank_statement_analyses
      ADD CONSTRAINT fk_analyses_bank_statements
      FOREIGN KEY (statement_id) REFERENCES public.bank_statements(id) ON DELETE CASCADE;
    END IF;

    -- Create index on user_id for faster queries
    CREATE INDEX idx_analyses_user_id ON public.bank_statement_analyses(user_id);
    
    -- Create index on statement_id for faster queries
    CREATE INDEX idx_analyses_statement_id ON public.bank_statement_analyses(statement_id);

    -- Enable Row Level Security
    ALTER TABLE public.bank_statement_analyses ENABLE ROW LEVEL SECURITY;

    -- Create policy for users to select only their own analyses
    CREATE POLICY select_own_analyses ON public.bank_statement_analyses
    FOR SELECT USING (auth.uid() = user_id);

    -- Create policy for users to insert only their own analyses
    CREATE POLICY insert_own_analyses ON public.bank_statement_analyses
    FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Create policy for users to update only their own analyses
    CREATE POLICY update_own_analyses ON public.bank_statement_analyses
    FOR UPDATE USING (auth.uid() = user_id);

    -- Create policy for users to delete only their own analyses
    CREATE POLICY delete_own_analyses ON public.bank_statement_analyses
    FOR DELETE USING (auth.uid() = user_id);
    
    RAISE NOTICE 'Created bank_statement_analyses table';
  END IF;
END;
$$ LANGUAGE plpgsql;

-- Function to create bank_statements table if it doesn't exist
-- (In case it hasn't been created already)
CREATE OR REPLACE FUNCTION create_bank_statements_table_if_not_exists()
RETURNS void AS $$
BEGIN
  -- Check if the table exists
  IF NOT EXISTS (
    SELECT FROM pg_tables
    WHERE schemaname = 'public'
    AND tablename = 'bank_statements'
  ) THEN
    -- Create the bank_statements table
    CREATE TABLE public.bank_statements (
      id UUID PRIMARY KEY,
      user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      upload_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      status TEXT NOT NULL DEFAULT 'pending',
      insights TEXT
    );

    -- Create index on user_id for faster queries
    CREATE INDEX idx_bank_statements_user_id ON public.bank_statements(user_id);
    
    -- Create index on status for faster queries
    CREATE INDEX idx_bank_statements_status ON public.bank_statements(status);

    -- Enable Row Level Security
    ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;

    -- Create policy for users to select only their own bank statements
    CREATE POLICY select_own_bank_statements ON public.bank_statements
    FOR SELECT USING (auth.uid() = user_id);

    -- Create policy for users to insert only their own bank statements
    CREATE POLICY insert_own_bank_statements ON public.bank_statements
    FOR INSERT WITH CHECK (auth.uid() = user_id);

    -- Create policy for users to update only their own bank statements
    CREATE POLICY update_own_bank_statements ON public.bank_statements
    FOR UPDATE USING (auth.uid() = user_id);

    -- Create policy for users to delete only their own bank statements
    CREATE POLICY delete_own_bank_statements ON public.bank_statements
    FOR DELETE USING (auth.uid() = user_id);
    
    RAISE NOTICE 'Created bank_statements table';
  END IF;
END;
$$ LANGUAGE plpgsql; 