# WorkDev Platform - AI Coding Agent Instructions

## Project Overview

This is a **modular monolith** React + TypeScript freelance marketplace platform connecting clients with developers. The architecture emphasizes feature isolation through domain modules while sharing common infrastructure.

## Architecture Principles

### Modular Monolith Structure
- **Feature modules** live in `src/modules/{moduleName}/` with self-contained services, context, components, and types
- Each module exports through an `index.ts` barrel file: `export * from './types'`, `export { serviceName } from './services/ServiceName'`
- **Never cross-import between modules** - use shared utilities or lift common code to `src/shared/`
- Modules communicate through the router (`src/routes/router.tsx`) and shared context providers

### Key Modules & Their Responsibilities
- **auth**: Authentication, MFA (TOTP + backup codes), OAuth (GitHub/Google), role-based access (client/developer/admin)
- **profiles**: Developer profile management, GitHub integration, portfolio projects, work history, skills autocomplete
- **marketplace**: Project listings with PostgreSQL full-text search (tsvector + GIN indexes), multi-criteria filtering, featured projects
- **clients**: Client profiles, two-way review system (mutual visibility), reputation metrics, hiring history
- **directory**: Developer directory with search and filtering
- **analytics**: Real-time event streaming pipeline, data warehouse integration (BigQuery/Redshift), metrics aggregation, ML-ready data

### Service Layer Pattern (Critical!)
All modules use **singleton service classes** for data operations:
```typescript
// Pattern: One service class per module, exported as singleton
export class ProfileService {
  private constructor() {} // Singleton
  async getProfile(userId: string) { /* ... */ }
}
export const profileService = new ProfileService();
```
- Services handle Supabase client calls, error handling, and business logic
- Import the singleton instance: `import { profileService } from '@/modules/profiles'`
- Never instantiate service classes - always use the exported singleton

### Context Provider Pattern
Each major module has a React Context for global state:
```typescript
// Pattern: Context + Provider + custom hook
const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);
export const ProfileProvider = ({ children }) => { /* state + methods */ };
export const useProfile = () => useContext(ProfileContext); // Custom hook
```
- Providers wrap the app in `src/providers/AppProviders.tsx`
- Use `useCallback` for stable function references in context values
- Context methods call service layer functions and manage local state

## Critical Patterns & Conventions

### Import Path Resolution
- Use **path aliases** from `tsconfig.json` (baseUrl: "src")
- Correct: `import { useAuth } from 'modules/auth/hooks/useAuth'`
- Correct: `import { theme } from 'shared/theme'`
- **NEVER** use relative paths like `../../modules/auth`

### Type Safety
- Every module has a `types.ts` file with comprehensive interfaces
- Use `Partial<T>` for update payloads: `ProfileUpdatePayload = Partial<Pick<Profile, 'bio' | 'headline'>>`
- Supabase types live in `src/types/supabase.ts` - regenerate with `supabase gen types typescript`

### Database Interaction
- **PostgreSQL via Supabase** client (singleton in `src/config/supabase/client.ts`)
- Use Row Level Security (RLS) policies - never bypass with service role keys in client code
- Advanced features in use:
  - Full-text search with `search_vector` (generated columns + GIN indexes)
  - Array containment with `@>` operator for skills filtering
  - JSONB for flexible data (filters, OAuth tokens, event metadata)
  - Triggers for automated calculations (review visibility, reputation stats, event emission)
  - Database functions called via RPC: `emit_platform_event()`, `get_pending_events()`, `update_realtime_metric()`

### Component Patterns
- **Material-UI v7** for all UI components (`@mui/material`, `@mui/icons-material`)
- Lazy load page components: `const Page = lazy(() => import('modules/x/pages/Page'))`
- Wrap lazy components with `<Suspense fallback={<LoadingScreen />}>`
- Use React Hook Form for complex forms (already in package.json)

### Routing
- React Router 6 with data router APIs (`createBrowserRouter`)
- Routes defined in `src/routes/router.tsx` with `moduleRoutes` array
- Role-based protection via `<ProtectedRoute allowedRoles={['client', 'admin']}>` wrapper
- Index routes use `{ index: true }`, nested routes use `path: 'relative-path'`

### State Management
- **React Query (TanStack Query v5)** for server state (configured in `AppProviders.tsx`)
- React Context for global app state (auth, profiles, marketplace)
- Local component state with `useState` for UI-only state

## Development Workflows

### Running the App
```bash
npm start              # Dev server (localhost:3000)
npm test              # Jest + Testing Library (watch mode)
npm run build         # Production build
npm run lint:fix      # ESLint auto-fix
npm run format        # Prettier format all files
```

