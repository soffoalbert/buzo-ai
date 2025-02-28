import { supabase } from '../api/supabaseClient';

// Check if API key is provided as command line argument
const apiKey = process.argv[2];

if (!apiKey) {
  console.error('Please provide an API key as a command line argument');
  console.error('Usage: npx ts-node src/scripts/setGlobalApiKey.ts YOUR_API_KEY');
  process.exit(1);
}

/**
 * Set a global API key that is not linked to any specific user
 */
const setGlobalApiKey = async () => {
  try {
    console.log('Setting global API key...');
    
    // Store as a global API key
    const { error } = await supabase.rpc('set_global_api_key', {
      key_type_param: 'openai',
      api_key_param: apiKey,
      description_param: 'Global OpenAI API key for development'
    });
    
    if (error) {
      console.error('Error storing global API key:', error);
      process.exit(1);
    } else {
      console.log('Global API key stored successfully');
      process.exit(0);
    }
  } catch (error) {
    console.error('Error in setGlobalApiKey:', error);
    process.exit(1);
  }
};

// Run the function
setGlobalApiKey(); 