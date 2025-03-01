import { supabase } from './supabaseClient';
import { SavingsGoal, SavingsMilestone } from '../models/SavingsGoal';
import { generateUUID } from '../utils/helpers';

/**
 * Fetch all savings goals for the current user from Supabase
 * @returns Promise resolving to array of savings goals
 */
export const fetchSavingsGoals = async (): Promise<SavingsGoal[]> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    const { data, error } = await supabase
      .from('savings_goals')
      .select(`
        *,
        milestones:savings_milestones(*)
      `)
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching savings goals:', error);
      throw error;
    }
    
    // Transform the data to match our model
    const savingsGoals: SavingsGoal[] = data.map(goal => {
      const milestones = goal.milestones?.map((milestone: any) => ({
        id: milestone.id,
        title: milestone.title,
        targetAmount: parseFloat(milestone.amount),
        isCompleted: milestone.is_reached,
        completedDate: milestone.completed_date,
      })) || [];
      
      return {
        id: goal.id,
        title: goal.title,
        description: goal.description,
        targetAmount: parseFloat(goal.target_amount),
        currentAmount: parseFloat(goal.current_amount),
        startDate: goal.start_date,
        targetDate: goal.target_date,
        category: goal.category,
        icon: goal.icon,
        color: goal.color,
        isCompleted: goal.is_completed,
        isShared: goal.is_shared,
        sharedWith: goal.shared_with,
        milestones,
        createdAt: goal.created_at,
        updatedAt: goal.updated_at,
      };
    });
    
    return savingsGoals;
  } catch (error) {
    console.error('Error in fetchSavingsGoals:', error);
    throw error;
  }
};

/**
 * Create a new savings goal in Supabase
 * @param goalData Savings goal data without id, createdAt, updatedAt
 * @returns Promise resolving to the created savings goal
 */
export const createSavingsGoal = async (
  goalData: Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>
): Promise<SavingsGoal> => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      throw new Error('User not authenticated');
    }
    
    // Prepare the data for Supabase
    const supabaseGoalData = {
      user_id: user.id,
      title: goalData.title,
      description: goalData.description,
      target_amount: goalData.targetAmount,
      current_amount: goalData.currentAmount || 0,
      start_date: goalData.startDate,
      target_date: goalData.targetDate,
      category: goalData.category,
      icon: goalData.icon,
      color: goalData.color,
      is_completed: goalData.isCompleted || false,
      is_shared: goalData.isShared || false,
      shared_with: goalData.sharedWith || [],
    };
    
    // Insert the goal
    const { data: insertedGoal, error } = await supabase
      .from('savings_goals')
      .insert(supabaseGoalData)
      .select('*')
      .single();
    
    if (error) {
      console.error('Error creating savings goal:', error);
      throw error;
    }
    
    // Insert milestones if any
    let milestones: SavingsMilestone[] = [];
    if (goalData.milestones && goalData.milestones.length > 0) {
      const milestonesData = goalData.milestones.map(milestone => ({
        goal_id: insertedGoal.id,
        title: milestone.title,
        amount: milestone.targetAmount,
        is_reached: milestone.isCompleted || false,
      }));
      
      const { data: insertedMilestones, error: milestonesError } = await supabase
        .from('savings_milestones')
        .insert(milestonesData)
        .select('*');
      
      if (milestonesError) {
        console.error('Error creating savings milestones:', milestonesError);
        // Continue without milestones if there's an error
      } else if (insertedMilestones) {
        milestones = insertedMilestones.map(m => ({
          id: m.id,
          title: m.title,
          targetAmount: parseFloat(m.amount),
          isCompleted: m.is_reached,
          completedDate: m.completed_date,
        }));
      }
    }
    
    // Return the created goal with our model format
    return {
      id: insertedGoal.id,
      title: insertedGoal.title,
      description: insertedGoal.description,
      targetAmount: parseFloat(insertedGoal.target_amount),
      currentAmount: parseFloat(insertedGoal.current_amount),
      startDate: insertedGoal.start_date,
      targetDate: insertedGoal.target_date,
      category: insertedGoal.category,
      icon: insertedGoal.icon,
      color: insertedGoal.color,
      isCompleted: insertedGoal.is_completed,
      isShared: insertedGoal.is_shared,
      sharedWith: insertedGoal.shared_with,
      milestones,
      createdAt: insertedGoal.created_at,
      updatedAt: insertedGoal.updated_at,
    };
  } catch (error) {
    console.error('Error in createSavingsGoal:', error);
    throw error;
  }
};

