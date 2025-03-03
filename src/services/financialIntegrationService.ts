import { Budget } from '../models/Budget';
import { Expense, PaymentMethod } from '../models/Expense';
import { SavingsGoal, SavingsMilestone } from '../models/SavingsGoal';
import { budgetService } from './budgetService';
import { expenseService } from './expenseService';
import { savingsService } from './savingsService';
import { notificationService } from './notifications';
import * as aiAdvisor from './aiAdvisor';
import { supabase } from '../api/supabaseClient';

class FinancialIntegrationService {
  // Handle expense creation with budget and savings impact
  async handleExpenseCreation(expense: Expense): Promise<void> {
    try {
      // 1. Create the expense
      const createdExpense = await expenseService.createExpense(expense);

      // 2. Update associated budget
      if (expense.budgetId) {
        const budget = await budgetService.getBudget(expense.budgetId);
        if (budget) {
          budget.spent += expense.amount;
          budget.remainingAmount = budget.amount - budget.spent - (budget.savingsAllocation || 0);
          budget.linkedExpenses = [...(budget.linkedExpenses || []), createdExpense.id];
          await budgetService.updateBudget(budget);

          // Check if budget threshold reached
          if (budget.remainingAmount < budget.amount * 0.2) {
            await notificationService.sendBudgetAlert({
              budgetId: budget.id,
              type: 'threshold',
              remainingPercentage: (budget.remainingAmount / budget.amount) * 100
            });
          }
        }
      }

      // 3. Handle savings impact
      if (expense.impactsSavingsGoal && expense.linkedSavingsGoals) {
        for (const goalId of expense.linkedSavingsGoals) {
          const goal = await savingsService.getSavingsGoal(goalId);
          if (goal) {
            if (expense.savingsContribution) {
              // This is a positive contribution to savings
              goal.currentAmount += expense.savingsContribution;
              goal.savingHistory?.push({
                date: new Date().toISOString(),
                amount: expense.savingsContribution,
                source: expense.isAutomatedSaving ? 'automated' : 'manual',
                expenseId: createdExpense.id
              });

              // Check if any milestones are completed
              this.checkAndUpdateMilestones(goal);
            }
            await savingsService.updateSavingsGoal(goal);
          }
        }
      }

      // 4. Get AI insights
      await this.generateFinancialInsights(createdExpense.id);
    } catch (error) {
      console.error('Error in handleExpenseCreation:', error);
      throw error;
    }
  }

  // Handle budget updates with savings automation
  async handleBudgetUpdate(budget: Budget): Promise<void> {
    try {
      // 1. Calculate savings allocation if auto-save is enabled
      if (budget.autoSavePercentage && budget.autoSavePercentage > 0) {
        const savingsAmount = (budget.amount * budget.autoSavePercentage) / 100;
        budget.savingsAllocation = savingsAmount;
        budget.remainingAmount = budget.amount - budget.spent - savingsAmount;

        // 2. Create automated savings expense
        if (budget.linkedSavingsGoals && budget.linkedSavingsGoals.length > 0) {
          const savingsExpense: Expense = {
            id: '', // Will be set by the service
            title: `Automated Savings from ${budget.name}`,
            amount: savingsAmount,
            date: new Date().toISOString(),
            category: 'Savings',
            paymentMethod: PaymentMethod.AUTOMATED_SAVING,
            budgetId: budget.id,
            impactsSavingsGoal: true,
            linkedSavingsGoals: budget.linkedSavingsGoals,
            savingsContribution: savingsAmount,
            isAutomatedSaving: true,
            user_id: budget.user_id,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          };

          await this.handleExpenseCreation(savingsExpense);
        }
      }

      // 3. Update the budget
      await budgetService.updateBudget(budget);
    } catch (error) {
      console.error('Error in handleBudgetUpdate:', error);
      throw error;
    }
  }

  // Handle savings goal updates
  async handleSavingsGoalUpdate(goal: SavingsGoal): Promise<void> {
    try {
      // 1. Update automated savings schedules
      if (goal.savingFrequency && goal.linkedBudgets) {
        for (const linkedBudget of goal.linkedBudgets) {
          const budget = await budgetService.getBudget(linkedBudget.budgetId);
          if (budget && linkedBudget.autoSave) {
            budget.autoSavePercentage = linkedBudget.allocationPercentage;
            budget.linkedSavingsGoals = [...(budget.linkedSavingsGoals || []), goal.id];
            await this.handleBudgetUpdate(budget);
          }
        }
      }

      // 2. Check progress and milestones
      this.checkAndUpdateMilestones(goal);

      // 3. Update the goal
      await savingsService.updateSavingsGoal(goal);

      // 4. Send progress notification if significant progress made
      if (goal.currentAmount / goal.targetAmount >= 0.25) { // 25%, 50%, 75%, 100%
        await notificationService.sendSavingsProgressAlert({
          goalId: goal.id,
          progress: (goal.currentAmount / goal.targetAmount) * 100
        });
      }
    } catch (error) {
      console.error('Error in handleSavingsGoalUpdate:', error);
      throw error;
    }
  }

