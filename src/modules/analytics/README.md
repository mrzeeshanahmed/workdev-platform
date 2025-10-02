# Analytics Module - Data Ingestion Pipeline

## Overview

The Analytics module implements WorkDev's Phase 2 evolution from "System of Record" to "System of Intelligence" by capturing all platform events in real-time and streaming them to a data warehouse for advanced analytics and machine learning.

## Architecture

### Event Flow

```
User Action → Client App → emit_platform_event() → platform_events table
                                                           ↓
                                   Edge Function (stream-platform-events)
                                                           ↓
                        BigQuery/Redshift ← Event Enrichment ← Batch Processing
```

### Components

1. **Database Layer** (`supabase/migrations/20251001_event_streaming_pipeline.sql`)
   - `platform_events`: Central event store
   - `platform_metrics_realtime`: Cached metrics with TTL
   - `event_aggregations`: Pre-computed hourly/daily/weekly stats
   - `warehouse_sync_status`: Sync tracking
   - `event_schemas`: Event validation and documentation

2. **Edge Function** (`supabase/functions/stream-platform-events/`)
   - Processes pending events in batches (100/minute)
   - Enriches events with user metadata
   - Streams to BigQuery or Redshift
   - Updates real-time metrics
   - Implements retry logic with exponential backoff

3. **Client Service** (`src/modules/analytics/services/AnalyticsService.ts`)
   - Singleton service for event emission
   - Session tracking
   - Device fingerprinting
   - Type-safe event APIs

## Usage

### 1. Setup

Run the database migration:

```bash
psql -U postgres -d workdev_db -f supabase/migrations/20251001_event_streaming_pipeline.sql
```

Deploy the edge function:

```bash
supabase functions deploy stream-platform-events
```

Set environment variables:

```bash
# For BigQuery
supabase secrets set BIGQUERY_ENABLED=true
supabase secrets set BIGQUERY_PROJECT_ID=your-project-id
supabase secrets set BIGQUERY_DATASET_ID=workdev_events

# For Redshift
supabase secrets set REDSHIFT_ENABLED=true
supabase secrets set REDSHIFT_HOST=your-cluster.redshift.amazonaws.com
supabase secrets set REDSHIFT_DATABASE=workdev
supabase secrets set REDSHIFT_USER=admin
supabase secrets set REDSHIFT_PASSWORD=your-password
```

Schedule the edge function (every minute):

```sql
SELECT cron.schedule(
  'stream-events',
  '* * * * *',
  $$SELECT net.http_post(
    url:='https://your-project.supabase.co/functions/v1/stream-platform-events',
    headers:='{"Authorization": "Bearer YOUR_SERVICE_ROLE_KEY"}'::jsonb
  )$$
);
```

### 2. Initialize Analytics Service

```typescript
import { analyticsService } from 'modules/analytics';

// Initialize session tracking (call once on app load)
await analyticsService.initSession();
```

### 3. Track Events

**Project Created:**

```typescript
await analyticsService.trackProjectCreated(projectId, {
  title: 'E-commerce Platform',
  budget: 5000,
  project_type: 'fixed',
  is_featured: false,
  skills: ['React', 'Node.js', 'PostgreSQL'],
});
```

**Proposal Submitted:**

```typescript
await analyticsService.trackProposalSubmitted(proposalId, projectId, bidAmount);
```

**Milestone Approved (Financial Event):**

```typescript
await analyticsService.trackMilestoneApproved(milestoneId, projectId, amount);
```

**Review Posted:**

```typescript
await analyticsService.trackReviewPosted(reviewId, {
  reviewee_user_id: clientId,
  reviewee_type: 'client',
  rating_overall: 4.5,
});
```

**Profile Viewed:**

```typescript
await analyticsService.trackProfileViewed(developerId);
```

**Search Performed:**

```typescript
await analyticsService.trackSearchPerformed(
  'react developer',
  { skills: ['React', 'TypeScript'], budget_min: 1000 },
  15, // results count
  350, // search time in ms
);
```

**User Login:**

```typescript
await analyticsService.trackUserLogin('github', true); // mfaUsed
```

### 4. Query Events

```typescript
const result = await analyticsService.queryEvents({
  event_types: ['project.created', 'proposal.submitted'],
  start_date: '2025-10-01T00:00:00Z',
  end_date: '2025-10-31T23:59:59Z',
  limit: 100,
});

console.log(`Total events: ${result.total}`);
console.log(`Events:`, result.events);
```

### 5. Get Dashboard Metrics

```typescript
const metrics = await analyticsService.getDashboardMetrics();

console.log(`Active users (last hour): ${metrics.active_users_last_hour}`);
console.log(`Projects created today: ${metrics.projects_created_today}`);
console.log(`Proposals submitted today: ${metrics.proposals_submitted_today}`);
```

### 6. Query Aggregations

```typescript
const aggregations = await analyticsService.queryAggregations({
  aggregation_type: 'daily',
  event_category: 'transaction',
  start_date: '2025-10-01',
  end_date: '2025-10-31',
});

console.log(`Total events: ${aggregations.total_events}`);
console.log(`Unique users: ${aggregations.unique_users}`);
```

## Integration with Existing Modules

### Marketplace Module

Replace existing `trackSearchAnalytics` with analytics service:

```typescript
// Before
await marketplaceService.trackSearchAnalytics(params, results.total, searchTime);

// After
await analyticsService.trackSearchPerformed(params.query || '', params, results.total, searchTime);
```

### Profiles Module

Track profile views:

```typescript
// In ProfileService.getProfile()
const profile = await fetchProfile(userId);
await analyticsService.trackProfileViewed(userId);
return profile;
```

