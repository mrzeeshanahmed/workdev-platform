/**
 * Recommendation Engine Type Definitions
 * Types for ML-powered personalized recommendations
 */

// ==================== Core Recommendation Types ====================

export interface ProjectRecommendation {
  recommendation_id: string;
  project_id: string;
  relevance_score: number;
  collaborative_score?: number;
  content_score?: number;
  skill_match_score?: number;
  budget_fit_score?: number;
  experience_match_score?: number;
  recency_score?: number;
  rank_position: number;
  explanation: string[];
  model_version: string;
  generated_at: string;
  expires_at: string;
  viewed_at?: string;
  applied_at?: string;
  dismissed_at?: string;
}

export interface TalentRecommendation {
  recommendation_id: string;
  client_user_id: string;
  project_id: string;
  developer_user_id: string;
  relevance_score: number;
  collaborative_score?: number;
  content_score?: number;
  skill_match_score?: number;
  experience_match_score?: number;
  reputation_score?: number;
  availability_score?: number;
  rank_position: number;
  explanation: string[];
  model_version: string;
  generated_at: string;
  expires_at: string;
  viewed_at?: string;
  contacted_at?: string;
  hired_at?: string;
  dismissed_at?: string;
}

// ==================== Developer Profile ====================

export interface DeveloperProfile {
  user_id: string;
  skills: string[];
  experience_level: 'junior' | 'mid' | 'senior' | 'expert';
  hourly_rate: number;
  preferences?: DeveloperPreferences;
  average_rating?: number;
  completion_rate?: number;
  total_projects_completed?: number;
  availability_status?: 'available' | 'partially_available' | 'busy';
  created_at?: string;
  avg_response_time_hours?: number;
}

export interface DeveloperPreferences {
  project_types?: string[];
  remote_preference?: 'remote_only' | 'hybrid' | 'onsite_only' | 'no_preference';
  industries?: string[];
  min_budget?: number;
  max_hours_per_week?: number;
}

// ==================== Project Types ====================

export interface ProjectForRecommendation {
  id: string;
  required_skills: string[];
  complexity_level: 'low' | 'medium' | 'high' | 'expert';
  budget_range: BudgetRange;
  project_type?: string;
  is_remote?: boolean;
  industry?: string;
  created_at?: string;
  expected_duration_weeks?: number;
  client_rating?: number;
  application_count?: number;
}

export interface BudgetRange {
  min?: number;
  max?: number;
  fixed?: number;
  estimated_hours?: number;
}

// ==================== API Request/Response Types ====================

export interface ProjectRecommendationRequest {
  developer_id: string;
  developer_profile: DeveloperProfile;
  candidate_projects: ProjectForRecommendation[];
  limit?: number;
  hybrid_weights?: HybridWeights;
  include_explanations?: boolean;
}

export interface TalentRecommendationRequest {
  client_user_id: string;
  project: ProjectForRecommendation;
  candidate_developers: DeveloperProfile[];
  limit?: number;
}

export interface HybridWeights {
  collaborative: number;
  content: number;
}

export interface RecommendationAPIResponse {
  recommendation_id?: string;
  project_id?: string;
  developer_user_id?: string;
  relevance_score: number;
  collaborative_score?: number;
  content_score?: number;
  skill_match_score?: number;
  budget_fit_score?: number;
  experience_match_score?: number;
  recency_score?: number;
  reputation_score?: number;
  availability_score?: number;
  rank_position: number;
  explanation: string[];
  model_version: string;
}

// ==================== Interaction Tracking ====================

export interface RecommendationInteraction {
  interaction_id: string;
  user_id: string;
  recommendation_type: 'project' | 'talent';
  recommendation_id: string;
  action: 'view' | 'apply' | 'hire' | 'contact' | 'dismiss' | 'click';
  interaction_context?: InteractionContext;
  converted?: boolean;
  conversion_date?: string;
  model_version: string;
  relevance_score?: number;
  rank_position?: number;
  created_at: string;
}

export interface InteractionContext {
  scroll_depth?: number;
  time_spent_seconds?: number;
  referrer?: string;
  device_type?: string;
  session_id?: string;
  [key: string]: any;
}

// ==================== ML Model Metadata ====================

