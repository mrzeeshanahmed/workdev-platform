import { supabaseClient } from 'config/supabase/client';
import type {
  ProjectSearchParams,
  ProjectCard,
  ProjectSearchResult,
  ProjectFilters,
  FilterOption,
  SearchAnalytics,
} from '../types';

export class MarketplaceService {
  private client = supabaseClient;

  private get supabase() {
    if (!this.client) {
      throw new Error('Supabase client is not configured. Check your environment variables.');
    }
    return this.client;
  }

  // ==================== Project Search ====================

  /**
   * Search projects with advanced filtering
   */
  async searchProjects(params: ProjectSearchParams): Promise<ProjectSearchResult> {
    const startTime = Date.now();
    const supabase = this.supabase;

    const {
      query,
      skills = [],
      budget_min,
      budget_max,
      project_type,
      duration,
      location,
      remote_only,
      sort_by = 'newest',
      page = 1,
      limit = 20,
    } = params;

    // Build base query using the view
    let projectQuery = supabase
      .from('marketplace_projects')
      .select('*', { count: 'exact' })
      .eq('status', 'open');

    // Full-text search
    if (query && query.trim()) {
      // Use textSearch for full-text search
      projectQuery = projectQuery.textSearch('title,description', query, {
        type: 'websearch',
        config: 'english',
      });
    }

    // Filter by skills (if any skill matches)
    if (skills.length > 0) {
      projectQuery = projectQuery.contains('skills_required', skills);
    }

    // Budget filters
    if (budget_min !== undefined) {
      projectQuery = projectQuery.gte('budget', budget_min);
    }
    if (budget_max !== undefined) {
      projectQuery = projectQuery.lte('budget', budget_max);
    }

    // Project type filter
    if (project_type) {
      projectQuery = projectQuery.eq('project_type', project_type);
    }

    // Duration filter
    if (duration) {
      projectQuery = projectQuery.eq('duration_estimate', duration);
    }

    // Location filter
    if (location) {
      projectQuery = projectQuery.ilike('location', `%${location}%`);
    }

    // Remote only filter
    if (remote_only) {
      projectQuery = projectQuery.eq('is_remote', true);
    }

    // Sorting
    switch (sort_by) {
      case 'newest':
        projectQuery = projectQuery.order('created_at', { ascending: false });
        break;
      case 'budget_high':
        projectQuery = projectQuery.order('budget', { ascending: false });
        break;
      case 'budget_low':
        projectQuery = projectQuery.order('budget', { ascending: true });
        break;
      case 'deadline':
        projectQuery = projectQuery
          .not('deadline', 'is', null)
          .order('deadline', { ascending: true });
        break;
      case 'relevance':
        // For relevance, prioritize featured projects first, then by created_at
        projectQuery = projectQuery
          .order('is_featured', { ascending: false })
          .order('created_at', { ascending: false });
        break;
    }

    // Pagination
    const from = (page - 1) * limit;
    const to = from + limit - 1;
    projectQuery = projectQuery.range(from, to);

    // Execute query
    const { data, error, count } = await projectQuery;

    if (error) {
      throw error;
    }

    const searchTime = Date.now() - startTime;
    const totalPages = count ? Math.ceil(count / limit) : 0;

    // Track search analytics (async, non-blocking)
    this.trackSearchAnalytics({
      query: query || '',
      filters: params,
      results_count: count || 0,
      search_time_ms: searchTime,
      clicked_projects: [],
      created_at: new Date().toISOString(),
    }).catch((err) => console.error('Failed to track search analytics:', err));

    return {
      projects: (data || []) as ProjectCard[],
      total: count || 0,
      page,
      limit,
      total_pages: totalPages,
      search_time_ms: searchTime,
      has_more: page < totalPages,
    };
  }

