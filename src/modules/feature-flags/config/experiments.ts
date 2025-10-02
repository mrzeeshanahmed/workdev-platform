/**
 * WorkDev Experiment Configurations
 * Defines A/B tests and feature rollouts for the platform
 */

import type { ExperimentConfig, RolloutConfig } from '../types';

/**
 * Active A/B experiments for WorkDev
 */
export const workdevExperiments: ExperimentConfig[] = [
  {
    key: 'project_creation_flow',
    name: 'AI-Assisted Project Creation',
    hypothesis: 'AI-assisted project creation will increase project posting completion rate by 15%',
    variations: ['control', 'treatment'],
    traffic_allocation: [50, 50],
    targeting_rules: [
      { attribute: 'role', operator: 'equals', values: ['client'] },
      { attribute: 'total_projects', operator: 'lessThan', values: [3] },
    ],
    success_metrics: ['project_posted', 'received_first_proposal'],
    duration_days: 14,
    minimum_sample_size: 1000,
  },
  {
    key: 'developer_profile_layout',
    name: 'Enhanced Developer Profile Layout',
    hypothesis: 'New profile layout will increase client engagement by 20%',
    variations: ['control', 'compact', 'detailed'],
    traffic_allocation: [34, 33, 33],
    targeting_rules: [{ attribute: 'role', operator: 'equals', values: ['client'] }],
    success_metrics: ['profile_view_duration', 'contact_initiated', 'proposal_requested'],
    duration_days: 21,
    minimum_sample_size: 1500,
  },
  {
    key: 'pricing_model_test',
    name: 'Dynamic Pricing Model',
    hypothesis: 'Tiered pricing will increase premium conversions by 25%',
    variations: ['flat_fee', 'tiered_percentage', 'hybrid'],
    traffic_allocation: [34, 33, 33],
    targeting_rules: [
      { attribute: 'role', operator: 'equals', values: ['client'] },
      { attribute: 'account_tier', operator: 'equals', values: ['free'] },
    ],
    success_metrics: ['upgraded_to_premium', 'payment_completed', 'retention_30d'],
    duration_days: 30,
    minimum_sample_size: 2000,
  },
  {
    key: 'onboarding_flow',
    name: 'Streamlined Onboarding',
    hypothesis: 'Shorter onboarding flow will increase completion rate by 30%',
    variations: ['standard', 'progressive', 'minimal'],
    traffic_allocation: [34, 33, 33],
    targeting_rules: [
      { attribute: 'registration_date', operator: 'greaterThan', values: [Date.now() - 86400000] },
    ],
    success_metrics: ['onboarding_completed', 'profile_completed', 'first_action_taken'],
    duration_days: 7,
    minimum_sample_size: 500,
  },
  {
    key: 'search_algorithm',
    name: 'ML-Powered Search',
    hypothesis: 'ML-based search will increase project match quality by 40%',
    variations: ['keyword_search', 'ml_ranking', 'hybrid_approach'],
    traffic_allocation: [34, 33, 33],
    targeting_rules: [{ attribute: 'role', operator: 'in', values: ['client', 'developer'] }],
    success_metrics: ['search_result_clicked', 'proposal_submitted', 'hire_rate'],
    duration_days: 21,
    minimum_sample_size: 3000,
  },
];

/**
 * Gradual feature rollout configurations
 */
export const featureRollouts: Record<string, RolloutConfig> = {
  sow_generation: {
    percentage: 25,
    targeting: [
      { attribute: 'account_tier', operator: 'in', values: ['pro', 'enterprise'] },
      { attribute: 'total_projects', operator: 'greaterThan', values: [5] },
    ],
    duration_hours: 72,
  },
  video_interviews: {
    percentage: 50,
    targeting: [{ attribute: 'is_vetted', operator: 'equals', values: [true] }],
    duration_hours: 168,
  },
  advanced_analytics: {
    percentage: 10,
    targeting: [{ attribute: 'account_tier', operator: 'equals', values: ['enterprise'] }],
    duration_hours: 24,
  },
  ai_recommendations: {
    percentage: 75,
    targeting: [{ attribute: 'role', operator: 'in', values: ['client', 'developer'] }],
    duration_hours: 336,
  },
};

/**
 * Feature flag configurations for WorkDev
 */
export const featureFlags = {
  // Core features
  sow_generation_enabled: {
    key: 'sow_generation_enabled',
    name: 'SOW Generation',
    description: 'Enable Statement of Work generation feature',
    enabled: true,
    rollout_percentage: 25,
  },
  video_interviews_enabled: {
    key: 'video_interviews_enabled',
    name: 'Video Interviews',
    description: 'Enable video interview scheduling and recording',
    enabled: true,
    rollout_percentage: 50,
  },
  ai_recommendations_enabled: {
    key: 'ai_recommendations_enabled',
    name: 'AI Recommendations',
    description: 'Enable ML-powered project and talent recommendations',
    enabled: true,
    rollout_percentage: 75,
  },

  // Experimental features
  collaborative_coding_enabled: {
    key: 'collaborative_coding_enabled',
    name: 'Collaborative Coding',
    description: 'Enable real-time collaborative code editor',
    enabled: false,
    rollout_percentage: 5,
  },
  blockchain_payments_enabled: {
    key: 'blockchain_payments_enabled',
    name: 'Blockchain Payments',
    description: 'Enable cryptocurrency payment options',
    enabled: false,
    rollout_percentage: 1,
  },

  // Business features
  premium_tier_enabled: {
    key: 'premium_tier_enabled',
    name: 'Premium Tier',
    description: 'Enable premium subscription tier',
    enabled: true,
    rollout_percentage: 100,
  },
  referral_program_enabled: {
    key: 'referral_program_enabled',
    name: 'Referral Program',
    description: 'Enable user referral and rewards program',
    enabled: true,
    rollout_percentage: 100,
  },
};
