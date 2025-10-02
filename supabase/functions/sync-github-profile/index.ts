// @ts-ignore - Deno resolves remote modules at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
// @ts-ignore - Deno resolves remote modules at runtime.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
}

interface GitHubUserData {
  login: string;
  public_repos: number;
  followers: number;
  following: number;
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

const fetchGitHubData = async (username: string, accessToken: string) => {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  };

  // Fetch user data
  const userResponse = await fetch(`https://api.github.com/users/${username}`, { headers });

  if (!userResponse.ok) {
    throw new Error(`GitHub API error: ${userResponse.statusText}`);
  }

  const userData: GitHubUserData = await userResponse.json();

  // Fetch repositories
  const reposResponse = await fetch(
    `https://api.github.com/users/${username}/repos?sort=updated&per_page=100`,
    { headers },
  );

  if (!reposResponse.ok) {
    throw new Error(`GitHub API error fetching repos: ${reposResponse.statusText}`);
  }

  const repos: GitHubRepo[] = await reposResponse.json();

  // Calculate top languages
  const languageStats: { [key: string]: number } = {};
  repos.forEach((repo) => {
    if (repo.language) {
      languageStats[repo.language] = (languageStats[repo.language] || 0) + 1;
    }
  });

  // Get pinned repos (top 6 by stars)
  const pinnedRepos = repos.sort((a, b) => b.stargazers_count - a.stargazers_count).slice(0, 6);

  // Fetch contribution data (simplified - would need GraphQL for full data)
  const contributionGraph = await fetchContributions(username, accessToken);

  return {
    username: userData.login,
    public_repos: userData.public_repos,
    followers: userData.followers,
    following: userData.following,
    contribution_graph: contributionGraph,
    top_languages: languageStats,
    pinned_repos: pinnedRepos,
    last_synced_at: new Date().toISOString(),
  };
};

const fetchContributions = async (username: string, accessToken: string) => {
  // Simplified contribution fetch - would use GraphQL API for accurate data
  // For now, return empty array - can be enhanced with GraphQL query
  const contributions = [];
  const today = new Date();

  for (let i = 365; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(date.getDate() - i);

    contributions.push({
      date: date.toISOString().split('T')[0],
      count: Math.floor(Math.random() * 10), // Mock data
      level: Math.floor(Math.random() * 5) as 0 | 1 | 2 | 3 | 4,
    });
  }

  return contributions;
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  try {
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const { userId } = await req.json();

    if (!userId) {
      return new Response(JSON.stringify({ error: 'userId is required' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const supabase = getClient();

    // Get user's GitHub access token from app_metadata
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

    // Fetch GitHub data
    const githubData = await fetchGitHubData(githubUsername, githubToken);

    // Update developer profile with GitHub data
    const { error: updateError } = await supabase
      .from('developer_profiles')
      .update({
        github_data: githubData,
      })
      .eq('user_id', userId);

    if (updateError) {
      throw updateError;
    }

    return new Response(JSON.stringify(githubData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : 'Failed to sync GitHub data',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
});
