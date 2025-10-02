import { supabaseClient } from '../../../config/supabase/client';
import type {
  DeveloperCard,
  DeveloperSearchParams,
  DeveloperSearchResult,
  DirectoryFilters,
  SavedSearch,
  SavedSearchInput,
  WatchlistDeveloper,
  WatchlistInput,
} from '../types';

export class DirectoryService {
  private client = supabaseClient;

  private get supabase() {
    if (!this.client) {
      throw new Error('Supabase client is not configured. Check your environment variables.');
    }
    return this.client;
  }

  // ==================== Developer Search ====================

  /**
   * Search developers with sophisticated filtering
   * Prioritizes availability status for immediate hiring needs
   */
  async searchDevelopers(params: DeveloperSearchParams): Promise<DeveloperSearchResult> {
    const supabase = this.supabase;
    const page = params.page || 1;
    const limit = params.limit || 12;
    const offset = (page - 1) * limit;

    try {
      // Call the search function
      const { data, error, count } = await supabase.rpc(
        'search_developers',
        {
          p_query: params.query || null,
          p_skills: params.skills || null,
          p_min_rate: params.min_rate || null,
          p_max_rate: params.max_rate || null,
          p_availability: params.availability || null,
          p_experience_level: params.experience_level || null,
          p_is_vetted: params.is_vetted ?? null,
          p_location: params.location || null,
          p_is_remote: params.is_remote ?? null,
          p_has_github: params.has_github ?? null,
          p_min_rating: params.min_rating || null,
          p_sort_by: params.sort_by || 'availability',
          p_limit: limit,
          p_offset: offset,
        },
        { count: 'exact' },
      );

      if (error) throw error;

      const total = count || 0;
      const total_pages = Math.ceil(total / limit);

      return {
        developers: (data || []) as DeveloperCard[],
        total,
        page,
        limit,
        total_pages,
        has_next: page < total_pages,
        has_previous: page > 1,
      };
    } catch (error) {
      console.error('Error searching developers:', error);
      throw error;
    }
  }

