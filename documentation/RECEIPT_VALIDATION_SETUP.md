# Server-side Receipt Validation Implementation Plan

This document outlines the steps we've taken to implement server-side validation for App Store and Google Play Store in-app purchases using Supabase, and what additional steps you need to take to complete the implementation.

## Completed Implementation

### 1. Supabase Database Structure
- Created a `purchase_validations` table to store validation results
- Set up Row Level Security (RLS) policies to protect validation data
- Implemented necessary indexes for performance optimization

### 2. Server-side Validation
- Created a Supabase Edge Function to validate receipts with Apple and Google servers
- Implemented platform-specific validation logic for both iOS and Android
- Set up secure storage of validation results in the database

### 3. Client-side Integration
- Enhanced the app's payment service to send receipts for server-side validation
- Updated the subscription service to check server validation status 
- Improved the UI to display subscription status based on validated purchases

## How It Works

1. **When a user makes a purchase:**
   - The app processes the purchase using `react-native-iap`
   - The receipt/purchase token is sent to the Supabase Edge Function
   - The function validates with Apple/Google servers and stores the result
   - The app uses the validation result to grant access to premium features

2. **For subscription management:**
   - The system checks the database for valid subscriptions
   - Expiration dates are tracked and enforced
   - Users can restore previous purchases securely

## Remaining Steps

### 1. Supabase Setup
- Create a new Supabase project (if not done already)
- Run the SQL migration script to create the `purchase_validations` table
- Deploy the Edge Function to your Supabase project:
  ```bash
  supabase functions deploy validate-receipt
  ```

### 2. Environment Configuration
- Set the following environment variables in your Supabase project:
  ```bash
  supabase secrets set APPLE_RECEIPT_VERIFY_URL=https://buy.itunes.apple.com/verifyReceipt
  supabase secrets set APPLE_SANDBOX_VERIFY_URL=https://sandbox.itunes.apple.com/verifyReceipt
  supabase secrets set APPLE_SHARED_SECRET=your_apple_shared_secret
  supabase secrets set GOOGLE_PUBLISHER_API_URL=https://androidpublisher.googleapis.com/androidpublisher/v3/applications
  supabase secrets set GOOGLE_API_CLIENT_EMAIL=your_service_account_email
  supabase secrets set GOOGLE_API_PRIVATE_KEY=your_service_account_private_key
  ```

### 3. Getting Apple Shared Secret
1. Log in to [App Store Connect](https://appstoreconnect.apple.com)
2. Go to "Apps" > Your App > "App Store" > "App Information"
3. Scroll down to "App-Specific Shared Secret"
4. Click "Generate Shared Secret" or view existing secret
5. Copy this secret - this will be your `APPLE_SHARED_SECRET`

### 4. Getting Google Service Account Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select your project
3. Enable the Google Play Android Developer API
4. Go to "IAM & Admin" > "Service Accounts"
5. Create a new service account or select existing one
6. Create a new JSON key:
   - Click on the service account
   - Go to "Keys" tab
   - Click "Add Key" > "Create New Key"
   - Choose JSON format
7. Download the JSON file
8. From the JSON file:
   - Use `client_email` as `GOOGLE_API_CLIENT_EMAIL`
   - Use `private_key` as `GOOGLE_API_PRIVATE_KEY`

### 5. Testing
- Use Apple's sandbox environment for testing iOS purchases
- Use Google Play's testing tracks for Android purchases
- Test all purchase flows, including:
  - Initial purchase
  - Subscription renewal
  - Subscription cancellation
  - Purchase restoration

## Security Considerations

- The server-side validation approach prevents common fraud techniques
- Keep your Supabase API keys and environment variables secure
- Regularly monitor purchase validations for unusual patterns
- Consider implementing additional anti-fraud measures for high-risk markets

## Resources

- [Apple Receipt Validation Documentation](https://developer.apple.com/documentation/storekit/in-app_purchase/validating_receipts_with_the_app_store)
- [Google Play Developer API Documentation](https://developers.google.com/android-publisher)
- [Supabase Edge Functions Documentation](https://supabase.com/docs/guides/functions)
- [React Native IAP Documentation](https://github.com/react-native-iap/react-native-iap)

---

For any issues with the implementation, please review the code comments or reach out for support.