/**
 * Update an existing savings goal in Supabase
 * @param id Savings goal ID to update
 * @param goalData Partial savings goal data to update
 * @returns Promise resolving to the updated savings goal
 */
export const updateSavingsGoal = async (
  id: string,
  goalData: Partial<Omit<SavingsGoal, 'id' | 'createdAt' | 'updatedAt'>>
): Promise<SavingsGoal> => {
  try {
    // Prepare the data for Supabase
    const supabaseGoalData: any = {};
    
    if (goalData.title !== undefined) supabaseGoalData.title = goalData.title;
    if (goalData.description !== undefined) supabaseGoalData.description = goalData.description;
    if (goalData.targetAmount !== undefined) supabaseGoalData.target_amount = goalData.targetAmount;
    if (goalData.currentAmount !== undefined) supabaseGoalData.current_amount = goalData.currentAmount;
    if (goalData.startDate !== undefined) supabaseGoalData.start_date = goalData.startDate;
    if (goalData.targetDate !== undefined) supabaseGoalData.target_date = goalData.targetDate;
    if (goalData.category !== undefined) supabaseGoalData.category = goalData.category;
    if (goalData.icon !== undefined) supabaseGoalData.icon = goalData.icon;
    if (goalData.color !== undefined) supabaseGoalData.color = goalData.color;
    if (goalData.isCompleted !== undefined) supabaseGoalData.is_completed = goalData.isCompleted;
    if (goalData.isShared !== undefined) supabaseGoalData.is_shared = goalData.isShared;
    if (goalData.sharedWith !== undefined) supabaseGoalData.shared_with = goalData.sharedWith;
    
    // Always update the updated_at field
    supabaseGoalData.updated_at = new Date().toISOString();
    
    // Update the goal
    const { data: updatedGoal, error } = await supabase
      .from('savings_goals')
      .update(supabaseGoalData)
      .eq('id', id)
      .select(`
        *,
        milestones:savings_milestones(*)
      `)
      .single();
    
    if (error) {
      console.error('Error updating savings goal:', error);
      throw error;
    }
    
    // Transform the data to match our model
    const milestones = updatedGoal.milestones?.map((milestone: any) => ({
      id: milestone.id,
      title: milestone.title,
      targetAmount: parseFloat(milestone.amount),
      isCompleted: milestone.is_reached,
      completedDate: milestone.completed_date,
    })) || [];
    
    return {
      id: updatedGoal.id,
      title: updatedGoal.title,
      description: updatedGoal.description,
      targetAmount: parseFloat(updatedGoal.target_amount),
      currentAmount: parseFloat(updatedGoal.current_amount),
      startDate: updatedGoal.start_date,
      targetDate: updatedGoal.target_date,
      category: updatedGoal.category,
      icon: updatedGoal.icon,
      color: updatedGoal.color,
      isCompleted: updatedGoal.is_completed,
      isShared: updatedGoal.is_shared,
      sharedWith: updatedGoal.shared_with,
      milestones,
      createdAt: updatedGoal.created_at,
      updatedAt: updatedGoal.updated_at,
    };
  } catch (error) {
    console.error('Error in updateSavingsGoal:', error);
    throw error;
  }
};

/**
 * Delete a savings goal from Supabase
 * @param id Savings goal ID to delete
 * @returns Promise resolving to boolean indicating success
 */
export const deleteSavingsGoal = async (id: string): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('savings_goals')
      .delete()
      .eq('id', id);
    
    if (error) {
      console.error('Error deleting savings goal:', error);
      throw error;
    }
    
    return true;
  } catch (error) {
    console.error('Error in deleteSavingsGoal:', error);
    throw error;
  }
}; 