  /**
   * Get featured/top developers
   * Returns developers with high ratings and availability
   */
  async getFeaturedDevelopers(limit = 6): Promise<DeveloperCard[]> {
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase.rpc('search_developers', {
        p_availability: 'available',
        p_min_rating: 4.5,
        p_sort_by: 'rating',
        p_limit: limit,
        p_offset: 0,
      });

      if (error) throw error;
      return (data || []) as DeveloperCard[];
    } catch (error) {
      console.error('Error fetching featured developers:', error);
      throw error;
    }
  }

  /**
   * Get single developer profile
   * Increments view count
   */
  async getDeveloperById(developerId: string, viewerId?: string): Promise<DeveloperCard | null> {
    const supabase = this.supabase;

    try {
      // Get developer from directory view
      const { data, error } = await supabase
        .from('developer_directory')
        .select('*')
        .eq('user_id', developerId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw error;
      }

      // Track view
      await this.trackDeveloperView(developerId, viewerId);

      return data as unknown as DeveloperCard;
    } catch (error) {
      console.error('Error fetching developer:', error);
      throw error;
    }
  }

  /**
   * Get similar developers based on skills
   */
  async getSimilarDevelopers(developerId: string, limit = 5): Promise<DeveloperCard[]> {
    const supabase = this.supabase;

    try {
      // Get the developer's skills
      const { data: developer } = await supabase
        .from('developer_directory')
        .select('skills')
        .eq('user_id', developerId)
        .single();

      if (!developer || !developer.skills || developer.skills.length === 0) {
        return [];
      }

      // Search for developers with overlapping skills
      const { data, error } = await supabase.rpc('search_developers', {
        p_skills: developer.skills,
        p_sort_by: 'rating',
        p_limit: limit + 1, // Get one extra to exclude self
        p_offset: 0,
      });

      if (error) throw error;

      // Filter out the current developer
      return ((data || []) as DeveloperCard[])
        .filter((dev) => dev.user_id !== developerId)
        .slice(0, limit);
    } catch (error) {
      console.error('Error fetching similar developers:', error);
      throw error;
    }
  }

  // ==================== Filter Options ====================

  /**
   * Get available filter options
   * Returns popular skills, timezones, etc.
   */
  async getAvailableFilters(): Promise<DirectoryFilters> {
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase.rpc('get_directory_filters');

      if (error) throw error;

      return data as unknown as DirectoryFilters;
    } catch (error) {
      console.error('Error fetching directory filters:', error);
      // Return default empty filters
      return {
        popular_skills: [],
        rate_ranges: [],
        timezones: [],
        experience_levels: ['junior', 'mid', 'senior', 'expert'],
        availability_statuses: ['available', 'booked', 'unavailable'],
      };
    }
  }

  /**
   * Get skill suggestions for autocomplete
   */
  async getSkillSuggestions(query: string): Promise<string[]> {
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase
        .from('skills')
        .select('name')
        .ilike('name', `%${query}%`)
        .order('name')
        .limit(10);

      if (error) throw error;

      return (data || []).map((s: { name: string }) => s.name);
    } catch (error) {
      console.error('Error fetching skill suggestions:', error);
      return [];
    }
  }

  // ==================== Analytics ====================

  /**
   * Track search query for analytics
   */
  async trackSearchAnalytics(
    params: DeveloperSearchParams,
    resultsCount: number,
    searchTimeMs: number,
  ): Promise<void> {
    const supabase = this.supabase;

    try {
      const { data: user } = await supabase.auth.getUser();

      await supabase.from('directory_analytics').insert({
        user_id: user?.user?.id || null,
        search_params: params,
        results_count: resultsCount,
        search_time_ms: searchTimeMs,
      });
    } catch (error) {
      // Non-blocking: don't throw on analytics failures
      console.warn('Failed to track search analytics:', error);
    }
  }

  /**
   * Track developer profile view
   */
  async trackDeveloperView(developerId: string, viewerId?: string): Promise<void> {
    const supabase = this.supabase;

    try {
      await supabase.rpc('track_developer_view', {
        p_developer_id: developerId,
        p_viewer_id: viewerId || null,
      });
    } catch (error) {
      // Non-blocking
      console.warn('Failed to track developer view:', error);
    }
  }

  /**
   * Track developer click from search results
   */
  async trackDeveloperClick(developerId: string): Promise<void> {
    const supabase = this.supabase;

    try {
      const { data: user } = await supabase.auth.getUser();

      await supabase.from('directory_analytics').insert({
        user_id: user?.user?.id || null,
        clicked_developer_id: developerId,
      });
    } catch (error) {
      // Non-blocking
      console.warn('Failed to track developer click:', error);
    }
  }

  // ==================== Saved Searches ====================

  /**
   * Get user's saved searches
   */
  async getSavedSearches(): Promise<SavedSearch[]> {
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as SavedSearch[];
    } catch (error) {
      console.error('Error fetching saved searches:', error);
      throw error;
    }
  }

  /**
   * Create a new saved search
   */
  async createSavedSearch(input: SavedSearchInput): Promise<SavedSearch> {
    const supabase = this.supabase;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('saved_searches')
        .insert({
          user_id: user.user.id,
          name: input.name,
          search_params: input.search_params,
          alert_enabled: input.alert_enabled ?? false,
          alert_frequency: input.alert_frequency ?? 'daily',
        })
        .select()
        .single();

      if (error) throw error;
      return data as SavedSearch;
    } catch (error) {
      console.error('Error creating saved search:', error);
      throw error;
    }
  }

  /**
   * Update saved search
   */
  async updateSavedSearch(
    searchId: string,
    input: Partial<SavedSearchInput>,
  ): Promise<SavedSearch> {
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase
        .from('saved_searches')
        .update({
          name: input.name,
          search_params: input.search_params,
          alert_enabled: input.alert_enabled,
          alert_frequency: input.alert_frequency,
          updated_at: new Date().toISOString(),
        })
        .eq('id', searchId)
        .select()
        .single();

      if (error) throw error;
      return data as SavedSearch;
    } catch (error) {
      console.error('Error updating saved search:', error);
      throw error;
    }
  }

  /**
   * Delete saved search
   */
  async deleteSavedSearch(searchId: string): Promise<void> {
    const supabase = this.supabase;

    try {
      const { error } = await supabase.from('saved_searches').delete().eq('id', searchId);

      if (error) throw error;
    } catch (error) {
      console.error('Error deleting saved search:', error);
      throw error;
    }
  }

  // ==================== Watchlist ====================

  /**
   * Get user's developer watchlist
   */
  async getWatchlist(): Promise<WatchlistDeveloper[]> {
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase
        .from('developer_watchlist')
        .select(
          `
          *,
          developer:developer_directory!developer_watchlist_developer_id_fkey(*)
        `,
        )
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as WatchlistDeveloper[];
    } catch (error) {
      console.error('Error fetching watchlist:', error);
      throw error;
    }
  }

  /**
   * Add developer to watchlist
   */
  async addToWatchlist(input: WatchlistInput): Promise<WatchlistDeveloper> {
    const supabase = this.supabase;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('User not authenticated');

      const { data, error } = await supabase
        .from('developer_watchlist')
        .insert({
          client_id: user.user.id,
          developer_id: input.developer_id,
          notes: input.notes || null,
          tags: input.tags || [],
        })
        .select(
          `
          *,
          developer:developer_directory!developer_watchlist_developer_id_fkey(*)
        `,
        )
        .single();

      if (error) throw error;
      return data as WatchlistDeveloper;
    } catch (error) {
      console.error('Error adding to watchlist:', error);
      throw error;
    }
  }

  /**
   * Update watchlist entry
   */
  async updateWatchlistEntry(
    watchlistId: string,
    input: Partial<WatchlistInput>,
  ): Promise<WatchlistDeveloper> {
    const supabase = this.supabase;

    try {
      const { data, error } = await supabase
        .from('developer_watchlist')
        .update({
          notes: input.notes,
          tags: input.tags,
          updated_at: new Date().toISOString(),
        })
        .eq('id', watchlistId)
        .select(
          `
          *,
          developer:developer_directory!developer_watchlist_developer_id_fkey(*)
        `,
        )
        .single();

      if (error) throw error;
      return data as WatchlistDeveloper;
    } catch (error) {
      console.error('Error updating watchlist entry:', error);
      throw error;
    }
  }

  /**
   * Remove developer from watchlist
   */
  async removeFromWatchlist(watchlistId: string): Promise<void> {
    const supabase = this.supabase;

    try {
      const { error } = await supabase.from('developer_watchlist').delete().eq('id', watchlistId);

      if (error) throw error;
    } catch (error) {
      console.error('Error removing from watchlist:', error);
      throw error;
    }
  }

  /**
   * Check if developer is in watchlist
   */
  async isInWatchlist(developerId: string): Promise<boolean> {
    const supabase = this.supabase;

    try {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user) return false;

      const { data, error } = await supabase
        .from('developer_watchlist')
        .select('id')
        .eq('client_id', user.user.id)
        .eq('developer_id', developerId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;

      return !!data;
    } catch (error) {
      console.error('Error checking watchlist status:', error);
      return false;
    }
  }
}

// Singleton instance
export const directoryService = new DirectoryService();
