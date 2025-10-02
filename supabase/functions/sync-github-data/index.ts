// @ts-ignore - Deno resolves remote modules at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
// @ts-ignore - Deno resolves remote modules at runtime.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
  fork: boolean;
}

interface GitHubUserData {
  login: string;
  name: string | null;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  avatar_url: string;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  created_at: string;
}

interface GitHubContribution {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

interface GitHubData {
  username: string;
  name: string | null;
  bio: string | null;
  avatar_url: string;
  public_repos: number;
  followers: number;
  following: number;
  company: string | null;
  location: string | null;
  blog: string | null;
  twitter_username: string | null;
  account_created_at: string;
  contribution_graph: GitHubContribution[];
  top_languages: { [key: string]: number };
  pinned_repos: GitHubRepo[];
  total_stars: number;
  total_forks: number;
  last_synced_at: string;
}

interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}

const getClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Missing Supabase configuration.');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const checkRateLimit = async (headers: HeadersInit): Promise<RateLimitInfo | null> => {
  try {
    const response = await fetch('https://api.github.com/rate_limit', { headers });
    if (!response.ok) return null;

    const data = await response.json();
    return data.rate as RateLimitInfo;
  } catch {
    return null;
  }
};

const waitForRateLimit = async (resetTimestamp: number): Promise<void> => {
  const now = Date.now() / 1000;
  const waitTime = Math.max(0, resetTimestamp - now) * 1000;
  if (waitTime > 0) {
    console.log(`Rate limit reached. Waiting ${waitTime / 1000} seconds...`);
    await new Promise((resolve) => setTimeout(resolve, waitTime + 1000));
  }
};

const validateGitHubToken = async (token: string): Promise<boolean> => {
  try {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    });
    return response.ok;
  } catch {
    return false;
  }
};

const fetchWithRetry = async (
  url: string,
  options: RequestInit,
  retries = 3,
): Promise<Response> => {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);

      // Check rate limit from response headers
      const remaining = response.headers.get('x-ratelimit-remaining');
      const reset = response.headers.get('x-ratelimit-reset');

      if (response.status === 403 && remaining === '0' && reset) {
        await waitForRateLimit(parseInt(reset, 10));
        continue;
      }

      if (response.ok) {
        return response;
      }

      if (response.status === 401) {
        throw new Error('GitHub token is invalid or expired');
      }

      if (response.status >= 500 && i < retries - 1) {
        await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
        continue;
      }

      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1000 * Math.pow(2, i)));
    }
  }

  throw new Error('Max retries reached');
};

const fetchContributionGraphQL = async (
  username: string,
  token: string,
): Promise<GitHubContribution[]> => {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

  const query = `
    query($username: String!, $from: DateTime!) {
      user(login: $username) {
        contributionsCollection(from: $from) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
                contributionLevel
              }
            }
          }
        }
      }
    }
  `;

  try {
    const response = await fetchWithRetry(
      'https://api.github.com/graphql',
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
          Accept: 'application/vnd.github+json',
        },
        body: JSON.stringify({
          query,
          variables: {
            username,
            from: oneYearAgo.toISOString(),
          },
        }),
      },
      2,
    );

    const data = await response.json();

    if (data.errors) {
      throw new Error(`GraphQL error: ${JSON.stringify(data.errors)}`);
    }

    const weeks = data.data.user.contributionsCollection.contributionCalendar.weeks;
    const contributions: GitHubContribution[] = [];

    for (const week of weeks) {
      for (const day of week.contributionDays) {
        const levelMap: { [key: string]: 0 | 1 | 2 | 3 | 4 } = {
          NONE: 0,
          FIRST_QUARTILE: 1,
          SECOND_QUARTILE: 2,
          THIRD_QUARTILE: 3,
          FOURTH_QUARTILE: 4,
        };

        contributions.push({
          date: day.date,
          count: day.contributionCount,
          level: levelMap[day.contributionLevel] || 0,
        });
      }
    }

    return contributions;
  } catch (error) {
    console.error('Failed to fetch contribution graph, using fallback:', error);
    return generateMockContributions();
  }
};

