# Buzo AI - Financial Assistant for African Youth

Buzo is an AI-powered financial assistant designed specifically for young South Africans. The app provides personalized financial advice, budgeting tools, expense tracking, and educational content to help users improve their financial literacy and achieve their financial goals.

## Features

- **AI Financial Advisor**: Get personalized financial advice powered by GPT-4o
- **Smart Budgeting**: Create and manage budgets with intelligent alerts
- **Expense Tracking**: Log expenses manually or by scanning receipts
- **Savings Goals**: Set and track progress towards financial goals
- **Financial Education**: Access tailored educational content
- **Push Notifications**: Receive timely reminders and financial tips
- **Bank Statement Analysis**: Upload bank statements for personalized insights

## Tech Stack

- React Native / Expo
- TypeScript
- OpenAI API (GPT-4o)
- Supabase for authentication and data storage
- Expo Secure Store for sensitive data
- Expo Notifications for push notifications

## Implementation Details

### Screens

- **Onboarding**: Introduction to the app's features with a smooth onboarding flow
- **Authentication**: Login and registration screens with form validation
- **Home**: Dashboard overview with financial summary and quick access to key features
- **Budget**: Budget management with category-based tracking and progress visualization
- **Expenses**: Expense tracking with filtering, search, and categorization
- **Savings**: Savings goals tracking with progress visualization and savings tips
- **Profile**: User profile management, settings, and app configuration

### Services

- **AI Advisor**: Integration with OpenAI's GPT-4o for personalized financial advice
- **Notifications**: In-app push notifications for budget alerts, savings milestones, and financial tips
- **Bank Statement Analysis**: Upload and analyze bank statements for personalized financial insights

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- OpenAI API key
- Supabase account and project

### Installation

1. Clone the repository
```bash
git clone https://github.com/yourusername/buzo-ai.git
cd buzo-ai
```

2. Install dependencies
```bash
npm install
# or
yarn install
```

3. Create a `.env` file in the root directory with your API keys
```
OPENAI_API_KEY=your_openai_api_key_here
SUPABASE_URL=your_supabase_url_here
SUPABASE_ANON_KEY=your_supabase_anon_key_here
```

4. Set up the Supabase database (see [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed instructions)

5. Start the development server
```bash
npx expo start
```

### Database Setup

The app uses Supabase for authentication, data storage, and file storage. You need to set up the required tables and storage buckets in your Supabase project. See [DATABASE_SETUP.md](./DATABASE_SETUP.md) for detailed instructions.

The app includes a local storage fallback mechanism for situations where:
- The Supabase database tables don't exist
- The storage buckets are not properly configured
- There are permission issues with the database or storage

This allows the app to continue functioning even when the backend is not fully set up, but for the best experience, it's recommended to properly configure the Supabase backend.

## Project Structure

```
buzo-ai/
├── src/
│   ├── api/              # API clients and configurations
│   │   └── supabaseClient.ts # Supabase client configuration
│   ├── assets/           # Images and static files
│   ├── components/       # Reusable UI components
│   ├── navigation/       # Navigation configuration
│   ├── screens/          # App screens
│   │   ├── OnboardingScreen.tsx  # Onboarding experience
│   │   ├── LoginScreen.tsx       # User login
│   │   ├── RegisterScreen.tsx    # User registration
│   │   ├── HomeScreen.tsx        # Main dashboard
│   │   ├── BudgetScreen.tsx      # Budget management
│   │   ├── ExpensesScreen.tsx    # Expense tracking
│   │   ├── SavingsScreen.tsx     # Savings goals
│   │   └── ProfileScreen.tsx     # User profile and settings
│   ├── services/         # API and service integrations
│   │   ├── aiAdvisor.ts  # OpenAI integration for financial advice
│   │   ├── authService.ts # Authentication service
│   │   ├── bankStatementService.ts # Bank statement upload and analysis
│   │   └── notifications.ts # Push notification handling
│   ├── utils/            # Utility functions and constants
│   │   ├── theme.ts      # App-wide styling theme
│   │   └── polyfills.ts  # Polyfills for React Native compatibility
│   └── App.tsx           # Main app component
├── .env                  # Environment variables (git-ignored)
├── DATABASE_SETUP.md     # Database setup instructions
└── package.json          # Project dependencies
```

## Next Steps

- Enhance bank statement analysis with more detailed insights
- Implement charts and visualizations for financial data
- Add receipt scanning functionality using the device camera
- Add social features for financial goal sharing and accountability
- Integrate with South African banking APIs for real-time financial data

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the GPT-4o API
- Supabase for the backend infrastructure
- Expo team for the excellent React Native tooling
- All contributors who help improve Buzo AI