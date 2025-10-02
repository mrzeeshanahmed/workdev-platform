# GitHub API Integration Service

Comprehensive GitHub integration with scheduled syncing, rate limiting, caching, and verifiable coding credentials.

## Features

### ✨ Core Capabilities

- **Scheduled Daily Sync**: Automatically refresh GitHub data for all developers
- **Smart Caching**: 24-hour cache to reduce API calls and respect rate limits
- **Rate Limit Management**: Automatic detection, waiting, and retry logic
- **Token Validation**: Graceful handling of expired or revoked OAuth tokens
- **Error Recovery**: Exponential backoff retry strategy for transient failures
- **GraphQL Integration**: Real contribution graph data (with REST fallback)
- **Filtered Data**: Excludes forks, includes only starred or recently active repos

### 📊 Data Collection

- **User Profile**: Name, bio, avatar, location, company, social links
- **Repository Stats**: Public repos, total stars, total forks
- **Top Languages**: Language usage statistics across repositories
- **Pinned Projects**: Top 6 repositories by star count
- **Contribution Graph**: 365 days of contribution data with intensity levels
- **Account Metadata**: Account creation date, followers, following

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend Application                      │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        GitHubIntegrationService.ts                    │  │
│  │  - syncDeveloperGitHubData()                          │  │
│  │  - validateGitHubToken()                              │  │
│  │  - getCachedGitHubData()                              │  │
│  │  - getContributionStats()                             │  │
│  │  - calculateProfileStrength()                         │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ Supabase Functions Invoke
                          ▼
┌─────────────────────────────────────────────────────────────┐
│               Supabase Edge Function                         │
│  ┌──────────────────────────────────────────────────────┐  │
│  │        sync-github-data/index.ts                      │  │
│  │                                                        │  │
│  │  User Sync Endpoint:                                  │  │
│  │  POST / { userId, forceRefresh }                      │  │
│  │                                                        │  │
│  │  Scheduled Sync Endpoint:                             │  │
│  │  POST /?action=sync-all (with CRON_SECRET)           │  │
│  │                                                        │  │
│  │  Functions:                                            │  │
│  │  - validateGitHubToken()                              │  │
│  │  - fetchGitHubData()                                  │  │
│  │  - fetchContributionGraphQL()                         │  │
│  │  - checkRateLimit()                                   │  │
│  │  - fetchWithRetry()                                   │  │
│  │  - syncDeveloperGitHubData()                          │  │
│  │  - syncAllDevelopers()                                │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────┬───────────────────────────────────┘
                          │
                          │ GitHub API Calls
                          ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub API                                │
│  - REST API: users, repos, rate_limit                       │
│  - GraphQL API: contribution graph                          │
│  - Rate Limit: 5000 requests/hour (authenticated)          │
└─────────────────────────────────────────────────────────────┘
```

## Setup

### 1. Deploy Edge Function

```bash
# Deploy the function
supabase functions deploy sync-github-data

# Set required secrets
supabase secrets set CRON_SECRET=your-random-secret-here
```

### 2. Configure Cron Job

Add to your `supabase/functions/_cron/cron.ts` or use external cron service:

```typescript
// Daily at 2 AM UTC
const response = await fetch(`${SUPABASE_URL}/functions/v1/sync-github-data?action=sync-all`, {
  method: 'POST',
  headers: {
    Authorization: `Bearer ${CRON_SECRET}`,
    'Content-Type': 'application/json',
  },
});
```

Or use GitHub Actions:

```yaml
# .github/workflows/sync-github-data.yml
name: Sync GitHub Data
on:
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM UTC
  workflow_dispatch:

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger Sync
        run: |
          curl -X POST \
            "${{ secrets.SUPABASE_URL }}/functions/v1/sync-github-data?action=sync-all" \
            -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" \
            -H "Content-Type: application/json"
```

### 3. Database Schema

The `developer_profiles` table should have:

```sql
ALTER TABLE developer_profiles
ADD COLUMN IF NOT EXISTS github_username TEXT,
ADD COLUMN IF NOT EXISTS github_data JSONB;

-- Index for faster lookups
CREATE INDEX IF NOT EXISTS idx_developer_profiles_github_username
ON developer_profiles(github_username);
```

### 4. OAuth Configuration

Store GitHub OAuth tokens in `auth.users.app_metadata`:

```json
{
  "oauth": {
    "github": {
      "access_token": "gho_xxxxxxxxxxxxx",
      "username": "octocat"
    }
  }
}
```

## Usage

### Frontend Integration

```typescript
import { githubIntegrationService } from '@/modules/profiles/services/GitHubIntegrationService';

// Sync GitHub data for current user
const result = await githubIntegrationService.syncDeveloperGitHubData(userId);