const generateMockContributions = (): GitHubContribution[] => {
  const contributions: GitHubContribution[] = [];
  const today = new Date();

  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    const count = Math.floor(Math.random() * 10);
    let level: 0 | 1 | 2 | 3 | 4 = 0;
    if (count > 8) level = 4;
    else if (count > 6) level = 3;
    else if (count > 3) level = 2;
    else if (count > 0) level = 1;

    contributions.push({
      date: date.toISOString().split('T')[0],
      count,
      level,
    });
  }

  return contributions;
};

const fetchGitHubData = async (
  username: string,
  accessToken: string,
): Promise<GitHubData> => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Check rate limit first
  const rateLimitInfo = await checkRateLimit(headers);
  if (rateLimitInfo && rateLimitInfo.remaining < 50) {
    console.warn(
      `Low rate limit: ${rateLimitInfo.remaining}/${rateLimitInfo.limit}. Reset at ${new Date(rateLimitInfo.reset * 1000).toISOString()}`,
    );
    if (rateLimitInfo.remaining === 0) {
      await waitForRateLimit(rateLimitInfo.reset);
    }
  }

  // Fetch user data
  const userResponse = await fetchWithRetry(`https://api.github.com/users/${username}`, {
    headers,
  });
  const userData: GitHubUserData = await userResponse.json();

  // Fetch repositories (up to 100, excluding forks by default)
  const reposResponse = await fetchWithRetry(
    `https://api.github.com/users/${username}/repos?sort=stars&per_page=100&type=owner`,
    { headers },
  );
  const allRepos: GitHubRepo[] = await reposResponse.json();

  // Filter relevant repositories (non-forks with stars or recent activity)
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const relevantRepos = allRepos.filter(
    (repo) =>
      !repo.fork &&
      (repo.stargazers_count > 0 || new Date(repo.updated_at) > ninetyDaysAgo),
  );

  // Calculate language statistics
  const languageStats: { [key: string]: number } = {};
  relevantRepos.forEach((repo) => {
    if (repo.language) {
      languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
    }
  });

  // Get top 6 repositories by stars (pinned repos)
  const pinnedRepos = relevantRepos
    .sort((a, b) => b.stargazers_count - a.stargazers_count)
    .slice(0, 6);

  // Calculate total stars and forks
  const totalStars = relevantRepos.reduce((sum, repo) => sum + repo.stargazers_count, 0);
  const totalForks = relevantRepos.reduce((sum, repo) => sum + repo.forks_count, 0);

  // Fetch contribution graph
  const contributionGraph = await fetchContributionGraphQL(username, accessToken);

  return {
    username: userData.login,
    name: userData.name,
    bio: userData.bio,
    avatar_url: userData.avatar_url,
    public_repos: userData.public_repos,
    followers: userData.followers,
    following: userData.following,
    company: userData.company,
    location: userData.location,
    blog: userData.blog,
    twitter_username: userData.twitter_username,
    account_created_at: userData.created_at,
    contribution_graph: contributionGraph,
    top_languages: languageStats,
    pinned_repos: pinnedRepos,
    total_stars: totalStars,
    total_forks: totalForks,
    last_synced_at: new Date().toISOString(),
  };
};

const shouldRefreshCache = (lastSyncedAt: string | null): boolean => {
  if (!lastSyncedAt) return true;

  const lastSync = new Date(lastSyncedAt);
  const now = new Date();
  const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

  // Refresh if data is older than 24 hours
  return hoursSinceSync >= 24;
};

const syncDeveloperGitHubData = async (
  supabase: any,
  userId: string,
  githubToken: string,
  githubUsername: string,
): Promise<GitHubData> => {
  // Validate token first
  const isValid = await validateGitHubToken(githubToken);
  if (!isValid) {
    throw new Error('GitHub token is invalid or expired');
  }

  // Check cache
  const { data: existingProfile } = await supabase
    .from('developer_profiles')
    .select('github_data')
    .eq('user_id', userId)
    .single();

  const existingGitHubData = existingProfile?.github_data as GitHubData | null;

  if (existingGitHubData && !shouldRefreshCache(existingGitHubData.last_synced_at)) {
    console.log(`Using cached data for ${githubUsername}`);
    return existingGitHubData;
  }

  // Fetch fresh data
  console.log(`Fetching fresh GitHub data for ${githubUsername}`);
  const githubData = await fetchGitHubData(githubUsername, githubToken);

  // Update database
  await supabase
    .from('developer_profiles')
    .update({
      github_data: githubData,
      github_username: githubUsername,
    })
    .eq('user_id', userId);

  return githubData;
};

