import { v4 as uuidv4 } from 'uuid';
import { Migration, registerMigration } from './index';
import { supabase } from '../supabaseClient';

const migration: Migration = {
  id: uuidv4(),
  name: 'update_milestones',
  description: 'Update savings_milestones table with additional fields and indexes',
  version: 6,
  
  up: async () => {
    console.log('Running migration: update_milestones');
    
    const { error: milestonesError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Add user_id column for better querying and security
        ALTER TABLE public.savings_milestones
        ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id);

        -- Add completed_date column
        ALTER TABLE public.savings_milestones
        ADD COLUMN IF NOT EXISTS completed_date TIMESTAMP WITH TIME ZONE;

        -- Add description column
        ALTER TABLE public.savings_milestones
        ADD COLUMN IF NOT EXISTS description TEXT;

        -- Add order column for custom ordering
        ALTER TABLE public.savings_milestones
        ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0;

        -- Update existing rows to set user_id from the parent goal
        UPDATE public.savings_milestones m
        SET user_id = g.user_id
        FROM public.savings_goals g
        WHERE m.goal_id = g.id AND m.user_id IS NULL;

        -- Make user_id NOT NULL after setting values
        ALTER TABLE public.savings_milestones
        ALTER COLUMN user_id SET NOT NULL;

        -- Create indexes for better performance
        CREATE INDEX IF NOT EXISTS idx_savings_milestones_goal_id ON public.savings_milestones(goal_id);
        CREATE INDEX IF NOT EXISTS idx_savings_milestones_user_id ON public.savings_milestones(user_id);
        CREATE INDEX IF NOT EXISTS idx_savings_milestones_is_reached ON public.savings_milestones(is_reached);
        CREATE INDEX IF NOT EXISTS idx_savings_milestones_display_order ON public.savings_milestones(display_order);

        -- Update RLS policies to use user_id directly
        DO $$
        BEGIN
          -- Drop existing policies
          DROP POLICY IF EXISTS "Users can view milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can insert milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can update milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can delete milestones for their goals" ON public.savings_milestones;
          
          -- Create new policies using user_id
          CREATE POLICY "Users can view milestones for their goals" ON public.savings_milestones
            FOR SELECT USING (
              auth.uid() = user_id OR
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id 
                AND (user_id = auth.uid() OR auth.uid() = ANY(shared_with))
              )
            );
          
          CREATE POLICY "Users can insert milestones for their goals" ON public.savings_milestones
            FOR INSERT WITH CHECK (
              auth.uid() = user_id AND
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id 
                AND (user_id = auth.uid() OR auth.uid() = ANY(shared_with))
              )
            );
          
          CREATE POLICY "Users can update milestones for their goals" ON public.savings_milestones
            FOR UPDATE USING (
              auth.uid() = user_id AND
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id 
                AND user_id = auth.uid()
              )
            );
          
          CREATE POLICY "Users can delete milestones for their goals" ON public.savings_milestones
            FOR DELETE USING (
              auth.uid() = user_id AND
              EXISTS (
                SELECT 1 FROM public.savings_goals
                WHERE id = savings_milestones.goal_id 
                AND user_id = auth.uid()
              )
            );
        END $$;
      `
    });
    
    if (milestonesError) {
      console.error('Error updating savings_milestones table:', milestonesError);
      throw milestonesError;
    }
    
    console.log('Savings milestones update completed successfully');
  },
  
  down: async () => {
    console.log('Rolling back migration: update_milestones');
    
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Drop indexes
        DROP INDEX IF EXISTS idx_savings_milestones_goal_id;
        DROP INDEX IF EXISTS idx_savings_milestones_user_id;
        DROP INDEX IF EXISTS idx_savings_milestones_is_reached;
        DROP INDEX IF EXISTS idx_savings_milestones_display_order;
        
        -- Drop added columns
        ALTER TABLE public.savings_milestones
        DROP COLUMN IF EXISTS user_id,
        DROP COLUMN IF EXISTS completed_date,
        DROP COLUMN IF EXISTS description,
        DROP COLUMN IF EXISTS display_order;

        -- Restore original RLS policies
        DO $$
        BEGIN
          -- Drop current policies
          DROP POLICY IF EXISTS "Users can view milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can insert milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can update milestones for their goals" ON public.savings_milestones;
          DROP POLICY IF EXISTS "Users can delete milestones for their goals" ON public.savings_milestones;
          
          -- Restore original policies
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
    
    if (dropError) {
      console.error('Error rolling back savings milestones update:', dropError);
      throw dropError;
    }
    
    console.log('Savings milestones rollback completed successfully');
  }
};

// Register the migration
registerMigration(migration); 