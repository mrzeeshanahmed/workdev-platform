# Developer Profile System - Implementation Guide

## Quick Start

### 1. Prerequisites

Ensure you have the following dependencies installed:

```bash
npm install @mui/material @mui/icons-material @supabase/supabase-js
```

### 2. Database Setup

Run these SQL commands in your Supabase SQL editor:

```sql
-- Developer Profiles Table
CREATE TABLE developer_profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  headline TEXT,
  bio TEXT,
  hourly_rate NUMERIC(10, 2),
  currency TEXT DEFAULT 'USD',
  availability_status TEXT DEFAULT 'available',
  years_of_experience INTEGER,
  location TEXT,
  skills TEXT[] DEFAULT '{}',
  profile_picture_url TEXT,
  github_username TEXT,
  github_data JSONB,
  profile_completeness INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Portfolio Projects Table
CREATE TABLE portfolio_projects (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  tech_stack TEXT[] DEFAULT '{}',
  project_url TEXT,
  github_url TEXT,
  image_url TEXT,
  featured BOOLEAN DEFAULT FALSE,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Work History Table
CREATE TABLE work_history (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  company TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE,
  is_current BOOLEAN DEFAULT FALSE,
  description TEXT,
  display_order INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Profile Analytics Table
CREATE TABLE profile_analytics (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  profile_views_7d INTEGER DEFAULT 0,
  profile_views_30d INTEGER DEFAULT 0,
  proposals_sent INTEGER DEFAULT 0,
  response_rate NUMERIC(5, 2) DEFAULT 0,
  avg_response_time INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Skills Table
CREATE TABLE skills (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT UNIQUE NOT NULL,
  category TEXT,
  usage_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_portfolio_user_id ON portfolio_projects(user_id);
CREATE INDEX idx_work_history_user_id ON work_history(user_id);
CREATE INDEX idx_skills_name ON skills(name);

-- Enable Row Level Security
ALTER TABLE developer_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE portfolio_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE work_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE profile_analytics ENABLE ROW LEVEL SECURITY;
ALTER TABLE skills ENABLE ROW LEVEL SECURITY;

-- RLS Policies (users can only access their own data)
CREATE POLICY "Users can view own profile" ON developer_profiles
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON developer_profiles
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON developer_profiles
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own portfolio" ON portfolio_projects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own portfolio" ON portfolio_projects
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own work history" ON work_history
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can manage own work history" ON work_history
  FOR ALL USING (auth.uid() = user_id);

CREATE POLICY "Users can view own analytics" ON profile_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Skills are publicly readable" ON skills
  FOR SELECT TO authenticated USING (true);
```

### 3. Storage Setup

Create a storage bucket for profile pictures:

```sql
-- Create storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('profile-pictures', 'profile-pictures', true);

-- RLS policy for storage
CREATE POLICY "Users can upload own profile pictures"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);

CREATE POLICY "Profile pictures are publicly readable"
ON storage.objects FOR SELECT TO authenticated
USING (bucket_id = 'profile-pictures');

CREATE POLICY "Users can update own profile pictures"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'profile-pictures' AND
  auth.uid()::text = (storage.foldername(name))[1]
);
```

### 4. Deploy GitHub Sync Edge Function

```bash
# Navigate to your Supabase functions directory
cd supabase/functions

# Deploy the function
supabase functions deploy sync-github-profile

# Set the GitHub token secret
supabase secrets set GITHUB_TOKEN=your_github_personal_access_token
```

### 5. Application Integration

#### Wrap your app with ProfileProvider

```tsx
// app/layout.tsx or app/providers.tsx
import { ProfileProvider } from '@/modules/profiles';

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <AuthProvider>
          <ProfileProvider>{children}</ProfileProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
```

#### Use the profile components

```tsx
// pages/profile/edit.tsx
import { ProfileEditor, PortfolioManager } from '@/modules/profiles';

export default function EditProfilePage() {
  return (
    <div>
      <h1>Edit Your Profile</h1>
      <ProfileEditor />
      <PortfolioManager />
    </div>
  );
}
```

#### Access profile data anywhere

```tsx
import { useProfile } from '@/modules/profiles';

export function MyComponent() {
  const { profile, loading, error } = useProfile();

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (!profile) return <div>No profile found</div>;

  return (
    <div>
      <h2>{profile.headline}</h2>
      <p>{profile.bio}</p>
    </div>
  );
}
```

## Common Use Cases

### 1. Display Profile Completeness

```tsx
import { ProfileCompletenessWidget } from '@/modules/profiles';

export function Dashboard() {
  return (
    <div>
      <ProfileCompletenessWidget />
      {/* Other dashboard content */}
    </div>
  );
}
```