### Clients Module

Track review submissions:

```typescript
// In ClientService.submitProjectReview()
const review = await insertReview(reviewData);
await analyticsService.trackReviewPosted(review.id, reviewData);
return review;
```

## Event Types & Retention

### Transaction Events (7-year retention)

- `project.created`, `project.updated`, `project.deleted`
- `proposal.submitted`, `proposal.accepted`, `proposal.rejected`
- `milestone.created`, `milestone.approved`, `milestone.completed`
- `payment.initiated`, `payment.completed`, `payment.failed`

### Interaction Events (1-year retention)

- `profile.viewed`, `project.viewed`
- `search.performed`, `filter.applied`
- `message.sent`, `notification.clicked`

### User Activity Events (2-year retention for security)

- `user.login`, `user.logout`, `user.registered`
- `session.started`, `session.ended`
- `password.changed`, `mfa.enabled`, `mfa.disabled`

### Content Events (7-year retention)

- `review.posted`, `review.updated`
- `portfolio.created`, `portfolio.updated`
- `profile.updated`, `github.synced`

## Data Warehouse Schema (BigQuery/Redshift)

```sql
CREATE TABLE platform_events (
  event_id STRING PRIMARY KEY,
  event_type STRING NOT NULL,
  event_category STRING NOT NULL,
  user_id STRING,
  user_role STRING,
  user_tenure_days INT64,
  entity_type STRING,
  entity_id STRING,
  event_data JSON,
  metadata JSON,
  source STRING,
  timestamp TIMESTAMP NOT NULL,
  session_id STRING,
  geo_location STRUCT<country STRING, region STRING, city STRING>,
  device_info STRUCT<device_type STRING, browser STRING, os STRING>,
  ingested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partition by day for performance
PARTITION BY DATE(timestamp)
CLUSTER BY event_type, user_id;
```

## Performance Characteristics

### Database

- **Throughput**: 10,000+ events/hour
- **Latency**: Sub-second event emission
- **Storage**: ~1KB per event (JSONB compressed)
- **Indexes**: GIN on event_data, B-tree on timestamp/user_id

### Edge Function

- **Batch Size**: 100 events per invocation
- **Frequency**: Every minute (60 batches/hour = 6,000 events)
- **Timeout**: 30 seconds
- **Retry Logic**: Max 3 retries with exponential backoff

### Data Warehouse

- **BigQuery**: Streaming inserts, 100K rows/second
- **Redshift**: COPY from S3 or direct INSERT
- **Latency**: 1-5 seconds for real-time queries

## Monitoring & Observability

### Check Sync Status

```sql
SELECT * FROM warehouse_sync_status
ORDER BY created_at DESC
LIMIT 10;
```

### Event Processing Metrics

```sql
SELECT
  processing_status,
  COUNT(*) as count,
  AVG(retry_count) as avg_retries
FROM platform_events
WHERE created_at > NOW() - INTERVAL '1 hour'
GROUP BY processing_status;
```

### Failed Events

```sql
SELECT event_id, event_type, error_message, retry_count
FROM platform_events
WHERE processing_status = 'failed'
ORDER BY created_at DESC
LIMIT 20;
```

### Real-Time Metrics

```sql
SELECT metric_key, metric_value, calculated_at
FROM platform_metrics_realtime
WHERE expires_at > NOW()
ORDER BY calculated_at DESC;
```

## Scheduled Jobs (pg_cron)

```sql
-- Aggregate events hourly
SELECT cron.schedule(
  'aggregate-events-hourly',
  '0 * * * *',
  'SELECT aggregate_events_hourly()'
);

-- Cleanup expired metrics every 15 minutes
SELECT cron.schedule(
  'cleanup-metrics',
  '*/15 * * * *',
  'SELECT cleanup_expired_metrics()'
);

-- Apply retention policy daily at 2 AM
SELECT cron.schedule(
  'apply-retention',
  '0 2 * * *',
  'SELECT apply_data_retention_policy()'
);
```

## Future Enhancements

### Phase 3: ML & Predictions

- User behavior clustering
- Churn prediction models
- Recommendation engine
- Anomaly detection
- A/B testing framework

### Phase 4: Real-Time Personalization

- Live user segmentation
- Dynamic pricing
- Smart notifications
- Predictive search

## Troubleshooting

### Events Not Processing

Check edge function logs:

```bash
supabase functions logs stream-platform-events
```

### High Retry Count

Increase batch size or reduce frequency:

```typescript
const BATCH_SIZE = 50; // Reduce from 100
```

### BigQuery Connection Failed

Verify service account has `bigquery.dataEditor` role:

```bash
gcloud projects add-iam-policy-binding YOUR_PROJECT_ID \
  --member="serviceAccount:YOUR_SA@YOUR_PROJECT.iam.gserviceaccount.com" \
  --role="roles/bigquery.dataEditor"
```

### Database Performance Issues

Enable table partitioning:

```sql
-- Partition platform_events by month
CREATE TABLE platform_events_2025_10 PARTITION OF platform_events
  FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');
```

## GDPR Compliance

### Anonymize User Data

```sql
-- Anonymize events for deleted user
UPDATE platform_events
SET
  user_id = NULL,
  event_data = event_data - 'email' - 'phone' - 'address',
  metadata = metadata - 'ip_address' - 'user_agent'
WHERE user_id = 'user-to-delete';
```

### Data Retention

Configured per event type in `event_schemas` table:

- Financial: 7 years (legal requirement)
- Security: 2 years (security audits)
- Interaction: 1 year (analytics)

## License

Part of the WorkDev platform. See main LICENSE file.
