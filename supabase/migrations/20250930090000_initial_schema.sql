-- Requires Supabase (PostgreSQL 14+)

-- Extensions
create extension if not exists "pgcrypto";
create extension if not exists "pg_trgm";
create extension if not exists "citext";

-- Reusable function for automatic updated_at timestamp
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$ language plpgsql;

-- Enumerated types
create type user_role as enum ('client', 'developer', 'admin');
create type availability_status as enum ('available', 'unavailable', 'booked');
create type project_status as enum ('draft', 'open', 'in_progress', 'paused', 'completed', 'cancelled');
create type project_budget_type as enum ('fixed', 'hourly');
create type proposal_status as enum ('pending', 'accepted', 'declined', 'withdrawn', 'expired');
create type workspace_member_role as enum ('client', 'developer', 'manager', 'observer');
create type milestone_status as enum ('pending', 'in_review', 'approved', 'paid', 'cancelled');
create type transaction_type as enum ('escrow_funded', 'milestone_paid', 'refund', 'adjustment', 'platform_fee');
create type transaction_status as enum ('pending', 'processing', 'completed', 'failed', 'refunded');
create type review_direction as enum ('client_to_developer', 'developer_to_client');

-- Core data tables
create table public.users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique references auth.users(id) on delete set null,
  email citext unique not null,
  role user_role not null default 'developer',
  display_name text,
  avatar_url text,
  timezone text,
  country_code char(2),
  headline text,
  bio text,
  metadata jsonb default '{}'::jsonb,
  last_active_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index users_role_idx on public.users(role);
create index users_last_active_idx on public.users(last_active_at desc);
create index users_country_idx on public.users(country_code);

create table public.client_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  company_name text,
  company_size text,
  website_url text,
  verified boolean not null default false,
  hiring_preferences jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index client_profiles_verified_idx on public.client_profiles(verified);

create table public.developer_profiles (
  user_id uuid primary key references public.users(id) on delete cascade,
  headline text,
  bio text,
  hourly_rate numeric(10,2),
  currency char(3) not null default 'USD',
  availability availability_status not null default 'available',
  years_of_experience int,
  location text,
  github_data jsonb,
  portfolio_urls text[],
  is_vetted boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (hourly_rate is null or hourly_rate >= 0),
  check (years_of_experience is null or years_of_experience >= 0)
);

create index developer_profiles_availability_idx on public.developer_profiles(availability);
create index developer_profiles_rate_idx on public.developer_profiles(hourly_rate);

