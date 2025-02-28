import { v4 as uuidv4 } from 'uuid';
import { Migration, registerMigration } from './index';
import { supabase } from '../supabaseClient';

const migration: Migration = {
  id: uuidv4(),
  name: 'expenses_budgets',
  description: 'Create expenses and budgets tables',
  version: 3,
  
  up: async () => {
    console.log('Running migration: expenses_budgets');
    
    // Create expenses table
    const { error: expensesError } = await supabase.rpc('execute_sql', {
      sql_query: `
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
        
        -- Enable RLS
        ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can view their own expenses" ON public.expenses;
          DROP POLICY IF EXISTS "Users can insert their own expenses" ON public.expenses;
          DROP POLICY IF EXISTS "Users can update their own expenses" ON public.expenses;
          DROP POLICY IF EXISTS "Users can delete their own expenses" ON public.expenses;
          
          -- Create new policies
          CREATE POLICY "Users can view their own expenses" ON public.expenses
            FOR SELECT USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can insert their own expenses" ON public.expenses
            FOR INSERT WITH CHECK (auth.uid() = user_id);
          
          CREATE POLICY "Users can update their own expenses" ON public.expenses
            FOR UPDATE USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can delete their own expenses" ON public.expenses
            FOR DELETE USING (auth.uid() = user_id);
        END $$;
      `
    });
    
    if (expensesError) {
      console.error('Error creating expenses table:', expensesError);
      throw expensesError;
    }
    
    // Create budgets table
    const { error: budgetsError } = await supabase.rpc('execute_sql', {
      sql_query: `
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
        
        -- Enable RLS
        ALTER TABLE public.budgets ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can view their own budgets" ON public.budgets;
          DROP POLICY IF EXISTS "Users can insert their own budgets" ON public.budgets;
          DROP POLICY IF EXISTS "Users can update their own budgets" ON public.budgets;
          DROP POLICY IF EXISTS "Users can delete their own budgets" ON public.budgets;
          
          -- Create new policies
          CREATE POLICY "Users can view their own budgets" ON public.budgets
            FOR SELECT USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can insert their own budgets" ON public.budgets
            FOR INSERT WITH CHECK (auth.uid() = user_id);
          
          CREATE POLICY "Users can update their own budgets" ON public.budgets
            FOR UPDATE USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can delete their own budgets" ON public.budgets
            FOR DELETE USING (auth.uid() = user_id);
        END $$;
      `
    });
    
    if (budgetsError) {
      console.error('Error creating budgets table:', budgetsError);
      throw budgetsError;
    }
    
    console.log('Expenses and budgets migration completed successfully');
  },
  
  down: async () => {
    console.log('Rolling back migration: expenses_budgets');
    
    // Drop tables in reverse order
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Drop budgets table
        DROP TABLE IF EXISTS public.budgets;
        
        -- Drop expenses table
        DROP TABLE IF EXISTS public.expenses;
      `
    });
    
    if (dropError) {
      console.error('Error rolling back expenses and budgets tables:', dropError);
      throw dropError;
    }
    
    console.log('Expenses and budgets rollback completed successfully');
  }
};

// Register the migration
registerMigration(migration); 