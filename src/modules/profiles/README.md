# Developer Profile Management System

A comprehensive developer profile management system with GitHub integration, portfolio management, skills tracking, and real-time profile analytics.

## 📁 Project Structure

```
src/modules/profiles/
├── types.ts                           # TypeScript type definitions
├── services/
│   └── ProfileService.ts              # Service layer for all profile operations
├── context/
│   └── ProfileContext.tsx             # React context provider with hooks
├── components/
│   ├── ProfileEditor.tsx              # Main profile editing form
│   ├── PortfolioManager.tsx           # Portfolio CRUD interface
│   ├── SkillsAutocomplete.tsx         # Skills search and selection
│   ├── ProfileCompletenessWidget.tsx  # Profile strength indicator
│   └── index.ts                       # Component exports
└── README.md                          # This file

supabase/functions/
└── sync-github-profile/
    └── index.ts                       # GitHub API integration edge function
```

## 🚀 Features

### Profile Management

- **Basic Information**: Headline, bio, hourly rate, location, years of experience
- **Availability Status**: Available, booked, or unavailable
- **Profile Pictures**: Upload with 2MB size limit and format validation (JPEG, PNG, WebP)
- **Skills Tracking**: Searchable skills with autocomplete, categorization, and usage analytics
- **Profile Completeness**: Real-time scoring algorithm based on 9 weighted factors

### GitHub Integration

- **Automatic Sync**: Fetch GitHub profile data, repositories, and contribution stats
- **Repository Analysis**: Automatic language statistics from top 100 repos
- **Pinned Projects**: Identifies featured repos by star count
- **Contribution Graph**: Mock data (ready for GraphQL API upgrade)

### Portfolio Management

- **Project Showcase**: Title, description, tech stack, images, and links
- **CRUD Operations**: Create, read, update, delete portfolio projects
- **Featured Projects**: Mark projects as featured
- **Drag & Drop Reordering**: Custom display order (UI implementation pending)
- **Tech Stack Tags**: Visual representation of technologies used

### Work History

- **Employment Timeline**: Company, role, dates, current position tracking
- **Rich Descriptions**: Detailed role descriptions with rich text support
- **Display Ordering**: Manual reordering of work history entries

### Analytics & Insights

- **Profile Views**: Track 7-day and 30-day view counts
- **Proposal Metrics**: Track proposals sent and response rates
- **Response Time**: Average response time tracking
- **Profile Strength**: Comprehensive scoring system

## 🏗️ Architecture

### Type System (`types.ts`)

- **DeveloperProfileExtended**: Main profile interface extending base user profile
- **GitHubData**: GitHub integration data structure
- **PortfolioProject**: Portfolio project with metadata
- **WorkHistory**: Employment history records
- **ProfileAnalytics**: Analytics and metrics data
- **ProfileCompletenessFactors**: Breakdown of profile strength factors
- **Input Types**: Payload types for create/update operations

### Service Layer (`ProfileService.ts`)

Handles all data operations with Supabase:

**Profile Operations**:

- `getProfile(userId)`: Fetch complete developer profile
- `updateProfile(userId, updates)`: Update profile fields
- `uploadProfilePicture(userId, file)`: Upload and validate profile pictures
- `calculateCompleteness(profile)`: Calculate profile strength score

**Portfolio Operations**:

- `getPortfolioProjects(userId)`: Fetch all portfolio projects
- `createPortfolioProject(userId, project)`: Add new project
- `updatePortfolioProject(projectId, updates)`: Update existing project
- `deletePortfolioProject(projectId)`: Remove project
- `reorderPortfolio(userId, projectIds)`: Change display order

**Work History Operations**:

- `getWorkHistory(userId)`: Fetch employment history
- `createWorkHistory(userId, work)`: Add work entry
- `updateWorkHistory(workId, updates)`: Update work entry
- `deleteWorkHistory(workId)`: Remove work entry

**Additional Features**:

- `syncGitHubData(userId, githubUsername)`: Trigger GitHub sync
- `searchSkills(query, limit)`: Search skills database
- `getProfileAnalytics(userId)`: Fetch analytics data

### React Context (`ProfileContext.tsx`)

Global state management with optimistic updates:

**State**:

- `profile`: Current developer profile
- `portfolio`: Array of portfolio projects
- `workHistory`: Array of work history entries
- `completeness`: Profile strength metrics
- `loading`: Loading states
- `error`: Error messages

**Hooks**:

- `useProfile()`: Access all profile state and methods

**Methods**: All service methods exposed as context methods with error handling and state updates

### UI Components

#### ProfileEditor

- Comprehensive form for all profile fields
- Real-time validation
- Profile picture upload with preview
- GitHub sync button
- Skills autocomplete integration
- Currency and availability selectors

#### PortfolioManager

- Grid layout of portfolio projects
- Add/Edit dialog with full form
- Delete confirmation
- Featured project badges
- Project cards with images, tech stack, and links

#### SkillsAutocomplete

- Debounced search (300ms)
- Multiple selection with chips
- Free-form entry supported
- Loading states
- Integration with skills database

#### ProfileCompletenessWidget

- Visual progress bar (color-coded by score)
- Missing items checklist with chips
- Real-time score updates
- Completion celebration

## 🔧 GitHub Sync Edge Function

**Location**: `supabase/functions/sync-github-profile/index.ts`

**Functionality**:

- Fetches GitHub user profile data
- Analyzes top 100 repositories
- Calculates language statistics
- Identifies pinned repositories (by stars)
- Generates contribution graph (mock data)
- Stores data in developer_profiles table