create table public.skills (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  category text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table public.developer_skills (
  developer_id uuid references public.developer_profiles(user_id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  proficiency smallint check (proficiency between 1 and 5),
  years_experience numeric(4,1),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (years_experience is null or years_experience >= 0),
  primary key (developer_id, skill_id)
);

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.users(id) on delete cascade,
  title text not null,
  slug text not null unique,
  summary text,
  description text,
  status project_status not null default 'draft',
  budget_type project_budget_type not null default 'fixed',
  budget_amount numeric(12,2),
  hourly_rate_min numeric(10,2),
  hourly_rate_max numeric(10,2),
  currency char(3) not null default 'USD',
  estimated_hours int,
  expected_start_date date,
  expected_end_date date,
  tags text[],
  location text,
  remote boolean not null default true,
  requires_vetting boolean not null default false,
  search_document tsvector generated always as (
    setweight(to_tsvector('english', coalesce(title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(summary, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(description, '')), 'C')
  ) stored,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (budget_amount is null or budget_amount >= 0),
  check (hourly_rate_min is null or hourly_rate_min >= 0),
  check (hourly_rate_max is null or hourly_rate_max >= 0),
  check (
    hourly_rate_min is null or hourly_rate_max is null or hourly_rate_min <= hourly_rate_max
  ),
  check (estimated_hours is null or estimated_hours > 0)
);

create index projects_client_idx on public.projects(client_id);
create index projects_status_idx on public.projects(status);
create index projects_created_idx on public.projects(created_at desc);
create index projects_search_idx on public.projects using gin (search_document);
create index projects_tags_idx on public.projects using gin (tags);

create table public.project_skills (
  project_id uuid references public.projects(id) on delete cascade,
  skill_id uuid references public.skills(id) on delete cascade,
  required_level smallint check (required_level between 1 and 5),
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (project_id, skill_id)
);

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  developer_id uuid not null references public.users(id) on delete cascade,
  cover_letter text,
  proposed_rate numeric(10,2),
  proposed_currency char(3) not null default 'USD',
  estimated_hours int,
  attachments jsonb default '[]'::jsonb,
  status proposal_status not null default 'pending',
  client_message text,
  submitted_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (proposed_rate is null or proposed_rate >= 0),
  check (estimated_hours is null or estimated_hours > 0),
  unique (project_id, developer_id)
);

create index proposals_project_idx on public.proposals(project_id, status);
create index proposals_developer_idx on public.proposals(developer_id, status);
create index proposals_submitted_idx on public.proposals(submitted_at desc);

create table public.project_invitations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  developer_id uuid not null references public.users(id) on delete cascade,
  message text,
  responded_at timestamptz,
  status proposal_status not null default 'pending',
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  unique (project_id, developer_id)
);

create index project_invitations_developer_idx on public.project_invitations(developer_id, status);
create index project_invitations_project_idx on public.project_invitations(project_id, status);

create table public.workspaces (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null unique references public.projects(id) on delete cascade,
  created_by uuid not null references public.users(id) on delete set null,
  is_active boolean not null default true,
  last_activity_at timestamptz,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create index workspaces_active_idx on public.workspaces(is_active);
create index workspaces_last_activity_idx on public.workspaces(last_activity_at desc);

create table public.workspace_members (
  workspace_id uuid references public.workspaces(id) on delete cascade,
  user_id uuid references public.users(id) on delete cascade,
  role workspace_member_role not null,
  joined_at timestamptz not null default timezone('utc', now()),
  invited_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (workspace_id, user_id)
);

create index workspace_members_user_idx on public.workspace_members(user_id);

create table public.milestones (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  title text not null,
  description text,
  sequence int not null,
  amount numeric(12,2) not null,
  currency char(3) not null default 'USD',
  due_date date,
  status milestone_status not null default 'pending',
  released_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (amount > 0),
  unique (project_id, sequence)
);

create index milestones_project_idx on public.milestones(project_id, status);
create index milestones_due_date_idx on public.milestones(due_date);
create index milestones_workspace_idx on public.milestones(workspace_id);

create table public.transactions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  milestone_id uuid references public.milestones(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  payer_id uuid references public.users(id) on delete set null,
  payee_id uuid references public.users(id) on delete set null,
  type transaction_type not null,
  status transaction_status not null default 'pending',
  amount numeric(12,2) not null,
  currency char(3) not null default 'USD',
  external_reference text,
  metadata jsonb default '{}'::jsonb,
  processed_at timestamptz,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (amount >= 0)
);

create index transactions_project_idx on public.transactions(project_id, status);
create index transactions_payee_idx on public.transactions(payee_id, status);
create index transactions_payer_idx on public.transactions(payer_id, status);
create index transactions_type_idx on public.transactions(type);
create index transactions_created_idx on public.transactions(created_at desc);

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects(id) on delete cascade,
  workspace_id uuid references public.workspaces(id) on delete set null,
  reviewer_id uuid not null references public.users(id) on delete cascade,
  reviewee_id uuid not null references public.users(id) on delete cascade,
  direction review_direction not null,
  rating smallint not null check (rating between 1 and 5),
  title text,
  body text,
  recommend boolean,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (reviewer_id <> reviewee_id),
  unique (project_id, reviewer_id, reviewee_id, direction)
);

create index reviews_reviewee_idx on public.reviews(reviewee_id);
create index reviews_project_idx on public.reviews(project_id);
create index reviews_direction_idx on public.reviews(direction);

create table public.workspace_files (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  uploaded_by uuid not null references public.users(id) on delete set null,
  storage_path text not null,
  file_name text not null,
  file_size bigint,
  file_type text,
  visibility text not null default 'workspace',
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  check (file_size is null or file_size >= 0)
);

create index workspace_files_workspace_idx on public.workspace_files(workspace_id);
create index workspace_files_uploader_idx on public.workspace_files(uploaded_by);
create index workspace_files_created_idx on public.workspace_files(created_at desc);

-- Audit helpers
create table public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  workspace_id uuid references public.workspaces(id) on delete set null,
  entity_type text not null,
  entity_id uuid,
  action text not null,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index activity_logs_project_idx on public.activity_logs(project_id);
create index activity_logs_workspace_idx on public.activity_logs(workspace_id);
create index activity_logs_actor_idx on public.activity_logs(actor_id);
create index activity_logs_created_idx on public.activity_logs(created_at desc);

-- Updated_at triggers
create trigger set_users_updated_at
before update on public.users
for each row execute function public.set_updated_at();

create trigger set_client_profiles_updated_at
before update on public.client_profiles
for each row execute function public.set_updated_at();

create trigger set_developer_profiles_updated_at
before update on public.developer_profiles
for each row execute function public.set_updated_at();

create trigger set_skills_updated_at
before update on public.skills
for each row execute function public.set_updated_at();

create trigger set_developer_skills_updated_at
before update on public.developer_skills
for each row execute function public.set_updated_at();

create trigger set_projects_updated_at
before update on public.projects
for each row execute function public.set_updated_at();

create trigger set_project_skills_updated_at
before update on public.project_skills
for each row execute function public.set_updated_at();

create trigger set_proposals_updated_at
before update on public.proposals
for each row execute function public.set_updated_at();

create trigger set_project_invitations_updated_at
before update on public.project_invitations
for each row execute function public.set_updated_at();

create trigger set_workspaces_updated_at
before update on public.workspaces
for each row execute function public.set_updated_at();

create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row execute function public.set_updated_at();

create trigger set_milestones_updated_at
before update on public.milestones
for each row execute function public.set_updated_at();

create trigger set_transactions_updated_at
before update on public.transactions
for each row execute function public.set_updated_at();

create trigger set_reviews_updated_at
before update on public.reviews
for each row execute function public.set_updated_at();

create trigger set_workspace_files_updated_at
before update on public.workspace_files
for each row execute function public.set_updated_at();

-- Security helper functions used by RLS policies
create or replace function public.current_user_id()
returns uuid
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  result uuid;
begin
  if uid is null then
    return null;
  end if;

  select u.id into result
  from public.users u
  where u.auth_user_id = uid;

  return result;
end;
$$;

create or replace function public.is_admin()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  uid uuid := auth.uid();
  is_admin boolean;
begin
  if uid is null then
    return false;
  end if;

  select u.role = 'admin' into is_admin
  from public.users u
  where u.auth_user_id = uid;

  return coalesce(is_admin, false);
end;
$$;

create or replace function public.is_workspace_member(target_workspace uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_id uuid := public.current_user_id();
begin
  if public.is_admin() then
    return true;
  end if;

  if current_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.workspace_members wm
    where wm.workspace_id = target_workspace
      and wm.user_id = current_id
  );
end;
$$;

create or replace function public.can_access_project(target_project uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  current_id uuid := public.current_user_id();
begin
  if public.is_admin() then
    return true;
  end if;

  if current_id is null then
    return false;
  end if;

  return exists (
    select 1
    from public.projects p
    where p.id = target_project
      and (p.client_id = current_id or p.status = 'open')
  )
  or exists (
    select 1
    from public.workspaces w
    join public.workspace_members wm on wm.workspace_id = w.id
    where w.project_id = target_project
      and wm.user_id = current_id
  )
  or exists (
    select 1
    from public.proposals pr
    where pr.project_id = target_project
      and pr.developer_id = current_id
  )
  or exists (
    select 1
    from public.project_invitations pi
    where pi.project_id = target_project
      and pi.developer_id = current_id
  );
end;
$$;

-- Enable Row Level Security on all tables
alter table public.users enable row level security;
alter table public.users force row level security;
alter table public.client_profiles enable row level security;
alter table public.client_profiles force row level security;
alter table public.developer_profiles enable row level security;
alter table public.developer_profiles force row level security;
alter table public.skills enable row level security;
alter table public.skills force row level security;
alter table public.developer_skills enable row level security;
alter table public.developer_skills force row level security;
alter table public.projects enable row level security;
alter table public.projects force row level security;
alter table public.project_skills enable row level security;
alter table public.project_skills force row level security;
alter table public.proposals enable row level security;
alter table public.proposals force row level security;
alter table public.project_invitations enable row level security;
alter table public.project_invitations force row level security;
alter table public.workspaces enable row level security;
alter table public.workspaces force row level security;
alter table public.workspace_members enable row level security;
alter table public.workspace_members force row level security;
alter table public.milestones enable row level security;
alter table public.milestones force row level security;
alter table public.transactions enable row level security;
alter table public.transactions force row level security;
alter table public.reviews enable row level security;
alter table public.reviews force row level security;
alter table public.workspace_files enable row level security;
alter table public.workspace_files force row level security;
alter table public.activity_logs enable row level security;
alter table public.activity_logs force row level security;

-- Users table policies
create policy "Users can view their own record or admin" on public.users
for select
using (
  public.is_admin() or auth.uid() = auth_user_id
);

create policy "Users can insert their own record" on public.users
for insert
with check (
  public.is_admin() or auth.uid() = auth_user_id
);

create policy "Users can update their own record" on public.users
for update
using (
  public.is_admin() or auth.uid() = auth_user_id
)
with check (
  public.is_admin() or auth.uid() = auth_user_id
);

create policy "Users can delete their own record" on public.users
for delete
using (
  public.is_admin() or auth.uid() = auth_user_id
);

-- Client profile policies
create policy "Clients viewable by owner or collaborators" on public.client_profiles
for select
using (
  public.is_admin() or user_id = public.current_user_id() or exists (
    select 1
    from public.projects p
    join public.workspaces w on w.project_id = p.id
    join public.workspace_members wm on wm.workspace_id = w.id
    where p.client_id = client_profiles.user_id
      and wm.user_id = public.current_user_id()
  )
);

create policy "Clients insert own profile" on public.client_profiles
for insert
with check (
  public.is_admin() or (
    user_id = public.current_user_id() and exists (
      select 1 from public.users u where u.id = user_id and u.role = 'client'
    )
  )
);

create policy "Clients update own profile" on public.client_profiles
for update
using (
  public.is_admin() or user_id = public.current_user_id()
)
with check (
  public.is_admin() or user_id = public.current_user_id()
);

create policy "Clients delete own profile" on public.client_profiles
for delete
using (
  public.is_admin() or user_id = public.current_user_id()
);

-- Developer profile policies
create policy "Anyone can view developer profiles" on public.developer_profiles
for select
using (true);

create policy "Developers insert their profile" on public.developer_profiles
for insert
with check (
  public.is_admin() or (
    user_id = public.current_user_id() and exists (
      select 1 from public.users u where u.id = user_id and u.role = 'developer'
    )
  )
);

create policy "Developers update their profile" on public.developer_profiles
for update
using (
  public.is_admin() or user_id = public.current_user_id()
)
with check (
  public.is_admin() or user_id = public.current_user_id()
);

create policy "Admins remove developer profiles" on public.developer_profiles
for delete
using (public.is_admin());

-- Skills policies
create policy "Skills visible to everyone" on public.skills
for select
using (true);

create policy "Only admins manage skills" on public.skills
for all
using (public.is_admin())
with check (public.is_admin());

-- Developer skills policies
create policy "Developer skills readable" on public.developer_skills
for select
using (true);

create policy "Developers manage their skills" on public.developer_skills
for insert
with check (
  public.is_admin() or developer_id = public.current_user_id()
);

create policy "Developers update their skills" on public.developer_skills
for update
using (
  public.is_admin() or developer_id = public.current_user_id()
)
with check (
  public.is_admin() or developer_id = public.current_user_id()
);

create policy "Developers remove their skills" on public.developer_skills
for delete
using (
  public.is_admin() or developer_id = public.current_user_id()
);

-- Projects policies
create policy "Projects available to public or stakeholders" on public.projects
for select
using (
  public.is_admin()
  or status = 'open'
  or client_id = public.current_user_id()
  or public.can_access_project(id)
);

create policy "Clients create projects" on public.projects
for insert
with check (
  public.is_admin() or (
    client_id = public.current_user_id() and exists (
      select 1 from public.users u where u.id = client_id and u.role = 'client'
    )
  )
);

create policy "Clients update their projects" on public.projects
for update
using (
  public.is_admin() or client_id = public.current_user_id()
)
with check (
  public.is_admin() or client_id = public.current_user_id()
);

create policy "Clients delete their projects" on public.projects
for delete
using (
  public.is_admin() or client_id = public.current_user_id()
);

-- Project skills policies
create policy "Project skills visible with project" on public.project_skills
for select
using (
  public.is_admin() or public.can_access_project(project_id)
);

create policy "Clients manage project skills" on public.project_skills
for all
using (
  public.is_admin() or exists (
    select 1 from public.projects p
    where p.id = project_id and p.client_id = public.current_user_id()
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.projects p
    where p.id = project_id and p.client_id = public.current_user_id()
  )
);

-- Proposals policies
create policy "Proposals visible to stakeholders" on public.proposals
for select
using (
  public.is_admin()
  or developer_id = public.current_user_id()
  or exists (
    select 1 from public.projects p
    where p.id = proposals.project_id
      and p.client_id = public.current_user_id()
  )
);

create policy "Developers submit proposals" on public.proposals
for insert
with check (
  public.is_admin() or (
    developer_id = public.current_user_id()
    and exists (
      select 1 from public.users u where u.id = developer_id and u.role = 'developer'
    )
  )
);

create policy "Developers update pending proposals" on public.proposals
for update
using (
  public.is_admin() or (developer_id = public.current_user_id() and status = 'pending')
)
with check (
  public.is_admin() or (developer_id = public.current_user_id())
);

create policy "Developers delete pending proposals" on public.proposals
for delete
using (
  public.is_admin() or (developer_id = public.current_user_id() and status = 'pending')
);

-- Project invitations policies
create policy "Invitations visible to participants" on public.project_invitations
for select
using (
  public.is_admin()
  or developer_id = public.current_user_id()
  or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

create policy "Clients send invitations" on public.project_invitations
for insert
with check (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

create policy "Clients update invitations" on public.project_invitations
for update
using (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

create policy "Clients delete invitations" on public.project_invitations
for delete
using (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

-- Workspaces policies
create policy "Workspaces visible to members" on public.workspaces
for select
using (
  public.is_admin()
  or exists (
    select 1 from public.projects p
    where p.id = workspaces.project_id
      and p.client_id = public.current_user_id()
  )
  or public.is_workspace_member(id)
);

create policy "Clients manage workspaces" on public.workspaces
for all
using (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

-- Workspace members policies
create policy "Members can view workspace roster" on public.workspace_members
for select
using (
  public.is_admin()
  or public.is_workspace_member(workspace_id)
  or exists (
    select 1 from public.workspaces w
    join public.projects p on p.id = w.project_id
    where w.id = workspace_id and p.client_id = public.current_user_id()
  )
);

create policy "Managers manage workspace members" on public.workspace_members
for all
using (
  public.is_admin()
  or exists (
    select 1 from public.workspace_members wm2
    where wm2.workspace_id = workspace_members.workspace_id
      and wm2.user_id = public.current_user_id()
      and wm2.role in ('client', 'manager')
  )
)
with check (
  public.is_admin()
  or exists (
    select 1 from public.workspace_members wm2
    where wm2.workspace_id = workspace_members.workspace_id
      and wm2.user_id = public.current_user_id()
      and wm2.role in ('client', 'manager')
  )
);

-- Milestones policies
create policy "Milestones visible to stakeholders" on public.milestones
for select
using (
  public.is_admin() or public.can_access_project(project_id) or public.is_workspace_member(workspace_id)
);

create policy "Clients manage milestones" on public.milestones
for all
using (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
)
with check (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

-- Transactions policies
create policy "Transactions visible to parties" on public.transactions
for select
using (
  public.is_admin()
  or payer_id = public.current_user_id()
  or payee_id = public.current_user_id()
  or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

create policy "Project owners log transactions" on public.transactions
for insert
with check (
  public.is_admin() or exists (
    select 1 from public.projects p where p.id = project_id and p.client_id = public.current_user_id()
  )
);

create policy "Admins update transactions" on public.transactions
for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete transactions" on public.transactions
for delete
using (public.is_admin());

-- Reviews policies
create policy "Reviews visible to everyone" on public.reviews
for select
using (true);

create policy "Reviewers create reviews" on public.reviews
for insert
with check (
  public.is_admin() or reviewer_id = public.current_user_id()
);

create policy "Reviewers update their reviews" on public.reviews
for update
using (
  public.is_admin() or reviewer_id = public.current_user_id()
)
with check (
  public.is_admin() or reviewer_id = public.current_user_id()
);

create policy "Reviewers delete their reviews" on public.reviews
for delete
using (
  public.is_admin() or reviewer_id = public.current_user_id()
);

-- Workspace files policies
create policy "Workspace files visible to members" on public.workspace_files
for select
using (
  public.is_admin() or public.is_workspace_member(workspace_id)
);

create policy "Workspace members upload files" on public.workspace_files
for insert
with check (
  public.is_admin() or (
    uploaded_by = public.current_user_id() and public.is_workspace_member(workspace_id)
  )
);

create policy "Workspace members update files" on public.workspace_files
for update
using (
  public.is_admin() or uploaded_by = public.current_user_id()
)
with check (
  public.is_admin() or uploaded_by = public.current_user_id()
);

create policy "File owners delete files" on public.workspace_files
for delete
using (
  public.is_admin() or uploaded_by = public.current_user_id()
);

-- Activity logs policies
create policy "Activity logs visible to stakeholders" on public.activity_logs
for select
using (
  public.is_admin()
  or (project_id is not null and public.can_access_project(project_id))
  or (workspace_id is not null and public.is_workspace_member(workspace_id))
);

create policy "Stakeholders add activity logs" on public.activity_logs
for insert
with check (
  public.is_admin()
  or (project_id is not null and public.can_access_project(project_id))
  or (workspace_id is not null and public.is_workspace_member(workspace_id))
);

create policy "Admins manage activity logs" on public.activity_logs
for update
using (public.is_admin())
with check (public.is_admin());

create policy "Admins delete activity logs" on public.activity_logs
for delete
using (public.is_admin());

-- Testing guidance (execute with elevated roles during verification)
-- set role service_role; -- should bypass RLS for migrations/tests
-- reset role;
