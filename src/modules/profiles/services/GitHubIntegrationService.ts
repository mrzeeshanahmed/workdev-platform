import { supabaseClient } from 'config/supabase/client';

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

interface GitHubContribution {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface GitHubData {
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
  cached?: boolean;
}

export interface GitHubSyncResult {
  success: boolean;
  data?: GitHubData;
  error?: string;
  cached: boolean;
}

export interface GitHubTokenStatus {
  isValid: boolean;
  username?: string;
  hasToken: boolean;
}

export class GitHubIntegrationService {
  /**
   * Sync GitHub data for the current user
   * @param userId - The user's ID
   * @param forceRefresh - Force a fresh fetch, ignoring cache
   * @returns GitHubSyncResult with data or error
   */
  async syncDeveloperGitHubData(userId: string, forceRefresh = false): Promise<GitHubSyncResult> {
    try {
      if (!supabaseClient) {
        return {
          success: false,
          error: 'Supabase client not initialized',
          cached: false,
        };
      }

      const {
        data: { session },
      } = await supabaseClient.auth.getSession();

      if (!session) {
        return {
          success: false,
          error: 'Not authenticated',
          cached: false,
        };
      }

      const response = await supabaseClient.functions.invoke('sync-github-data', {
        body: { userId, forceRefresh },
      });

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
          cached: false,
        };
      }

      return {
        success: true,
        data: response.data as GitHubData,
        cached: response.data.cached || false,
      };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to sync GitHub data',
        cached: false,
      };
    }
  }

  /**
   * Trigger a scheduled sync for all developers (admin only)
   * Requires CRON_SECRET to be set
   */
  async refreshAllDeveloperData(): Promise<{ success: boolean; error?: string }> {
    try {
      if (!supabaseClient) {
        return {
          success: false,
          error: 'Supabase client not initialized',
        };
      }

      const response = await supabaseClient.functions.invoke('sync-github-data', {
        body: {},
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.error) {
        return {
          success: false,
          error: response.error.message,
        };
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to refresh all developer data',
      };
    }
  }

  /**
   * Check if the user has a valid GitHub token
   * @param userId - The user's ID
   * @returns GitHubTokenStatus with validation info
   */
  async checkGitHubToken(userId: string): Promise<GitHubTokenStatus> {
    try {
      if (!supabaseClient) {
        return {
          isValid: false,
          hasToken: false,
        };
      }

      const { data: user } = await supabaseClient.auth.getUser();

      if (!user.user) {
        return {
          isValid: false,
          hasToken: false,
        };
      }

      const appMetadata = user.user.app_metadata as {
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
        return {
          isValid: false,
          hasToken: false,
        };
      }

      // Try to fetch data to validate token
      const syncResult = await this.syncDeveloperGitHubData(userId, false);

      return {
        isValid: syncResult.success,
        hasToken: true,
        username: githubUsername,
      };
    } catch {
      return {
        isValid: false,
        hasToken: false,
      };
    }
  }

  /**
   * Get cached GitHub data from database without triggering sync
   * @param userId - The user's ID
   * @returns GitHubData or null
   */
  async fetchGitHubData(userId: string): Promise<GitHubData | null> {
    try {
      if (!supabaseClient) {
        console.error('Supabase client not initialized');
        return null;
      }

      const { data, error } = await supabaseClient
        .from('developer_profiles')
        .select('github_data')
        .eq('user_id', userId)
        .single();

      if (error || !data) {
        return null;
      }

      return data.github_data as GitHubData;
    } catch {
      return null;
    }
  }

  /**
   * Check if cached data needs refresh (older than 24 hours)
   * @param githubData - The GitHub data to check
   * @returns boolean indicating if refresh is needed
   */
  shouldRefreshCache(githubData: GitHubData | null): boolean {
    if (!githubData || !githubData.last_synced_at) {
      return true;
    }

    const lastSync = new Date(githubData.last_synced_at);
    const now = new Date();
    const hoursSinceSync = (now.getTime() - lastSync.getTime()) / (1000 * 60 * 60);

    return hoursSinceSync >= 24;
  }

  /**
   * Get contribution statistics from GitHub data
   * @param githubData - The GitHub data
   * @returns Contribution statistics
   */
  getContributionStats(githubData: GitHubData): {
    totalContributions: number;
    currentStreak: number;
    longestStreak: number;
    averagePerDay: number;
  } {
    const contributions = githubData.contribution_graph;
    const totalContributions = contributions.reduce((sum, day) => sum + day.count, 0);

    let currentStreak = 0;
    let longestStreak = 0;
    let tempStreak = 0;

    // Calculate streaks (from most recent to oldest)
    const sortedContributions = [...contributions].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
    );

    for (let i = 0; i < sortedContributions.length; i++) {
      if (sortedContributions[i].count > 0) {
        tempStreak++;
        if (i === 0) {
          currentStreak = tempStreak;
        }
      } else {
        if (tempStreak > longestStreak) {
          longestStreak = tempStreak;
        }
        if (i === 0) {
          currentStreak = 0;
        }
        tempStreak = 0;
      }
    }

    longestStreak = Math.max(longestStreak, tempStreak);

    const averagePerDay = contributions.length > 0 ? totalContributions / contributions.length : 0;

    return {
      totalContributions,
      currentStreak,
      longestStreak,
      averagePerDay: Math.round(averagePerDay * 10) / 10,
    };
  }

  /**
   * Get top languages sorted by usage
   * @param githubData - The GitHub data
   * @param limit - Maximum number of languages to return
   * @returns Array of language names and counts
   */
  getTopLanguages(
    githubData: GitHubData,
    limit = 5,
  ): Array<{ language: string; count: number; percentage: number }> {
    const languages = githubData.top_languages;
    const total = Object.values(languages).reduce((sum, count) => sum + count, 0);

    return Object.entries(languages)
      .map(([language, count]) => ({
        language,
        count,
        percentage: Math.round((count / total) * 100),
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }

  /**
   * Calculate GitHub profile strength score (0-100)
   * @param githubData - The GitHub data
   * @returns Score from 0 to 100
   */
  calculateProfileStrength(githubData: GitHubData): number {
    let score = 0;

    // Public repos (0-20 points)
    score += Math.min(20, (githubData.public_repos / 20) * 20);

    // Followers (0-15 points)
    score += Math.min(15, (githubData.followers / 100) * 15);

    // Total stars (0-20 points)
    score += Math.min(20, (githubData.total_stars / 50) * 20);

    // Languages diversity (0-15 points)
    const languageCount = Object.keys(githubData.top_languages).length;
    score += Math.min(15, (languageCount / 5) * 15);

    // Pinned repos (0-10 points)
    score += Math.min(10, (githubData.pinned_repos.length / 6) * 10);

    // Contributions (0-20 points)
    const stats = this.getContributionStats(githubData);
    score += Math.min(20, (stats.totalContributions / 500) * 20);

    return Math.round(score);
  }
}

// Export singleton instance
export const githubIntegrationService = new GitHubIntegrationService();
