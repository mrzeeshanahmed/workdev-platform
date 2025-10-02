/**
 * Budget Estimation Service
 * Client-side service for ML-powered budget estimation API
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { supabaseClient } from 'config/supabase/client';
import type {
  BudgetEstimate,
  ProjectDetails,
  MarketRateRequest,
  MarketRateResponse,
  BudgetValidationRequest,
  BudgetValidationResponse,
  HealthResponse,
  BudgetEstimationRecord,
  CachedEstimation,
} from '../types';
import { BudgetEstimationError } from '../types';

/**
 * Budget Estimation Service
 * Handles all budget estimation API calls with caching and error handling
 */
class BudgetEstimationService {
  private supabase: SupabaseClient;
  private apiBaseUrl: string;
  private cache: Map<string, CachedEstimation>;
  private cacheTTL: number = 5 * 60 * 1000; // 5 minutes

  constructor() {
    if (!supabaseClient) {
      throw new Error('Supabase client not initialized');
    }
    this.supabase = supabaseClient;
    this.apiBaseUrl = process.env.REACT_APP_BUDGET_API_URL || 'http://localhost:8001';
    this.cache = new Map();
  }

  /**
   * Estimate budget for a project
   */
  async estimateBudget(
    projectDetails: ProjectDetails,
    useCache: boolean = true,
  ): Promise<BudgetEstimate> {
    // Check cache first
    if (useCache) {
      const cached = this._getCachedEstimation(projectDetails);
      if (cached) {
        console.log('Returning cached budget estimate');
        return cached;
      }
    }

    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/budget/estimate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(projectDetails),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BudgetEstimationError(
          error.detail || 'Budget estimation failed',
          'ESTIMATION_FAILED',
          error,
        );
      }

      const estimate: BudgetEstimate = await response.json();

      // Cache the result
      this._cacheEstimation(projectDetails, estimate);

