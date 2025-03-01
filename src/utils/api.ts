import { supabase } from '../api/supabaseClient';

/**
 * Base URL for the backend API
 */
const API_BASE_URL = 'https://api.buzo.app/v1';

/**
 * Generic API request function for calling the Buzo backend
 * @param endpoint The API endpoint to call (without the base URL)
 * @param method The HTTP method to use
 * @param data Optional data to send with the request
 * @param headers Optional additional headers
 * @returns The JSON response from the API
 */
export const apiRequest = async (
  endpoint: string,
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' = 'GET',
  data?: any,
  headers?: Record<string, string>
): Promise<any> => {
  try {
    // Get the current session for the authentication token
    const { data: sessionData } = await supabase.auth.getSession();
    const token = sessionData?.session?.access_token;
    
    // Create the request URL
    const url = `${API_BASE_URL}${endpoint}`;
    
    // Prepare the fetch options
    const options: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': token ? `Bearer ${token}` : '',
        ...headers,
      },
    };
    
    // Add the body for non-GET requests
    if (method !== 'GET' && data) {
      options.body = JSON.stringify(data);
    }
    
    // Make the request
    const response = await fetch(url, options);
    
    // Parse the response
    const responseData = await response.json();
    
    // Check if the request was successful
    if (!response.ok) {
      throw new Error(responseData.message || 'API request failed');
    }
    
    return responseData;
  } catch (error) {
    console.error(`API request error (${endpoint}):`, error);
    throw error;
  }
}; 