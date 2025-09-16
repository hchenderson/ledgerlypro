
# Ledgerly Pro - Technical Blueprint

This document outlines the technical architecture, design decisions, and core concepts behind the Ledgerly Pro application.

## 1. Project Overview

Ledgerly Pro is a modern personal finance management application designed to provide users with a clean, intuitive, and powerful tool for tracking income, expenses, budgets, and savings goals. It leverages AI to offer advanced features like receipt scanning and cash flow projections.

## 2. Tech Stack

- **Framework**: [Next.js (App Router)](https://nextjs.org/) - Chosen for its hybrid rendering capabilities (Server Components and Client Components), performance optimizations, and integrated routing.
- **Language**: [TypeScript](https://www.typescriptlang.org/) - For static typing, improved code quality, and better developer experience.
- **UI Library**: [React](https://react.dev/) - For building a component-based, interactive user interface.
- **Styling**:
    - [Tailwind CSS](https://tailwindcss.com/) - A utility-first CSS framework for rapid UI development.
    - [ShadCN UI](https://ui.shadcn.com/) - A collection of beautifully designed, accessible, and unstyled components that are copied into the project and fully customizable.
    - **Fonts**: `Montserrat` for headlines, `Inter` for body text, and `Source Code Pro` for numbers, configured in `tailwind.config.ts` and loaded in `src/app/layout.tsx`.
- **Backend & Database**: [Firebase](https://firebase.google.com/)
    - **Authentication**: Firebase Authentication for secure user sign-in/sign-up (Email/Password, Google).
    - **Database**: Firestore, a NoSQL document database, for storing all user data.
    - **Hosting**: Firebase App Hosting.
- **AI/Generative AI**: [Genkit (via Firebase AI)](https://firebase.google.com/docs/genkit) - A framework for building production-ready AI-powered features, used for receipt scanning and financial projections.

## 3. Project Structure

The `src` directory is organized to maintain a clear separation of concerns.

- `src/app/`: Contains all pages and layouts, following the Next.js App Router conventions.
    - `(app)/`: A route group for all authenticated pages (e.g., dashboard, transactions). `layout.tsx` within this group handles the main app shell, including the sidebar and header.
    - `(auth)/`: A route group for authentication-related pages (e.g., sign-in, welcome).
    - `api/`: Route handlers for server-side API logic.
    - `globals.css`: Contains the core Tailwind directives and the application's color theme defined with HSL CSS variables for easy customization.
- `src/components/`: Reusable React components.
    - `ui/`: Core, unstyled components provided by ShadCN (e.g., Button, Card, Dialog).
    - `dashboard/`, `reports/`, etc.: Larger, feature-specific components.
- `src/hooks/`: Custom React hooks for shared logic.
    - `use-auth.tsx`: Manages user authentication state globally.
    - `use-user-data.tsx`: The primary hook for all Firestore data interactions (CRUD operations for transactions, categories, etc.). This acts as a centralized data layer for the frontend.
- `src/lib/`: Core utilities, configuration, and libraries.
    - `auth.ts`: Wrapper functions for Firebase Authentication calls.
    - `firebase.ts`: Firebase SDK initialization.
    - `data.ts`: Contains default data used to seed a new user's account during onboarding.
    - `actions.ts`: Server Actions for performing server-side logic without needing to create explicit API endpoints.
- `src/ai/`: Contains all Genkit-related code.
    - `genkit.ts`: Initializes and configures the global Genkit instance.
    - `flows/`: Contains the Genkit flows that define the AI logic (e.g., `scan-receipt-flow.ts`).
- `src/types/`: TypeScript type definitions used throughout the application.

## 4. Authentication Flow

- Authentication is managed via the `AuthProvider` and the `useAuth` hook (`src/hooks/use-auth.tsx`).
- It handles user state, loading status, and onboarding completion.
- The root layout (`src/app/(auth)/layout.tsx`) protects routes by redirecting unauthenticated users to `/signin`.
- The app layout (`src/app/(app)/layout.tsx`) handles redirecting new, un-onboarded users to the `/welcome` page.

## 5. Data Management & Firestore

- **Database**: All user data (transactions, categories, budgets, goals) is stored in Firestore.
- **Data Structure**: Data is strictly segregated by user. The top-level collection is `users`, and all data for a specific user is stored in sub-collections under their unique `userId`.
    - Example path for transactions: `/users/{userId}/transactions/{transactionId}`
- **Security**: Security is enforced via `firestore.rules`. The rules ensure that a user can **only** read and write to documents within their own `/users/{userId}` path. **This is the most critical security feature of the app.**
- **Data Access**: All data fetching and mutation logic is centralized in the `UserDataProvider` (`src/hooks/use-user-data.tsx`). This provider uses `onSnapshot` listeners to subscribe to real-time updates from Firestore, ensuring the UI is always in sync with the database.

## 6. AI Features (Genkit)

- Genkit flows are defined in `src/ai/flows/`.
- Each flow file is a server-side module (`'use server'`).
- **Receipt Scanning**: The `scan-receipt-flow.ts` defines a flow that takes a base64-encoded image, sends it to a multimodal LLM, and returns structured JSON data (date, amount, description).
- **Cash Flow Projections**: The `cash-flow-projections.ts` flow takes a user's transaction history as JSON and uses an LLM to generate a text-based financial projection.

## 7. Deployment & Environment

- **Hosting**: The app is configured for Firebase App Hosting via `apphosting.yaml`.
- **Environment Variables**: Sensitive keys (like Firebase API keys) are managed through environment variables. A `.env.local` file should be created locally for development, but secrets should be configured directly in the App Hosting backend for production.
