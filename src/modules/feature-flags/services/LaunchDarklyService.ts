/**
 * LaunchDarkly Service Implementation for WorkDev
 * Provides feature flagging and A/B testing capabilities
 */

import {
  FeatureFlagService,
  ABTestService,
  UserContext,
  LDUser,
  ExperimentConfig,
  Experiment,
  ExperimentResults,
  LaunchDarklyConfig,
} from '../types';

// Mock LaunchDarkly client types (install @launchdarkly/node-server-sdk for real implementation)
interface LDClient {
  variation: (flagKey: string, user: LDUser, defaultValue: any) => Promise<any>;
  track: (eventKey: string, user: LDUser, data?: any) => void;
  allFlagsState: (user: LDUser) => Promise<any>;
  close: () => void;
}

export class LaunchDarklyService implements FeatureFlagService, ABTestService {
  private ldClient: LDClient | null = null;
  private userCache: Map<string, LDUser> = new Map();
  private config: LaunchDarklyConfig;

  constructor(config: LaunchDarklyConfig) {
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    // In production, use: import * as LaunchDarkly from '@launchdarkly/node-server-sdk';
    // this.ldClient = LaunchDarkly.init(this.config.sdkKey);
    console.log('LaunchDarkly initialized with config:', this.config);
  }

  // --- Feature Flag Methods ---

  async isFeatureEnabled(flagKey: string, userId: string, context?: UserContext): Promise<boolean> {
    const startTime = performance.now();

    try {
      const user = await this.buildLDUser(userId, context);
      const enabled = await this.evaluateFlag(flagKey, user, false);

      const evalTime = performance.now() - startTime;
      if (evalTime > 5) {
        console.warn(`Feature flag evaluation took ${evalTime}ms (threshold: 5ms)`);
      }

      return enabled as boolean;
    } catch (error) {
      console.error(`Feature flag evaluation failed for ${flagKey}:`, error);
      return false;
    }
  }

  async getFeatureVariation(flagKey: string, userId: string, defaultValue: any): Promise<any> {
    try {
      const user = await this.buildLDUser(userId);
      return await this.evaluateFlag(flagKey, user, defaultValue);
    } catch (error) {
      console.error(`Feature variation evaluation failed for ${flagKey}:`, error);
      return defaultValue;
    }
  }

  trackFeatureUsage(flagKey: string, userId: string, event: string): void {
    const user = this.userCache.get(userId);
    if (!user) {
      console.warn(`User ${userId} not found in cache for tracking`);
      return;
    }

    if (this.ldClient) {
      this.ldClient.track(event, user, {
        flag_key: flagKey,
        timestamp: Date.now(),
      });
    }
  }

  async getAllFlags(userId: string): Promise<Record<string, boolean>> {
    try {
      const user = await this.buildLDUser(userId);
      if (!this.ldClient) {
        return {};
      }

      const flagsState = await this.ldClient.allFlagsState(user);
      return flagsState.allValues() || {};
    } catch (error) {
      console.error('Failed to get all flags:', error);
      return {};
    }
  }

  // --- A/B Testing Methods ---

  async createExperiment(experiment: ExperimentConfig): Promise<Experiment> {
    // In production, this would call LaunchDarkly API to create a feature flag
    const flagConfig = {
      name: experiment.key,
      kind: 'multivariate',
      variations: experiment.variations,
      targeting: {
        rules: experiment.targeting_rules,
        rollout: {
          variations: experiment.traffic_allocation,
        },
      },
    };

    console.log('Creating experiment:', flagConfig);

    return {
      id: `exp_${Date.now()}`,
      key: experiment.key,
      name: experiment.name,
      status: 'active',
      variations: experiment.variations,
      hypothesis: experiment.hypothesis,
      success_metrics: experiment.success_metrics,
      created_at: new Date().toISOString(),
    };
  }

  async getExperimentVariation(experimentKey: string, userId: string): Promise<string> {
    const variation = await this.getFeatureVariation(experimentKey, userId, 'control');

    // Track experiment participation
    this.trackFeatureUsage(experimentKey, userId, 'experiment_viewed');

    return variation;
  }

  async trackConversion(
    experimentKey: string,
    userId: string,
    conversionEvent: string,
  ): Promise<void> {
    const user = await this.buildLDUser(userId);

    if (this.ldClient) {
      this.ldClient.track(conversionEvent, user, {
        experiment_key: experimentKey,
        conversion_time: Date.now(),
      });
    }

    // Also track in analytics system
    console.log('Conversion tracked:', {
      experimentKey,
      userId,
      conversionEvent,
    });
  }

  async getExperimentResults(experimentKey: string): Promise<ExperimentResults> {
    // In production, this would fetch real results from LaunchDarkly Experimentation API
    return {
      experiment_key: experimentKey,
      status: 'running',
      sample_size: 0,
      statistical_significance: 0,
      confidence_level: 95,
      variations: [],
      recommendation: 'continue',
    };
  }

  // --- Private Helper Methods ---

  private async buildLDUser(userId: string, context?: UserContext): Promise<LDUser> {
    // Check cache first (5ms requirement)
    if (this.userCache.has(userId)) {
      return this.userCache.get(userId)!;
    }

    // Build user context for targeting
    const userProfile = await this.getUserProfile(userId);

    const ldUser: LDUser = {
      key: userId,
      email: userProfile?.email,
      name: userProfile?.name,
      custom: {
        role: userProfile?.role || context?.role,
        registration_date: userProfile?.created_at || context?.registration_date,
        is_vetted: userProfile?.is_vetted || context?.is_vetted,
        country: userProfile?.country || context?.country,
        total_projects: userProfile?.total_projects || context?.total_projects || 0,
        account_tier: this.calculateAccountTier(userProfile),
        ...context,
      },
    };

    // Cache for 5 minutes
    this.userCache.set(userId, ldUser);
    setTimeout(() => this.userCache.delete(userId), 5 * 60 * 1000);

    return ldUser;
  }

  private async getUserProfile(userId: string): Promise<any> {
    // In production, fetch from database or cache
    // For now, return mock data
    return {
      id: userId,
      email: `user${userId}@example.com`,
      name: `User ${userId}`,
      role: 'developer',
      created_at: new Date().toISOString(),
      is_vetted: false,
      total_projects: 0,
    };
  }

  private calculateAccountTier(userProfile: any): 'free' | 'pro' | 'enterprise' {
    if (!userProfile) return 'free';

    const totalProjects = userProfile.total_projects || 0;
    if (totalProjects > 50) return 'enterprise';
    if (totalProjects > 10) return 'pro';
    return 'free';
  }

  private async evaluateFlag(flagKey: string, user: LDUser, defaultValue: any): Promise<any> {
    if (!this.ldClient) {
      return defaultValue;
    }

    return await this.ldClient.variation(flagKey, user, defaultValue);
  }

  public close(): void {
    if (this.ldClient) {
      this.ldClient.close();
    }
  }
}

// Singleton instance
let launchDarklyInstance: LaunchDarklyService | null = null;

export function initializeLaunchDarkly(config: LaunchDarklyConfig): LaunchDarklyService {
  if (!launchDarklyInstance) {
    launchDarklyInstance = new LaunchDarklyService(config);
  }
  return launchDarklyInstance;
}

export function getLaunchDarklyService(): LaunchDarklyService {
  if (!launchDarklyInstance) {
    throw new Error('LaunchDarkly service not initialized. Call initializeLaunchDarkly first.');
  }
  return launchDarklyInstance;
}