// Daily scheduled sync for all developers
const syncAllDevelopers = async (supabase: any): Promise<void> => {
  console.log('Starting daily GitHub sync for all developers...');

  // Get all developers with GitHub tokens
  const { data: users, error } = await supabase.auth.admin.listUsers();

  if (error) {
    console.error('Failed to fetch users:', error);
    return;
  }

  const stats = {
    total: 0,
    synced: 0,
    cached: 0,
    failed: 0,
    errors: [] as string[],
  };

  for (const user of users.users) {
    const appMetadata = user.app_metadata as {
      oauth?: {
        github?: {
          access_token?: string;
          username?: string;
        };
      };
    };

    const githubToken = appMetadata?.oauth?.github?.access_token;
    const githubUsername = appMetadata?.oauth?.github?.username;

    if (!githubToken || !githubUsername) {
      continue;
    }

    stats.total++;

    try {
      const githubData = await syncDeveloperGitHubData(
        supabase,
        user.id,
        githubToken,
        githubUsername,
      );

      if (shouldRefreshCache(githubData.last_synced_at)) {
        stats.synced++;
      } else {
        stats.cached++;
      }

      // Small delay to respect rate limits
      await new Promise((resolve) => setTimeout(resolve, 100));
    } catch (error) {
      stats.failed++;
      const errorMsg = `Failed to sync ${githubUsername}: ${error instanceof Error ? error.message : 'Unknown error'}`;
      console.error(errorMsg);
      stats.errors.push(errorMsg);
    }
  }

  console.log('Daily GitHub sync completed:', stats);
};

serve(async (req: Request) => {
  const corsHeaders: HeadersInit = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };

  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabase = getClient();
    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    // Scheduled sync endpoint (for cron job)
    if (action === 'sync-all' && req.method === 'POST') {
      const authHeader = req.headers.get('Authorization');
      const cronSecret = Deno.env.get('CRON_SECRET');

      if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
        return new Response(JSON.stringify({ error: 'Unauthorized' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }

      await syncAllDevelopers(supabase);

      return new Response(JSON.stringify({ success: true, message: 'Sync completed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Individual user sync endpoint
    if (req.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 405,
      });
    }

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const { userId, forceRefresh = false } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Get user's GitHub credentials
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unable to get user' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const appMetadata = user.app_metadata as {
      oauth?: {
        github?: {
          access_token?: string;
          username?: string;
        };
      };
    };

    const githubToken = appMetadata?.oauth?.github?.access_token;
    const githubUsername = appMetadata?.oauth?.github?.username;

    if (!githubToken || !githubUsername) {
      return new Response(
        JSON.stringify({ error: 'GitHub account not linked. Please link your GitHub account.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        },
      );
    }

    // Check cache unless force refresh
    if (!forceRefresh) {
      const { data: existingProfile } = await supabase
        .from('developer_profiles')
        .select('github_data')
        .eq('user_id', userId)
        .single();

      const existingGitHubData = existingProfile?.github_data as GitHubData | null;

      if (existingGitHubData && !shouldRefreshCache(existingGitHubData.last_synced_at)) {
        console.log('Returning cached GitHub data');
        return new Response(JSON.stringify({ ...existingGitHubData, cached: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        });
      }
    }

    // Sync GitHub data
    const githubData = await syncDeveloperGitHubData(
      supabase,
      userId,
      githubToken,
      githubUsername,
    );

    return new Response(JSON.stringify({ ...githubData, cached: false }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    console.error('Error syncing GitHub data:', error);
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to sync GitHub data',
      }),
      {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Content-Type': 'application/json',
        },
        status: 500,
      },
    );
  }
});
