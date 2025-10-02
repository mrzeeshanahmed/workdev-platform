/**
 * React Hooks for Feature Flags and A/B Testing
 */

import { useState, useEffect, useCallback } from 'react';
import type { UseFeatureFlagResult, UseABTestResult, UserContext } from '../types';

// Mock auth hook - replace with actual auth implementation
const useAuth = () => {
  return {
    user: {
      id: 'user123',
      role: 'developer' as const,
      email: 'user@example.com',
    },
  };
};

// Mock service getters - replace with actual service instances
const getFeatureFlagService = () => {
  // Import and return actual LaunchDarklyService instance
  return null as any;
};

const getABTestService = () => {
  // Import and return actual LaunchDarklyService instance
  return null as any;
};

/**
 * Hook to check if a feature flag is enabled for the current user
 */
export function useFeatureFlag(flagKey: string, context?: UserContext): UseFeatureFlagResult {
  const [isEnabled, setIsEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const checkFeatureFlag = async () => {
      try {
        const featureFlagService = getFeatureFlagService();
        if (!featureFlagService) {
          throw new Error('Feature flag service not initialized');
        }

        const enabled = await featureFlagService.isFeatureEnabled(flagKey, user.id, {
          userRole: user.role,
          ...context,
        });
        setIsEnabled(enabled);
        setError(undefined);
      } catch (err) {
        console.error(`Feature flag check failed for ${flagKey}:`, err);
        setIsEnabled(false);
        setError(err instanceof Error ? err : new Error('Feature flag check failed'));
      } finally {
        setLoading(false);
      }
    };

    checkFeatureFlag();
  }, [flagKey, user, context]);

  return { isEnabled, loading, error };
}

/**
 * Hook to get A/B test variation and track conversions
 */
export function useABTest(experimentKey: string): UseABTestResult {
  const [variation, setVariation] = useState<string>('control');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const { user } = useAuth();

  const trackConversion = useCallback(
    (event: string) => {
      if (user) {
        const abTestService = getABTestService();
        if (abTestService) {
          abTestService.trackConversion(experimentKey, user.id, event);
        }
      }
    },
    [experimentKey, user],
  );

  useEffect(() => {
    if (!user) {
      setIsLoading(false);
      return;
    }

    const getVariation = async () => {
      try {
        const abTestService = getABTestService();
        if (!abTestService) {
          throw new Error('A/B test service not initialized');
        }

        const userVariation = await abTestService.getExperimentVariation(experimentKey, user.id);
        setVariation(userVariation);
        setError(undefined);
      } catch (err) {
        console.error(`A/B test variation failed for ${experimentKey}:`, err);
        setVariation('control');
        setError(err instanceof Error ? err : new Error('A/B test variation failed'));
      } finally {
        setIsLoading(false);
      }
    };

    getVariation();
  }, [experimentKey, user]);

  return { variation, isLoading, trackConversion, error };
}

/**
 * Hook to get a feature variation (multivariate flag)
 */
export function useFeatureVariation<T = any>(
  flagKey: string,
  defaultValue: T,
): {
  value: T;
  loading: boolean;
  error?: Error;
} {
  const [value, setValue] = useState<T>(defaultValue);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | undefined>(undefined);
  const { user } = useAuth();

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }

    const getVariation = async () => {
      try {
        const featureFlagService = getFeatureFlagService();
        if (!featureFlagService) {
          throw new Error('Feature flag service not initialized');
        }

        const variation = await featureFlagService.getFeatureVariation(
          flagKey,
          user.id,
          defaultValue,
        );
        setValue(variation);
        setError(undefined);
      } catch (err) {
        console.error(`Feature variation failed for ${flagKey}:`, err);
        setValue(defaultValue);
        setError(err instanceof Error ? err : new Error('Feature variation failed'));
      } finally {
        setLoading(false);
      }
    };

    getVariation();
  }, [flagKey, user, defaultValue]);

  return { value, loading, error };
}
