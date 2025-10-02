/**
 * Analytics Module - Data Ingestion & System of Intelligence
 * Phase 2: Real-time event streaming, metrics, and ML-ready data pipeline
 */

// Export types
export * from './types';

// Export services
export { AnalyticsService, analyticsService } from './services/AnalyticsService';

// Module constants
export const EVENT_RETENTION_DAYS = {
  FINANCIAL: 2555, // 7 years
  SECURITY: 730, // 2 years
  INTERACTION: 365, // 1 year
  SYSTEM: 365, // 1 year
} as const;

export const BATCH_SIZE = {
  EVENT_PROCESSING: 100,
  AGGREGATION: 1000,
} as const;
