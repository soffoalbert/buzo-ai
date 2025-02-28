import { v4 as uuidv4 } from 'uuid';
import { Migration, registerMigration } from './index';
import { supabase } from '../supabaseClient';

const migration: Migration = {
  id: uuidv4(),
  name: 'savings_goals',
  description: 'Create savings_goals and savings_milestones tables',
  version: 2,
  
  up: async () => {
    console.log('Running migration: savings_goals');
    
    // Create savings_goals table
    const { error: savingsGoalsError } = await supabase.rpc('execute_sql', {
      sql_query: `
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
        
        -- Enable RLS
        ALTER TABLE public.savings_goals ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can view their own savings goals" ON public.savings_goals;
          DROP POLICY IF EXISTS "Users can insert their own savings goals" ON public.savings_goals;
          DROP POLICY IF EXISTS "Users can update their own savings goals" ON public.savings_goals;
          DROP POLICY IF EXISTS "Users can delete their own savings goals" ON public.savings_goals;
          
          -- Create new policies
          CREATE POLICY "Users can view their own savings goals" ON public.savings_goals
            FOR SELECT USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can insert their own savings goals" ON public.savings_goals
            FOR INSERT WITH CHECK (auth.uid() = user_id);
          
          CREATE POLICY "Users can update their own savings goals" ON public.savings_goals
            FOR UPDATE USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can delete their own savings goals" ON public.savings_goals
            FOR DELETE USING (auth.uid() = user_id);
        END $$;
      `
    });
    
    if (savingsGoalsError) {
      console.error('Error creating savings_goals table:', savingsGoalsError);
      throw savingsGoalsError;
    }
    
    // Create savings_milestones table
    const { error: milestonesError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.savings_milestones (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          goal_id UUID REFERENCES public.savings_goals(id) ON DELETE CASCADE,
          title TEXT NOT NULL,
          amount DECIMAL(12,2) NOT NULL,
          is_reached BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
        );
        
        -- Enable RLS
        ALTER TABLE public.savings_milestones ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can view milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can insert milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can update milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can delete milestones for their goals" ON public.savings_milestones;
          
          -- Create new policies
          CREATE POLICY "Users can view milestones for their goals" ON public.savings_milestones
            FOR SELECT USING (
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
              )
            );
          
          CREATE POLICY "Users can insert milestones for their goals" ON public.savings_milestones
            FOR INSERT WITH CHECK (
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
              )
            );
          
          CREATE POLICY "Users can update milestones for their goals" ON public.savings_milestones
            FOR UPDATE USING (
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
              )
            );
          
          CREATE POLICY "Users can delete milestones for their goals" ON public.savings_milestones
            FOR DELETE USING (
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id AND user_id = auth.uid()
              )
            );
        END $$;
      `
    });
    
    if (milestonesError) {
      console.error('Error creating savings_milestones table:', milestonesError);
      throw milestonesError;
    }
    
    console.log('Savings goals migration completed successfully');
  },
  
  down: async () => {
    console.log('Rolling back migration: savings_goals');
    
    // Drop tables in reverse order
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Drop savings_milestones table
        DROP TABLE IF EXISTS public.savings_milestones;
        
        -- Drop savings_goals table
        DROP TABLE IF EXISTS public.savings_goals;
      `
    });
    
    if (dropError) {
      console.error('Error rolling back savings goals tables:', dropError);
      throw dropError;
    }
    
    console.log('Savings goals rollback completed successfully');
  }
};

// Register the migration
registerMigration(migration); 