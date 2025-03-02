-- Drop existing policies first
DROP POLICY IF EXISTS "Users can view their own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can update their own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can delete their own budgets" ON budgets;
DROP POLICY IF EXISTS "Users can insert their own budgets" ON budgets;

-- Create RLS policies
CREATE POLICY "Users can view their own budgets" ON budgets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets" ON budgets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own budgets" ON budgets
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own budgets" ON budgets
  FOR INSERT WITH CHECK (auth.uid() = user_id);


-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Update budgets table
ALTER TABLE budgets
ADD COLUMN IF NOT EXISTS savings_allocation DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS auto_save_percentage INTEGER CHECK (auto_save_percentage >= 0 AND auto_save_percentage <= 100),
ADD COLUMN IF NOT EXISTS remaining_amount DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS linked_expenses UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS linked_savings_goals UUID[] DEFAULT '{}';

-- Update expenses table
ALTER TABLE expenses
ADD COLUMN IF NOT EXISTS budget_id UUID REFERENCES budgets(id),
ADD COLUMN IF NOT EXISTS impacts_savings_goal BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS linked_savings_goals UUID[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS savings_contribution DECIMAL(10,2),
ADD COLUMN IF NOT EXISTS is_automated_saving BOOLEAN DEFAULT false;

-- Update savings_goals table
ALTER TABLE savings_goals
ADD COLUMN IF NOT EXISTS saving_frequency TEXT CHECK (saving_frequency IN ('daily', 'weekly', 'monthly')),
ADD COLUMN IF NOT EXISTS next_saving_date TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS saving_history JSONB DEFAULT '[]',
ADD COLUMN IF NOT EXISTS linked_budgets JSONB DEFAULT '[]';

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_budget_linked_savings_goals ON budgets USING GIN (linked_savings_goals);
CREATE INDEX IF NOT EXISTS idx_expense_budget_id ON expenses (budget_id);
CREATE INDEX IF NOT EXISTS idx_expense_linked_savings_goals ON expenses USING GIN (linked_savings_goals);
CREATE INDEX IF NOT EXISTS idx_savings_goal_next_saving_date ON savings_goals (next_saving_date);

-- Create function to update budget remaining amount
CREATE OR REPLACE FUNCTION update_budget_remaining_amount()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE budgets
  SET remaining_amount = amount - COALESCE(spent, 0) - COALESCE(savings_allocation, 0)
  WHERE id = NEW.id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for budget updates
DROP TRIGGER IF EXISTS update_budget_remaining ON budgets;
CREATE TRIGGER update_budget_remaining
AFTER UPDATE OF amount, spent, savings_allocation
ON budgets
FOR EACH ROW
EXECUTE FUNCTION update_budget_remaining_amount();

-- Create function to handle automated savings
CREATE OR REPLACE FUNCTION process_automated_savings()
RETURNS TRIGGER AS $$
BEGIN
  -- If auto_save_percentage is set and we're updating the amount
  IF NEW.auto_save_percentage IS NOT NULL AND 
     (TG_OP = 'INSERT' OR OLD.amount != NEW.amount) THEN
    -- Calculate and update savings allocation
    NEW.savings_allocation = (NEW.amount * NEW.auto_save_percentage / 100)::DECIMAL(10,2);
    
    -- Create automated savings expense if there are linked savings goals
    IF array_length(NEW.linked_savings_goals, 1) > 0 THEN
      INSERT INTO expenses (
        title,
        amount,
        category,
        date,
        budget_id,
        impacts_savings_goal,
        linked_savings_goals,
        savings_contribution,
        is_automated_saving,
        user_id
      ) VALUES (
        'Automated Savings from ' || NEW.name,
        NEW.savings_allocation,
        'Savings',
        CURRENT_TIMESTAMP,
        NEW.id,
        true,
        NEW.linked_savings_goals,
        NEW.savings_allocation,
        true,
        NEW.user_id
      );
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automated savings
DROP TRIGGER IF EXISTS handle_automated_savings ON budgets;
CREATE TRIGGER handle_automated_savings
BEFORE INSERT OR UPDATE OF amount, auto_save_percentage
ON budgets
FOR EACH ROW
EXECUTE FUNCTION process_automated_savings();

-- Create function to update savings goal progress
CREATE OR REPLACE FUNCTION update_savings_goal_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- If this is a savings contribution
  IF NEW.impacts_savings_goal AND NEW.savings_contribution > 0 THEN
    -- Update each linked savings goal
    UPDATE savings_goals
    SET 
      current_amount = current_amount + NEW.savings_contribution,
      saving_history = saving_history || jsonb_build_object(
        'date', CURRENT_TIMESTAMP,
        'amount', NEW.savings_contribution,
        'source', CASE WHEN NEW.is_automated_saving THEN 'automated' ELSE 'manual' END,
        'expenseId', NEW.id,
        'budgetId', NEW.budget_id
      )
    WHERE id = ANY(NEW.linked_savings_goals);
    
    -- Check and update completion status
    UPDATE savings_goals
    SET is_completed = true
    WHERE id = ANY(NEW.linked_savings_goals)
    AND current_amount >= target_amount;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for savings goal updates
DROP TRIGGER IF EXISTS handle_savings_progress ON expenses;
CREATE TRIGGER handle_savings_progress
AFTER INSERT
ON expenses
FOR EACH ROW
EXECUTE FUNCTION update_savings_goal_progress();

-- Add RLS policies
ALTER TABLE budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE savings_goals ENABLE ROW LEVEL SECURITY;

-- Budget policies
CREATE POLICY "Users can view their own budgets"
ON budgets FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own budgets"
ON budgets FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own budgets"
ON budgets FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Expense policies
CREATE POLICY "Users can view their own expenses"
ON expenses FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own expenses"
ON expenses FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own expenses"
ON expenses FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Savings goal policies
CREATE POLICY "Users can view their own savings goals"
ON savings_goals FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own savings goals"
ON savings_goals FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own savings goals"
ON savings_goals FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id); 