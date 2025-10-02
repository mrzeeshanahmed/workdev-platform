/**
 * Feature Flags and A/B Testing Module
 * Comprehensive framework for safe feature rollouts and experiments
 */

// Types
export * from './types';

// Services
export {
  LaunchDarklyService,
  initializeLaunchDarkly,
  getLaunchDarklyService,
} from './services/LaunchDarklyService';

// Hooks
export { useFeatureFlag, useABTest, useFeatureVariation } from './hooks/useFeatureFlags';

// Components
export {
  FeatureGate,
  ABTestWrapper,
  GradualRollout,
  FeatureToggleButton,
} from './components/FeatureComponents';

// Configuration
export { workdevExperiments, featureRollouts, featureFlags } from './config/experiments';

// Utilities
export {
  calculateStatisticalSignificance,
  calculateRequiredSampleSize,
  calculateConfidenceInterval,
  getExperimentRecommendation,
  formatVariationResults,
} from './utils/statistics';
