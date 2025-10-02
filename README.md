# WorkDev Platform Frontend

Foundational React + TypeScript application for the WorkDev modular monolith. The stack is ready for authentication, real-time collaboration, file delivery, and payments through Supabase and Stripe.

## 🧱 Tech Stack

- React 19 with TypeScript (Create React App template)
- React Router 6 data router APIs
- Material UI 7 for UI components and theming
- React Query 5 for data fetching and caching
- React Hook Form for ergonomic form handling
- Supabase client SDK v2
- Stripe Elements for payment flows
- ESLint + Prettier + Husky + lint-staged for code quality

## 📁 Project Structure

```
workdev-platform/
├── src/
│   ├── config/
│   │   └── supabase/
│   │       └── client.ts          # Supabase singleton (lazy loaded)
│   ├── modules/                   # Feature modules in the modular monolith
│   │   ├── auth/
│   │   ├── profiles/
│   │   ├── marketplace/
│   │   ├── projects/
│   │   └── workspace/
│   ├── providers/                 # Cross-cutting providers (theme, query, Stripe)
│   ├── routes/                    # Centralised router and module route config
│   ├── shared/                    # Reusable components, hooks, utils, theming
│   ├── types/                     # Domain-wide TypeScript types
│   └── App.tsx / index.tsx        # Application entry points
├── supabase/                      # Placeholder for SQL migrations, metadata, policies
├── .env.example                   # Required environment variables
└── README.md
```

Each module currently exposes a placeholder screen. Swap these with real pages as features land while keeping the module boundaries intact.

## 🔧 Environment Variables

Copy `.env.example` to `.env.local` and populate values before running the app:

```bash
REACT_APP_SUPABASE_URL=<https://project.supabase.co>
REACT_APP_SUPABASE_ANON_KEY=<public-anon-key>
REACT_APP_STRIPE_PUBLIC_KEY=<pk_live_or_pk_test>
```

In test mode the Stripe provider safely no-ops when the key is absent.

## 🚀 Development Scripts

| Command | Description |
| --- | --- |
| `npm start` | Launch the dev server on http://localhost:3000 |
| `npm test` | Run Jest + Testing Library in watch mode |
| `npm test -- --watch=false` | CI-friendly test run |
| `npm run build` | Production build with React Scripts |
| `npm run lint` / `npm run lint:fix` | ESLint against the `src` tree |
| `npm run format` / `npm run format:check` | Prettier formatting |

Husky installs a `pre-commit` hook (via the `prepare` script) that runs lint-staged. Staged TypeScript/JavaScript/JSX files are linted and prettified automatically.

## 🧭 Architectural Guidelines

- Treat `src/modules/*` as isolated domains. Keep UI, hooks, and service logic under the owning module.
- Share cross-cutting concerns through `src/shared` (components, hooks, utils) or `src/providers`.
- Registered routes live in `src/routes/router.tsx`; extend the `moduleRoutes` array when adding new pages.
- Use React Query for API calls and Supabase client access to stay consistent with caching and real-time workflows.

## ✅ Next Steps

1. Wire Supabase auth (email/password, OAuth, magic links) inside the `auth` module.
2. Connect React Query mutation/query hooks to backend endpoints or Supabase RPC functions.
3. Extend Stripe integration with product/pricing configuration and secure server-side payment intents.
4. Add Cypress or Playwright for module-level smoke tests as features mature.

Happy building! Let the modular monolith grow alongside the WorkDev platform roadmap.
