import { supabaseClient } from 'config/supabase/client';
import type {
  DeveloperProfileExtended,
  GitHubData,
  PortfolioProject,
  PortfolioProjectInput,
  ProfileAnalytics,
  ProfileCompletenessFactors,
  ProfileUpdatePayload,
  Skill,
  WorkHistory,
  WorkHistoryInput,
} from '../types';

export class ProfileService {
  private client = supabaseClient;

  private get supabase() {
    if (!this.client) {
      throw new Error('Supabase client is not configured. Check your environment variables.');
    }
    return this.client;
  }

  // Profile Management
  async getProfile(userId: string): Promise<DeveloperProfileExtended | null> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('developer_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw error;
    }

    return data as DeveloperProfileExtended;
  }

  async updateProfile(
    userId: string,
    payload: ProfileUpdatePayload,
  ): Promise<DeveloperProfileExtended> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('developer_profiles')
      .update(payload)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as DeveloperProfileExtended;
  }

  async uploadProfilePicture(userId: string, file: File): Promise<string> {
    const supabase = this.supabase;

    // Validate file
    if (file.size > 2 * 1024 * 1024) {
      throw new Error('File size must be less than 2MB');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Only JPEG, PNG, and WebP images are allowed');
    }

    // Upload to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}-${Date.now()}.${fileExt}`;
    const filePath = `profile-pictures/${fileName}`;

    const { error: uploadError } = await supabase.storage.from('profiles').upload(filePath, file, {
      cacheControl: '3600',
      upsert: true,
    });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('profiles').getPublicUrl(filePath);

    // Update profile with new URL
    await this.updateProfile(userId, { profile_picture_url: publicUrl });

    return publicUrl;
  }

  // Portfolio Management
  async getPortfolio(userId: string): Promise<PortfolioProject[]> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('portfolio_projects')
      .select('*')
      .eq('user_id', userId)
      .order('display_order', { ascending: true })
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return data as PortfolioProject[];
  }

  async createPortfolioProject(
    userId: string,
    project: PortfolioProjectInput,
  ): Promise<PortfolioProject> {
    const supabase = this.supabase;

    // Get next display order
    const { count } = await supabase
      .from('portfolio_projects')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { data, error } = await supabase
      .from('portfolio_projects')
      .insert({
        user_id: userId,
        ...project,
        display_order: (count ?? 0) + 1,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as PortfolioProject;
  }

  async updatePortfolioProject(
    projectId: string,
    updates: Partial<PortfolioProjectInput>,
  ): Promise<PortfolioProject> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('portfolio_projects')
      .update(updates)
      .eq('id', projectId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as PortfolioProject;
  }

  async deletePortfolioProject(projectId: string): Promise<void> {
    const supabase = this.supabase;
    const { error } = await supabase.from('portfolio_projects').delete().eq('id', projectId);

    if (error) {
      throw error;
    }
  }

  async reorderPortfolio(userId: string, projectIds: string[]): Promise<void> {
    const supabase = this.supabase;

    // Update display_order for each project
    const updates = projectIds.map((id, index) => ({
      id,
      user_id: userId,
      display_order: index + 1,
    }));

    const { error } = await supabase.from('portfolio_projects').upsert(updates);

    if (error) {
      throw error;
    }
  }

  // Work History Management
  async getWorkHistory(userId: string): Promise<WorkHistory[]> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('work_history')
      .select('*')
      .eq('user_id', userId)
      .order('is_current', { ascending: false })
      .order('start_date', { ascending: false });

    if (error) {
      throw error;
    }

    return data as WorkHistory[];
  }

  async createWorkHistory(userId: string, work: WorkHistoryInput): Promise<WorkHistory> {
    const supabase = this.supabase;

    // Get next display order
    const { count } = await supabase
      .from('work_history')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId);

    const { data, error } = await supabase
      .from('work_history')
      .insert({
        user_id: userId,
        ...work,
        display_order: (count ?? 0) + 1,
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as WorkHistory;
  }

  async updateWorkHistory(
    workId: string,
    updates: Partial<WorkHistoryInput>,
  ): Promise<WorkHistory> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('work_history')
      .update(updates)
      .eq('id', workId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as WorkHistory;
  }

  async deleteWorkHistory(workId: string): Promise<void> {
    const supabase = this.supabase;
    const { error } = await supabase.from('work_history').delete().eq('id', workId);

    if (error) {
      throw error;
    }
  }

  // GitHub Integration
  async syncGitHubData(userId: string): Promise<GitHubData> {
    const supabase = this.supabase;

    // Call edge function to sync GitHub data
    const { data, error } = await supabase.functions.invoke('sync-github-profile', {
      body: { userId },
    });

    if (error) {
      throw error;
    }

    return data as GitHubData;
  }

  async getGitHubData(userId: string): Promise<GitHubData | null> {
    const profile = await this.getProfile(userId);
    return profile?.github_data ?? null;
  }

  // Skills Management
  async searchSkills(query: string, limit = 20): Promise<Skill[]> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data as Skill[];
  }

  async getPopularSkills(limit = 50): Promise<Skill[]> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('skills')
      .select('*')
      .order('usage_count', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return data as Skill[];
  }

  // Analytics
  async getProfileAnalytics(userId: string): Promise<ProfileAnalytics> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('profile_analytics')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Return default analytics if not found
        return {
          user_id: userId,
          views_last_7_days: 0,
          views_last_30_days: 0,
          views_total: 0,
          proposal_count: 0,
          proposal_success_rate: 0,
          average_response_time: null,
          profile_strength_score: 0,
          last_calculated_at: new Date().toISOString(),
        };
      }
      throw error;
    }

    return data as ProfileAnalytics;
  }

  async trackProfileView(userId: string, viewerUserId?: string): Promise<void> {
    const supabase = this.supabase;
    await supabase.from('profile_views').insert({
      profile_user_id: userId,
      viewer_user_id: viewerUserId ?? null,
      viewed_at: new Date().toISOString(),
    });
  }

  // Profile Completeness
  calculateCompleteness(
    profile: DeveloperProfileExtended,
    portfolio: PortfolioProject[],
    workHistory: WorkHistory[],
  ): { score: number; factors: ProfileCompletenessFactors } {
    const factors: ProfileCompletenessFactors = {
      has_headline: !!profile.headline && profile.headline.length > 10,
      has_bio: !!profile.bio && profile.bio.length > 50,
      has_hourly_rate: !!profile.hourly_rate && profile.hourly_rate > 0,
      has_skills: profile.skills.length >= 3,
      has_location: !!profile.location,
      has_profile_picture: !!profile.profile_picture_url,
      has_portfolio: portfolio.length > 0,
      has_work_history: workHistory.length > 0,
      has_github_sync: !!profile.github_data,
    };

    const weights = {
      has_headline: 10,
      has_bio: 15,
      has_hourly_rate: 10,
      has_skills: 15,
      has_location: 5,
      has_profile_picture: 10,
      has_portfolio: 15,
      has_work_history: 10,
      has_github_sync: 10,
    };

    let score = 0;
    for (const [key, value] of Object.entries(factors)) {
      if (value) {
        score += weights[key as keyof typeof weights];
      }
    }

    return { score, factors };
  }

  async updateProfileCompleteness(userId: string): Promise<number> {
    const profile = await this.getProfile(userId);
    if (!profile) {
      throw new Error('Profile not found');
    }

    const portfolio = await this.getPortfolio(userId);
    const workHistory = await this.getWorkHistory(userId);

    const { score } = this.calculateCompleteness(profile, portfolio, workHistory);

    await this.updateProfile(userId, { profile_completeness: score });

    return score;
  }
}

export const profileService = new ProfileService();