if (result.success) {
  console.log('GitHub data:', result.data);
  console.log('From cache:', result.cached);
} else {
  console.error('Sync failed:', result.error);
}

// Force refresh (ignore cache)
const freshResult = await githubIntegrationService.syncDeveloperGitHubData(userId, true);

// Validate GitHub token
const tokenStatus = await githubIntegrationService.validateGitHubToken(userId);
if (!tokenStatus.isValid) {
  alert('Please reconnect your GitHub account');
}

// Get cached data without triggering sync
const cachedData = await githubIntegrationService.getCachedGitHubData(userId);

// Calculate contribution stats
if (cachedData) {
  const stats = githubIntegrationService.getContributionStats(cachedData);
  console.log('Total contributions:', stats.totalContributions);
  console.log('Current streak:', stats.currentStreak);
  console.log('Longest streak:', stats.longestStreak);
  console.log('Average per day:', stats.averagePerDay);
}

// Get top languages
const topLanguages = githubIntegrationService.getTopLanguages(cachedData, 5);
topLanguages.forEach(({ language, count, percentage }) => {
  console.log(`${language}: ${count} repos (${percentage}%)`);
});

// Calculate profile strength
const strength = githubIntegrationService.calculateProfileStrength(cachedData);
console.log('GitHub profile strength:', strength);
```

### React Component Example

```typescript
import { useEffect, useState } from 'react';
import { githubIntegrationService, GitHubData } from '@/modules/profiles/services/GitHubIntegrationService';

