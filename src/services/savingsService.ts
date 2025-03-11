import { SavingsGoal, SavingsMilestone, SAVINGS_CATEGORIES } from '../models/SavingsGoal';
import { 
  saveData, 
  loadData, 
  removeData, 
  isOnline,
  saveSavingsGoals as saveGoalsToStorage,
  loadSavingsGoals as loadGoalsFromStorage
} from './offlineStorage';
import { generateUUID } from '../utils/helpers';
import * as savingsApi from '../api/savingsApi';
import { checkSupabaseConnection } from '../api/supabaseClient';
import { supabase } from '../api/supabaseClient';
import { addToSyncQueue } from './syncQueueService';
import { v4 as uuidv4 } from 'uuid';
import { getUserId } from './fixed/getUserId';

// Storage keys
const SAVINGS_GOALS_STORAGE_KEY = 'buzo_savings_goals';
const SAVINGS_CATEGORIES_STORAGE_KEY = 'buzo_savings_categories';

// Add these functions for backward compatibility
export const saveSavingsGoalsLocally = async (goals: SavingsGoal[]): Promise<void> => {
  await saveGoalsToStorage(goals);
};

export const loadSavingsGoalsLocally = async (): Promise<SavingsGoal[]> => {
  try {
    const goals = await loadData<SavingsGoal[]>(SAVINGS_GOALS_STORAGE_KEY);
    return goals || [];
  } catch (error) {
    console.error('Error loading savings goals from local storage:', error);
    return [];
  }
};

class SavingsService {
  private readonly tableName = 'savings_goals';
  private readonly contributionsTable = 'savings_contributions';
  private readonly milestonesTable = 'savings_milestones';

  async createSavingsGoal(goal: SavingsGoal): Promise<SavingsGoal> {
    // Get user ID with offline support
    const userId = await getUserId();
    
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const { data, error } = await supabase
      .from(this.tableName)
      .insert([{
        ...goal,
        user_id: userId,
        current_amount: 0,
        is_completed: false,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }])
      .select(`
        *,
        milestones:${this.milestonesTable}(*),
        contributions:${this.contributionsTable}(*)
      `)
      .single();

    if (error) throw error;
    return this.mapToSavingsGoal(data);
  }

  async getSavingsGoal(id: string): Promise<SavingsGoal | null> {
    try {
      // Check if we're online
      const online = await isOnline();
      
      if (online) {
        // Try to get from Supabase when online
        try {
          const { data, error } = await supabase
            .from(this.tableName)
            .select(`
              *,
              milestones:${this.milestonesTable}(*),
              contributions:${this.contributionsTable}(*)
            `)
            .eq('id', id)
            .single();

          if (error) {
            console.error('Error fetching savings goal from Supabase:', error);
            throw error;
          }
          
          return data ? this.mapToSavingsGoal(data) : null;
        } catch (error) {
          console.error('Error in online getSavingsGoal:', error);
          // Fall back to local storage if Supabase fails
        }
      }
      
      // If offline or Supabase failed, get from local storage
      console.log('Offline mode: Loading savings goal from local storage');
      const localGoals = await loadGoalsFromStorage();
      return localGoals.find(goal => goal.id === id) || null;
    } catch (error) {
      console.error('Error in getSavingsGoal:', error);
      
      // As a last resort, try to load from local storage
      try {
        const localGoals = await loadGoalsFromStorage();
        return localGoals.find(goal => goal.id === id) || null;
      } catch (storageError) {
        console.error('Error loading goal from storage:', storageError);
        return null;
      }
    }
  }

