import { SavingsGoal, SavingsMilestone, SAVINGS_CATEGORIES } from '../models/SavingsGoal';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';
import * as savingsApi from '../api/savingsApi';
import { checkSupabaseConnection } from '../api/supabaseClient';
import syncQueueService from './syncQueueService';
import { supabase } from '../api/supabaseClient';

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
export const loadSavingsGoalsLocally = async (): Promise<SavingsGoal[]> => {
  try {
    const goals = await loadData<SavingsGoal[]>(SAVINGS_GOALS_STORAGE_KEY);
    return goals || [];
  } catch (error) {
    console.error('Error loading savings goals:', error);
    return [];
  }
};

/**
 * Load savings goals from Supabase or local storage if offline
 * @returns Promise resolving to array of savings goals
 */
export const loadSavingsGoals = async (): Promise<SavingsGoal[]> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, fetch from Supabase
      const goals = await savingsApi.fetchSavingsGoals();
      
      // Save to local storage for offline access
      await saveSavingsGoals(goals);
      
      return goals;
    } else {
      // If offline, load from local storage
      console.log('Offline mode: Loading savings goals from local storage');
      return loadSavingsGoalsLocally();
    }
  } catch (error) {
    console.error('Error loading savings goals:', error);
    
    // Fallback to local storage if there's an error
    console.log('Falling back to local storage for savings goals');
    return loadSavingsGoalsLocally();
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
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, create in Supabase
      const newGoal = await savingsApi.createSavingsGoal(goalData);
      
      // Update local storage
      const currentGoals = await loadSavingsGoalsLocally();
      await saveSavingsGoals([...currentGoals, newGoal]);
      
      return newGoal;
    } else {
      // If offline, create locally and queue for sync
      console.log('Offline mode: Creating savings goal locally');
      
      // Get the current user from Supabase auth
      const { data: { user } } = await supabase.auth.getUser();
      const userId = user?.id;
      
      if (!userId) {
        throw new Error('User not authenticated. Cannot create savings goal.');
      }
      
      const now = new Date().toISOString();
      const newGoal: SavingsGoal = {
        id: `local_${generateUUID()}`, // Use a prefix to identify locally created goals
        createdAt: now,
        updatedAt: now,
        ...goalData,
        currentAmount: goalData.currentAmount || 0,
        isCompleted: false,
      };
      
      // Save locally
      const currentGoals = await loadSavingsGoalsLocally();
      await saveSavingsGoals([...currentGoals, newGoal]);
      
      // Queue for sync when back online
      await syncQueueService.addToSyncQueue({
        id: newGoal.id,
        type: 'CREATE_SAVINGS_GOAL',
        data: newGoal,
        timestamp: Date.now(),
      }, 5); // Higher priority for savings goals
      
      return newGoal;
    }
  } catch (error) {
    console.error('Error creating savings goal:', error);
    throw error;
  }
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
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, update in Supabase
      const updatedGoal = await savingsApi.updateSavingsGoal(id, goalData);
      
      // Update local storage
      const currentGoals = await loadSavingsGoalsLocally();
      const updatedGoals = currentGoals.map(goal => 
        goal.id === id ? updatedGoal : goal
      );
      await saveSavingsGoals(updatedGoals);
      
      return updatedGoal;
    } else {
      // If offline, update locally and queue for sync
      console.log('Offline mode: Updating savings goal locally');
      
      const currentGoals = await loadSavingsGoalsLocally();
      const goalIndex = currentGoals.findIndex(goal => goal.id === id);
      
      if (goalIndex === -1) {
        throw new Error(`Savings goal with ID ${id} not found`);
      }
      
      // Check if goal is completed
      let isCompleted = currentGoals[goalIndex].isCompleted;
      if (goalData.currentAmount !== undefined && 
          goalData.targetAmount !== undefined && 
          goalData.currentAmount >= goalData.targetAmount) {
        isCompleted = true;
      } else if (goalData.currentAmount !== undefined && 
                currentGoals[goalIndex].targetAmount && 
                goalData.currentAmount >= currentGoals[goalIndex].targetAmount) {
        isCompleted = true;
      }
      
      const updatedGoal: SavingsGoal = {
        ...currentGoals[goalIndex],
        ...goalData,
        isCompleted,
        updatedAt: new Date().toISOString(),
      };
      
      currentGoals[goalIndex] = updatedGoal;
      await saveSavingsGoals(currentGoals);
      
      // Queue for sync when back online
      await syncQueueService.addToSyncQueue({
        id: updatedGoal.id,
        type: 'UPDATE_SAVINGS_GOAL',
        data: updatedGoal,
        timestamp: Date.now(),
      }, 5); // Higher priority for savings goals
      
      return updatedGoal;
    }
  } catch (error) {
    console.error('Error updating savings goal:', error);
    throw error;
  }
};

