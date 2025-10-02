// Application Performance Monitoring (APM) Types for WorkDev
// Supports frontend (React), backend (Node.js), and DataDog/New Relic integrations

// --- Core APM Service Interface ---
export interface APMService {
  trackPageView: (page: string, userId?: string) => void;
  trackUserAction: (action: string, properties: Record<string, any>) => void;
  trackError: (error: Error, context: Record<string, any>) => void;
  trackBusinessMetric: (metric: string, value: number, tags?: Record<string, string>) => void;
  startTransaction: (name: string) => Transaction;
}

// --- Transaction/Span Types ---
export interface Transaction {
  id: string;
  name: string;
  startTime: number;
  finish: () => void;
  addSpan?: (span: Span) => void;
}

export interface Span {
  id: string;
  name: string;
  startTime: number;
  endTime?: number;
  finish: () => void;
  attributes?: Record<string, any>;
}

// --- Error/Event Types ---
export interface APMError {
  message: string;
  stack?: string;
  name?: string;
  context?: Record<string, any>;
  timestamp?: number;
}

export interface BusinessMetricEvent {
  metric: string;
  value: number;
  tags?: Record<string, string>;
  timestamp?: number;
}

// --- DataDog/New Relic Config Types ---
export interface DataDogConfig {
  rumApplicationId: string;
  clientToken: string;
  environment: string;
  version: string;
}

export interface NewRelicConfig {
  accountId: string;
  trustKey: string;
  agentId: string;
  licenseKey: string;
  applicationId: string;
  environment: string;
  version: string;
}

// --- GDPR/User Session Types ---
export interface UserSession {
  sessionId: string;
  userId?: string;
  startTime: number;
  endTime?: number;
  consentGiven: boolean;
  anonymized: boolean;
}

// --- Frontend Metrics ---
export interface FrontendPerformanceMetrics {
  pageLoadTime: number;
  firstContentfulPaint: number;
  timeToInteractive: number;
  errorRate: number;
  userInteractions: number;
  sessionReplayUrl?: string;
}

// --- Backend/API Metrics ---
export interface BackendPerformanceMetrics {
  apiResponseTime: number;
  errorRate: number;
  dbQueryTime: number;
  throughput: number;
  thirdPartyLatency?: number;
}

// --- Infrastructure Metrics ---
export interface InfrastructureMetrics {
  cpuUsage: number;
  memoryUsage: number;
  diskIO: number;
  networkIO: number;
  dbPerformance: number;
  serviceHealth: Record<string, 'healthy' | 'degraded' | 'down'>;
}

// --- Business Metrics ---
export interface BusinessMetrics {
  conversionRate: number;
  userEngagement: number;
  featureAdoption: Record<string, number>;
  revenue: number;
  activeUsers: number;
}

// --- Alerting/Recommendation Types ---
export interface PerformanceAlert {
  type: 'error' | 'degradation' | 'anomaly';
  message: string;
  severity: 'info' | 'warning' | 'critical';
  detectedAt: number;
  affectedComponent?: string;
  details?: Record<string, any>;
}

export interface OptimizationRecommendation {
  area: 'frontend' | 'backend' | 'infrastructure' | 'business';
  description: string;
  impact: 'low' | 'medium' | 'high';
  suggestedFix: string;
}

// --- Utility Types ---
export type MetricTag = Record<string, string>;
export type MetricValue = number | string | boolean;

// --- Dashboard Widget Types ---
export interface DashboardWidget {
  type: 'metric' | 'timeseries' | 'heatmap' | 'table' | 'custom';
  title: string;
  query: string;
  options?: Record<string, any>;
}

export interface DashboardConfig {
  name: string;
  widgets: DashboardWidget[];
}
