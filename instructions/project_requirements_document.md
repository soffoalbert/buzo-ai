# Project Requirements Document

## 1. Project Overview

This project is an AI-powered personal finance assistant designed primarily for South African youth. The app aims to help users manage their money more effectively by guiding them through budgeting, expense tracking, and setting savings goals that accommodate their unique financial challenges. By analyzing data from scanned receipts, uploaded bank statements, and manual entries, the assistant delivers personalized financial advice that resonates with the local economic conditions and cultural context.

The tool is being built to empower young people with practical financial management skills and to promote better money habits. Success will be measured by improved financial literacy, increased user engagement with budgeting and saving features, and a reduction in overspending. The AI's ability to provide tailored, actionable advice coupled with friendly, culturally relevant design elements are key objectives of the project.

## 2. In-Scope vs. Out-of-Scope

### In-Scope:

*   Development of a mobile app using React Native (TypeScript) to support both iOS and Android.
*   Integration with Supabase for database management, secure storage, and user authentication with multi-factor support.
*   Implementation of GPT-4o for real-time, personalized financial advice based on user inputs.
*   Core features including Budget Planner, Expense Tracker, Savings Goals, and Financial Education modules.
*   Onboarding process including receipt scanning via phone camera and bank statement uploads for accurate data capture.
*   Offline capabilities that allow users to view their data and log expenses even without an internet connection.
*   Tiered service levels with a freemium model, offering basic free features and premium functionalities.
*   Use of in-app push notifications for immediate alerts about budget limits, progress updates, and other financial tips.
*   Robust encryption (TLS for data in transit and AES-256 for data at rest) to ensure data privacy and security.

### Out-of-Scope:

*   Integration with external local financial data sources or partnerships for real-time exchange or inflation rates.
*   Development for platforms beyond the mobile app (such as a web interface) during the initial version.
*   Extensive support for countries or regions outside of South Africa in the first release.
*   Advanced SMS or email notification integrations as primary methods; these will only be considered for future enhancements.
*   Any large-scale changes to the core financial insight algorithms, as improvements will be planned for subsequent updates once user feedback is collected.

## 3. User Flow

A new user launches the app and is greeted with a friendly onboarding experience. The onboarding process explains the core features of the app – budgeting, expense tracking, and savings goals – and guides the user to set up their account. During onboarding, users are prompted to scan receipts using their phone camera and upload bank statements, so the AI can analyze past spending habits and set initial budget recommendations. The process ensures that users feel supported and understand the benefits of the tool right from the start.

After completing onboarding, the user lands on the Home Screen, which serves as a central dashboard. From here, users can navigate to detailed screens for Budget Management, Expense Tracking, and Savings Goals. They can quickly tap through different sections, receive real-time alerts via in-app push notifications, and explore educational resources tailored to improving financial literacy. The journey is designed to be intuitive and straightforward so even users with minimal technical knowledge can manage their finances without confusion.

## 4. Core Features

*   **Budget Planner:**

    *   Ability to set up budgets using inputted income data, spending limits, and categorization (e.g., groceries, transportation, housing, education, healthcare, entertainment, savings, and custom categories).
    *   Visual alerts and feedback when spending approaches set limits.

*   **Expense Tracker:**

    *   Automatic categorization of expenses through receipt scanning using the phone camera.
    *   Manual input of expenses and ability to upload bank statements.
    *   Insightful summaries and graphical representations of spending patterns.

*   **Savings Goals:**

    *   Users can define specific saving targets such as education, housing, or future investments.
    *   Progress tracking with motivational insights to encourage long-term saving habits.

*   **Financial Education:**

    *   Interactive articles, videos, and tips on personal finance that are tailored to the economic context of South Africa.
    *   Content designed to be culturally relevant using vibrant visual elements and relatable examples for African youth.

*   **AI Personalization:**

    *   Use of GPT-4o to analyze user financial data and provide contextual, customized advice.
    *   Continuous learning from user feedback to refine recommendations over time.

