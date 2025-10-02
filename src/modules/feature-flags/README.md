# Feature Flags and A/B Testing Framework

Comprehensive system for safe feature rollouts, controlled experiments, and data-driven product decisions across the WorkDev platform.

## Features

- **Feature Flagging**: Enable/disable features for specific user segments
- **A/B Testing**: Run controlled experiments with statistical analysis
- **Gradual Rollouts**: Roll out features to percentages of users (1%, 5%, 25%, 50%, 100%)
- **User Segmentation**: Target based on role, tenure, geography, behavior
- **Statistical Analysis**: Real-time significance calculations and recommendations
- **React Integration**: Hooks and components for easy feature flag usage

## Quick Start

### 1. Initialize LaunchDarkly

```typescript
import { initializeLaunchDarkly } from 'modules/feature-flags';

const config = {
  sdkKey: process.env.LAUNCHDARKLY_SDK_KEY!,
  environment: process.env.NODE_ENV,
  stream: true,
};

const ldService = initializeLaunchDarkly(config);
```

### 2. Use Feature Flags in Components

```typescript
import { FeatureGate, useFeatureFlag } from 'modules/feature-flags';

// Using the component wrapper
function MyComponent() {
  return (
    <FeatureGate flagKey="sow_generation_enabled">
      <SOWGenerationFeature />
    </FeatureGate>
  );
}

// Using the hook
function AnotherComponent() {
  const { isEnabled, loading } = useFeatureFlag('ai_recommendations_enabled');

  if (loading) return <Spinner />;
  if (!isEnabled) return null;

  return <AIRecommendations />;
}
```

### 3. Run A/B Tests

```typescript
import { ABTestWrapper, useABTest } from 'modules/feature-flags';

// Using the component wrapper
function ProjectCreation() {
  return (
    <ABTestWrapper experimentKey="project_creation_flow">
      {{
        control: <StandardProjectForm />,
        treatment: <AIAssistedProjectForm />,
      }}
    </ABTestWrapper>
  );
}

// Using the hook with conversion tracking
function CheckoutPage() {
  const { variation, trackConversion } = useABTest('pricing_model_test');

  const handlePurchase = () => {
    // Track conversion when user completes purchase
    trackConversion('payment_completed');
  };

  return <CheckoutForm variation={variation} onPurchase={handlePurchase} />;
}
```

## Experiments

### Active Experiments

See `config/experiments.ts` for all active experiments:

- **project_creation_flow**: AI-assisted vs standard project creation
- **developer_profile_layout**: Testing 3 different profile layouts
- **pricing_model_test**: Comparing pricing strategies
- **onboarding_flow**: Streamlined vs traditional onboarding
- **search_algorithm**: ML-powered vs keyword search

### Creating New Experiments

```typescript
import { workdevExperiments } from 'modules/feature-flags';

const newExperiment = {
  key: 'new_feature_test',
  name: 'New Feature Test',
  hypothesis: 'New feature will increase engagement by 20%',
  variations: ['control', 'treatment'],
  traffic_allocation: [50, 50],
  targeting_rules: [{ attribute: 'role', operator: 'equals', values: ['developer'] }],
  success_metrics: ['feature_used', 'conversion_rate'],
  duration_days: 14,
  minimum_sample_size: 1000,
};
```

## Statistical Analysis

The framework includes utilities for calculating statistical significance:

```typescript
import {
  calculateStatisticalSignificance,
  calculateRequiredSampleSize,
  getExperimentRecommendation,
} from 'modules/feature-flags';

// Calculate if results are statistically significant
const analysis = calculateStatisticalSignificance(
  controlConversions,
  controlSampleSize,
  treatmentConversions,
  treatmentSampleSize,
);

if (analysis.is_significant) {
  console.log(`P-value: ${analysis.p_value}`);
  console.log(`Effect size: ${analysis.effect_size}`);
}

// Get recommendation on experiment
const recommendation = getExperimentRecommendation(
  currentSampleSize,
  requiredSampleSize,
  pValue,
  treatmentWinning,
);
// Returns: 'continue' | 'stop' | 'rollout' | 'rollback'
```

## Targeting Rules

Target specific user segments using attributes:

```typescript
targeting_rules: [
  { attribute: 'role', operator: 'equals', values: ['client'] },
  { attribute: 'total_projects', operator: 'greaterThan', values: [5] },
  { attribute: 'account_tier', operator: 'in', values: ['pro', 'enterprise'] },
  { attribute: 'country', operator: 'notEquals', values: ['US'] },
];
```

## Performance

- Feature flag evaluations complete within **5ms**
- User context cached for 5 minutes
- Minimal performance overhead (< 2% impact)
- Offline support with cached flags

## Integration with APM

Feature flag usage and experiment results are tracked in the APM system:

```typescript
// Automatically tracked:
// - Feature flag evaluations
// - Experiment participations
// - Conversion events
// - Statistical results
```

## Best Practices

1. **Always use the `control` variation** as your default/existing experience
2. **Set clear success metrics** before running experiments
3. **Calculate required sample size** using provided utilities
4. **Wait for statistical significance** before making decisions
5. **Use gradual rollouts** for risky features (1% → 5% → 25% → 50% → 100%)
6. **Clean up old flags** after full rollout or rollback

## API Reference

### Hooks

- `useFeatureFlag(flagKey, context?)`: Check if feature is enabled
- `useABTest(experimentKey)`: Get variation and track conversions
- `useFeatureVariation(flagKey, defaultValue)`: Get multivariate flag value

### Components

- `<FeatureGate>`: Conditionally render based on feature flag
- `<ABTestWrapper>`: Render different variations based on experiment
- `<GradualRollout>`: Progressive feature rollout component

### Services

- `LaunchDarklyService`: Main service for feature flags and experiments
- Statistical utilities for analysis and recommendations

## Environment Variables

```bash
LAUNCHDARKLY_SDK_KEY=sdk-xxx-xxx
LAUNCHDARKLY_CLIENT_ID=xxx
NODE_ENV=production
```

## License

Internal WorkDev use only.
