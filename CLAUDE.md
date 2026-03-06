# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

PocketTrack is a personal finance tracking web app built with React/TypeScript, Supabase backend, and AI-powered features (receipt scanning, purchase advisor, AI coach).

## Commands

```bash
npm run dev          # Dev server on port 8080
npm run build        # Production build
npm run lint         # ESLint
npm run test         # Vitest (single run)
npm run test:watch   # Vitest (watch mode)
```

Supabase edge functions use Deno runtime. Deploy via Supabase Dashboard or CLI.

## Architecture

### Frontend
- **React 18** + **TypeScript** + **Vite** (SWC compiler)
- **shadcn/ui** components in `src/components/ui/` (Radix UI primitives + Tailwind)
- **TanStack React Query** for server state
- **React Router DOM** for routing
- Path alias: `@/` → `src/`

### Backend (Supabase)
- **Auth**: Supabase Auth with JWT, session in localStorage
- **Database**: PostgreSQL with RLS. Tables: `profiles`, `transactions`, `subscriptions`, `savings_goals`, `scans`, `budgets`, `scheduled_transactions`, `accounts`, `net_worth_snapshots`
- **Edge Functions** (`supabase/functions/`): Deno-based serverless functions
- **AI**: Google Gemini 2.5 Flash via direct API (`generativelanguage.googleapis.com`)

### Key Edge Functions
- `scan-product` — AI purchase advisor (verdict: go_for_it/think_twice/skip_it)
- `scan-receipt` — Receipt OCR extraction
- `scan-transaction` — Single transaction from bank screenshot
- `scan-bank-screenshot` — Multiple transactions from bank statement screenshot
- `ai-coach` — AI financial coach with full user context
- `check-subscription`, `create-checkout`, `customer-portal`, `stripe-webhook` — Stripe billing

### Routing (`App.tsx`)
All authenticated routes wrapped in `AppLayout` → `AuthGuard`:
- `/auth`, `/onboarding` (public)
- `/home` (dashboard), `/spending`, `/goals`, `/profile`, `/scan`

### State Management
- **SubscriptionContext** — Pro subscription status (Stripe + local fallback)
- **React Query** — Server data caching
- Component-local `useState`/`useCallback`/`useMemo`

### Design System
- Tailwind CSS with HSL CSS variables for theming
- Dark mode default, class-based toggle
- Inter font family
- Base radius: 1rem

## Conventions

- Functional components only, PascalCase files for components, camelCase for utilities
- `@/` path alias for all imports (absolute preferred)
- TypeScript with relaxed strictness (no strict null checks, no implicit any checking)
- Auto-generated Supabase types in `src/integrations/supabase/types.ts` — do not edit manually
- Toast notifications via Sonner
- All edge functions include CORS headers

## Environment Variables

Frontend (`.env`): `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`

Edge functions (runtime): `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
