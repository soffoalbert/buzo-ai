import { v4 as uuidv4 } from 'uuid';
import { Migration, registerMigration } from './index';
import { supabase } from '../supabaseClient';

const migration: Migration = {
  id: uuidv4(),
  name: 'initial_schema',
  description: 'Create initial database schema with profiles and bank_statements tables',
  version: 1,
  
  up: async () => {
    console.log('Running migration: initial_schema');
    
    // Create profiles table
    const { error: profilesError } = await supabase.rpc('execute_sql', {
      sql_query: `
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
        
        -- Enable RLS
        ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
          DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
          DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
          DROP POLICY IF EXISTS "Service role can manage all profiles" ON public.profiles;
          
          -- Create new policies
          CREATE POLICY "Users can view their own profile" ON public.profiles
            FOR SELECT USING (auth.uid() = id);
          
          CREATE POLICY "Users can update their own profile" ON public.profiles
            FOR UPDATE USING (auth.uid() = id);
          
          CREATE POLICY "Users can insert their own profile" ON public.profiles
            FOR INSERT WITH CHECK (auth.uid() = id);
          
          CREATE POLICY "Service role can manage all profiles" ON public.profiles
            USING (auth.role() = 'service_role');
        END $$;
      `
    });
    
    if (profilesError) {
      console.error('Error creating profiles table:', profilesError);
      throw profilesError;
    }
    
    // Create bank_statements table
    const { error: bankStatementsError } = await supabase.rpc('execute_sql', {
      sql_query: `
        CREATE TABLE IF NOT EXISTS public.bank_statements (
          id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
          user_id UUID REFERENCES auth.users(id) NOT NULL,
          file_name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          upload_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
          status TEXT NOT NULL,
          insights JSONB
        );
        
        -- Enable RLS
        ALTER TABLE public.bank_statements ENABLE ROW LEVEL SECURITY;
        
        -- Create policies
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can view their own bank statements" ON public.bank_statements;
          DROP POLICY IF EXISTS "Users can insert their own bank statements" ON public.bank_statements;
          DROP POLICY IF EXISTS "Users can update their own bank statements" ON public.bank_statements;
          DROP POLICY IF EXISTS "Users can delete their own bank statements" ON public.bank_statements;
          
          -- Create new policies
          CREATE POLICY "Users can view their own bank statements" ON public.bank_statements
            FOR SELECT USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can insert their own bank statements" ON public.bank_statements
            FOR INSERT WITH CHECK (auth.uid() = user_id);
          
          CREATE POLICY "Users can update their own bank statements" ON public.bank_statements
            FOR UPDATE USING (auth.uid() = user_id);
          
          CREATE POLICY "Users can delete their own bank statements" ON public.bank_statements
            FOR DELETE USING (auth.uid() = user_id);
        END $$;
      `
    });
    
    if (bankStatementsError) {
      console.error('Error creating bank_statements table:', bankStatementsError);
      throw bankStatementsError;
    }
    
    // Create storage bucket if it doesn't exist
    const { error: storageError } = await supabase.rpc('execute_sql', {
      sql_query: `
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
        DO $$
        BEGIN
          -- Drop existing policies if they exist
          DROP POLICY IF EXISTS "Users can upload their own documents" ON storage.objects;
          DROP POLICY IF EXISTS "Users can view their own documents" ON storage.objects;
          DROP POLICY IF EXISTS "Users can delete their own documents" ON storage.objects;
          
          -- Create new policies
          CREATE POLICY "Users can upload their own documents" ON storage.objects
            FOR INSERT WITH CHECK (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
          
          CREATE POLICY "Users can view their own documents" ON storage.objects
            FOR SELECT USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
          
          CREATE POLICY "Users can delete their own documents" ON storage.objects
            FOR DELETE USING (bucket_id = 'user-documents' AND auth.uid()::text = (storage.foldername(name))[1]);
        END $$;
      `
    });
    
    if (storageError) {
      console.error('Error setting up storage:', storageError);
      throw storageError;
    }
    
    console.log('Initial schema migration completed successfully');
  },
  
  down: async () => {
    console.log('Rolling back migration: initial_schema');
    
    // Drop tables in reverse order
    const { error: dropError } = await supabase.rpc('execute_sql', {
      sql_query: `
        -- Drop bank_statements table
        DROP TABLE IF EXISTS public.bank_statements;
        
        -- Drop profiles table
        DROP TABLE IF EXISTS public.profiles;
      `
    });
    
    if (dropError) {
      console.error('Error rolling back initial schema:', dropError);
      throw dropError;
    }
    
    console.log('Initial schema rollback completed successfully');
  }
};

// Register the migration
registerMigration(migration); 