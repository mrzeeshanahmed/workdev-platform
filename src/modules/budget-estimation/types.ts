/**
 * Budget Estimation Type Definitions
 * Types for ML-powered project budget estimation
 */

// ==================== Core Budget Types ====================

export interface BudgetEstimate {
  estimated_budget: number;
  confidence_interval: ConfidenceInterval;
  budget_breakdown: BudgetBreakdown;
  market_insights: MarketInsights;
  recommendation: string;
  model_version: string;
  model_confidence_score: number;
  warning_flags: string[];
  response_time_ms?: number;
}

export interface ConfidenceInterval {
  lower_bound: number;
  upper_bound: number;
  confidence_level: number;
}

export interface BudgetBreakdown {
  planning_and_design: number;
  development: number;
  testing_and_qa: number;
  deployment_and_launch: number;
  buffer_contingency: number;
}

export interface MarketInsights {
  similar_projects_avg: number;
  skill_premium_factors: Record<string, number>;
  regional_adjustment: number;
  market_demand_factor: number;
  average_hourly_rate: number;
}

// ==================== API Request Types ====================

export interface ProjectDetails {
  description: string;
  required_skills: string[];
  estimated_hours?: number;
  complexity_level?: ComplexityLevel;
  project_type?: ProjectType;
  region?: string;
  estimated_duration_weeks?: number;
  initial_budget_min?: number;
  initial_budget_max?: number;
  currency?: string;
}

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'expert';

export type ProjectType =
  | 'web_app'
  | 'mobile_app'
  | 'api_backend'
  | 'data_pipeline'
  | 'ml_model'
  | 'blockchain'
  | 'integration'
  | 'other';

// ==================== Market Rate Types ====================

export interface MarketRateRequest {
  skills: string[];
  region?: string;
  hours?: number;
}

export interface MarketRateResponse {
  skill_premiums: Record<string, number>;
  estimated_budget_range: {
    min: number;
    max: number;
  };
  regional_adjustment: number;
  average_hourly_rate: number;
}

// ==================== Budget Validation Types ====================

export interface BudgetValidationRequest {
  proposed_budget: number;
  project_details: ProjectDetails;
}

export interface BudgetValidationResponse {
  is_realistic: boolean;
  deviation_from_estimate: number;
  deviation_percentage: number;
  recommendation: string;
  warnings: string[];
}

// ==================== Historical Budget Data ====================

export interface HistoricalProjectBudget {
  id: string;
  project_id: string;
  description: string;
  required_skills: string[];
  project_type?: string;
  complexity_level?: string;
  estimated_hours?: number;
  estimated_duration_weeks?: number;
  initial_budget_min?: number;
  initial_budget_max?: number;
  final_budget: number;
  actual_hours_worked?: number;
  actual_duration_weeks?: number;
  region?: string;
  currency: string;
  completion_status?: string;
  client_satisfaction_score?: number;
  budget_variance_percent?: number;
  created_at: string;
  completed_at?: string;
}

// ==================== Budget Estimation Record ====================

export interface BudgetEstimationRecord {
  id: string;
  project_id: string;
  estimated_budget: number;
  confidence_lower_bound: number;
  confidence_upper_bound: number;
  confidence_level: number;
  budget_breakdown: BudgetBreakdown;
  model_version: string;
  model_confidence_score?: number;
  feature_importance?: Record<string, number>;
  market_insights: MarketInsights;
  recommendation: string;
  warning_flags: string[];
  user_id: string;
  created_at: string;
  used_in_project: boolean;
  actual_final_budget?: number;
  prediction_error_percent?: number;
  was_within_confidence_interval?: boolean;
}

// ==================== Market Rate Data ====================

export interface MarketRateData {
  id: string;
  skill_name: string;
  skill_category?: string;
  region: string;
  average_hourly_rate: number;
  median_hourly_rate: number;
  min_rate?: number;
  max_rate?: number;
  rate_std_dev?: number;
  currency: string;
  sample_size: number;
  experience_level?: string;
  demand_multiplier: number;
  scarcity_premium: number;
  data_period_start: string;
  data_period_end: string;
  last_updated: string;
  data_source?: string;
  confidence_score: number;
}

