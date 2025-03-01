# Supabase Edge Function Deployment Guide

This guide will help you deploy the receipt validation Edge Function and set up your Supabase project for handling in-app purchase validations.

## Prerequisites

1. A Supabase account and project
2. Supabase CLI installed on your machine
3. Node.js and npm installed

## Installing the Supabase CLI

### Using npm
```bash
npm install -g supabase
```

### Using Homebrew (for macOS)
```bash
brew install supabase/tap/supabase
```

## Login to Supabase

```bash
supabase login
```

You'll be prompted to enter a token, which you can generate from your Supabase dashboard.

## Project Setup

1. Navigate to your project directory:
```bash
cd buzo-ai
```

2. Link your local project to your Supabase project:
```bash
supabase link --project-ref your-project-ref
```

Replace `your-project-ref` with your Supabase project reference ID. You can find this in your project's dashboard URL: `https://app.supabase.com/project/your-project-ref`.

## Setting Up Environment Variables

Set the following secrets for your edge functions:

```bash
supabase secrets set APPLE_RECEIPT_VERIFY_URL=https://buy.itunes.apple.com/verifyReceipt
supabase secrets set APPLE_SANDBOX_VERIFY_URL=https://sandbox.itunes.apple.com/verifyReceipt
supabase secrets set APPLE_SHARED_SECRET=your_apple_shared_secret
supabase secrets set GOOGLE_PUBLISHER_API_URL=https://androidpublisher.googleapis.com/androidpublisher/v3/applications
supabase secrets set GOOGLE_API_CLIENT_EMAIL=your_service_account_email
supabase secrets set GOOGLE_API_PRIVATE_KEY=your_service_account_private_key
```

Replace the placeholder values with your actual credentials.

## Deploying the Edge Function

```bash
supabase functions deploy validate-receipt
```

## Running the SQL Migration

1. Connect to your Supabase database using the SQL Editor in the Supabase dashboard.
2. Copy the contents of the file `src/services/migrations/create_purchase_validation_table.sql`.
3. Paste the SQL into the editor and run it to create the required table and policies.

## Testing the Function

After deployment, you can test the function using the Supabase dashboard:

1. Go to your project dashboard.
2. Navigate to Edge Functions.
3. Select the `validate-receipt` function.
4. Use the "Invoke" feature to test with sample request bodies:

Sample iOS test:
```json
{
  "platform": "ios",
  "receiptData": "your_test_receipt_data",
  "productId": "buzo.premium.monthly",
  "transactionId": "test_transaction_123",
  "userId": "your_test_user_id"
}
```

Sample Android test:
```json
{
  "platform": "android",
  "packageName": "com.buzo.financialassistant",
  "productId": "buzo.premium.monthly",
  "purchaseToken": "your_test_purchase_token",
  "transactionId": "test_transaction_123",
  "userId": "your_test_user_id"
}
```

## Troubleshooting

### Function Deploy Errors
- Make sure your Supabase CLI is up to date
- Check that you have the correct permissions on your Supabase project
- Verify that your project is properly linked with `supabase status`

### Function Execution Errors
- Check the logs in the Supabase dashboard
- Verify your environment variables are set correctly
- Ensure your SQL migration was successfully executed

### JWT Signing Issues with Google
The example implementation includes a simplified JWT creation function. For production, you should use a proper JWT library within the Edge Function. You can install dependencies for Edge Functions by adding a `package.json` file in the function directory and specifying the dependencies there.

## Production Considerations

1. **Security**: 
   - Keep your shared secrets and API keys secure
   - Consider using more robust verification in production

2. **Monitoring**:
   - Set up logging and monitoring for your Edge Function
   - Regularly check for failed validations that might indicate fraud attempts

3. **Scaling**:
   - For high-traffic apps, consider caching validation results
   - Implement rate limiting if needed

---

For more information, see the [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions) and the [Supabase CLI Documentation](https://supabase.com/docs/guides/cli). 