**API Endpoints**:

- GET `https://api.github.com/users/{username}`
- GET `https://api.github.com/users/{username}/repos`

**Dependencies**:

- Supabase JS SDK 2.45.2
- Deno standard library 0.224.0

**Note**: Contribution graph currently uses mock data. For production, upgrade to GitHub GraphQL API for real contribution data.

## 📊 Database Schema

### `developer_profiles`

```sql
- user_id (uuid, FK to users)
- headline (text)
- bio (text)
- hourly_rate (numeric)
- currency (text)
- availability_status (text)
- years_of_experience (integer)
- location (text)
- skills (text[])
- profile_picture_url (text)
- github_username (text)
- github_data (jsonb)
- profile_completeness (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

### `portfolio_projects`

```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- title (text)
- description (text)
- tech_stack (text[])
- project_url (text)
- github_url (text)
- image_url (text)
- featured (boolean)
- display_order (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

### `work_history`

```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- company (text)
- role (text)
- start_date (date)
- end_date (date, nullable)
- is_current (boolean)
- description (text)
- display_order (integer)
- created_at (timestamp)
- updated_at (timestamp)
```

### `profile_analytics`

```sql
- id (uuid, PK)
- user_id (uuid, FK to users)
- profile_views_7d (integer)
- profile_views_30d (integer)
- proposals_sent (integer)
- response_rate (numeric)
- avg_response_time (integer) -- in hours
- created_at (timestamp)
- updated_at (timestamp)
```

### `skills`

```sql
- id (uuid, PK)
- name (text, unique)
- category (text)
- usage_count (integer)
- created_at (timestamp)
```

## 🎯 Profile Completeness Algorithm

**Weighted Scoring System** (Total: 100 points):

- Profile Picture: 10 points
- Professional Headline: 15 points
- Bio (500+ chars): 15 points
- Skills (3+ tags): 10 points
- Hourly Rate: 10 points
- Portfolio Projects: 15 points
- Work History: 10 points
- GitHub Sync: 10 points
- Location: 5 points

## 🔐 Security Considerations

1. **File Upload Validation**:
   - 2MB size limit enforced
   - MIME type validation (image/jpeg, image/png, image/webp)
   - Secure storage in Supabase Storage

2. **GitHub Token**:
   - Stored as Supabase secret
   - Never exposed to client
   - Used only in edge function

3. **Row-Level Security**:
   - Ensure RLS policies are enabled on all tables
   - Users can only access their own data

## 📝 Usage Examples

### Basic Setup

```tsx
import { ProfileProvider } from '@/modules/profiles/context/ProfileContext';
import { ProfileEditor } from '@/modules/profiles/components';

function App() {
  return (
    <ProfileProvider>
      <ProfileEditor />
    </ProfileProvider>
  );
}
```

### Using the Profile Hook

```tsx
import { useProfile } from '@/modules/profiles/context/ProfileContext';

function MyComponent() {
  const { profile, portfolio, loading, error, updateProfile, syncGitHub } = useProfile();

  const handleSync = async () => {
    await syncGitHub();
  };

  return (
    <div>
      <h1>{profile?.headline}</h1>
      <button onClick={handleSync}>Sync GitHub</button>
    </div>
  );
}
```

### Creating a Portfolio Project

```tsx
const { createPortfolioProject } = useProfile();

const newProject = {
  title: 'E-commerce Platform',
  description: 'Full-stack e-commerce solution',
  tech_stack: ['React', 'Node.js', 'PostgreSQL'],
  project_url: 'https://example.com',
  github_url: 'https://github.com/user/repo',
  featured: true,
};

await createPortfolioProject(newProject);
```

## 🚧 Known Issues & Limitations

1. **Material-UI Grid**: The `item` prop may cause TypeScript errors in newer MUI versions. Use `Grid2` or update MUI if needed.

2. **GitHub Contribution Graph**: Currently uses mock data. Implement GraphQL API for real data:

   ```graphql
   query ($userName: String!) {
     user(login: $userName) {
       contributionsCollection {
         contributionCalendar {
           weeks {
             contributionDays {
               date
               contributionCount
             }
           }
         }
       }
     }
   }
   ```

3. **Rich Text Editor**: Bio field uses plain textarea. Consider integrating:
   - TipTap
   - Draft.js
   - Quill
   - Slate

4. **Drag & Drop**: Portfolio and work history reordering UI not yet implemented. Backend ready.

5. **Image Cropping**: Profile picture upload lacks cropping functionality.

## 🔄 Future Enhancements

- [ ] Real-time collaboration features
- [ ] PDF resume generation from profile
- [ ] Advanced analytics dashboard
- [ ] Skills endorsements system
- [ ] Profile templates/themes
- [ ] Export profile data (JSON, PDF)
- [ ] Integration with other platforms (LinkedIn, GitLab, Bitbucket)
- [ ] AI-powered bio suggestions
- [ ] Profile sharing and embedding
- [ ] Multi-language support

## 📦 Dependencies

```json
{
  "dependencies": {
    "@mui/material": "^5.x",
    "@mui/icons-material": "^5.x",
    "@supabase/supabase-js": "^2.45.2",
    "react": "^18.x"
  }
}
```

## 🤝 Contributing

1. Follow TypeScript best practices
2. Use Prettier for code formatting
3. Test all CRUD operations
4. Ensure RLS policies are respected
5. Document new features in this README

## 📄 License

[Your License Here]

## 👥 Authors

[Your Name/Team]

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Status**: Production Ready (UI components may need MUI version fixes)