  // Helper function to check and update milestones
  private async checkAndUpdateMilestones(goal: SavingsGoal): Promise<void> {
    if (goal.milestones) {
      for (const milestone of goal.milestones) {
        if (!milestone.isCompleted && goal.currentAmount >= milestone.targetAmount) {
          milestone.isCompleted = true;
          milestone.completedDate = new Date().toISOString();
          
          await notificationService.sendMilestoneAlert({
            goalId: goal.id,
            milestoneId: milestone.id,
            title: milestone.title
          });
        }
      }
    }
  }

  // Generate AI insights based on financial activity
  private async generateFinancialInsights(expenseId: string): Promise<void> {
    try {
      // Get the expense and related data
      const expense = await expenseService.getExpense(expenseId);
      if (!expense) return;

      const [expenses, budgets, savingsGoals] = await Promise.all([
        expenseService.getUserExpenses(expense.user_id || ''),
        budgetService.getUserBudgets(expense.user_id || ''),
        savingsService.getUserSavingsGoals(expense.user_id || '')
      ]);

      const insights = await aiAdvisor.generateFinancialInsights({
        expenses: expenses.map(e => ({
          category: e.category,
          amount: e.amount,
          date: e.date,
          title: e.title
        })),
        budgets: budgets.map(b => ({
          category: b.name || 'Uncategorized',
          limit: b.amount || 0,
          spent: b.spent || 0
        })),
        savingsGoals: savingsGoals.map(g => ({
          title: g.title || 'Untitled Goal',
          target: g.targetAmount || 0,
          current: g.currentAmount || 0,
          deadline: g.targetDate || new Date().toISOString()
        }))
      });

      if (insights && insights.length > 0) {
        await notificationService.sendFinancialInsight({
          type: 'ai_insight',
          message: insights[0].description
        });
      }
    } catch (error) {
      console.error('Error generating financial insights:', error);
      // Don't throw error as this is a non-critical feature
    }
  }

