// Supabase Edge Function for validating App Store and Google Play receipts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Configure Supabase client using environment variables
const supabaseUrl = Deno.env.get('SUPABASE_URL') as string;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') as string;

// Apple and Google verification endpoints
const APPLE_VERIFICATION_URL_SANDBOX = 'https://sandbox.itunes.apple.com/verifyReceipt';
const APPLE_VERIFICATION_URL_PRODUCTION = 'https://buy.itunes.apple.com/verifyReceipt';
const GOOGLE_VERIFICATION_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3/applications';
const GOOGLE_OAUTH_TOKEN_URL = 'https://oauth2.googleapis.com/token';

// Configure the function to handle HTTP requests
serve(async (req) => {
  // CORS headers to allow requests from your app domain
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers });
  }

  try {
    // Initialize the Supabase client with admin privileges
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Parse the request body
    const { platform, receiptData, productId, transactionId, userId, packageName, purchaseToken } = await req.json();
    
    // Validate required fields based on platform
    if (!platform || !userId || (platform === 'ios' && !receiptData) || 
        (platform === 'android' && (!packageName || !purchaseToken || !productId))) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields',
          details: 'iOS requires receiptData, Android requires packageName, purchaseToken, and productId'
        }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Validate user ID by checking if the user exists
    const { data: userData, error: userError } = await supabase
      .from('auth.users')
      .select('id')
      .eq('id', userId)
      .single();

    if (userError || !userData) {
      return new Response(
        JSON.stringify({ error: 'Invalid user ID' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Handle different platforms
    let validationResult;
    let isValid = false;
    let expirationDate = null;
    let autoRenewing = false;
    let originalTransactionId = null;
    let validationResponse = null;
    let purchaseDate = new Date();

    if (platform === 'ios') {
      // Validate with Apple App Store
      validationResult = await validateAppleReceipt(receiptData);
      validationResponse = validationResult.response;
      
      if (validationResult.isValid) {
        isValid = true;
        
        // Find the specific purchase in the receipt
        const receipt = validationResult.response.receipt;
        const latestReceiptInfo = validationResult.response.latest_receipt_info;
        
        if (Array.isArray(latestReceiptInfo) && latestReceiptInfo.length > 0) {
          // Find the purchase matching the transaction ID
          const purchase = latestReceiptInfo.find(item => item.transaction_id === transactionId) || latestReceiptInfo[0];
          
          // Parse purchase details
          purchaseDate = new Date(parseInt(purchase.purchase_date_ms, 10));
          
          if (purchase.expires_date_ms) {
            expirationDate = new Date(parseInt(purchase.expires_date_ms, 10));
          }
          
          autoRenewing = validationResult.response.auto_renew_status === '1';
          originalTransactionId = purchase.original_transaction_id;
        } else if (receipt && receipt.in_app && Array.isArray(receipt.in_app)) {
          const purchase = receipt.in_app.find(item => item.transaction_id === transactionId) || receipt.in_app[0];
          purchaseDate = new Date(parseInt(purchase.purchase_date_ms, 10));
          originalTransactionId = purchase.original_transaction_id;
        }
      }
    } else if (platform === 'android') {
      // Validate with Google Play Store
      validationResult = await validateGooglePurchase(packageName, productId, purchaseToken);
      validationResponse = validationResult.response;
      
      if (validationResult.isValid) {
        isValid = true;
        
        // Parse purchase details from Google response
        if (validationResult.response.expiryTimeMillis) {
          expirationDate = new Date(parseInt(validationResult.response.expiryTimeMillis, 10));
        }
        
        if (validationResult.response.startTimeMillis) {
          purchaseDate = new Date(parseInt(validationResult.response.startTimeMillis, 10));
        }
        
        autoRenewing = validationResult.response.autoRenewing || false;
        originalTransactionId = validationResult.response.orderId;
      }
    } else {
      return new Response(
        JSON.stringify({ error: 'Unsupported platform' }),
        { status: 400, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Store the validation result in the database
    const { data: insertData, error: insertError } = await supabase
      .from('purchase_validations')
      .upsert({
        user_id: userId,
        product_id: productId,
        transaction_id: transactionId,
        platform,
        purchase_date: purchaseDate.toISOString(),
        is_valid: isValid,
        expiration_date: expirationDate ? expirationDate.toISOString() : null,
        auto_renewing: autoRenewing,
        original_transaction_id: originalTransactionId,
        receipt_data: platform === 'ios' ? receiptData : null, // Store receipt for iOS
        validation_response: validationResponse,
      }, { onConflict: 'transaction_id, platform' })
      .select()
      .single();

    if (insertError) {
      console.error('Database error:', insertError);
      
      return new Response(
        JSON.stringify({ 
          error: 'Failed to store validation result',
          isValid,
          expirationDate: expirationDate ? expirationDate.toISOString() : null
        }),
        { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
      );
    }

    // Return the validation result
    return new Response(
      JSON.stringify({
        isValid,
        expirationDate: expirationDate ? expirationDate.toISOString() : null,
        autoRenewing,
        purchaseDate: purchaseDate.toISOString(),
        validationId: insertData.id,
      }),
      { headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Validation error:', error);
    
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { ...headers, 'Content-Type': 'application/json' } }
    );
  }
});

/**
 * Validate receipt with Apple App Store
 */
async function validateAppleReceipt(receiptData: string) {
  // Get the shared secret from environment variables
  const sharedSecret = Deno.env.get('APPLE_SHARED_SECRET');
  
  try {
    // Try production environment first
    let response = await fetch(APPLE_VERIFICATION_URL_PRODUCTION, {
      method: 'POST',
      body: JSON.stringify({
        'receipt-data': receiptData,
        'password': sharedSecret,
        'exclude-old-transactions': true
      })
    });

    let responseData = await response.json();
    
    // If status is 21007, it's a sandbox receipt, try sandbox environment
    if (responseData.status === 21007) {
      response = await fetch(APPLE_VERIFICATION_URL_SANDBOX, {
        method: 'POST',
        body: JSON.stringify({
          'receipt-data': receiptData,
          'password': sharedSecret,
          'exclude-old-transactions': true
        })
      });
      
      responseData = await response.json();
    }

    // Status 0 means success
    const isValid = responseData.status === 0;
    
    return {
      isValid,
      response: responseData
    };
  } catch (error) {
    console.error('Apple validation error:', error);
    return {
      isValid: false,
      response: { error: error.message }
    };
  }
}

/**
 * Validate purchase with Google Play Store
 */
async function validateGooglePurchase(packageName: string, productId: string, purchaseToken: string) {
  try {
    // Get Google API credentials from environment variables
    const clientEmail = Deno.env.get('GOOGLE_CLIENT_EMAIL');
    const privateKey = Deno.env.get('GOOGLE_PRIVATE_KEY')?.replace(/\\n/g, '\n');
    
    if (!clientEmail || !privateKey) {
      throw new Error('Google API credentials not configured');
    }

    // Get access token from Google
    const tokenResponse = await fetch(GOOGLE_OAUTH_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: createJWT(clientEmail, privateKey)
      })
    });

    const tokenData = await tokenResponse.json();
    
    if (!tokenData.access_token) {
      throw new Error('Failed to get Google API access token');
    }

    // Determine if this is a subscription or one-time purchase
    const isSubscription = productId.includes('subscription');
    const purchaseType = isSubscription ? 'subscriptions' : 'products';
    
    // Validate the purchase with Google Play Developer API
    const validationResponse = await fetch(
      `${GOOGLE_VERIFICATION_URL}/${packageName}/${purchaseType}/${productId}/purchases/${purchaseToken}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`
        }
      }
    );

    const validationData = await validationResponse.json();
    
    // Check if purchase is valid
    // For subscriptions: check if subscriptionState is active (1)
    // For one-time purchases: check if purchaseState is purchased (0)
    let isValid = false;
    
    if (isSubscription) {
      isValid = validationData.subscriptionState === 1;
    } else {
      isValid = validationData.purchaseState === 0;
    }

    return {
      isValid,
      response: validationData
    };
  } catch (error) {
    console.error('Google validation error:', error);
    return {
      isValid: false,
      response: { error: error.message }
    };
  }
}

/**
 * Create a JWT for Google API authentication
 */
function createJWT(clientEmail: string, privateKey: string): string {
  // Note: In a production environment, you would use a proper JWT library
  // This is a simplified version for illustration
  const header = {
    alg: 'RS256',
    typ: 'JWT'
  };
  
  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: clientEmail,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    exp: now + 3600,
    iat: now
  };
  
  const base64Header = btoa(JSON.stringify(header));
  const base64Payload = btoa(JSON.stringify(payload));
  
  // In a real implementation, you would sign this with the private key
  // For this example, we're just returning a placeholder
  // You would need a proper crypto library for actual JWT signing
  return `${base64Header}.${base64Payload}.signature`;
} 