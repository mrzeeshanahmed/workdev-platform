# Supabase Resources

This directory is reserved for Supabase configuration, SQL migrations, and metadata required to support the WorkDev platform backend.

- Place SQL migration scripts under `supabase/migrations`.
- Store seed data under `supabase/seed`.
- Client-side integration lives inside `src/config/supabase` for compatibility with Create React App.
- Apply migrations locally with `supabase db reset --skip-seed` (destructive) or `supabase db push`.
- Current baseline schema: `20250930090000_initial_schema.sql`.