  // Get integrated financial overview
  async getFinancialOverview(userId: string) {
    try {
      console.log('Getting financial overview for user:', userId);
      
      const [expenses, budgets, savingsGoals] = await Promise.all([
        expenseService.getUserExpenses(userId).catch(err => {
          console.error('Error fetching expenses:', err);
          return [];
        }),
        budgetService.getUserBudgets(userId).catch(err => {
          console.error('Error fetching budgets:', err);
          return [];
        }),
        savingsService.getUserSavingsGoals(userId).catch(err => {
          console.error('Error fetching savings goals:', err);
          return [];
        })
      ]);

      console.log('Raw data counts:', {
        expenses: expenses.length,
        budgets: budgets.length,
        savingsGoals: savingsGoals.length
      });
      
      // Log expense dates and formatting for debugging
      console.log('EXPENSE DATE DIAGNOSTICS:', expenses.map(exp => ({
        id: exp.id,
        amount: exp.amount,
        description: exp.description || exp.category || 'Unknown',
        rawDate: exp.date,
        parsedDate: new Date(exp.date).toISOString(),
        dateComponents: {
          year: new Date(exp.date).getFullYear(),
          month: new Date(exp.date).getMonth() + 1,
          day: new Date(exp.date).getDate()
        }
      })));

      // Ensure we have arrays even if the promises failed
      const safeExpenses = Array.isArray(expenses) ? expenses : [];
      const safeBudgets = Array.isArray(budgets) ? budgets : [];
      const safeSavingsGoals = Array.isArray(savingsGoals) ? savingsGoals : [];

      const totalBudgeted = safeBudgets.reduce((sum, b) => sum + (b?.amount || 0), 0);
      const totalSpent = safeExpenses.reduce((sum, e) => sum + (e?.amount || 0), 0);
      
      // Log raw details for debugging
      console.log('Savings goals for total calculation:', safeSavingsGoals.map(g => ({
        id: g.id,
        title: g.title,
        currentAmount: g.currentAmount,
        targetAmount: g.targetAmount,
        isCompleted: g.isCompleted
      })));
      
      // Ensure all savings goals have valid numerical values
      const validatedGoals = safeSavingsGoals.map(goal => ({
        ...goal,
        currentAmount: typeof goal.currentAmount === 'number' && !isNaN(goal.currentAmount) ? goal.currentAmount : 0,
        targetAmount: typeof goal.targetAmount === 'number' && !isNaN(goal.targetAmount) ? goal.targetAmount : 0,
        isCompleted: !!goal.isCompleted
      }));
      
      // Calculate total saved amount - include all goals (both active and completed)
      const totalSaved = validatedGoals.reduce((sum, goal) => {
        console.log(`Adding ${goal.title || 'Unnamed goal'} with amount: ${goal.currentAmount}`);
        return sum + goal.currentAmount;
      }, 0);

      console.log('Calculated totals:', { totalBudgeted, totalSpent, totalSaved });

      const budgetUtilization = safeBudgets.map(b => {
        // Calculate actual spent amount for this budget
        const budgetSpent = safeExpenses
          .filter(e => {
            // Match expenses to budget by budget ID or category
            const budgetIdMatch = e.budgetId && e.budgetId === b.id;
            const categoryIdMatch = e.category && e.category === b.category;
            const categoryNameMatch = e.categoryName && b.name && 
              e.categoryName.toLowerCase() === b.name.toLowerCase();
            
            const isMatch = budgetIdMatch || categoryIdMatch || categoryNameMatch;
            
            if (isMatch) {
              console.log(`✅ Expense matched to budget "${b.name}":`, {
                expense_id: e.id,
                expense_category: e.category,
                expense_categoryName: e.categoryName,
                expense_budgetId: e.budgetId,
                budget_id: b.id,
                budget_category: b.category,
                budget_name: b.name,
                match_type: budgetIdMatch ? 'budgetId' : (categoryIdMatch ? 'categoryId' : 'categoryName')
              });
            }
            
            return isMatch;
          })
          .reduce((sum, e) => sum + e.amount, 0);
        
        // Use the calculated spent amount or fall back to the budget's spent field
        const actualSpent = budgetSpent > 0 ? budgetSpent : (b?.spent || 0);
        
        console.log(`Budget "${b.name}" (${b.id}): Amount=${b.amount}, Spent=${actualSpent}, Calculated=${budgetSpent}, Original=${b.spent || 0}`);
        
        return {
          id: b?.id || '',
          name: b?.name || 'Unnamed Budget',
          amount: b?.amount || 0,
          spent: actualSpent,
          utilization: b?.amount ? (actualSpent / b.amount) * 100 : 0,
          savingsContribution: b?.savingsAllocation || 0
        };
      });

      // Log expenses that didn't match any budget for debugging
      safeExpenses.forEach(e => {
        const matchingBudget = safeBudgets.find(b => 
          (e.budgetId && e.budgetId === b.id) || 
          (e.category && e.category === b.category) ||
          (e.categoryName && b.name && e.categoryName.toLowerCase() === b.name.toLowerCase())
        );
        
        if (!matchingBudget) {
          console.log(`⚠️ Expense not matched to any budget:`, {
            expense_id: e.id,
            expense_title: e.title,
            expense_amount: e.amount,
            expense_category: e.category,
            expense_categoryName: e.categoryName,
            expense_budgetId: e.budgetId
          });
        }
      });

      const savingsProgress = validatedGoals.map(g => ({
        id: g?.id || '',
        title: g?.title || 'Unnamed Goal',
        progress: g?.targetAmount ? ((g?.currentAmount || 0) / g.targetAmount) * 100 : 0,
        nextSavingDate: g?.nextSavingDate || undefined,
        targetAmount: g?.targetAmount || 0,
        currentAmount: g?.currentAmount || 0
      }));

      console.log('Transformed arrays:', {
        budgetUtilization: budgetUtilization.length,
        savingsProgress: savingsProgress.length,
        recentTransactions: safeExpenses.slice(0, 5).length
      });

      return {
        totalBudgeted,
        totalSpent,
        totalSaved,
        budgetUtilization,
        savingsProgress,
        recentTransactions: safeExpenses.slice(0, 5)
      };
    } catch (error) {
      console.error('Error in getFinancialOverview:', error);
      // Return default structure with empty values
      return {
        totalBudgeted: 0,
        totalSpent: 0,
        totalSaved: 0,
        budgetUtilization: [],
        savingsProgress: [],
        recentTransactions: []
      };
    }
  }
}

export const financialIntegrationService = new FinancialIntegrationService(); 