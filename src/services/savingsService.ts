import { SavingsGoal, SavingsMilestone, SAVINGS_CATEGORIES } from '../models/SavingsGoal';
import { saveData, loadData, removeData } from './offlineStorage';
import { generateUUID } from '../utils/helpers';
import * as savingsApi from '../api/savingsApi';
import { checkSupabaseConnection } from '../api/supabaseClient';
import syncQueueService from './syncQueueService';
import { supabase } from '../api/supabaseClient';
import { v4 as uuidv4 } from 'uuid';

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
 * Update a savings goal with partial data
 * @param id The ID of the savings goal to update
 * @param goalData Partial savings goal data to update
 * @returns Promise resolving to the updated savings goal
 */
export const updateSavingsGoal = async (
  id: string,
  goalData: Partial<Omit<SavingsGoal, 'id'>>
): Promise<SavingsGoal> => {
  try {
    // Check if we're online
    const isOnline = await checkSupabaseConnection();

    // Get the current goal to update
    const currentGoal = await getSavingsGoal(id);
    if (!currentGoal) {
      throw new Error(`Savings goal with id ${id} not found`);
    }

    // Merge the current goal with the updates
    const updatedGoal: SavingsGoal = {
      ...currentGoal,
      ...goalData,
    };

    // Update the goal with the entire object
    return updateEntireSavingsGoal(updatedGoal);
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
 * @param goalId ID of the savings goal to retrieve
 * @returns Promise resolving to the savings goal or null if not found
 */
export const getSavingsGoalById = async (goalId: string): Promise<SavingsGoal | null> => {
  try {
    // Check if we're online and can connect to Supabase
    const isOnline = await checkSupabaseConnection();
    
    if (isOnline) {
      // If online, fetch from Supabase
      const goal = await savingsApi.fetchSavingsGoalById(goalId);
      return goal;
    } else {
      // If offline, fetch from local storage
      console.log('Offline mode: Loading savings goal from local storage');
      const goals = await loadSavingsGoalsLocally();
      return goals.find(goal => goal.id === goalId) || null;
    }
  } catch (error) {
    console.error('Error loading savings goal by ID:', error);
    
    // Fallback to local storage
    console.log('Falling back to local storage for savings goal');
    const goals = await loadSavingsGoalsLocally();
    return goals.find(goal => goal.id === goalId) || null;
  }
};

/**
 * Get a savings goal by ID (alias for getSavingsGoalById for consistency)
 * @param goalId ID of the savings goal to retrieve
 * @returns Promise resolving to the savings goal or null if not found
 */
export const getSavingsGoal = async (goalId: string): Promise<SavingsGoal | null> => {
  return getSavingsGoalById(goalId);
};

/**
 * Update a savings goal's current amount
 * @param goalId ID of the savings goal to update
 * @param newAmount New current amount
 * @returns Promise resolving to the updated savings goal
 */
export const updateSavingsGoalAmount = async (goalId: string, newAmount: number): Promise<SavingsGoal> => {
  try {
    // Check if we're online
    const isOnline = await checkSupabaseConnection();
    
    // Get the current goals
    const currentGoals = await loadSavingsGoalsLocally();
    const goalIndex = currentGoals.findIndex(goal => goal.id === goalId);
    
    if (goalIndex === -1) {
      throw new Error('Savings goal not found');
    }
    
    // Update the goal
    const updatedGoal = {
      ...currentGoals[goalIndex],
      currentAmount: newAmount,
      isCompleted: newAmount >= currentGoals[goalIndex].targetAmount,
      updatedAt: new Date().toISOString()
    };
    
    // Replace the goal in the array
    const updatedGoals = [...currentGoals];
    updatedGoals[goalIndex] = updatedGoal;
    
    // Save to local storage
    await saveSavingsGoals(updatedGoals);
    
    if (isOnline) {
      // If online, update in Supabase
      await savingsApi.updateSavingsGoal(updatedGoal);
    } else {
      // If offline, queue for sync
      await syncQueueService.addToQueue('update_savings_goal', updatedGoal);
    }
    
    return updatedGoal;
  } catch (error) {
    console.error('Error updating savings goal amount:', error);
    throw new Error('Failed to update savings goal amount');
  }
};

/**
 * Update a savings goal with the entire goal object
 * @param goal The complete savings goal object
 * @returns Promise resolving to the updated savings goal
 */
export const updateEntireSavingsGoal = async (goal: SavingsGoal): Promise<SavingsGoal> => {
  try {
    // Check if we're online
    const isOnline = await checkSupabaseConnection();
    
    // Get the current goals
    const currentGoals = await loadSavingsGoalsLocally();
    const goalIndex = currentGoals.findIndex(g => g.id === goal.id);
    
    if (goalIndex === -1) {
      throw new Error('Savings goal not found');
    }
    
    // Update the goal with the updated timestamp
    const updatedGoal = {
      ...goal,
      updatedAt: new Date().toISOString()
    };
    
    // Replace the goal in the array
    const updatedGoals = [...currentGoals];
    updatedGoals[goalIndex] = updatedGoal;
    
    // Save to local storage
    await saveSavingsGoals(updatedGoals);
    
    if (isOnline) {
      // If online, update in Supabase
      await savingsApi.updateSavingsGoal(updatedGoal);
    } else {
      // If offline, queue for sync
      await syncQueueService.addToQueue('update_savings_goal', updatedGoal);
    }
    
    return updatedGoal;
  } catch (error) {
    console.error('Error updating savings goal:', error);
    throw new Error('Failed to update savings goal');
  }
};

/**
 * Add a milestone to a savings goal
 * @param goalId ID of the savings goal
 * @param milestone Milestone to add
 * @returns Promise resolving to the updated savings goal
 */
export const addMilestoneToGoal = async (
  goalId: string,
  milestone: SavingsMilestone
): Promise<SavingsGoal> => {
  try {
    // Get the current goal
    const goal = await getSavingsGoal(goalId);
    if (!goal) {
      throw new Error(`Savings goal with id ${goalId} not found`);
    }

    // Create a new milestone with a unique ID
    const newMilestone: SavingsMilestone = {
      ...milestone,
      id: uuidv4(),
      isCompleted: milestone.currentAmount >= milestone.targetAmount,
    };

    // Add the milestone to the goal
    const milestones = [...(goal.milestones || []), newMilestone];

    // Update the goal with the new milestones
    return updateSavingsGoal(goalId, { milestones });
  } catch (error) {
    console.error('Error adding milestone to goal:', error);
    throw error;
  }
};

/**
 * Update a milestone in a savings goal
 * @param goalId ID of the savings goal
 * @param milestone Updated milestone data
 * @returns Promise resolving to the updated savings goal
 */
export const updateMilestone = async (goalId: string, milestone: SavingsMilestone): Promise<SavingsGoal> => {
  try {
    // Get the savings goal
    const goal = await getSavingsGoalById(goalId);
    
    if (!goal) {
      throw new Error('Savings goal not found');
    }
    
    // Check if goal has milestones
    if (!goal.milestones || goal.milestones.length === 0) {
      throw new Error('Savings goal has no milestones');
    }
    
    // Find the milestone index
    const milestoneIndex = goal.milestones.findIndex(m => m.id === milestone.id);
    
    if (milestoneIndex === -1) {
      throw new Error('Milestone not found');
    }
    
    // Update the milestone
    const updatedMilestones = [...goal.milestones];
    updatedMilestones[milestoneIndex] = milestone;
    
    // Sort milestones by target amount
    updatedMilestones.sort((a, b) => a.targetAmount - b.targetAmount);
    
    // Update the goal
    const updatedGoal = {
      ...goal,
      milestones: updatedMilestones,
      updatedAt: new Date().toISOString()
    };
    
    return updateEntireSavingsGoal(updatedGoal);
  } catch (error) {
    console.error('Error updating milestone:', error);
    throw new Error('Failed to update milestone');
  }
};

/**
 * Delete a milestone from a savings goal
 * @param goalId ID of the savings goal
 * @param milestoneId ID of the milestone to delete
 * @returns Promise resolving to the updated savings goal
 */
export const deleteMilestone = async (goalId: string, milestoneId: string): Promise<SavingsGoal> => {
  try {
    // Get the savings goal
    const goal = await getSavingsGoalById(goalId);
    
    if (!goal) {
      throw new Error('Savings goal not found');
    }
    
    // Check if goal has milestones
    if (!goal.milestones || goal.milestones.length === 0) {
      throw new Error('Savings goal has no milestones');
    }
    
    // Remove the milestone
    const updatedMilestones = goal.milestones.filter(m => m.id !== milestoneId);
    
    // Update the goal
    const updatedGoal = {
      ...goal,
      milestones: updatedMilestones,
      updatedAt: new Date().toISOString()
    };
    
    return updateEntireSavingsGoal(updatedGoal);
  } catch (error) {
    console.error('Error deleting milestone:', error);
    throw new Error('Failed to delete milestone');
  }
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

export const updateSavingsMilestone = async (
  goalId: string,
  milestoneId: string,
  milestoneData: Partial<SavingsMilestone>
): Promise<SavingsGoal> => {
  try {
    // Get the current goal
    const goal = await getSavingsGoal(goalId);
    if (!goal) {
      throw new Error(`Savings goal with id ${goalId} not found`);
    }

    // Find and update the milestone
    const milestones = goal.milestones?.map(milestone => {
      if (milestone.id === milestoneId) {
        // Check if milestone is completed
        const isCompleted = 
          milestoneData.currentAmount !== undefined && 
          (milestoneData.targetAmount || milestone.targetAmount) && 
          milestoneData.currentAmount >= (milestoneData.targetAmount || milestone.targetAmount);
        
        return {
          ...milestone,
          ...milestoneData,
          isCompleted: isCompleted !== undefined ? isCompleted : milestone.isCompleted
        };
      }
      return milestone;
    });
    
    return updateSavingsGoal(goalId, { milestones });
  } catch (error) {
    console.error('Error updating milestone:', error);
    throw error;
  }
};

export const deleteSavingsMilestone = async (
  goalId: string,
  milestoneId: string
): Promise<SavingsGoal> => {
  try {
    // Get the current goal
    const goal = await getSavingsGoal(goalId);
    if (!goal) {
      throw new Error(`Savings goal with id ${goalId} not found`);
    }

    // Filter out the milestone to delete
    const milestones = goal.milestones?.filter(
      milestone => milestone.id !== milestoneId
    );
    
    return updateSavingsGoal(goalId, { milestones });
  } catch (error) {
    console.error('Error deleting milestone:', error);
    throw error;
  }
};

export const contributeSavingsGoal = async (
  id: string,
  amount: number
): Promise<SavingsGoal> => {
  try {
    const goal = await getSavingsGoal(id);
    if (!goal) {
      throw new Error(`Savings goal with id ${id} not found`);
    }

    const newAmount = (goal.currentAmount || 0) + amount;
    const isCompleted = newAmount >= goal.targetAmount;
    
    return updateSavingsGoal(id, {
      currentAmount: newAmount,
      isCompleted,
      lastContributionDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error contributing to savings goal:', error);
    throw error;
  }
};

export const withdrawFromSavingsGoal = async (
  id: string,
  amount: number
): Promise<SavingsGoal> => {
  try {
    const goal = await getSavingsGoal(id);
    if (!goal) {
      throw new Error(`Savings goal with id ${id} not found`);
    }

    const currentAmount = goal.currentAmount || 0;
    if (amount > currentAmount) {
      throw new Error('Withdrawal amount exceeds available funds');
    }

    const newAmount = currentAmount - amount;
    const isCompleted = newAmount >= goal.targetAmount;
    
    return updateSavingsGoal(id, {
      currentAmount: newAmount,
      isCompleted,
      lastWithdrawalDate: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error withdrawing from savings goal:', error);
    throw error;
  }
}; 