  async getUserSavingsGoals(userId: string): Promise<SavingsGoal[]> {
    console.log(`Getting savings goals for user: ${userId}`);
    
    try {
      // Check if we're online
      const online = await isOnline();
      
      if (online) {
        // Try to get goals from Supabase
        try {
          const { data, error } = await supabase
            .from(this.tableName)
            .select(`
              *,
              milestones:savings_milestones(*)
            `)
            .eq('user_id', userId)
            .order('created_at', { ascending: false });
          
          if (error) {
            console.error('Error fetching savings goals:', error);
            // Fall back to local storage if there's an error 
            const localGoals = await loadGoalsFromStorage();
            return localGoals.filter(goal => goal.user_id === userId);
          }
          
          console.log(`Found ${data?.length || 0} savings goals in database`);
          
          if (data && data.length > 0) {
            console.log('First goal raw data sample:', JSON.stringify(data[0]).substring(0, 200) + '...');
          }
          
          // Transform the data to match our model
          const savingsGoals: SavingsGoal[] = (data || []).map(goal => {
            // Parse milestones if any
            const milestones = goal.milestones?.map((milestone: any) => ({
              id: milestone.id,
              title: milestone.title,
              targetAmount: this.parseSafeNumber(milestone.amount, 0),
              isCompleted: milestone.is_completed,
              completedDate: milestone.completed_date,
              contributingBudgets: milestone.contributing_budgets,
            })) || [];
            
            const mappedGoal = this.mapToSavingsGoal(goal);
            
            // Add milestones to the goal
            mappedGoal.milestones = milestones;
            
            console.log(`Mapped goal: ${mappedGoal.title}, currentAmount: ${mappedGoal.currentAmount}, DB current_amount: ${goal.current_amount}`);
            
            return mappedGoal;
          });
          
          // Save to local storage for offline access
          await saveGoalsToStorage(savingsGoals);
          
          return savingsGoals;
        } catch (error) {
          console.error('Error fetching savings goals from Supabase:', error);
          // Fall back to local storage if there's an error
          const localGoals = await loadGoalsFromStorage();
          return localGoals.filter(goal => goal.user_id === userId);
        }
      } else {
        // If offline, load from local storage
        console.log('Offline mode: Loading savings goals from local storage');
        const localGoals = await loadGoalsFromStorage();
        return localGoals.filter(goal => goal.user_id === userId);
      }
    } catch (error) {
      console.error('Error in getUserSavingsGoals:', error);
      
      // As a last resort, try to get from local storage
      try {
        const localGoals = await loadGoalsFromStorage();
        return localGoals.filter(goal => goal.user_id === userId);
      } catch (storageError) {
        console.error('Error loading goals from storage:', storageError);
        return [];
      }
    }
  }

  // Helper to safely parse a number
  private parseSafeNumber(value: any, defaultValue: number = 0): number {
    if (value === null || value === undefined) return defaultValue;
    
    const parsed = parseFloat(value);
    return isNaN(parsed) ? defaultValue : parsed;
  }