      return estimate;
    } catch (error) {
      if (error instanceof BudgetEstimationError) {
        throw error;
      }
      throw new BudgetEstimationError(
        'Failed to connect to budget estimation service',
        'CONNECTION_ERROR',
        error,
      );
    }
  }

  /**
   * Get market rates for specific skills and region
   */
  async getMarketRates(request: MarketRateRequest): Promise<MarketRateResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/budget/market-rates`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BudgetEstimationError(
          error.detail || 'Failed to fetch market rates',
          'MARKET_RATES_FAILED',
          error,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BudgetEstimationError) {
        throw error;
      }
      throw new BudgetEstimationError('Failed to fetch market rates', 'CONNECTION_ERROR', error);
    }
  }

  /**
   * Validate if a proposed budget is realistic
   */
  async validateBudget(request: BudgetValidationRequest): Promise<BudgetValidationResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/api/v1/budget/validate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new BudgetEstimationError(
          error.detail || 'Budget validation failed',
          'VALIDATION_FAILED',
          error,
        );
      }

      return await response.json();
    } catch (error) {
      if (error instanceof BudgetEstimationError) {
        throw error;
      }
      throw new BudgetEstimationError('Failed to validate budget', 'CONNECTION_ERROR', error);
    }
  }

  /**
   * Check ML API health status
   */
  async checkHealth(): Promise<HealthResponse> {
    try {
      const response = await fetch(`${this.apiBaseUrl}/health`);

      if (!response.ok) {
        throw new Error('Health check failed');
      }

      return await response.json();
    } catch (error) {
      throw new BudgetEstimationError(
        'Budget estimation service is unavailable',
        'SERVICE_UNAVAILABLE',
        error,
      );
    }
  }

  /**
   * Save budget estimation to database
   */
  async saveBudgetEstimation(
    projectId: string,
    userId: string,
    estimate: BudgetEstimate,
  ): Promise<string> {
    try {
      const { data, error } = await this.supabase.rpc('record_budget_estimation', {
        p_project_id: projectId,
        p_user_id: userId,
        p_estimated_budget: estimate.estimated_budget,
        p_confidence_lower: estimate.confidence_interval.lower_bound,
        p_confidence_upper: estimate.confidence_interval.upper_bound,
        p_budget_breakdown: estimate.budget_breakdown,
        p_market_insights: estimate.market_insights,
        p_model_version: estimate.model_version,
        p_recommendation: estimate.recommendation,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to save budget estimation:', error);
      throw new BudgetEstimationError('Failed to save budget estimation', 'DB_ERROR', error);
    }
  }

  /**
   * Get saved budget estimations for a user
   */
  async getUserEstimations(userId: string, limit: number = 10): Promise<BudgetEstimationRecord[]> {
    try {
      const { data, error } = await this.supabase
        .from('budget_estimations')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw error;
      }

      return data || [];
    } catch (error) {
      console.error('Failed to fetch user estimations:', error);
      throw new BudgetEstimationError('Failed to fetch estimations', 'DB_ERROR', error);
    }
  }

  /**
   * Get budget estimation for a specific project
   */
  async getProjectEstimation(projectId: string): Promise<BudgetEstimationRecord | null> {
    try {
      const { data, error } = await this.supabase
        .from('budget_estimations')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (error && error.code !== 'PGRST116') {
        // PGRST116 = no rows returned
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch project estimation:', error);
      return null;
    }
  }

  /**
   * Update estimation accuracy after project completion
   */
  async updateEstimationAccuracy(estimationId: string, actualBudget: number): Promise<boolean> {
    try {
      const { data, error } = await this.supabase.rpc('update_estimation_accuracy', {
        p_estimation_id: estimationId,
        p_actual_final_budget: actualBudget,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to update estimation accuracy:', error);
      return false;
    }
  }

  /**
   * Get model performance summary
   */
  async getModelPerformance(modelVersion: string): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc('get_model_performance_summary', {
        p_model_version: modelVersion,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch model performance:', error);
      return null;
    }
  }

  /**
   * Get budget statistics by project type
   */
  async getBudgetStatisticsByType(projectType: string): Promise<any> {
    try {
      const { data, error } = await this.supabase.rpc('get_budget_statistics_by_type', {
        p_project_type: projectType,
      });

      if (error) {
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Failed to fetch budget statistics:', error);
      return null;
    }
  }

  /**
   * Clear estimation cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get cached estimation if available and not expired
   */
  private _getCachedEstimation(projectDetails: ProjectDetails): BudgetEstimate | null {
    const hash = this._hashProjectDetails(projectDetails);
    const cached = this.cache.get(hash);

    if (!cached) {
      return null;
    }

    // Check if cache is expired
    if (Date.now() - cached.timestamp > this.cacheTTL) {
      this.cache.delete(hash);
      return null;
    }

    return cached.estimate;
  }

  /**
   * Cache estimation result
   */
  private _cacheEstimation(projectDetails: ProjectDetails, estimate: BudgetEstimate): void {
    const hash = this._hashProjectDetails(projectDetails);
    this.cache.set(hash, {
      estimate,
      timestamp: Date.now(),
      projectHash: hash,
    });

    // Clean up old cache entries (keep max 50)
    if (this.cache.size > 50) {
      const oldestKey = this.cache.keys().next().value;
      if (oldestKey) {
        this.cache.delete(oldestKey);
      }
    }
  }

  /**
   * Generate hash for project details
   */
  private _hashProjectDetails(projectDetails: ProjectDetails): string {
    const normalized = {
      description: projectDetails.description.trim().toLowerCase().slice(0, 100),
      skills: projectDetails.required_skills.sort().join(','),
      hours: projectDetails.estimated_hours || 0,
      complexity: projectDetails.complexity_level || 'medium',
      type: projectDetails.project_type || 'web_app',
      region: projectDetails.region || 'Global',
    };

    return JSON.stringify(normalized);
  }

  /**
   * Get current user ID from Supabase auth
   */
  private async _getCurrentUserId(): Promise<string | null> {
    const {
      data: { user },
    } = await this.supabase.auth.getUser();
    return user?.id || null;
  }
}

// Export singleton instance
export const budgetEstimationService = new BudgetEstimationService();

// Export class for testing
export { BudgetEstimationService };