export interface MLModelMetadata {
  model_id: string;
  model_name: string;
  model_version: string;
  model_type: 'collaborative' | 'content_based' | 'hybrid' | 'cold_start';
  model_path?: string;
  feature_importance?: Record<string, number>;
  hyperparameters?: Record<string, any>;
  training_data_size?: number;
  training_date: string;
  training_duration_seconds?: number;
  metrics: ModelMetrics;
  is_active: boolean;
  deployed_at?: string;
  deprecated_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ModelMetrics {
  'precision@5'?: number;
  'precision@10'?: number;
  'recall@5'?: number;
  'recall@10'?: number;
  'ndcg@5'?: number;
  'ndcg@10'?: number;
  'f1@10'?: number;
  view_rate?: number;
  application_rate?: number;
  hire_rate?: number;
  [key: string]: number | undefined;
}

// ==================== A/B Testing ====================

export interface RecommendationExperiment {
  experiment_id: string;
  experiment_name: string;
  description?: string;
  control_model_version: string;
  treatment_model_version: string;
  traffic_allocation: number;
  status: 'draft' | 'running' | 'paused' | 'completed';
  start_date?: string;
  end_date?: string;
  primary_metric: string;
  minimum_sample_size?: number;
  results?: ExperimentResults;
  winner?: 'control' | 'treatment' | 'inconclusive';
  created_at: string;
  updated_at: string;
}

export interface ExperimentResults {
  control_metrics: ModelMetrics;
  treatment_metrics: ModelMetrics;
  statistical_significance: number;
  effect_size: number;
  confidence_interval: [number, number];
  sample_size_control: number;
  sample_size_treatment: number;
}

export interface ExperimentAssignment {
  assignment_id: string;
  experiment_id: string;
  user_id: string;
  variant: 'control' | 'treatment';
  assigned_at: string;
}

// ==================== Service Options ====================

export interface GetRecommendationsOptions {
  limit?: number;
  include_expired?: boolean;
  min_relevance_score?: number;
  refresh?: boolean; // Force refresh from ML API
}

export interface RecordInteractionOptions {
  context?: InteractionContext;
  converted?: boolean;
}

export interface UpdateRecommendationsOptions {
  force_retrain?: boolean;
  batch_size?: number;
  active_users_only?: boolean;
}

// ==================== Cache & State ====================

export interface RecommendationCache {
  project_recommendations: Map<string, ProjectRecommendation[]>;
  talent_recommendations: Map<string, TalentRecommendation[]>;
  last_updated: Map<string, Date>;
  ttl_seconds: number;
}

export interface RecommendationState {
  loading: boolean;
  error: Error | null;
  recommendations: ProjectRecommendation[] | TalentRecommendation[];
  cache: RecommendationCache;
}

// ==================== ML API Client Types ====================

export interface MLAPIConfig {
  base_url: string;
  api_key?: string;
  timeout_ms?: number;
  retry_attempts?: number;
}

export interface MLAPIHealthResponse {
  status: string;
  model_version: string;
  model_loaded: boolean;
  timestamp: string;
}

export interface MLAPIModelInfo {
  model_version: string;
  model_loaded: boolean;
  num_users: number;
  num_projects: number;
  matrix_sparsity: number | null;
}

// ==================== Dashboard & Analytics ====================

export interface RecommendationMetrics {
  total_recommendations_generated: number;
  total_views: number;
  total_applications: number;
  total_hires: number;
  view_rate: number;
  application_rate: number;
  hire_rate: number;
  avg_relevance_score: number;
  model_version: string;
  date_range: {
    start: string;
    end: string;
  };
}

export interface RecommendationPerformance {
  model_version: string;
  metrics: ModelMetrics;
  business_metrics: {
    conversion_improvement: number; // % improvement over baseline
    user_satisfaction: number;
    coverage: number; // % of users receiving recommendations
  };
  date_calculated: string;
}

// ==================== Utility Types ====================

export type RecommendationType = 'project' | 'talent';

export type InteractionAction = 'view' | 'apply' | 'hire' | 'contact' | 'dismiss' | 'click';

export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'expert';

export type ComplexityLevel = 'low' | 'medium' | 'high' | 'expert';

export type AvailabilityStatus = 'available' | 'partially_available' | 'busy';

export type ExperimentStatus = 'draft' | 'running' | 'paused' | 'completed';

export type ExperimentVariant = 'control' | 'treatment';
