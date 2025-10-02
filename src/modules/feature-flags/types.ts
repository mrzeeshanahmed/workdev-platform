/**
 * A/B Testing and Feature Flag Types for WorkDev
 * Supports LaunchDarkly and Split.io integrations
 */

// --- Core Feature Flag Types ---
export interface FeatureFlagService {
  isFeatureEnabled: (flagKey: string, userId: string, context?: UserContext) => Promise<boolean>;
  getFeatureVariation: (flagKey: string, userId: string, defaultValue: any) => Promise<any>;
  trackFeatureUsage: (flagKey: string, userId: string, event: string) => void;
  getAllFlags: (userId: string) => Promise<Record<string, boolean>>;
}

// --- A/B Testing Types ---
export interface ABTestService {
  createExperiment: (experiment: ExperimentConfig) => Promise<Experiment>;
  getExperimentVariation: (experimentKey: string, userId: string) => Promise<string>;
  trackConversion: (
    experimentKey: string,
    userId: string,
    conversionEvent: string,
  ) => Promise<void>;
  getExperimentResults: (experimentKey: string) => Promise<ExperimentResults>;
}

// --- User Context for Targeting ---
export interface UserContext {
  email?: string;
  role?: 'client' | 'developer' | 'admin';
  country?: string;
  registration_date?: string;
  is_vetted?: boolean;
  total_projects?: number;
  account_tier?: 'free' | 'pro' | 'enterprise';
  userRole?: string;
  [key: string]: any;
}

// --- LaunchDarkly User ---
export interface LDUser {
  key: string;
  email?: string;
  name?: string;
  custom?: Record<string, any>;
}

// --- Experiment Configuration ---
export interface ExperimentConfig {
  key: string;
  name: string;
  hypothesis: string;
  variations: string[];
  traffic_allocation: number[];
  targeting_rules: TargetingRule[];
  success_metrics: string[];
  duration_days: number;
  minimum_sample_size: number;
}

export interface TargetingRule {
  attribute: string;
  operator: 'equals' | 'notEquals' | 'lessThan' | 'greaterThan' | 'in' | 'notIn';
  values: any[];
}

// --- Experiment Results ---
export interface Experiment {
  id: string;
  key: string;
  name: string;
  status: 'active' | 'paused' | 'completed' | 'archived';
  variations: string[];
  hypothesis: string;
  success_metrics: string[];
  created_at: string;
  updated_at?: string;
}

export interface ExperimentResults {
  experiment_key: string;
  status: 'running' | 'completed';
  sample_size: number;
  statistical_significance: number;
  confidence_level: number;
  variations: VariationResults[];
  winner?: string;
  recommendation: 'continue' | 'stop' | 'rollout' | 'rollback';
}

export interface VariationResults {
  name: string;
  sample_size: number;
  conversion_rate: number;
  conversion_count: number;
  confidence_interval: [number, number];
  improvement_over_control?: number;
  statistical_significance?: number;
}

// --- Feature Flag Configuration ---
export interface FeatureFlagConfig {
  key: string;
  name: string;
  description?: string;
  enabled: boolean;
  variations?: any[];
  targeting?: TargetingConfig;
  rollout_percentage?: number;
}

export interface TargetingConfig {
  rules: TargetingRule[];
  fallthrough_variation?: string;
}

// --- Gradual Rollout ---
export interface RolloutConfig {
  percentage: 1 | 5 | 10 | 25 | 50 | 75 | 100;
  targeting?: TargetingRule[];
  duration_hours?: number;
}

// --- Statistical Analysis ---
export interface StatisticalAnalysis {
  p_value: number;
  confidence_level: number;
  sample_size: number;
  effect_size: number;
  required_sample_size: number;
  is_significant: boolean;
}

// --- Conversion Tracking ---
export interface ConversionEvent {
  experiment_key: string;
  user_id: string;
  variation: string;
  event_name: string;
  timestamp: number;
  metadata?: Record<string, any>;
}

// --- Feature Flag Evaluation Result ---
export interface FlagEvaluationResult {
  flagKey: string;
  value: boolean | string | number;
  variation: string;
  reason: 'targeting' | 'fallthrough' | 'default' | 'rule_match';
  evaluationTime: number;
}

// --- Hooks Return Types ---
export interface UseFeatureFlagResult {
  isEnabled: boolean;
  loading: boolean;
  error?: Error;
}

export interface UseABTestResult {
  variation: string;
  isLoading: boolean;
  trackConversion: (event: string) => void;
  error?: Error;
}

// --- Service Configuration ---
export interface LaunchDarklyConfig {
  sdkKey: string;
  environment: string;
  stream?: boolean;
  baseUri?: string;
  eventsUri?: string;
}

export interface SplitIOConfig {
  authorizationKey: string;
  environment: string;
  trafficType?: string;
}

// --- Feature Flag Provider Props ---
export interface FeatureFlagProviderProps {
  children: React.ReactNode;
  config: LaunchDarklyConfig | SplitIOConfig;
  provider: 'launchdarkly' | 'splitio';
}