*   **User Feedback Mechanism:**

    *   In-app feedback system featuring quick surveys and a rating system for immediate and periodic user input.
    *   Regular prompts to help improve the accuracy and effectiveness of the AI recommendations.

*   **Tiered Membership:**

    *   A free version offering essential budgeting, expense tracking, and educational resources.
    *   A premium version with advanced features like personalized financial coaching, detailed spending analysis, priority customer support, and an ad-free experience.

*   **Offline Mode & Data Synchronization:**

    *   Offline access to critical data and the ability to log transactions even without an internet connection.
    *   Seamless synchronization of data with the central server once a stable connection is re-established.

## 5. Tech Stack & Tools

*   **Frontend:**

    *   React Native (using TypeScript) to build a cross-platform mobile app for both iOS and Android.

*   **Backend & Storage:**

    *   Supabase for managing the database, handling user authentication (including multi-factor authentication), and securely storing financial data with AES-256 encryption for data at rest.

*   **AI Integration:**

    *   GPT-4o will be used to generate personalized financial advice, budget suggestions, and insights based on user-entered data.

*   **Security:**

    *   TLS (Transport Layer Security) is used to encrypt data in transit.

*   **Development Tools:**

    *   Cursor as an advanced IDE with real-time suggestions.
    *   Expo for building and streamlining the cross-platform development process with React Native.

## 6. Non-Functional Requirements

*   **Performance:**

    *   Quick response times with data processing and financial insights delivered in near real-time.
    *   Minimal load times on the mobile app to ensure user engagement, especially in regions with low bandwidth.

*   **Security & Compliance:**

    *   End-to-end encryption (TLS and AES-256) for all user data.
    *   Regular security audits and adherence to data protection regulations (e.g., GDPR where applicable).

*   **Usability:**

    *   Intuitive design that is easy to navigate regardless of the user’s tech familiarity.
    *   Visual and interactive feedback in the app to help guide users through each task.

*   **Reliability:**

    *   Offline capabilities to ensure continuous usage in low connectivity zones.
    *   Robust error handling and synchronization mechanisms to protect data integrity.

## 7. Constraints & Assumptions

*   The project is initially focused on South Africa to tailor financial advice accurately for the region.
*   There is no planned integration with local external financial data sources; analysis relies solely on user-provided data (scanned receipts, uploaded bank statements, and manual entries).
*   The app assumes that a significant portion of local users will have smartphones capable of capturing high-quality images for receipt scanning.
*   Supabase services, including authentication and storage, and GPT-4o availability are critical dependencies for the project.
*   It is assumed that users will understand and consent to the robust encryption and security protocols, which are in place to protect their sensitive financial data.

## 8. Known Issues & Potential Pitfalls

*   **Data Accuracy:**

    *   Receipt scanning and bank statement uploads may occasionally produce errors in data extraction. To mitigate this, prompt users for manual confirmation and provide easy correction options.

*   **Connectivity:**

    *   Inconsistent internet access in some regions may hinder real-time data synchronization. The offline mode and lightweight data transfer protocols are essential, but further testing in low-bandwidth conditions is advised.

*   **User Adoption:**

    *   There is potential for low adoption if the onboarding process isn’t engaging enough. Iterative user testing and a clear, friendly introduction to the app’s benefits will help overcome this.

*   **Security Risks:**

    *   Handling sensitive financial information always carries security risks. Regular audits, adherence to strict encryption standards, and a clear, transparent privacy policy are needed to maintain user trust.

*   **Feedback Loop:**

    *   Ensuring that the AI adapts effectively to user feedback can be complex. An iterative development approach that incorporates user surveys and ratings will be key to refining the financial advice over time.

This document serves as the comprehensive blueprint for the development of the AI-powered financial assistant for African youth. Every aspect from user onboarding to data security and offline functionality has been addressed so that subsequent technical documents can be developed without any ambiguity.