// ==================== Model Performance ====================

export interface EstimationAccuracyMetrics {
  id: string;
  model_version: string;
  evaluation_date: string;
  mean_absolute_error?: number;
  mean_absolute_percentage_error?: number;
  r_squared_score?: number;
  within_10_percent_accuracy?: number;
  within_confidence_interval_rate?: number;
  accuracy_by_project_type?: Record<string, number>;
  accuracy_by_budget_range?: Record<string, number>;
  accuracy_by_region?: Record<string, number>;
  average_response_time_ms?: number;
  p95_response_time_ms?: number;
  p99_response_time_ms?: number;
  evaluation_sample_size: number;
  training_data_size?: number;
  training_date?: string;
  created_at: string;
}

export interface MLBudgetModel {
  id: string;
  model_version: string;
  model_type: string;
  model_path: string;
  feature_config: Record<string, any>;
  training_accuracy?: number;
  validation_accuracy?: number;
  test_accuracy?: number;
  is_active: boolean;
  is_production: boolean;
  trained_by?: string;
  training_samples?: number;
  training_date: string;
  deployed_at?: string;
  retired_at?: string;
  created_at: string;
  notes?: string;
}

// ==================== API Service Types ====================

export interface BudgetEstimationServiceConfig {
  apiBaseUrl: string;
  timeout?: number;
  cacheEnabled?: boolean;
  cacheTTL?: number;
}

export interface BudgetEstimationOptions {
  confidenceLevel?: number;
  includeBreakdown?: boolean;
  includeMarketInsights?: boolean;
  currency?: string;
}

export interface CachedEstimation {
  estimate: BudgetEstimate;
  timestamp: number;
  projectHash: string;
}

// ==================== Health Check ====================

export interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  model_loaded: boolean;
  model_version?: string;
  model_info?: ModelInfo;
}

export interface ModelInfo {
  model_version: string;
  is_trained: boolean;
  training_date?: string;
  training_samples: number;
  base_models: string[];
  ensemble_weights: number[];
  feature_count: number;
}

// ==================== Budget Statistics ====================

export interface BudgetStatistics {
  avg_budget: number;
  median_budget: number;
  min_budget: number;
  max_budget: number;
  std_dev: number;
  sample_size: number;
}

export interface BudgetStatisticsByType extends Record<string, BudgetStatistics> {}

// ==================== UI Component Props ====================

export interface BudgetEstimationWizardProps {
  initialData?: Partial<ProjectDetails>;
  onComplete?: (estimate: BudgetEstimate, projectDetails: ProjectDetails) => void;
  onCancel?: () => void;
  autoEstimate?: boolean;
}

export interface BudgetBreakdownChartProps {
  breakdown: BudgetBreakdown;
  totalBudget: number;
  showLabels?: boolean;
  showPercentages?: boolean;
}

export interface MarketInsightsPanelProps {
  insights: MarketInsights;
  projectDetails: ProjectDetails;
  showComparison?: boolean;
}

export interface ConfidenceIntervalDisplayProps {
  interval: ConfidenceInterval;
  estimatedBudget: number;
  showVisualization?: boolean;
}

// ==================== Error Types ====================

export class BudgetEstimationError extends Error {
  constructor(
    message: string,
    public code: string,
    public details?: any,
  ) {
    super(message);
    this.name = 'BudgetEstimationError';
  }
}

export interface EstimationErrorResponse {
  error: string;
  code: string;
  details?: any;
  timestamp: string;
}

// ==================== Utility Types ====================

export interface EstimationComparison {
  estimate1: BudgetEstimate;
  estimate2: BudgetEstimate;
  difference: number;
  difference_percentage: number;
  recommendation: string;
}

export interface BudgetTrend {
  date: string;
  average_budget: number;
  project_count: number;
  project_type?: string;
  region?: string;
  tech_stack?: Record<string, any>;
}

// ==================== Export All ====================

export // Core exports are already typed above
 type {};