  /**
   * Get featured projects
   */
  async getFeaturedProjects(limit = 6): Promise<ProjectCard[]> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('marketplace_projects')
      .select('*')
      .eq('status', 'open')
      .eq('is_featured', true)
      .gte('featured_until', new Date().toISOString())
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as ProjectCard[];
  }

  /**
   * Get project by ID
   */
  async getProjectById(projectId: string): Promise<ProjectCard | null> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('marketplace_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    // Increment view count (async, non-blocking)
    this.incrementProjectViews(projectId).catch((err) =>
      console.error('Failed to increment views:', err),
    );

    return data as ProjectCard;
  }

  /**
   * Get similar projects based on skills
   */
  async getSimilarProjects(projectId: string, limit = 5): Promise<ProjectCard[]> {
    const supabase = this.supabase;

    // First, get the project skills
    const { data: project } = await supabase
      .from('marketplace_projects')
      .select('skills_required')
      .eq('id', projectId)
      .single();

    if (!project || !project.skills_required) {
      return [];
    }

    // Find projects with overlapping skills
    const { data, error } = await supabase
      .from('marketplace_projects')
      .select('*')
      .eq('status', 'open')
      .neq('id', projectId)
      .overlaps('skills_required', project.skills_required)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (data || []) as ProjectCard[];
  }

  // ==================== Filters & Aggregations ====================

  /**
   * Get available filters with counts
   */
  async getAvailableFilters(): Promise<ProjectFilters> {
    const supabase = this.supabase;

    // Get popular skills
    const { data: skillsData, error: skillsError } = await supabase.rpc('get_popular_skills', {
      skill_limit: 50,
    });

    if (skillsError) {
      console.error('Failed to fetch skills:', skillsError);
    }

    const skills: FilterOption[] =
      skillsData?.map((skill: any) => ({
        value: skill.skill_name,
        label: skill.skill_name,
        count: skill.project_count,
      })) || [];

    // Get unique locations
    const { data: locationsData } = await supabase
      .from('projects')
      .select('location')
      .eq('status', 'open')
      .not('location', 'is', null);

    const locations = Array.from(
      new Set(locationsData?.map((p: any) => p.location).filter(Boolean) || []),
    );

    return {
      skills,
      budget_ranges: [], // Imported from types
      project_types: [], // Imported from types
      durations: [], // Imported from types
      locations,
    };
  }

  /**
   * Get skill suggestions for autocomplete
   */
  async getSkillSuggestions(query: string, limit = 10): Promise<string[]> {
    const supabase = this.supabase;

    const { data, error } = await supabase
      .from('project_skills')
      .select('skill_name')
      .ilike('skill_name', `${query}%`)
      .limit(limit);

    if (error) {
      throw error;
    }

    return Array.from(new Set(data?.map((s: any) => s.skill_name) || []));
  }

  // ==================== Analytics ====================

  /**
   * Track search analytics
   */
  private async trackSearchAnalytics(analytics: SearchAnalytics): Promise<void> {
    const supabase = this.supabase;

    const { error } = await supabase.from('search_analytics').insert({
      query: analytics.query,
      filters: analytics.filters,
      results_count: analytics.results_count,
      search_time_ms: analytics.search_time_ms,
      clicked_projects: analytics.clicked_projects,
    });

    if (error) {
      console.error('Search analytics tracking error:', error);
    }
  }

  /**
   * Track project click
   */
  async trackProjectClick(projectId: string): Promise<void> {
    const supabase = this.supabase;

    // Check if featured and increment click count
    const { data: featured } = await supabase
      .from('featured_projects')
      .select('id')
      .eq('project_id', projectId)
      .gte('featured_until', new Date().toISOString())
      .single();

    if (featured) {
      await supabase.rpc('increment_featured_click', { project_id: projectId });
    }
  }

  /**
   * Increment project views
   */
  private async incrementProjectViews(projectId: string): Promise<void> {
    const supabase = this.supabase;
    await supabase.rpc('increment_project_views', { project_id: projectId });
  }

  // ==================== Project Management (Client) ====================

  /**
   * Create a new project
   */
  async createProject(projectData: {
    title: string;
    description: string;
    budget: number;
    project_type: 'fixed' | 'hourly';
    duration_estimate?: string;
    deadline?: string;
    location?: string;
    is_remote?: boolean;
    skills: string[];
  }): Promise<string> {
    const supabase = this.supabase;

    const { skills, ...projectFields } = projectData;

    // Insert project
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert(projectFields)
      .select()
      .single();

    if (projectError) {
      throw projectError;
    }

    // Insert skills
    if (skills && skills.length > 0) {
      const skillRecords = skills.map((skill) => ({
        project_id: project.id,
        skill_name: skill,
        is_required: true,
      }));

      const { error: skillsError } = await supabase.from('project_skills').insert(skillRecords);

      if (skillsError) {
        console.error('Failed to insert skills:', skillsError);
      }
    }

    return project.id;
  }

  /**
   * Update project
   */
  async updateProject(
    projectId: string,
    updates: Partial<{
      title: string;
      description: string;
      budget: number;
      deadline: string;
      status: string;
    }>,
  ): Promise<void> {
    const supabase = this.supabase;

    const { error } = await supabase
      .from('projects')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('id', projectId);

    if (error) {
      throw error;
    }
  }

  /**
   * Delete project
   */
  async deleteProject(projectId: string): Promise<void> {
    const supabase = this.supabase;

    const { error } = await supabase.from('projects').delete().eq('id', projectId);

    if (error) {
      throw error;
    }
  }

  // ==================== Featured Projects ====================

  /**
   * Make project featured
   */
  async featureProject(
    projectId: string,
    durationDays: number,
    placement: 'top' | 'sidebar' | 'grid' = 'grid',
  ): Promise<void> {
    const supabase = this.supabase;

    const featuredUntil = new Date();
    featuredUntil.setDate(featuredUntil.getDate() + durationDays);

    // Insert featured record
    const { error: featuredError } = await supabase.from('featured_projects').upsert({
      project_id: projectId,
      featured_until: featuredUntil.toISOString(),
      placement,
    });

    if (featuredError) {
      throw featuredError;
    }

    // Update project
    const { error: projectError } = await supabase
      .from('projects')
      .update({
        is_featured: true,
        featured_until: featuredUntil.toISOString(),
      })
      .eq('id', projectId);

    if (projectError) {
      throw projectError;
    }
  }
}

// Export singleton instance
export const marketplaceService = new MarketplaceService();
