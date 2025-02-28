# Buzo AI - Financial Assistant for African Youth

Buzo is an AI-powered financial assistant designed specifically for young South Africans. The app provides personalized financial advice, budgeting tools, expense tracking, and educational content to help users improve their financial literacy and achieve their financial goals.

## Features

- **AI Financial Advisor**: Get personalized financial advice powered by GPT-4o
- **Smart Budgeting**: Create and manage budgets with intelligent alerts
- **Expense Tracking**: Log expenses manually or by scanning receipts
- **Savings Goals**: Set and track progress towards financial goals
- **Financial Education**: Access tailored educational content
- **Push Notifications**: Receive timely reminders and financial tips

## Tech Stack

- React Native / Expo
- TypeScript
- OpenAI API (GPT-4o)
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

## Getting Started

### Prerequisites

- Node.js (v14 or later)
- npm or yarn
- Expo CLI
- OpenAI API key

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

3. Create a `.env` file in the root directory with your OpenAI API key
```
OPENAI_API_KEY=your_api_key_here
```

4. Start the development server
```bash
npx expo start
```

## Project Structure

```
buzo-ai/
├── src/
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
│   │   └── notifications.ts # Push notification handling
│   ├── utils/            # Utility functions and constants
│   │   └── theme.ts      # App-wide styling theme
│   └── App.tsx           # Main app component
├── .env                  # Environment variables (git-ignored)
└── package.json          # Project dependencies
```

## Next Steps

- Implement data persistence with a backend service or local storage
- Add receipt scanning functionality using the device camera
- Implement charts and visualizations for financial data
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
- Expo team for the excellent React Native tooling
- All contributors who help improve Buzo AI