### Pre-commit Automation
- Husky runs lint-staged on commit
- Auto-lints and formats staged files
- **Never commit without passing lint** (max-warnings=0)

### Database Migrations
- Migrations in `supabase/migrations/YYYYMMDD_description.sql`
- Apply with: `psql -U postgres -d workdev_db -f supabase/migrations/file.sql`
- Or use Supabase CLI: `supabase db push`

### Adding a New Feature Module
1. Create `src/modules/{module}/` directory structure
2. Add `types.ts`, `services/Service.ts` (singleton pattern), `context/Context.tsx`
3. Create components in `components/` with barrel export `index.ts`
4. Export module interface via `src/modules/{module}/index.ts`
5. Add routes to `moduleRoutes` array in `router.tsx`
6. Wire context provider into `AppProviders.tsx` if needed

## Event Tracking (Analytics Module)

### Track User Actions
- **Always emit events** for significant user actions (project created, proposal submitted, profile viewed)
- Use `analyticsService` singleton: `import { analyticsService } from 'modules/analytics'`
- Initialize session on app load: `await analyticsService.initSession()`
- Events are async - use fire-and-forget pattern: `void analyticsService.trackX()`

### Event Types Follow Conventions
- Format: `entity.action` (e.g., `project.created`, `review.posted`)
- Categories: `transaction`, `interaction`, `user_activity`, `content`, `system`
- Retention varies: financial (7 years), security (2 years), interaction (1 year)

### Example Integrations
```typescript
// After creating a project
const project = await createProject(data);
await analyticsService.trackProjectCreated(project.id, data);

// After viewing a profile
const profile = await getProfile(userId);
void analyticsService.trackProfileViewed(userId); // Fire-and-forget
```

## Common Gotchas & Solutions

### Module Imports Failing
- Check `tsconfig.json` baseUrl is "src"
- Use absolute paths from src root: `import { X } from 'modules/auth'`, not `from '../auth'`

### Supabase Client Null Error
- Client is lazily loaded - check env vars: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_ANON_KEY`
- Guard against null: `if (!supabaseClient) throw new Error('Supabase not configured')`

### MUI Grid Warnings (Known Issue)
- MUI v7 has breaking changes for Grid `item` prop
- Use `Grid2` component for new code
- Existing warnings are non-blocking (documented in module READMEs)

### Search Performance Issues
- Check GIN indexes exist: `\di` in psql, look for `idx_projects_search`
- Verify search_vector is populated: `SELECT search_vector FROM projects LIMIT 1`
- Use `EXPLAIN ANALYZE` to debug slow queries

### Authentication Flow
- OAuth redirects store pending role in sessionStorage: `workdev:pending_oauth_role`
- Auth context finalizes registration on redirect callback
- GitHub/Google tokens stored in encrypted user metadata, retrieved via edge functions

### Analytics Pipeline Not Processing
- Check edge function is deployed: `supabase functions list`
- Verify pg_cron is running: `SELECT * FROM cron.job WHERE jobname = 'stream-events'`
- Check warehouse sync status: `SELECT * FROM warehouse_sync_status ORDER BY created_at DESC LIMIT 5`
- Events stuck in pending: increase batch size or reduce cron frequency

## Key Files Reference

- **Router**: `src/routes/router.tsx` - Add new module routes here
- **App Providers**: `src/providers/AppProviders.tsx` - Wrap with new context providers
- **Supabase Client**: `src/config/supabase/client.ts` - Singleton, check for null
- **Auth Context**: `src/modules/auth/context/AuthContext.tsx` - User session, roles, MFA
- **Theme**: `src/shared/theme/index.ts` - MUI theme customization

## Testing Expectations

- Write tests for service methods (data transformations, business logic)
- Use `@testing-library/react` for component tests
- Mock Supabase client in tests: `jest.mock('config/supabase/client')`
- Test RLS policies with different user contexts in Supabase dashboard

## Performance Considerations

- **Debounce search inputs** (500ms for text, 300ms for autocomplete) - use `src/hooks/useDebounce.ts`
- Pagination via range queries: `.range(from, to)` instead of offset/limit
- Featured projects expire via cron trigger: `expire_featured_projects()` function
- Profile completeness calculated server-side to avoid client computation

## Security Notes

- **Never expose service role keys** - use RLS policies exclusively
- File uploads validated: 2MB max, image types only (JPEG/PNG/WebP/SVG)
- OAuth tokens encrypted in user metadata, accessed via Supabase edge functions
- Review system uses mutual visibility trigger - both parties must submit before public

## When in Doubt

1. Check module's `README.md` for detailed examples and patterns
2. Look at similar existing modules for consistent patterns
3. Use service layer singletons - never duplicate Supabase logic in components
4. Follow the modular monolith principle - modules should be replaceable units
