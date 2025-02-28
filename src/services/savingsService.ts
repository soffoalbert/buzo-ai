import { SavingsGoal, SavingsMilestone, SAVINGS_CATEGORIES } from '../models/SavingsGoal';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';

// Storage keys
const SAVINGS_GOALS_STORAGE_KEY = 'buzo_savings_goals';
const SAVINGS_CATEGORIES_STORAGE_KEY = 'buzo_savings_categories';

/**
 * Save savings goals to local storage
 * @param goals Array of savings goals to save
 * @returns Promise resolving to the saved goals
 */
export const saveSavingsGoals = async (goals: SavingsGoal[]): Promise<SavingsGoal[]> => {
  try {
    await saveData(SAVINGS_GOALS_STORAGE_KEY, goals);
    return goals;
  } catch (error) {
    console.error('Error saving savings goals:', error);
    throw new Error('Failed to save savings goals');
  }
};

/**
 * Load savings goals from local storage
 * @returns Promise resolving to array of savings goals or empty array if none found
 */
export const loadSavingsGoals = async (): Promise<SavingsGoal[]> => {
  try {
    const goals = await loadData<SavingsGoal[]>(SAVINGS_GOALS_STORAGE_KEY);
    return goals || [];
  } catch (error) {
    console.error('Error loading savings goals:', error);
    return [];
  }
};

/**
 * Create a new savings goal
 * @param goalData Savings goal data without id, createdAt, updatedAt
 * @returns Promise resolving to the created savings goal
 */
