import { v4 as uuidv4 } from 'uuid';
import { Migration, registerMigration } from './index';
import { supabase } from '../supabaseClient';

const migration: Migration = {
  id: uuidv4(),
  name: 'savings_contributions',
  description: 'Create savings_contributions table',
  version: 5,
  
  up: async () => {
    console.log('Running migration: savings_contributions');
    
    // Create savings_contributions table
    const { error: contributionsError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.savings_contributions (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,
          user_id UUID REFERENCES auth.users(id) NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          source TEXT NOT NULL CHECK (source IN ('manual', 'automated', 'budget_allocation')),
          budget_id UUID,
          expense_id UUID,
          metadata JSONB,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable RLS
        ALTER TABLE public.savings_contributions ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can view their own contributions" ON public.savings_contributions;
          DROP POLICY IF EXISTS "Users can insert their own contributions" ON public.savings_contributions;
          DROP POLICY IF EXISTS "Users can update their own contributions" ON public.savings_contributions;
          DROP POLICY IF EXISTS "Users can delete their own contributions" ON public.savings_contributions;
          
          -- Create new policies
          CREATE POLICY "Users can view their own contributions" ON public.savings_contributions
            FOR SELECT USING (
              auth.uid() = user_id OR
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_contributions.goal_id 
                AND (user_id = auth.uid() OR auth.uid() = ANY(shared_with))
              )
            );
          
          CREATE POLICY "Users can insert their own contributions" ON public.savings_contributions
            FOR INSERT WITH CHECK (
              auth.uid() = user_id AND
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_contributions.goal_id 
                AND (user_id = auth.uid() OR auth.uid() = ANY(shared_with))
              )
            );
          
          CREATE POLICY "Users can update their own contributions" ON public.savings_contributions
            FOR UPDATE USING (
              auth.uid() = user_id AND
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_contributions.goal_id 
                AND user_id = auth.uid()
              )
            );
          
          CREATE POLICY "Users can delete their own contributions" ON public.savings_contributions
            FOR DELETE USING (
              auth.uid() = user_id AND
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_contributions.goal_id 
                AND user_id = auth.uid()
              )
            );
        END $$;

        -- Create indexes for better query performance
        CREATE INDEX IF NOT EXISTS idx_savings_contributions_goal_id ON public.savings_contributions(goal_id);
        CREATE INDEX IF NOT EXISTS idx_savings_contributions_user_id ON public.savings_contributions(user_id);
        CREATE INDEX IF NOT EXISTS idx_savings_contributions_created_at ON public.savings_contributions(created_at DESC);
      `
    });
    
    if (contributionsError) {
      console.error('Error creating savings_contributions table:', contributionsError);
      throw contributionsError;
    }
    
    console.log('Savings contributions migration completed successfully');
  },
  
  down: async () => {
    console.log('Rolling back migration: savings_contributions');
    
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Drop indexes
        DROP INDEX IF EXISTS idx_savings_contributions_goal_id;
        DROP INDEX IF EXISTS idx_savings_contributions_user_id;
        DROP INDEX IF EXISTS idx_savings_contributions_created_at;
        
        -- Drop savings_contributions table
        DROP TABLE IF EXISTS public.savings_contributions;
      `
    });
    
    if (dropError) {
      console.error('Error rolling back savings contributions table:', dropError);
      throw dropError;
    }
    
    console.log('Savings contributions rollback completed successfully');
  }
};

// Register the migration
registerMigration(migration); 