/**
 * Delete a savings goal
 * @param id Savings goal ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteSavingsGoal = async (id: string): Promise<boolean> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, delete from Supabase
      await savingsApi.deleteSavingsGoal(id);
      
      // Update local storage
      const currentGoals = await loadSavingsGoalsLocally();
      const updatedGoals = currentGoals.filter(goal => goal.id !== id);
      await saveSavingsGoals(updatedGoals);
      
      return true;
    } else {
      // If offline, mark for deletion and queue for sync
      console.log('Offline mode: Marking savings goal for deletion');
      
      const currentGoals = await loadSavingsGoalsLocally();
      const updatedGoals = currentGoals.filter(goal => goal.id !== id);
      
      if (updatedGoals.length === currentGoals.length) {
        return false; // No goal was deleted
      }
      
      await saveSavingsGoals(updatedGoals);
      
      // Queue for sync when back online
      await syncQueueService.addToSyncQueue({
        id,
        type: 'DELETE_SAVINGS_GOAL',
        data: { id },
        timestamp: Date.now(),
      }, 5); // Higher priority for savings goals
      
      return true;
    }
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
  
  return updateSavingsGoal(goalId, {
    isShared: true,
    sharedWith: userIds,
  });
};

/**
 * Get savings statistics
 * @returns Object with savings statistics
 */
export const getSavingsStatistics = async () => {
  const goals = await loadSavingsGoals();
  
  const totalSaved = goals.reduce((sum, goal) => sum + goal.currentAmount, 0);
  const totalTarget = goals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  const completedGoals = goals.filter(goal => goal.isCompleted).length;
  const inProgressGoals = goals.length - completedGoals;
  
  // Calculate average savings rate (amount saved per day)
  let avgSavingsRate = 0;
  if (goals.length > 0) {
    const oldestGoalDate = new Date(Math.min(...goals.map(g => new Date(g.createdAt).getTime())));
    const daysSinceOldest = Math.max(1, Math.ceil((Date.now() - oldestGoalDate.getTime()) / (1000 * 60 * 60 * 24)));
    avgSavingsRate = totalSaved / daysSinceOldest;
  }
  
  return {
    totalSaved,
    totalTarget,
    savingsProgress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
    completedGoals,
    inProgressGoals,
    totalGoals: goals.length,
    avgSavingsRate,
  };
};

/**
 * Load savings categories
 * @returns Array of savings categories
 */
export const loadSavingsCategories = async () => {
  try {
    // Try to load from local storage first
    const categories = await loadData(SAVINGS_CATEGORIES_STORAGE_KEY);
    
    if (categories && categories.length > 0) {
      return categories;
    }
    
    // If not found in local storage, use default categories
    await saveData(SAVINGS_CATEGORIES_STORAGE_KEY, SAVINGS_CATEGORIES);
    return SAVINGS_CATEGORIES;
  } catch (error) {
    console.error('Error loading savings categories:', error);
    return SAVINGS_CATEGORIES;
  }
}; 