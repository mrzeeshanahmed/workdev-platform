/**
 * Recommendation Service
 * Client-side service for consuming ML recommendation API and managing recommendations
 */

import { supabaseClient } from 'config/supabase/client';
import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  ProjectRecommendation,
  TalentRecommendation,
  DeveloperProfile,
  ProjectForRecommendation,
  ProjectRecommendationRequest,
  TalentRecommendationRequest,
  RecommendationAPIResponse,
  GetRecommendationsOptions,
  RecordInteractionOptions,
  InteractionAction,
  RecommendationMetrics,
  MLAPIHealthResponse,
  MLAPIModelInfo,
  ExperimentVariant,
} from '../types';

class RecommendationService {
  private mlApiBaseUrl: string;
  private cache: Map<string, { data: any; timestamp: number }>;
  private cacheTTL: number; // milliseconds
  private supabase: SupabaseClient;

  constructor() {
    // ML API base URL from environment variable
    this.mlApiBaseUrl = process.env.REACT_APP_ML_API_URL || 'http://localhost:8000';
    this.cache = new Map();
    this.cacheTTL = 5 * 60 * 1000; // 5 minutes default

    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }

    this.supabase = supabaseClient;
  }

  // ==================== Project Recommendations ====================

  /**
   * Get personalized project recommendations for a developer.
   */
  async getProjectRecommendations(
    developerId: string,
    options: GetRecommendationsOptions = {},
  ): Promise<ProjectRecommendation[]> {
    const cacheKey = `project_recommendations_${developerId}`;

    // Check cache unless force refresh
    if (!options.refresh && this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      // First, try to get from database (pre-generated recommendations)
      const { data: dbRecommendations, error: dbError } = await this.supabase
        .rpc('get_developer_recommendations', {
          p_user_id: developerId,
          p_limit: options.limit || 10,
        })
        .select('*');

      if (dbError) throw dbError;

      // If we have valid recommendations, return them
      if (dbRecommendations && dbRecommendations.length > 0) {
        const formattedRecommendations = dbRecommendations.map((rec: any) => ({
          recommendation_id: rec.recommendation_id,
          project_id: rec.project_id,
          relevance_score: rec.relevance_score,
          collaborative_score: rec.collaborative_score,
          content_score: rec.content_score,
          skill_match_score: rec.skill_match_score,
          budget_fit_score: rec.budget_fit_score,
          experience_match_score: rec.experience_match_score,
          recency_score: rec.recency_score,
          rank_position: rec.rank_position,
          explanation: rec.explanation,
          model_version: rec.model_version,
          generated_at: rec.generated_at,
          expires_at: rec.expires_at,
          viewed_at: rec.viewed_at,
          applied_at: rec.applied_at,
          dismissed_at: rec.dismissed_at,
        }));

        this._setCache(cacheKey, formattedRecommendations);
        return formattedRecommendations;
      }

      // If no pre-generated recommendations, generate real-time
      return await this.generateProjectRecommendationsRealtime(developerId, options);
    } catch (error) {
      console.error('Error fetching project recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate project recommendations in real-time using ML API.
   */
  async generateProjectRecommendationsRealtime(
    developerId: string,
    options: GetRecommendationsOptions = {},
  ): Promise<ProjectRecommendation[]> {
    try {
      // Get developer profile
      const { data: profile, error: profileError } = await this.supabase
        .from('developer_profiles')
        .select('*')
        .eq('user_id', developerId)
        .single();

      if (profileError) throw profileError;

      // Get candidate projects (open projects)
      const { data: projects, error: projectsError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('status', 'open')
        .limit(100); // Limit candidates for performance

      if (projectsError) throw projectsError;

      // Format for ML API
      const developerProfile: DeveloperProfile = {
        user_id: developerId,
        skills: profile.skills || [],
        experience_level: profile.experience_level || 'mid',
        hourly_rate: profile.hourly_rate || 50,
        preferences: profile.preferences || {},
        average_rating: profile.average_rating,
        completion_rate: profile.completion_rate,
        total_projects_completed: profile.total_projects_completed,
        availability_status: profile.availability_status,
      };

      const candidateProjects: ProjectForRecommendation[] = projects.map((p) => ({
        id: p.id,
        required_skills: p.required_skills || [],
        complexity_level: p.complexity_level || 'medium',
        budget_range: p.budget_range || {},
        project_type: p.project_type,
        is_remote: p.is_remote !== false,
        industry: p.industry,
        created_at: p.created_at,
      }));

      // Call ML API
      const request: ProjectRecommendationRequest = {
        developer_id: developerId,
        developer_profile: developerProfile,
        candidate_projects: candidateProjects,
        limit: options.limit || 10,
      };

      const response = await fetch(`${this.mlApiBaseUrl}/api/v1/recommendations/projects`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.statusText}`);
      }

      const mlRecommendations: RecommendationAPIResponse[] = await response.json();

      // Store recommendations in database for caching
      await this._storeProjectRecommendations(developerId, mlRecommendations);

      // Convert to domain model
      const recommendations: ProjectRecommendation[] = mlRecommendations.map((rec, idx) => ({
        recommendation_id: crypto.randomUUID(),
        project_id: rec.project_id!,
        relevance_score: rec.relevance_score,
        collaborative_score: rec.collaborative_score,
        content_score: rec.content_score,
        skill_match_score: rec.skill_match_score,
        budget_fit_score: rec.budget_fit_score,
        experience_match_score: rec.experience_match_score,
        recency_score: rec.recency_score,
        rank_position: idx + 1,
        explanation: rec.explanation,
        model_version: rec.model_version,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }));

      return recommendations;
    } catch (error) {
      console.error('Error generating real-time recommendations:', error);
      throw error;
    }
  }

  /**
   * Get talent recommendations for a project.
   */
  async getTalentRecommendations(
    clientUserId: string,
    projectId: string,
    options: GetRecommendationsOptions = {},
  ): Promise<TalentRecommendation[]> {
    const cacheKey = `talent_recommendations_${projectId}`;

    // Check cache
    if (!options.refresh && this._isCacheValid(cacheKey)) {
      return this.cache.get(cacheKey)!.data;
    }

    try {
      // Get from database
      const { data: dbRecommendations, error: dbError } = await this.supabase
        .rpc('get_talent_recommendations', {
          p_client_user_id: clientUserId,
          p_project_id: projectId,
          p_limit: options.limit || 10,
        })
        .select('*');

      if (dbError) throw dbError;

      if (dbRecommendations && dbRecommendations.length > 0) {
        const recommendations = dbRecommendations.map((rec: any) => ({
          recommendation_id: rec.recommendation_id,
          client_user_id: clientUserId,
          project_id: projectId,
          developer_user_id: rec.developer_user_id,
          relevance_score: rec.relevance_score,
          skill_match_score: rec.skill_match_score,
          experience_match_score: rec.experience_match_score,
          reputation_score: rec.reputation_score,
          availability_score: rec.availability_score,
          rank_position: rec.rank_position,
          explanation: rec.explanation,
          model_version: rec.model_version,
          generated_at: rec.generated_at,
          expires_at: rec.expires_at,
          viewed_at: rec.viewed_at,
          contacted_at: rec.contacted_at,
          hired_at: rec.hired_at,
          dismissed_at: rec.dismissed_at,
        }));

        this._setCache(cacheKey, recommendations);
        return recommendations;
      }

      // Generate real-time if no cached recommendations
      return await this.generateTalentRecommendationsRealtime(clientUserId, projectId, options);
    } catch (error) {
      console.error('Error fetching talent recommendations:', error);
      throw error;
    }
  }

  /**
   * Generate talent recommendations in real-time.
   */
  async generateTalentRecommendationsRealtime(
    clientUserId: string,
    projectId: string,
    options: GetRecommendationsOptions = {},
  ): Promise<TalentRecommendation[]> {
    try {
      // Get project details
      const { data: project, error: projectError } = await this.supabase
        .from('projects')
        .select('*')
        .eq('id', projectId)
        .single();

      if (projectError) throw projectError;

      // Get available developers
      const { data: developers, error: devsError } = await this.supabase
        .from('developer_profiles')
        .select('*')
        .eq('availability_status', 'available')
        .limit(100);

      if (devsError) throw devsError;

      // Format for ML API
      const projectForRecommendation: ProjectForRecommendation = {
        id: projectId,
        required_skills: project.required_skills || [],
        complexity_level: project.complexity_level || 'medium',
        budget_range: project.budget_range || {},
        project_type: project.project_type,
        is_remote: project.is_remote,
        industry: project.industry,
        created_at: project.created_at,
      };

      const candidateDevelopers: DeveloperProfile[] = developers.map((d) => ({
        user_id: d.user_id,
        skills: d.skills || [],
        experience_level: d.experience_level || 'mid',
        hourly_rate: d.hourly_rate || 50,
        average_rating: d.average_rating,
        completion_rate: d.completion_rate,
        total_projects_completed: d.total_projects_completed,
        availability_status: d.availability_status,
      }));

      // Call ML API
      const request: TalentRecommendationRequest = {
        client_user_id: clientUserId,
        project: projectForRecommendation,
        candidate_developers: candidateDevelopers,
        limit: options.limit || 10,
      };

      const response = await fetch(`${this.mlApiBaseUrl}/api/v1/recommendations/talent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        throw new Error(`ML API error: ${response.statusText}`);
      }

      const mlRecommendations: RecommendationAPIResponse[] = await response.json();

      // Store in database
      await this._storeTalentRecommendations(clientUserId, projectId, mlRecommendations);

      // Convert to domain model
      const recommendations: TalentRecommendation[] = mlRecommendations.map((rec, idx) => ({
        recommendation_id: crypto.randomUUID(),
        client_user_id: clientUserId,
        project_id: projectId,
        developer_user_id: rec.developer_user_id!,
        relevance_score: rec.relevance_score,
        skill_match_score: rec.skill_match_score,
        experience_match_score: rec.experience_match_score,
        reputation_score: rec.reputation_score,
        availability_score: rec.availability_score,
        rank_position: idx + 1,
        explanation: rec.explanation,
        model_version: rec.model_version,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }));

      return recommendations;
    } catch (error) {
      console.error('Error generating real-time talent recommendations:', error);
      throw error;
    }
  }

  // ==================== Interaction Tracking ====================

  /**
   * Record user interaction with a recommendation.
   */
  async recordInteraction(
    recommendationId: string,
    recommendationType: 'project' | 'talent',
    action: InteractionAction,
    options: RecordInteractionOptions = {},
  ): Promise<void> {
    try {
      const userId = await this._getCurrentUserId();

      const { error } = await this.supabase.rpc('record_recommendation_interaction', {
        p_user_id: userId,
        p_recommendation_type: recommendationType,
        p_recommendation_id: recommendationId,
        p_action: action,
        p_interaction_context: options.context || null,
      });

      if (error) throw error;

      // If converted, update conversion status
      if (options.converted) {
        await this.supabase
          .from('recommendation_interactions')
          .update({
            converted: true,
            conversion_date: new Date().toISOString(),
          })
          .eq('recommendation_id', recommendationId)
          .eq('action', action);
      }
    } catch (error) {
      console.error('Error recording interaction:', error);
      // Don't throw - interaction tracking shouldn't break user experience
    }
  }

  /**
   * Mark recommendation as viewed.
   */
  async markAsViewed(
    recommendationId: string,
    recommendationType: 'project' | 'talent',
  ): Promise<void> {
    await this.recordInteraction(recommendationId, recommendationType, 'view');
  }

  /**
   * Mark recommendation as dismissed.
   */
  async dismissRecommendation(
    recommendationId: string,
    recommendationType: 'project' | 'talent',
  ): Promise<void> {
    await this.recordInteraction(recommendationId, recommendationType, 'dismiss');

    // Clear from cache
    this.cache.clear();
  }

  // ==================== A/B Testing ====================

  /**
   * Get experiment variant for current user.
   */
  async getExperimentVariant(experimentName: string): Promise<ExperimentVariant> {
    try {
      const userId = await this._getCurrentUserId();

      const { data, error } = await this.supabase.rpc('get_experiment_variant', {
        p_user_id: userId,
        p_experiment_name: experimentName,
      });

      if (error) throw error;

      return data as ExperimentVariant;
    } catch (error) {
      console.error('Error getting experiment variant:', error);
      return 'control'; // Default to control on error
    }
  }

  // ==================== Metrics & Analytics ====================

  /**
   * Get recommendation performance metrics.
   */
  async getRecommendationMetrics(
    modelVersion: string,
    dateFrom: string,
    dateTo: string,
  ): Promise<RecommendationMetrics> {
    try {
      const { data, error } = await this.supabase.rpc('calculate_recommendation_metrics', {
        p_model_version: modelVersion,
        p_date_from: dateFrom,
        p_date_to: dateTo,
      });

      if (error) throw error;

      return {
        total_recommendations_generated: data.total_recommendations || 0,
        total_views: data.total_views || 0,
        total_applications: data.total_applications || 0,
        total_hires: data.total_hires || 0,
        view_rate: data.view_rate || 0,
        application_rate: data.application_rate || 0,
        hire_rate: data.hire_rate || 0,
        avg_relevance_score: 0,
        model_version: modelVersion,
        date_range: {
          start: dateFrom,
          end: dateTo,
        },
      };
    } catch (error) {
      console.error('Error fetching recommendation metrics:', error);
      throw error;
    }
  }

  // ==================== ML API Health ====================

  /**
   * Check ML API health status.
   */
  async checkMLAPIHealth(): Promise<MLAPIHealthResponse> {
    try {
      const response = await fetch(`${this.mlApiBaseUrl}/health`);

      if (!response.ok) {
        throw new Error(`ML API health check failed: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('ML API health check failed:', error);
      throw error;
    }
  }

  /**
   * Get ML model information.
   */
  async getModelInfo(): Promise<MLAPIModelInfo> {
    try {
      const response = await fetch(`${this.mlApiBaseUrl}/api/v1/model/info`);

      if (!response.ok) {
        throw new Error(`Failed to fetch model info: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Error fetching model info:', error);
      throw error;
    }
  }

  // ==================== Private Helper Methods ====================

  private async _storeProjectRecommendations(
    developerId: string,
    recommendations: RecommendationAPIResponse[],
  ): Promise<void> {
    try {
      const recommendationsToInsert = recommendations.map((rec) => ({
        user_id: developerId,
        project_id: rec.project_id,
        relevance_score: rec.relevance_score,
        collaborative_score: rec.collaborative_score,
        content_score: rec.content_score,
        skill_match_score: rec.skill_match_score,
        budget_fit_score: rec.budget_fit_score,
        experience_match_score: rec.experience_match_score,
        recency_score: rec.recency_score,
        rank_position: rec.rank_position,
        explanation: rec.explanation,
        model_version: rec.model_version,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }));

      await this.supabase.from('developer_recommendations').insert(recommendationsToInsert);
    } catch (error) {
      console.error('Error storing project recommendations:', error);
    }
  }

  private async _storeTalentRecommendations(
    clientUserId: string,
    projectId: string,
    recommendations: RecommendationAPIResponse[],
  ): Promise<void> {
    try {
      const recommendationsToInsert = recommendations.map((rec) => ({
        client_user_id: clientUserId,
        project_id: projectId,
        developer_user_id: rec.developer_user_id,
        relevance_score: rec.relevance_score,
        skill_match_score: rec.skill_match_score,
        experience_match_score: rec.experience_match_score,
        reputation_score: rec.reputation_score,
        availability_score: rec.availability_score,
        rank_position: rec.rank_position,
        explanation: rec.explanation,
        model_version: rec.model_version,
        generated_at: new Date().toISOString(),
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      }));

      await this.supabase.from('client_recommendations').insert(recommendationsToInsert);
    } catch (error) {
      console.error('Error storing talent recommendations:', error);
    }
  }

  private async _getCurrentUserId(): Promise<string> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();

    if (!user) {
      throw new Error('User not authenticated');
    }

    return user.id;
  }

  private _isCacheValid(key: string): boolean {
    const cached = this.cache.get(key);
    if (!cached) return false;

    const age = Date.now() - cached.timestamp;
    return age < this.cacheTTL;
  }

  private _setCache(key: string, data: any): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
    });
  }
}

// Export singleton instance
export const recommendationService = new RecommendationService();
