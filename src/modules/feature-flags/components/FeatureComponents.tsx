/**
 * React Components for Feature Flags and A/B Testing
 */

import React from 'react';
import { useFeatureFlag, useABTest } from '../hooks/useFeatureFlags';

/**
 * Feature Gate Component
 * Shows children only if feature flag is enabled
 */
export const FeatureGate: React.FC<{
  flagKey: string;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  loadingFallback?: React.ReactNode;
}> = ({ flagKey, children, fallback = null, loadingFallback = null }) => {
  const { isEnabled, loading } = useFeatureFlag(flagKey);

  if (loading) {
    return <>{loadingFallback}</>;
  }

  return isEnabled ? <>{children}</> : <>{fallback}</>;
};

/**
 * A/B Test Wrapper Component
 * Shows different variations based on experiment assignment
 */
export const ABTestWrapper: React.FC<{
  experimentKey: string;
  children: Record<string, React.ReactNode>;
  loadingFallback?: React.ReactNode;
}> = ({ experimentKey, children, loadingFallback = null }) => {
  const { variation, isLoading } = useABTest(experimentKey);

  if (isLoading) {
    return <>{loadingFallback}</>;
  }

  return <>{children[variation] || children['control']}</>;
};

/**
 * Gradual Rollout Component
 * Shows feature to a percentage of users
 */
export const GradualRollout: React.FC<{
  flagKey: string;
  percentage: number;
  children: React.ReactNode;
  fallback?: React.ReactNode;
}> = ({ flagKey, children, fallback = null }) => {
  const { isEnabled, loading } = useFeatureFlag(flagKey);

  if (loading) {
    return <>{fallback}</>;
  }

  return isEnabled ? <>{children}</> : <>{fallback}</>;
};

/**
 * Feature Toggle Button (for admins/testing)
 */
export const FeatureToggleButton: React.FC<{
  flagKey: string;
  onToggle?: (enabled: boolean) => void;
}> = ({ flagKey, onToggle }) => {
  const { isEnabled } = useFeatureFlag(flagKey);

  const handleToggle = () => {
    // In production, this would call admin API to toggle flag
    console.log(`Toggling feature flag: ${flagKey}`);
    onToggle?.(!isEnabled);
  };

  return (
    <button
      onClick={handleToggle}
      style={{
        padding: '8px 16px',
        background: isEnabled ? '#4CAF50' : '#f44336',
        color: 'white',
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
      }}
    >
      {flagKey}: {isEnabled ? 'ON' : 'OFF'}
    </button>
  );
};
