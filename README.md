# Buzo AI - Financial Assistant for African Youth

Buzo AI is a mobile application designed to help young South Africans manage their finances through budgeting, expense tracking, savings goals, and AI-powered financial advice.

## Features

- **Budget Management**: Create and track budgets by category
- **Expense Tracking**: Record and categorize expenses
- **Savings Goals**: Set and monitor progress towards financial goals
- **AI Financial Advisor**: Get personalized financial advice powered by OpenAI

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Expo CLI

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

3. Set up your OpenAI API key
   - Create a `.env` file in the root directory
   - Add your OpenAI API key: `OPENAI_API_KEY=your_api_key_here`
   - Alternatively, you can set the API key in the app settings

4. Start the development server
```bash
npm start
# or
yarn start
```

### Setting up the OpenAI API Key

For security reasons, the OpenAI API key is not hardcoded in the application. You need to:

1. Get an API key from [OpenAI](https://platform.openai.com/account/api-keys)
2. Replace the placeholder in `src/services/aiAdvisor.ts` with your actual API key:
   ```javascript
   const DEFAULT_API_KEY = 'YOUR_OPENAI_API_KEY_HERE';
   ```
   
   **IMPORTANT**: Never commit your actual API key to version control. Consider using environment variables or a secure key management system in production.

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- OpenAI for providing the AI capabilities
- The South African youth for inspiring this project