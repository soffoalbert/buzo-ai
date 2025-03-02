import { useState, useCallback, useEffect } from 'react';
import { Budget } from '../models/Budget';
import { Expense } from '../models/Expense';
import { SavingsGoal } from '../models/SavingsGoal';
import { financialIntegrationService } from '../services/financialIntegrationService';
import { useAuth } from './useAuth';

interface FinancialOverview {
  totalBudgeted: number;
  totalSpent: number;
  totalSaved: number;
  budgetUtilization: {
    id: string;
    name: string;
    utilization: number;
    savingsContribution: number;
  }[];
  savingsProgress: {
    id: string;
    title: string;
    progress: number;
    nextSavingDate?: string;
  }[];
  recentTransactions: Expense[];
}

export const useFinancialIntegration = () => {
  const { user } = useAuth();
  const [overview, setOverview] = useState<FinancialOverview | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch financial overview
  const fetchOverview = useCallback(async () => {
    if (!user?.id) return;

    try {
      setLoading(true);
      setError(null);
      const data = await financialIntegrationService.getFinancialOverview(user.id);
      setOverview(data);
    } catch (err) {
      setError('Failed to fetch financial overview');
      console.error('Error fetching financial overview:', err);
    } finally {
      setLoading(false);
    }
  }, [user?.id]);

  // Handle expense creation with integrations
  const handleExpenseCreation = useCallback(async (expense: Expense) => {
    try {
      setLoading(true);
      setError(null);
      await financialIntegrationService.handleExpenseCreation({
        ...expense,
        user_id: user?.id
      });
      await fetchOverview(); // Refresh overview after expense creation
    } catch (err) {
      setError('Failed to create expense');
      console.error('Error creating expense:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchOverview]);

  // Handle budget update with integrations
  const handleBudgetUpdate = useCallback(async (budget: Budget) => {
    try {
      setLoading(true);
      setError(null);
      await financialIntegrationService.handleBudgetUpdate({
        ...budget,
        user_id: user?.id
      });
      await fetchOverview(); // Refresh overview after budget update
    } catch (err) {
      setError('Failed to update budget');
      console.error('Error updating budget:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchOverview]);

  // Handle savings goal update with integrations
  const handleSavingsGoalUpdate = useCallback(async (goal: SavingsGoal) => {
    try {
      setLoading(true);
      setError(null);
      await financialIntegrationService.handleSavingsGoalUpdate({
        ...goal,
        user_id: user?.id
      });
      await fetchOverview(); // Refresh overview after goal update
    } catch (err) {
      setError('Failed to update savings goal');
      console.error('Error updating savings goal:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, [user?.id, fetchOverview]);

  // Setup automatic refresh of overview
  useEffect(() => {
    fetchOverview();
    
    // Refresh every 5 minutes
    const interval = setInterval(fetchOverview, 5 * 60 * 1000);
    
    return () => clearInterval(interval);
  }, [fetchOverview]);

  return {
    overview,
    loading,
    error,
    handleExpenseCreation,
    handleBudgetUpdate,
    handleSavingsGoalUpdate,
    refreshOverview: fetchOverview
  };
}; 