export function GitHubProfile({ userId }: { userId: string }) {
  const [githubData, setGithubData] = useState<GitHubData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGitHubData();
  }, [userId]);

  const loadGitHubData = async () => {
    setLoading(true);
    const result = await githubIntegrationService.syncDeveloperGitHubData(userId);
    if (result.success && result.data) {
      setGithubData(result.data);
    }
    setLoading(false);
  };

  if (loading) return <div>Loading GitHub data...</div>;
  if (!githubData) return <div>No GitHub data available</div>;

  const stats = githubIntegrationService.getContributionStats(githubData);
  const languages = githubIntegrationService.getTopLanguages(githubData);
  const strength = githubIntegrationService.calculateProfileStrength(githubData);

  return (
    <div>
      <h2>{githubData.name || githubData.username}</h2>
      <p>{githubData.bio}</p>

      <div>
        <h3>Stats</h3>
        <p>Repos: {githubData.public_repos}</p>
        <p>Stars: {githubData.total_stars}</p>
        <p>Followers: {githubData.followers}</p>
        <p>Contributions: {stats.totalContributions}</p>
        <p>Current Streak: {stats.currentStreak} days</p>
      </div>

      <div>
        <h3>Top Languages</h3>
        {languages.map(({ language, percentage }) => (
          <div key={language}>
            {language}: {percentage}%
          </div>
        ))}
      </div>

      <div>
        <h3>Pinned Repositories</h3>
        {githubData.pinned_repos.map((repo) => (
          <div key={repo.id}>
            <a href={repo.html_url}>{repo.name}</a>
            <p>{repo.description}</p>
            <span>⭐ {repo.stargazers_count}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## API Reference

### Edge Function Endpoints

#### Individual User Sync

```
POST /sync-github-data
Headers:
  Authorization: Bearer <user_access_token>
Body:
  {
    "userId": "uuid",
    "forceRefresh": false  // optional
  }
```

**Response:**

```json
{
  "username": "octocat",
  "name": "The Octocat",
  "bio": "GitHub mascot",
  "avatar_url": "https://...",
  "public_repos": 8,
  "followers": 1000,
  "following": 50,
  "total_stars": 150,
  "total_forks": 25,
  "top_languages": {
    "JavaScript": 5,
    "TypeScript": 3
  },
  "pinned_repos": [...],
  "contribution_graph": [...],
  "last_synced_at": "2025-10-01T12:00:00Z",
  "cached": false
}
```

#### Scheduled Sync All

```
POST /sync-github-data?action=sync-all
Headers:
  Authorization: Bearer <CRON_SECRET>
```

**Response:**

```json
{
  "success": true,
  "message": "Sync completed"
}
```

### Service Methods

#### `syncDeveloperGitHubData(userId, forceRefresh?)`

Sync GitHub data for a specific user.

**Parameters:**

- `userId`: User's UUID
- `forceRefresh`: Boolean (default: false) - Ignore 24hr cache

**Returns:** `Promise<GitHubSyncResult>`

#### `validateGitHubToken(userId)`

Check if user's GitHub token is valid.

**Returns:** `Promise<GitHubTokenStatus>`

#### `getCachedGitHubData(userId)`

Get cached data from database without API call.

**Returns:** `Promise<GitHubData | null>`

#### `shouldRefreshCache(githubData)`

Check if cached data is stale (>24hrs).

**Returns:** `boolean`

#### `getContributionStats(githubData)`

Calculate contribution statistics.

**Returns:**

```typescript
{
  totalContributions: number;
  currentStreak: number;
  longestStreak: number;
  averagePerDay: number;
}
```

#### `getTopLanguages(githubData, limit?)`

Get top programming languages.

**Returns:**

```typescript
Array<{
  language: string;
  count: number;
  percentage: number;
}>;
```

#### `calculateProfileStrength(githubData)`

Calculate GitHub profile strength score (0-100).

**Scoring:**

- Public repos: 0-20 points
- Followers: 0-15 points
- Total stars: 0-20 points
- Language diversity: 0-15 points
- Pinned repos: 0-10 points
- Contributions: 0-20 points

## Rate Limiting

### GitHub API Limits

- **Authenticated**: 5,000 requests/hour
- **Unauthenticated**: 60 requests/hour

### Handling Strategy

1. **Check Before Fetch**: Always check rate limit before making requests
2. **Wait on Limit**: Automatically wait until reset time if limit reached
3. **Exponential Backoff**: Retry with increasing delays on failures
4. **Cache Aggressively**: 24-hour cache reduces API calls by ~96%

### Rate Limit Response Headers

```
x-ratelimit-limit: 5000
x-ratelimit-remaining: 4999
x-ratelimit-reset: 1696176000
x-ratelimit-used: 1
```

## Error Handling

### Common Errors

1. **Token Invalid/Expired**

   ```json
   {
     "error": "GitHub token is invalid or expired"
   }
   ```

   **Solution**: User needs to reconnect GitHub account

2. **Rate Limit Exceeded**
   - Automatically waits for reset
   - Logs warning with reset time

3. **Network Errors**
   - Retries up to 3 times with exponential backoff
   - Returns error after max retries

4. **GraphQL Errors**
   - Falls back to mock contribution data
   - Logs error for debugging

## Performance

### Caching Strategy

- **Cache Duration**: 24 hours
- **Cache Location**: PostgreSQL JSONB column
- **Cache Key**: `user_id` in `developer_profiles` table
- **Cache Invalidation**: Manual refresh or scheduled sync

### API Call Optimization

**Without Service:**

- Fetch on every profile view
- ~1000 API calls/day for 1000 views

**With Service:**

- Fetch once per day per user
- ~100 API calls/day for 100 users
- **90% reduction** in API usage

### Database Performance

```sql
-- Ensure index exists for fast lookups
CREATE INDEX IF NOT EXISTS idx_developer_profiles_user_id
ON developer_profiles(user_id);

-- Query cached data efficiently
SELECT github_data
FROM developer_profiles
WHERE user_id = $1;
```

## Security

### Token Storage

- ✅ Tokens stored in `auth.users.app_metadata` (encrypted)
- ✅ Tokens never exposed to client
- ✅ Edge function uses service role key
- ✅ CORS configured for safety

### Scheduled Sync Security

- ✅ Requires `CRON_SECRET` header
- ✅ Random secret generated during setup
- ✅ Only accessible by cron service

### Data Privacy

- ✅ RLS policies ensure users can only access own data
- ✅ GitHub tokens validated before use
- ✅ Expired tokens handled gracefully

## Monitoring

### Logs

Edge function logs available in Supabase dashboard:

```
Fetching fresh GitHub data for octocat
Low rate limit: 45/5000. Reset at 2025-10-01T13:00:00Z
Sync completed: { total: 100, synced: 50, cached: 45, failed: 5 }
```

### Metrics to Track

- Sync success rate
- Average sync duration
- Cache hit rate
- API rate limit usage
- Token validation failures

## Troubleshooting

### Issue: "GitHub account not linked"

**Cause**: User hasn't connected GitHub OAuth

**Solution**:

```typescript
// Redirect to GitHub OAuth
const { data } = await supabaseClient.auth.signInWithOAuth({
  provider: 'github',
  options: {
    scopes: 'read:user repo',
  },
});
```

### Issue: Contribution graph returns mock data

**Cause**: GraphQL API requires additional permissions

**Solution**: Request `read:org` scope during OAuth

### Issue: High API rate limit usage

**Cause**: Too many force refreshes or cache not working

**Solution**:

- Check `shouldRefreshCache` logic
- Verify database JSONB column storing data
- Review cache TTL (24hrs recommended)

---

**Last Updated**: October 1, 2025
**Version**: 1.0.0
**Status**: Production Ready
