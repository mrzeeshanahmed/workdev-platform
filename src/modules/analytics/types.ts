/**
 * Data Ingestion & Analytics Types
 * Phase 2: System of Intelligence - Event streaming and analytics
 */

// ==================== Platform Events ====================

export type EventCategory = 'transaction' | 'interaction' | 'user_activity' | 'content' | 'system';
export type EventSource = 'web' | 'mobile' | 'api' | 'system';
export type ProcessingStatus = 'pending' | 'processing' | 'processed' | 'failed';

export interface PlatformEvent {
  event_id: string;
  event_type: string;
  event_category: EventCategory;
  user_id: string | null;
  entity_type: string | null;
  entity_id: string | null;
  event_data: Record<string, any>;
  metadata: EventMetadata;
  source: EventSource;
  timestamp: string;
  processing_status: ProcessingStatus;
  retry_count: number;
  error_message: string | null;
  created_at: string;
}

export interface EventMetadata {
  session_id?: string;
  ip_address?: string;
  user_agent?: string;
  geo_location?: GeoLocation;
  device_info?: DeviceInfo;
  referrer?: string;
  page_url?: string;
  [key: string]: any;
}

export interface GeoLocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface DeviceInfo {
  device_type?: 'desktop' | 'mobile' | 'tablet';
  browser?: string;
  os?: string;
  screen_width?: number;
  screen_height?: number;
}

// ==================== Event Emission ====================

export interface EmitEventPayload {
  event_type: string;
  event_category: EventCategory;
  entity_type?: string;
  entity_id?: string;
  event_data?: Record<string, any>;
  metadata?: Partial<EventMetadata>;
}

// ==================== Real-Time Metrics ====================

export type TimeWindow = 'hour' | 'day' | 'week' | 'month';

export interface RealTimeMetric {
  metric_key: string;
  metric_value: Record<string, any>;
  time_window: TimeWindow;
  calculated_at: string;
  expires_at: string;
}

export interface DashboardMetrics {
  active_users_last_hour: number;
  active_users_last_day: number;
  projects_created_today: number;
  proposals_submitted_today: number;
  reviews_posted_today: number;
  conversion_rate_last_7_days: number;
  avg_response_time_hours: number;
  total_revenue_today: number;
}

// ==================== Event Aggregations ====================

export type AggregationType = 'hourly' | 'daily' | 'weekly' | 'monthly';

export interface EventAggregation {
  id: string;
  aggregation_type: AggregationType;
  event_category: EventCategory;
  event_type: string | null;
  time_bucket: string;
  metrics: AggregationMetrics;
  created_at: string;
}

export interface AggregationMetrics {
  count: number;
  unique_users: number;
  sources?: Record<EventSource, number>;
  avg_duration_ms?: number;
  conversion_rate?: number;
  [key: string]: any;
}

// ==================== Analytics Queries ====================

export interface EventQueryParams {
  event_types?: string[];
  event_categories?: EventCategory[];
  user_id?: string;
  entity_type?: string;
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface EventQueryResult {
  events: PlatformEvent[];
  total: number;
  page: number;
  limit: number;
  has_more: boolean;
}

export interface AggregationQueryParams {
  aggregation_type: AggregationType;
  event_category?: EventCategory;
  event_type?: string;
  start_date: string;
  end_date: string;
}

export interface AggregationQueryResult {
  aggregations: EventAggregation[];
  total_events: number;
  unique_users: number;
  time_range: {
    start: string;
    end: string;
  };
}

// ==================== Event Schemas ====================

export interface EventSchema {
  event_type: string;
  event_category: EventCategory;
  schema_definition: Record<string, any>; // JSON Schema
  required_fields: string[];
  example_payload: Record<string, any>;
  description: string;
  retention_days: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ==================== Warehouse Sync ====================

export type WarehouseType = 'bigquery' | 'redshift' | 'snowflake';
export type SyncStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface WarehouseSyncStatus {
  id: string;
  sync_batch_id: string;
  warehouse_type: WarehouseType;
  last_synced_event_id: string | null;
  last_synced_timestamp: string | null;
  events_synced: number;
  sync_duration_ms: number;
  sync_status: SyncStatus;
  error_details: string | null;
  created_at: string;
  updated_at: string;
}

// ==================== Predefined Event Types ====================

// Transaction Events (7-year retention)
export type TransactionEventType =
  | 'project.created'
  | 'project.updated'
  | 'project.deleted'
  | 'proposal.submitted'
  | 'proposal.accepted'
  | 'proposal.rejected'
  | 'milestone.created'
  | 'milestone.approved'
  | 'milestone.completed'
  | 'payment.initiated'
  | 'payment.completed'
  | 'payment.failed';

// Interaction Events (1-year retention)
export type InteractionEventType =
  | 'profile.viewed'
  | 'project.viewed'
  | 'search.performed'
  | 'filter.applied'
  | 'message.sent'
  | 'notification.clicked';

// User Activity Events (2-year retention for security)
export type UserActivityEventType =
  | 'user.login'
  | 'user.logout'
  | 'user.registered'
  | 'session.started'
  | 'session.ended'
  | 'password.changed'
  | 'mfa.enabled'
  | 'mfa.disabled';

// Content Events (7-year retention)
export type ContentEventType =
  | 'review.posted'
  | 'review.updated'
  | 'portfolio.created'
  | 'portfolio.updated'
  | 'profile.updated'
  | 'github.synced';

// System Events (1-year retention)
export type SystemEventType =
  | 'error.occurred'
  | 'job.started'
  | 'job.completed'
  | 'job.failed'
  | 'sync.completed'
  | 'backup.completed';

// ==================== Event Data Schemas ====================

export interface ProjectCreatedData {
  title: string;
  budget: number;
  project_type: 'fixed' | 'hourly';
  is_featured: boolean;
  skills: string[];
}

export interface ProposalSubmittedData {
  project_id: string;
  developer_id: string;
  bid_amount: number;
  estimated_duration_days: number;
}

export interface MilestoneApprovedData {
  milestone_id: string;
  project_id: string;
  amount: number;
  payment_method: string;
}

export interface ReviewPostedData {
  reviewee_user_id: string;
  reviewee_type: 'client' | 'developer';
  rating_overall: number;
  rating_communication: number;
  rating_professionalism: number;
}

export interface ProfileViewedData {
  viewed_user_id: string;
  viewer_type: 'client' | 'developer' | 'anonymous';
  view_duration_seconds?: number;
}

export interface SearchPerformedData {
  query: string;
  filters: Record<string, any>;
  results_count: number;
  search_time_ms: number;
}

export interface UserLoginData {
  login_method: 'email' | 'github' | 'google';
  session_id: string;
  mfa_used: boolean;
}

// ==================== Funnel Analytics ====================

export interface ConversionFunnel {
  funnel_name: string;
  steps: FunnelStep[];
  overall_conversion_rate: number;
  total_users: number;
}

export interface FunnelStep {
  step_number: number;
  step_name: string;
  event_type: string;
  users_count: number;
  conversion_rate: number;
  avg_time_to_next_step_minutes: number | null;
}

// ==================== Cohort Analysis ====================

export interface CohortData {
  cohort_date: string;
  cohort_size: number;
  retention_by_week: Record<number, number>;
  revenue_by_week: Record<number, number>;
}

// ==================== ML Features ====================

export interface UserBehaviorFeatures {
  user_id: string;
  total_events: number;
  events_by_category: Record<EventCategory, number>;
  avg_session_duration_minutes: number;
  last_active_at: string;
  days_since_registration: number;
  conversion_likelihood_score: number;
}