### 2. Sync GitHub Data

```tsx
import { useProfile } from '@/modules/profiles';
import { Button } from '@mui/material';

export function GitHubSyncButton() {
  const { syncGitHub, loading } = useProfile();

  return (
    <Button onClick={() => syncGitHub()} disabled={loading} variant="contained">
      Sync GitHub
    </Button>
  );
}
```

### 3. Create a Portfolio Project

```tsx
import { useProfile } from '@/modules/profiles';

export function AddProjectForm() {
  const { createPortfolioProject } = useProfile();

  const handleSubmit = async (e) => {
    e.preventDefault();
    const formData = new FormData(e.target);

    await createPortfolioProject({
      title: formData.get('title'),
      description: formData.get('description'),
      tech_stack: formData.get('tech_stack').split(','),
      project_url: formData.get('project_url'),
      featured: formData.get('featured') === 'on',
    });
  };

  return <form onSubmit={handleSubmit}>{/* form fields */}</form>;
}
```

### 4. Update Profile Information

```tsx
import { useProfile } from '@/modules/profiles';

export function UpdateBioButton() {
  const { updateProfile, profile } = useProfile();

  const handleUpdate = async () => {
    await updateProfile({
      bio: 'Updated bio text here...',
      headline: 'Senior Full-Stack Developer',
    });
  };

  return <button onClick={handleUpdate}>Update Profile</button>;
}
```

### 5. Upload Profile Picture

```tsx
import { useProfile } from '@/modules/profiles';

export function ProfilePictureUploader() {
  const { uploadProfilePicture, loading } = useProfile();

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      try {
        await uploadProfilePicture(file);
        alert('Profile picture updated!');
      } catch (error) {
        alert(error.message);
      }
    }
  };

  return (
    <input
      type="file"
      accept="image/jpeg,image/png,image/webp"
      onChange={handleFileChange}
      disabled={loading}
    />
  );
}
```

## Configuration

### Environment Variables

Create a `.env.local` file:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Supabase Configuration

Update `config/supabase/client.ts`:

```typescript
import { createClient } from '@supabase/supabase-js';

export const supabaseClient = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);
```

## Troubleshooting

### Common Issues

1. **"Supabase client is not configured"**
   - Ensure environment variables are set correctly
   - Check that `supabaseClient` is imported from the correct path

2. **"Cannot upload profile picture"**
   - Verify file size is under 2MB
   - Check file format (JPEG, PNG, WebP only)
   - Ensure storage bucket exists and RLS policies are set

3. **"GitHub sync failed"**
   - Verify GitHub token is set: `supabase secrets list`
   - Check that the edge function is deployed
   - Ensure user has valid `github_username` in profile

4. **Material-UI Grid errors**
   - Update to Material-UI v5.14+ or use Grid2
   - Replace `<Grid item>` with `<Grid2>` components

5. **Skills autocomplete not working**
   - Populate skills table with initial data
   - Ensure RLS policy allows reading skills

## Testing

### Manual Testing Checklist

- [ ] Create a new developer profile
- [ ] Upload a profile picture
- [ ] Add skills using autocomplete
- [ ] Sync GitHub data
- [ ] Create a portfolio project
- [ ] Edit portfolio project details
- [ ] Delete a portfolio project
- [ ] Add work history entry
- [ ] Update work history
- [ ] Check profile completeness score
- [ ] Verify analytics data updates

### Example Test Data

```sql
-- Insert test skills
INSERT INTO skills (name, category, usage_count) VALUES
  ('JavaScript', 'Programming Language', 1500),
  ('TypeScript', 'Programming Language', 1200),
  ('React', 'Framework', 2000),
  ('Node.js', 'Runtime', 1800),
  ('Python', 'Programming Language', 1600),
  ('PostgreSQL', 'Database', 900);
```

## Performance Optimization

### Recommended Indexes

```sql
-- Add composite indexes for common queries
CREATE INDEX idx_portfolio_user_order ON portfolio_projects(user_id, display_order);
CREATE INDEX idx_work_history_user_order ON work_history(user_id, display_order);
CREATE INDEX idx_skills_category_usage ON skills(category, usage_count DESC);
```

### Caching Strategy

Consider implementing React Query for better caching:

```tsx
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5 minutes
      cacheTime: 10 * 60 * 1000, // 10 minutes
    },
  },
});

export function Providers({ children }) {
  return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
}
```

## Support

For issues or questions:

1. Check the main README.md in `src/modules/profiles/`
2. Review error messages in browser console
3. Check Supabase logs for backend errors
4. Verify RLS policies are correctly configured

---

**Last Updated**: January 2025