export const createSavingsGoal = async (
  goalData: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SavingsGoal> => {
  const now = new Date().toISOString();
  
  const newGoal: SavingsGoal = {
    id: generateUUID(),
    createdAt: now,
    updatedAt: now,
    currentAmount: goalData.currentAmount || 0,
    isCompleted: false,
    ...goalData,
  };
  
  const currentGoals = await loadSavingsGoals();
  const updatedGoals = [...currentGoals, newGoal];
  
  await saveSavingsGoals(updatedGoals);
  return newGoal;
};

/**
 * Update an existing savings goal
 * @param id Savings goal ID to update
 * @param goalData Partial savings goal data to update
 * @returns Promise resolving to the updated savings goal
 */
export const updateSavingsGoal = async (
  id: string,
  goalData: Partial<Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<SavingsGoal> => {
  const currentGoals = await loadSavingsGoals();
  const goalIndex = currentGoals.findIndex(goal => goal.id === id);
  
  if (goalIndex === -1) {
    throw new Error(`Savings goal with ID ${id} not found`);
  }
  
  const updatedGoal: SavingsGoal = {
    ...currentGoals[goalIndex],
    ...goalData,
    updatedAt: new Date().toISOString(),
  };
  
  // Check if goal is completed
  if (updatedGoal.currentAmount >= updatedGoal.targetAmount && !updatedGoal.isCompleted) {
    updatedGoal.isCompleted = true;
  }
  
  currentGoals[goalIndex] = updatedGoal;
  await saveSavingsGoals(currentGoals);
  
  return updatedGoal;
};

/**
 * Delete a savings goal
 * @param id Savings goal ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteSavingsGoal = async (id: string): Promise<boolean> => {
  try {
    const currentGoals = await loadSavingsGoals();
    const updatedGoals = currentGoals.filter(goal => goal.id !== id);
    
    if (updatedGoals.length === currentGoals.length) {
      return false; // No goal was deleted
    }
    
    await saveSavingsGoals(updatedGoals);
    return true;
  } catch (error) {
    console.error('Error deleting savings goal:', error);
    return false;
  }
};

/**
 * Get a savings goal by ID
 * @param id Savings goal ID to retrieve
 * @returns Promise resolving to the savings goal or null if not found
 */
export const getSavingsGoalById = async (id: string): Promise<SavingsGoal | null> => {
  const goals = await loadSavingsGoals();
  const goal = goals.find(goal => goal.id === id);
  return goal || null;
};

/**
 * Add funds to a savings goal
 * @param id Savings goal ID
 * @param amount Amount to add
 * @returns Promise resolving to the updated savings goal
 */
export const addFundsToSavingsGoal = async (
  id: string,
  amount: number
): Promise<SavingsGoal> => {
  const goal = await getSavingsGoalById(id);
  
  if (!goal) {
    throw new Error(`Savings goal with ID ${id} not found`);
  }
  
  const newAmount = goal.currentAmount + amount;
  const isCompleted = newAmount >= goal.targetAmount;
  
  return updateSavingsGoal(id, {
    currentAmount: newAmount,
    isCompleted,
  });
};

/**
 * Withdraw funds from a savings goal
 * @param id Savings goal ID
 * @param amount Amount to withdraw
 * @returns Promise resolving to the updated savings goal
 */
export const withdrawFundsFromSavingsGoal = async (
  id: string,
  amount: number
): Promise<SavingsGoal> => {
  const goal = await getSavingsGoalById(id);
  
  if (!goal) {
    throw new Error(`Savings goal with ID ${id} not found`);
  }
  
  if (amount > goal.currentAmount) {
    throw new Error('Withdrawal amount exceeds available funds');
  }
  
  const newAmount = goal.currentAmount - amount;
  const isCompleted = newAmount >= goal.targetAmount;
  
  return updateSavingsGoal(id, {
    currentAmount: newAmount,
    isCompleted,
  });
};

/**
 * Add a milestone to a savings goal
 * @param goalId Savings goal ID
 * @param milestone Milestone data without id
 * @returns Promise resolving to the updated savings goal
 */
export const addMilestoneToSavingsGoal = async (
  goalId: string,
  milestone: Omit<SavingsMilestone, 'id' | 'isCompleted' | 'completedDate'>
): Promise<SavingsGoal> => {
  const goal = await getSavingsGoalById(goalId);
  
  if (!goal) {
    throw new Error(`Savings goal with ID ${goalId} not found`);
  }
  
  const newMilestone: SavingsMilestone = {
    id: generateUUID(),
    isCompleted: goal.currentAmount >= milestone.targetAmount,
    completedDate: goal.currentAmount >= milestone.targetAmount
      ? new Date().toISOString()
      : undefined,
    ...milestone,
  };
  
  const milestones = [...(goal.milestones || []), newMilestone];
  
  return updateSavingsGoal(goalId, { milestones });
};

/**
 * Update milestones completion status
 * @param goalId Savings goal ID
 * @returns Promise resolving to the updated savings goal
 */
export const updateMilestonesStatus = async (goalId: string): Promise<SavingsGoal> => {
  const goal = await getSavingsGoalById(goalId);
  
  if (!goal || !goal.milestones || goal.milestones.length === 0) {
    return goal!;
  }
  
  const updatedMilestones = goal.milestones.map(milestone => {
    if (!milestone.isCompleted && goal.currentAmount >= milestone.targetAmount) {
      return {
        ...milestone,
        isCompleted: true,
        completedDate: new Date().toISOString(),
      };
    }
    return milestone;
  });
  
  return updateSavingsGoal(goalId, { milestones: updatedMilestones });
};

/**
 * Share a savings goal with other users
 * @param goalId Savings goal ID
 * @param userIds Array of user IDs to share with
 * @returns Promise resolving to the updated savings goal
 */
export const shareSavingsGoal = async (
  goalId: string,
  userIds: string[]
): Promise<SavingsGoal> => {
  const goal = await getSavingsGoalById(goalId);
  
  if (!goal) {
    throw new Error(`Savings goal with ID ${goalId} not found`);
  }
  
  // Combine existing shared users with new ones, removing duplicates
  const sharedWith = Array.from(
    new Set([...(goal.sharedWith || []), ...userIds])
  );
  
  return updateSavingsGoal(goalId, {
    isShared: true,
    sharedWith,
  });
};

/**
 * Get savings goal statistics
 * @returns Promise resolving to savings statistics
 */
export const getSavingsStatistics = async () => {
  const goals = await loadSavingsGoals();
  
  const totalSaved = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  
  const completedGoals = goals.filter(goal => goal.isCompleted);
  const activeGoals = goals.filter(goal => !goal.isCompleted);
  
  const categoryBreakdown = goals.reduce((acc, goal) => {
    const category = goal.category;
    if (!acc[category]) {
      acc[category] = {
        saved: 0,
        target: 0,
      };
    }
    acc[category].saved += goal.currentAmount;
    acc[category].target += goal.targetAmount;
    return acc;
  }, {} as Record<string, { saved: number; target: number }>);
  
  return {
    totalSaved,
    totalTarget,
    savingsRate: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
    completedGoalsCount: completedGoals.length,
    activeGoalsCount: activeGoals.length,
    categoryBreakdown,
  };
};

/**
 * Load savings categories from local storage
 * @returns Promise resolving to array of savings categories
 */
export const loadSavingsCategories = async () => {
  try {
    const categories = await loadData<typeof SAVINGS_CATEGORIES>(SAVINGS_CATEGORIES_STORAGE_KEY);
    
    // If no categories are found, initialize with defaults
    if (!categories || categories.length === 0) {
      await saveData(SAVINGS_CATEGORIES_STORAGE_KEY, SAVINGS_CATEGORIES);
      return SAVINGS_CATEGORIES;
    }
    
    return categories;
  } catch (error) {
    console.error('Error loading savings categories:', error);
    return SAVINGS_CATEGORIES;
  }
}; 