  async updateSavingsGoal(goal: SavingsGoal): Promise<SavingsGoal> {
    const { data, error } = await supabase
      .from(this.tableName)
      .update({
        ...goal,
        updated_at: new Date().toISOString()
      })
      .eq('id', goal.id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  async deleteSavingsGoal(id: string): Promise<void> {
    const { error } = await supabase
      .from(this.tableName)
      .delete()
      .eq('id', id);

    if (error) throw error;
  }

  // Integration methods
  async addContribution(goalId: string, amount: number, source: 'manual' | 'automated' | 'budget_allocation' = 'manual', metadata?: { budgetId?: string; expenseId?: string }): Promise<SavingsGoal> {
    try {
      // Check if we're online
      const online = await isOnline();
      console.log('[addContribution] Online status:', online);
      
      // Get user ID with offline support
      const userId = await getUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // Start a transaction by getting the current goal first
      const goal = await this.getSavingsGoal(goalId);
      if (!goal) {
        throw new Error(`Savings goal with id ${goalId} not found`);
      }

      // Calculate new amount
      const newAmount = goal.currentAmount + amount;
      const isCompleted = newAmount >= goal.targetAmount;

      if (online) {
        console.log('[addContribution] Online mode - updating in Supabase');
        // Insert the contribution
        const { data: contribution, error: contributionError } = await supabase
          .from(this.contributionsTable)
          .insert([{
            goal_id: goalId,
            user_id: userId,
            amount: amount,
            source: source,
            budget_id: metadata?.budgetId,
            expense_id: metadata?.expenseId,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (contributionError) {
          console.error('[addContribution] Error inserting contribution:', contributionError);
          throw contributionError;
        }

        // Update the goal with new amount
        const { data: updatedGoal, error: goalError } = await supabase
          .from(this.tableName)
          .update({
            current_amount: newAmount,
            is_completed: isCompleted,
            updated_at: new Date().toISOString()
          })
          .eq('id', goalId)
          .select(`
            *,
            milestones:${this.milestonesTable}(*)
          `)
          .single();

        if (goalError) {
          console.error('[addContribution] Error updating goal:', goalError);
          throw goalError;
        }

        // Return the updated goal
        return this.mapToSavingsGoal(updatedGoal);
      } else {
        console.log('[addContribution] Offline mode - updating locally');
        // Offline mode - update locally and queue for sync
        
        // Get all goals to update the specific one
        const allGoals = await loadSavingsGoalsLocally();
        const goalIndex = allGoals.findIndex(g => g.id === goalId);
        
        if (goalIndex === -1) {
          throw new Error(`Savings goal with id ${goalId} not found locally`);
        }
        
        // Update the goal
        allGoals[goalIndex] = {
          ...allGoals[goalIndex],
          currentAmount: newAmount,
          isCompleted: isCompleted,
          updatedAt: new Date().toISOString()
        };
        
        // Save back to local storage
        await saveSavingsGoalsLocally(allGoals);
        
        // Queue contribution for sync when back online
        await addToSyncQueue({
          id: `contrib_${generateUUID()}`,
          type: 'create',
          entity: 'savings',
          data: {
            goalId: goalId,
            amount: amount,
            source: source,
            metadata: metadata
          },
          table: 'savings_contributions'
        });
        
        return allGoals[goalIndex];
      }
    } catch (error) {
      console.error('[addContribution] Error:', error);
      throw error;
    }
  }

  async linkBudget(goalId: string, budgetId: string, allocationPercentage: number, autoSave: boolean): Promise<SavingsGoal> {
    const goal = await this.getSavingsGoal(goalId);
    if (!goal) throw new Error('Savings goal not found');

    goal.linkedBudgets = [
      ...(goal.linkedBudgets || []),
      {
        budgetId,
        allocationPercentage,
        autoSave
      }
    ];

    if (autoSave) {
      // Set up next saving date based on frequency
      if (goal.savingFrequency) {
        const now = new Date();
        switch (goal.savingFrequency) {
          case 'daily':
            now.setDate(now.getDate() + 1);
            break;
          case 'weekly':
            now.setDate(now.getDate() + 7);
            break;
          case 'monthly':
            now.setMonth(now.getMonth() + 1);
            break;
        }
        goal.nextSavingDate = now.toISOString();
      }
    }

    return this.updateSavingsGoal(goal);
  }

  async addMilestoneToSavingsGoal(
    goalId: string,
    milestone: { title: string; targetAmount: number }
  ): Promise<SavingsGoal> {
    try {
      // Check if we're online
      const online = await isOnline();
      console.log('[addMilestoneToSavingsGoal class] Online status:', online);
      
      // Use getUserId which works offline
      const userId = await getUserId();
      
      if (!userId) {
        throw new Error('User not authenticated');
      }

      // First get the current goal
      const goal = await this.getSavingsGoal(goalId);
      if (!goal) {
        throw new Error(`Savings goal with id ${goalId} not found`);
      }

      if (online) {
        console.log('[addMilestoneToSavingsGoal class] Online mode - using Supabase');
        // Insert the milestone
        const { data: insertedMilestone, error: milestoneError } = await supabase
          .from(this.milestonesTable)
          .insert([{
            goal_id: goalId,
            user_id: userId,
            title: milestone.title,
            amount: milestone.targetAmount,
            is_reached: goal.currentAmount >= milestone.targetAmount,
            completed_date: goal.currentAmount >= milestone.targetAmount ? new Date().toISOString() : null,
            created_at: new Date().toISOString()
          }])
          .select()
          .single();

        if (milestoneError) {
          throw milestoneError;
        }

        // Update the goal's milestones array
        const milestones = goal.milestones || [];
        const newMilestone: SavingsMilestone = {
          id: insertedMilestone.id,
          title: milestone.title,
          targetAmount: milestone.targetAmount,
          isCompleted: goal.currentAmount >= milestone.targetAmount,
          completedDate: goal.currentAmount >= milestone.targetAmount ? new Date().toISOString() : undefined,
        };

        // Return the updated goal with the new milestone
        return this.updateSavingsGoal({
          ...goal,
          milestones: [...milestones, newMilestone],
        });
      } else {
        console.log('[addMilestoneToSavingsGoal class] Offline mode - updating locally');
        
        // Create milestone with a local ID
        const newMilestone: SavingsMilestone = {
          id: `local_${generateUUID()}`,
          title: milestone.title,
          targetAmount: milestone.targetAmount,
          isCompleted: goal.currentAmount >= milestone.targetAmount,
          completedDate: goal.currentAmount >= milestone.targetAmount ? new Date().toISOString() : undefined,
        };
        
        // Get all goals to update the specific one
        const allGoals = await loadSavingsGoalsLocally();
        const goalIndex = allGoals.findIndex(g => g.id === goalId);
        
        if (goalIndex === -1) {
          throw new Error(`Savings goal with id ${goalId} not found locally`);
        }
        
        // Update the goal with new milestone
        const updatedGoal = {
          ...allGoals[goalIndex],
          milestones: [...(allGoals[goalIndex].milestones || []), newMilestone],
          updatedAt: new Date().toISOString()
        };
        
        allGoals[goalIndex] = updatedGoal;
        
        // Save back to local storage
        await saveSavingsGoalsLocally(allGoals);
        
        // Queue milestone creation for sync when back online
        await addToSyncQueue({
          id: `milestone_${generateUUID()}`,
          type: 'create',
          entity: 'savings',
          data: {
            goalId: goalId,
            milestone: {
              title: milestone.title,
              targetAmount: milestone.targetAmount
            }
          },
          table: 'savings_milestones'
        });
        
        return updatedGoal;
      }
    } catch (error) {
      console.error('[addMilestoneToSavingsGoal class] Error:', error);
      throw error;
    }
  }

  async getSavingsAnalytics(goalId: string) {
    const goal = await this.getSavingsGoal(goalId);
    if (!goal) throw new Error('Savings goal not found');

    const progress = (goal.currentAmount / goal.targetAmount) * 100;
    const savingHistory = goal.savingHistory || [];

    return {
      currentAmount: goal.currentAmount,
      targetAmount: goal.targetAmount,
      progress,
      isCompleted: goal.isCompleted,
      contributionsBySource: savingHistory.reduce((acc, contribution) => {
        acc[contribution.source] = (acc[contribution.source] || 0) + contribution.amount;
        return acc;
      }, {} as Record<string, number>),
      milestoneProgress: goal.milestones?.map(milestone => ({
        title: milestone.title,
        targetAmount: milestone.targetAmount,
        isCompleted: milestone.isCompleted,
        progress: (goal.currentAmount / milestone.targetAmount) * 100
      })) || [],
      nextSavingDate: goal.nextSavingDate,
      averageContribution: savingHistory.length > 0 
        ? savingHistory.reduce((sum, c) => sum + c.amount, 0) / savingHistory.length 
        : 0
    };
  }

  private mapToSavingsGoal(data: any): SavingsGoal {
    return {
      id: data.id,
      userId: data.user_id,
      title: data.title,
      description: data.description,
      targetAmount: Number(data.target_amount),
      currentAmount: Number(data.current_amount || 0),
      startDate: data.start_date,
      targetDate: data.target_date,
      category: data.category,
      icon: data.icon,
      color: data.color,
      isCompleted: data.is_completed,
      isShared: data.is_shared,
      sharedWith: data.shared_with || [],
      milestones: data.milestones?.map(this.mapToMilestone) || [],
      contributions: data.contributions?.map(this.mapContribution) || [],
      createdAt: data.created_at,
      updatedAt: data.updated_at,
      linkedBudgets: data.linked_budgets || [],
      contributingExpenses: data.contributing_expenses || [],
      savingFrequency: data.saving_frequency,
      nextSavingDate: data.next_saving_date,
      savingHistory: data.saving_history || []
    };
  }

  private mapToMilestone(data: any): SavingsMilestone {
    return {
      id: data.id,
      title: data.title,
      targetAmount: Number(data.amount),
      isCompleted: data.is_reached,
      completedDate: data.completed_date,
      description: data.description,
      displayOrder: data.display_order
    };
  }

  private mapContribution(data: any): any {
    return {
      id: data.id,
      amount: Number(data.amount),
      source: data.source,
      createdAt: data.created_at,
      budgetId: data.budget_id,
      expenseId: data.expense_id
    };
  }

  async getSavingsContributions(goalId: string): Promise<any[]> {
    try {
      // Check if we're online
      const online = await isOnline();
      
      if (online) {
        try {
          const { data, error } = await supabase
            .from(this.contributionsTable)
            .select('*')
            .eq('goal_id', goalId)
            .order('created_at', { ascending: true });
          
          if (error) {
            console.error('Error fetching savings contributions:', error);
            return [];
          }
          
          return data.map((contribution: any) => ({
            id: contribution.id,
            amount: Number(contribution.amount),
            date: contribution.created_at,
            source: contribution.source,
            budgetId: contribution.budget_id,
            expenseId: contribution.expense_id
          }));
        } catch (error) {
          console.error('Error fetching contributions from Supabase:', error);
          // Fall back to empty array if Supabase fails
          return [];
        }
      }
      
      // If offline, we can only return an empty array since contributions are only stored online
      // In a real-world solution, we would store contributions locally as well
      console.log('Offline mode: Cannot load contributions, returning empty array');
      return [];
    } catch (error) {
      console.error('Error in getSavingsContributions:', error);
      return [];
    }
  }
}

export const savingsService = new SavingsService();

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
      await saveGoalsToStorage(goals);
      
      return goals;
    } else {
      // If offline, load from local storage
      console.log('Offline mode: Loading savings goals from local storage');
      return loadGoalsFromStorage();
    }
  } catch (error) {
    console.error('Error loading savings goals:', error);
    
    // Fallback to local storage if there's an error
    console.log('Falling back to local storage for savings goals');
    return loadGoalsFromStorage();
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
      const currentGoals = await loadGoalsFromStorage();
      await saveGoalsToStorage([...currentGoals, newGoal]);
      
      return newGoal;
    } else {
      // If offline, create locally and queue for sync
      console.log('Offline mode: Creating savings goal locally');
      
      // Get the current user from Supabase auth
      const userId = await getUserId();
      
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
      const currentGoals = await loadGoalsFromStorage();
      await saveGoalsToStorage([...currentGoals, newGoal]);
      
      // Queue for sync when back online
      await addToSyncQueue({
        id: newGoal.id,
        type: 'CREATE_SAVINGS_GOAL',
        entity: 'savings',
        data: newGoal,
        table: 'savings_goals'
      });
      
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
      const currentGoals = await loadGoalsFromStorage();
      const updatedGoals = currentGoals.filter(goal => goal.id !== id);
      await saveGoalsToStorage(updatedGoals);
      
      return true;
    } else {
      // If offline, mark for deletion and queue for sync
      console.log('Offline mode: Marking savings goal for deletion');
      
      const currentGoals = await loadGoalsFromStorage();
      const updatedGoals = currentGoals.filter(goal => goal.id !== id);
      
      if (updatedGoals.length === currentGoals.length) {
        return false; // No goal was deleted
      }
      
      await saveGoalsToStorage(updatedGoals);
      
      // Queue for sync when back online
      await addToSyncQueue({
        id,
        type: 'DELETE_SAVINGS_GOAL',
        entity: 'savings',
        data: { id },
        table: 'savings_goals'
      });
      
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
      const goals = await loadGoalsFromStorage();
      return goals.find(goal => goal.id === goalId) || null;
    }
  } catch (error) {
    console.error('Error loading savings goal by ID:', error);
    
    // Fallback to local storage
    console.log('Falling back to local storage for savings goal');
    const goals = await loadGoalsFromStorage();
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
    const currentGoals = await loadGoalsFromStorage();
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
    await saveGoalsToStorage(updatedGoals);
    
    if (isOnline) {
      // If online, update in Supabase
      await savingsApi.updateSavingsGoal(updatedGoal);
    } else {
      // If offline, queue for sync
      await addToSyncQueue({
        id: updatedGoal.id,
        type: 'UPDATE_SAVINGS_GOAL',
        entity: 'savings',
        data: updatedGoal,
        table: 'savings_goals'
      });
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
    const currentGoals = await loadGoalsFromStorage();
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
    await saveGoalsToStorage(updatedGoals);
    
    if (isOnline) {
      // If online, update in Supabase
      await savingsApi.updateSavingsGoal(updatedGoal);
    } else {
      // If offline, queue for sync
      await addToSyncQueue({
        id: updatedGoal.id,
        type: 'UPDATE_SAVINGS_GOAL',
        entity: 'savings',
        data: updatedGoal,
        table: 'savings_goals'
      });
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
  try {
    // Check if we're online
    const online = await isOnline();
    console.log('[addMilestoneToSavingsGoal] Online status:', online);

    // Get the goal - this works in both online and offline mode
    const goal = await getSavingsGoalById(goalId);
    
    if (!goal) {
      throw new Error(`Savings goal with ID ${goalId} not found`);
    }
    
    // Create the new milestone with properly generated ID
    const newMilestone: SavingsMilestone = {
      id: generateUUID(),
      isCompleted: goal.currentAmount >= milestone.targetAmount,
      completedDate: goal.currentAmount >= milestone.targetAmount
        ? new Date().toISOString()
        : undefined,
      ...milestone,
    };
    
    // Add to existing milestones or create a new array if milestones is undefined
    const milestones = [...(goal.milestones || []), newMilestone];
    
    // Update the goal with the new milestones
    if (online) {
      console.log('[addMilestoneToSavingsGoal] Online mode - updating in Supabase');
      return updateSavingsGoal(goalId, { milestones });
    } else {
      console.log('[addMilestoneToSavingsGoal] Offline mode - updating locally');
      
      // Get all goals to update the specific one
      const allGoals = await loadSavingsGoalsLocally();
      const goalIndex = allGoals.findIndex(g => g.id === goalId);
      
      if (goalIndex === -1) {
        throw new Error(`Savings goal with id ${goalId} not found locally`);
      }
      
      // Update the goal with new milestone
      allGoals[goalIndex] = {
        ...allGoals[goalIndex],
        milestones: milestones,
        updatedAt: new Date().toISOString()
      };
      
      // Save back to local storage
      await saveSavingsGoalsLocally(allGoals);
      
      // Queue milestone creation for sync when back online
      await addToSyncQueue({
        id: `milestone_${generateUUID()}`,
        type: 'create',
        entity: 'savings',
        data: {
          goalId: goalId,
          milestone: newMilestone
        },
        table: 'savings_milestones'
      });
      
      return allGoals[goalIndex];
    }
  } catch (error) {
    console.error('[addMilestoneToSavingsGoal] Error:', error);
    throw error;
  }
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
  console.log('Starting getSavingsStatistics...');
  const goals = await loadSavingsGoals();
  
  // Check if any goals have corrupted data (extremely large values)
  await checkAndRepairCorruptedGoals(goals);
  
  // Log goals data for debugging
  console.log(`Raw goals data: ${JSON.stringify(goals, null, 2)}`);
  console.log('Calculating savings statistics for', goals.length, 'goals');
  goals.forEach(goal => {
    console.log(`Goal: ${goal.title}, CurrentAmount: ${goal.currentAmount ?? 'undefined'} (type: ${typeof goal.currentAmount}), TargetAmount: ${goal.targetAmount ?? 'undefined'} (type: ${typeof goal.targetAmount}), Completed: ${goal.isCompleted ?? 'undefined'}`);
  });
  
  // Ensure all goals have valid numerical values for currentAmount and targetAmount
  const validatedGoals = goals.map(goal => {
    const validatedGoal = {
      ...goal,
      currentAmount: typeof goal.currentAmount === 'number' && !isNaN(goal.currentAmount) ? goal.currentAmount : 0,
      targetAmount: typeof goal.targetAmount === 'number' && !isNaN(goal.targetAmount) ? goal.targetAmount : 0,
      isCompleted: !!goal.isCompleted
    };
    
    console.log(`Validated goal: ${goal.title}, Original currentAmount: ${goal.currentAmount} (${typeof goal.currentAmount}), Validated currentAmount: ${validatedGoal.currentAmount}`);
    
    return validatedGoal;
  });
  
  console.log('Validated goals with default values applied:');
  validatedGoals.forEach(goal => {
    console.log(`${goal.title}: currentAmount=${goal.currentAmount}, targetAmount=${goal.targetAmount}, isCompleted=${goal.isCompleted}`);
  });
  
  // Calculate total saved amount
  const totalSaved = validatedGoals.reduce((sum, goal) => {
    const newSum = sum + goal.currentAmount;
    console.log(`Adding to total: ${goal.title} with ${goal.currentAmount}, running sum: ${newSum}`);
    return newSum;
  }, 0);
  
  // Calculate total target amount
  const totalTarget = validatedGoals.reduce((sum, goal) => sum + goal.targetAmount, 0);
  
  const completedGoals = validatedGoals.filter(goal => goal.isCompleted).length;
  const inProgressGoals = validatedGoals.length - completedGoals;
  
  // Calculate average savings rate (amount saved per day)
  let avgSavingsRate = 0;
  if (validatedGoals.length > 0) {
    const oldestGoalDate = new Date(Math.min(...validatedGoals.map(g => new Date(g.createdAt).getTime())));
    const daysSinceOldest = Math.max(1, Math.ceil((Date.now() - oldestGoalDate.getTime()) / (1000 * 60 * 60 * 24)));
    avgSavingsRate = totalSaved / daysSinceOldest;
  }
  
  console.log('Savings statistics calculated:', {
    totalSaved,
    totalTarget,
    progress: totalTarget > 0 ? (totalSaved / totalTarget) * 100 : 0,
    completedGoals,
    inProgressGoals
  });
  
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
 * Check for and repair any corrupted savings goals with unrealistically large values
 * @param goals List of savings goals to check
 */
export const checkAndRepairCorruptedGoals = async (goals: SavingsGoal[]): Promise<void> => {
  const MAX_REASONABLE_VALUE = 1000000000; // 1 billion
  const corruptedGoals = goals.filter(
    goal => goal.currentAmount > MAX_REASONABLE_VALUE || goal.targetAmount > MAX_REASONABLE_VALUE
  );
  
  if (corruptedGoals.length > 0) {
    console.error(`Found ${corruptedGoals.length} corrupted goals with unrealistic values:`);
    
    for (const goal of corruptedGoals) {
      console.error(`Corrupted goal: ${goal.title}, currentAmount: ${goal.currentAmount}, targetAmount: ${goal.targetAmount}`);
      
      try {
        // Reset the corrupted values to 0 or a reasonable default
        await updateSavingsGoal(goal.id, {
          currentAmount: 0,
          targetAmount: goal.targetAmount > MAX_REASONABLE_VALUE ? 5000000 : goal.targetAmount, // Reset to reasonable default
          isCompleted: false // Reset completion status
        });
        
        console.log(`Successfully repaired corrupted goal: ${goal.title}`);
      } catch (error) {
        console.error(`Failed to repair corrupted goal ${goal.title}:`, error);
      }
    }
  }
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
    // Check if we're online
    const online = await isOnline();

    // Get the goal regardless of online status
    const goal = await getSavingsGoal(id);
    if (!goal) {
      throw new Error(`Savings goal with id ${id} not found`);
    }

    // Calculate new amount
    const newAmount = (goal.currentAmount || 0) + amount;
    const isCompleted = newAmount >= goal.targetAmount;
    
    // Update goal with new amount
    const updatedGoal = await updateSavingsGoal(id, {
      currentAmount: newAmount,
      isCompleted,
      ...(online ? {} : { updatedAt: new Date().toISOString() })
    });

    // If online, try to add the contribution to the server
    if (online) {
      try {
        // Add to contributions table - this is only done when online
        const userId = await getUserId();
        const { error } = await supabase
          .from('savings_contributions')
          .insert([{
            goal_id: id,
            user_id: userId,
            amount: amount,
            source: 'manual',
            created_at: new Date().toISOString()
          }]);
        
        if (error) {
          console.warn('Failed to save contribution record, but the goal was updated:', error);
        }
      } catch (err) {
        console.warn('Error saving contribution record:', err);
        // Continue even if the contribution record fails - the goal was still updated
      }
    } else {
      // If offline, add to sync queue
      await addToSyncQueue({
        id: `contrib_${generateUUID()}`,
        type: 'create',
        entity: 'savings',
        data: {
          goalId: id,
          amount: amount,
          source: 'manual'
        },
        table: 'savings_contributions'
      });
    }
    
    return updatedGoal;
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

// Also add this exported function for backward compatibility
export const getUserSavingsGoals = async (userId: string): Promise<SavingsGoal[]> => {
  return savingsService.getUserSavingsGoals(userId);
}; 