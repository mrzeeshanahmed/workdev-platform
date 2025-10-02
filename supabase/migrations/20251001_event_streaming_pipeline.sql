-- ============================================================================
-- Data Ingestion Pipeline: Event Streaming Infrastructure
-- Purpose: Capture all platform events for analytics, ML, and business intelligence
-- Phase 2: Transition from System of Record to System of Intelligence
-- ============================================================================

-- ==================== Platform Events Table ====================
-- Central event store for all platform activities
CREATE TABLE IF NOT EXISTS platform_events (
    event_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    event_type VARCHAR(100) NOT NULL,
    event_category VARCHAR(50) NOT NULL CHECK (event_category IN (
        'transaction',      -- project.created, proposal.submitted, milestone.approved
        'interaction',      -- profile.viewed, search.performed, filter.applied
        'user_activity',    -- user.login, user.logout, session.started
        'content',          -- review.posted, portfolio.updated, profile.updated
        'system'            -- error.occurred, job.completed, sync.completed
    )),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    entity_type VARCHAR(50), -- 'project', 'proposal', 'profile', 'review', etc.
    entity_id UUID,
    event_data JSONB NOT NULL DEFAULT '{}',
    metadata JSONB DEFAULT '{}', -- session_id, ip_address, user_agent, geo_location
    source VARCHAR(20) DEFAULT 'web' CHECK (source IN ('web', 'mobile', 'api', 'system')),
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    processed_at TIMESTAMPTZ, -- When event was processed for data warehouse
    processing_status VARCHAR(20) DEFAULT 'pending' CHECK (processing_status IN ('pending', 'processing', 'processed', 'failed')),
    retry_count INTEGER DEFAULT 0,
    error_message TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for high-performance event querying
CREATE INDEX idx_events_type ON platform_events(event_type);
CREATE INDEX idx_events_category ON platform_events(event_category);
CREATE INDEX idx_events_user ON platform_events(user_id, timestamp DESC);
CREATE INDEX idx_events_entity ON platform_events(entity_type, entity_id);
CREATE INDEX idx_events_timestamp ON platform_events(timestamp DESC);
CREATE INDEX idx_events_processing ON platform_events(processing_status, timestamp) 
    WHERE processing_status IN ('pending', 'failed');
CREATE INDEX idx_events_data_gin ON platform_events USING GIN(event_data);

-- Partition by month for performance (optional, comment out if not needed)
-- CREATE TABLE platform_events_2025_10 PARTITION OF platform_events
--     FOR VALUES FROM ('2025-10-01') TO ('2025-11-01');

-- ==================== Real-Time Metrics Cache ====================
-- Materialized metrics for dashboard queries
CREATE TABLE IF NOT EXISTS platform_metrics_realtime (
    metric_key VARCHAR(100) PRIMARY KEY,
    metric_value JSONB NOT NULL,
    time_window VARCHAR(20) NOT NULL, -- 'hour', 'day', 'week', 'month'
    calculated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_metrics_window ON platform_metrics_realtime(time_window, expires_at);
CREATE INDEX idx_metrics_calculated ON platform_metrics_realtime(calculated_at DESC);

-- ==================== Event Aggregations Table ====================
-- Pre-computed aggregations for analytics queries
CREATE TABLE IF NOT EXISTS event_aggregations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    aggregation_type VARCHAR(50) NOT NULL, -- 'hourly', 'daily', 'weekly'
    event_category VARCHAR(50) NOT NULL,
    event_type VARCHAR(100),
    time_bucket TIMESTAMPTZ NOT NULL,
    metrics JSONB NOT NULL DEFAULT '{}', -- {count, unique_users, avg_value, etc.}
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(aggregation_type, event_category, event_type, time_bucket)
);

CREATE INDEX idx_aggregations_bucket ON event_aggregations(time_bucket DESC);
CREATE INDEX idx_aggregations_type ON event_aggregations(aggregation_type, event_category);

-- ==================== Data Warehouse Sync Status ====================
-- Track which events have been synced to external data warehouse
CREATE TABLE IF NOT EXISTS warehouse_sync_status (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sync_batch_id VARCHAR(100) UNIQUE NOT NULL,
    warehouse_type VARCHAR(50) NOT NULL, -- 'bigquery', 'redshift', 'snowflake'
    last_synced_event_id UUID REFERENCES platform_events(event_id),
    last_synced_timestamp TIMESTAMPTZ,
    events_synced INTEGER DEFAULT 0,
    sync_duration_ms INTEGER,
    sync_status VARCHAR(20) DEFAULT 'pending' CHECK (sync_status IN ('pending', 'running', 'completed', 'failed')),
    error_details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_warehouse_sync_status ON warehouse_sync_status(sync_status, created_at);
CREATE INDEX idx_warehouse_timestamp ON warehouse_sync_status(last_synced_timestamp DESC);

-- ==================== Event Schema Registry ====================
-- Define expected schemas for event validation
CREATE TABLE IF NOT EXISTS event_schemas (
    event_type VARCHAR(100) PRIMARY KEY,
    event_category VARCHAR(50) NOT NULL,
    schema_definition JSONB NOT NULL, -- JSON Schema for validation
    required_fields TEXT[] NOT NULL,
    example_payload JSONB,
    description TEXT,
    retention_days INTEGER DEFAULT 2555, -- 7 years for financial events
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==================== Functions ====================

-- Function: Emit platform event (to be called from triggers)
CREATE OR REPLACE FUNCTION emit_platform_event(
    p_event_type VARCHAR(100),
    p_event_category VARCHAR(50),
    p_user_id UUID,
    p_entity_type VARCHAR(50),
    p_entity_id UUID,
    p_event_data JSONB DEFAULT '{}',
    p_metadata JSONB DEFAULT '{}'
) RETURNS UUID AS $$
DECLARE
    v_event_id UUID;
BEGIN
    INSERT INTO platform_events (
        event_type,
        event_category,
        user_id,
        entity_type,
        entity_id,
        event_data,
        metadata,
        source
    ) VALUES (
        p_event_type,
        p_event_category,
        p_user_id,
        p_entity_type,
        p_entity_id,
        p_event_data,
        p_metadata,
        'system'
    ) RETURNING event_id INTO v_event_id;
    
    RETURN v_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Mark event as processed
CREATE OR REPLACE FUNCTION mark_event_processed(
    p_event_id UUID,
    p_success BOOLEAN DEFAULT true,
    p_error_message TEXT DEFAULT NULL
) RETURNS VOID AS $$
BEGIN
    UPDATE platform_events
    SET 
        processing_status = CASE WHEN p_success THEN 'processed' ELSE 'failed' END,
        processed_at = NOW(),
        error_message = p_error_message,
        retry_count = CASE WHEN NOT p_success THEN retry_count + 1 ELSE retry_count END
    WHERE event_id = p_event_id;
END;
$$ LANGUAGE plpgsql;

-- Function: Get pending events for processing
CREATE OR REPLACE FUNCTION get_pending_events(
    p_batch_size INTEGER DEFAULT 100,
    p_max_retry INTEGER DEFAULT 3
) RETURNS SETOF platform_events AS $$
BEGIN
    RETURN QUERY
    SELECT *
    FROM platform_events
    WHERE processing_status IN ('pending', 'failed')
      AND retry_count < p_max_retry
    ORDER BY timestamp ASC
    LIMIT p_batch_size
    FOR UPDATE SKIP LOCKED; -- Prevent concurrent processing
END;
$$ LANGUAGE plpgsql;

-- Function: Update real-time metrics
CREATE OR REPLACE FUNCTION update_realtime_metric(
    p_metric_key VARCHAR(100),
    p_metric_value JSONB,
    p_time_window VARCHAR(20),
    p_ttl_seconds INTEGER DEFAULT 3600
) RETURNS VOID AS $$
BEGIN
    INSERT INTO platform_metrics_realtime (
        metric_key,
        metric_value,
        time_window,
        expires_at
    ) VALUES (
        p_metric_key,
        p_metric_value,
        p_time_window,
        NOW() + (p_ttl_seconds || ' seconds')::INTERVAL
    )
    ON CONFLICT (metric_key)
    DO UPDATE SET
        metric_value = EXCLUDED.metric_value,
        calculated_at = NOW(),
        expires_at = EXCLUDED.expires_at;
END;
$$ LANGUAGE plpgsql;

-- Function: Aggregate events (run hourly via cron)
CREATE OR REPLACE FUNCTION aggregate_events_hourly() RETURNS VOID AS $$
BEGIN
    INSERT INTO event_aggregations (
        aggregation_type,
        event_category,
        event_type,
        time_bucket,
        metrics
    )
    SELECT
        'hourly',
        event_category,
        event_type,
        date_trunc('hour', timestamp) AS time_bucket,
        jsonb_build_object(
            'count', COUNT(*),
            'unique_users', COUNT(DISTINCT user_id),
            'sources', jsonb_object_agg(source, COUNT(*))
        ) AS metrics
    FROM platform_events
    WHERE timestamp >= date_trunc('hour', NOW() - INTERVAL '1 hour')
      AND timestamp < date_trunc('hour', NOW())
      AND processing_status = 'processed'
    GROUP BY event_category, event_type, date_trunc('hour', timestamp)
    ON CONFLICT (aggregation_type, event_category, event_type, time_bucket)
    DO UPDATE SET
        metrics = EXCLUDED.metrics,
        created_at = NOW();
END;
$$ LANGUAGE plpgsql;

-- Function: Clean expired metrics
CREATE OR REPLACE FUNCTION cleanup_expired_metrics() RETURNS INTEGER AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM platform_metrics_realtime
    WHERE expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$ LANGUAGE plpgsql;

-- Function: Apply data retention policy (run daily)
CREATE OR REPLACE FUNCTION apply_data_retention_policy() RETURNS TABLE(
    event_type VARCHAR,
    deleted_count BIGINT
) AS $$
BEGIN
    RETURN QUERY
    WITH deleted AS (
        DELETE FROM platform_events pe
        USING event_schemas es
        WHERE pe.event_type = es.event_type
          AND pe.timestamp < NOW() - (es.retention_days || ' days')::INTERVAL
        RETURNING pe.event_type
    )
    SELECT 
        d.event_type,
        COUNT(*) AS deleted_count
    FROM deleted d
    GROUP BY d.event_type;
END;
$$ LANGUAGE plpgsql;

-- ==================== Example Event Triggers ====================
-- These demonstrate how to emit events from existing tables

-- Trigger: Emit event when project is created
CREATE OR REPLACE FUNCTION trigger_project_created() RETURNS TRIGGER AS $$
BEGIN
    PERFORM emit_platform_event(
        'project.created',
        'transaction',
        NEW.client_id,
        'project',
        NEW.id,
        jsonb_build_object(
            'title', NEW.title,
            'budget', NEW.budget,
            'project_type', NEW.project_type,
            'is_featured', NEW.is_featured
        ),
        jsonb_build_object(
            'table', TG_TABLE_NAME,
            'operation', TG_OP
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Example trigger attachment (uncomment to enable)
-- DROP TRIGGER IF EXISTS trg_project_created ON projects;
-- CREATE TRIGGER trg_project_created
--     AFTER INSERT ON projects
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_project_created();

-- Trigger: Emit event when review is posted
CREATE OR REPLACE FUNCTION trigger_review_posted() RETURNS TRIGGER AS $$
BEGIN
    PERFORM emit_platform_event(
        'review.posted',
        'content',
        NEW.reviewer_user_id,
        'review',
        NEW.id,
        jsonb_build_object(
            'reviewee_user_id', NEW.reviewee_user_id,
            'reviewee_type', NEW.reviewee_type,
            'rating_overall', (
                NEW.rating_communication + 
                NEW.rating_professionalism + 
                COALESCE(NEW.rating_project_clarity, 0) + 
                COALESCE(NEW.rating_payment_timeliness, 0)
            ) / 4.0,
            'is_mutual_visible', NEW.is_mutual_visible
        )
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Example trigger attachment (uncomment to enable)
-- DROP TRIGGER IF EXISTS trg_review_posted ON project_reviews;
-- CREATE TRIGGER trg_review_posted
--     AFTER INSERT ON project_reviews
--     FOR EACH ROW
--     EXECUTE FUNCTION trigger_review_posted();

-- ==================== Seed Event Schemas ====================
INSERT INTO event_schemas (event_type, event_category, schema_definition, required_fields, retention_days, description) VALUES
('project.created', 'transaction', 
 '{"type":"object","properties":{"title":{"type":"string"},"budget":{"type":"number"},"project_type":{"type":"string"}}}',
 ARRAY['title', 'budget', 'project_type'],
 2555, 'Emitted when a client creates a new project listing'),

('proposal.submitted', 'transaction',
 '{"type":"object","properties":{"project_id":{"type":"string"},"developer_id":{"type":"string"},"bid_amount":{"type":"number"}}}',
 ARRAY['project_id', 'developer_id', 'bid_amount'],
 2555, 'Emitted when a developer submits a proposal'),

('milestone.approved', 'transaction',
 '{"type":"object","properties":{"milestone_id":{"type":"string"},"project_id":{"type":"string"},"amount":{"type":"number"}}}',
 ARRAY['milestone_id', 'project_id', 'amount'],
 2555, 'Emitted when a client approves a milestone (financial event)'),

('review.posted', 'content',
 '{"type":"object","properties":{"reviewee_user_id":{"type":"string"},"rating_overall":{"type":"number"}}}',
 ARRAY['reviewee_user_id', 'rating_overall'],
 2555, 'Emitted when a review is posted (affects reputation)'),

('profile.viewed', 'interaction',
 '{"type":"object","properties":{"viewed_user_id":{"type":"string"},"viewer_type":{"type":"string"}}}',
 ARRAY['viewed_user_id'],
 365, 'Emitted when a user profile is viewed'),

('search.performed', 'interaction',
 '{"type":"object","properties":{"query":{"type":"string"},"filters":{"type":"object"},"results_count":{"type":"number"}}}',
 ARRAY['query', 'results_count'],
 365, 'Emitted when a search is performed'),

('user.login', 'user_activity',
 '{"type":"object","properties":{"login_method":{"type":"string"},"session_id":{"type":"string"}}}',
 ARRAY['login_method'],
 730, 'Emitted when a user logs in (2 year retention for security)');

-- ==================== Row Level Security ====================
ALTER TABLE platform_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE platform_metrics_realtime ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_aggregations ENABLE ROW LEVEL SECURITY;
ALTER TABLE warehouse_sync_status ENABLE ROW LEVEL SECURITY;
ALTER TABLE event_schemas ENABLE ROW LEVEL SECURITY;

-- Admin-only access to event tables (system processing only)
CREATE POLICY "Service role can manage events" ON platform_events
    FOR ALL TO service_role USING (true);

CREATE POLICY "Authenticated users can view their own events" ON platform_events
    FOR SELECT TO authenticated
    USING (user_id = auth.uid());

-- Real-time metrics are publicly readable (for dashboards)
CREATE POLICY "Metrics are readable by authenticated users" ON platform_metrics_realtime
    FOR SELECT TO authenticated USING (true);

-- Event schemas are publicly readable (for documentation)
CREATE POLICY "Schemas are readable by authenticated users" ON event_schemas
    FOR SELECT TO authenticated USING (is_active = true);

-- ==================== Comments for Documentation ====================
COMMENT ON TABLE platform_events IS 'Central event store for all platform activities, supports real-time streaming to data warehouse';
COMMENT ON TABLE platform_metrics_realtime IS 'Cached real-time metrics with TTL for dashboard queries';
COMMENT ON TABLE event_aggregations IS 'Pre-computed event aggregations for analytics queries';
COMMENT ON TABLE warehouse_sync_status IS 'Tracks sync status to external data warehouses (BigQuery, Redshift, Snowflake)';
COMMENT ON TABLE event_schemas IS 'Event schema registry for validation and documentation';

COMMENT ON FUNCTION emit_platform_event IS 'Emit a platform event from triggers or application code';
COMMENT ON FUNCTION get_pending_events IS 'Retrieve pending events for batch processing (with row locking)';
COMMENT ON FUNCTION update_realtime_metric IS 'Update or insert a real-time metric with TTL';
COMMENT ON FUNCTION aggregate_events_hourly IS 'Run hourly to pre-compute event aggregations';
COMMENT ON FUNCTION apply_data_retention_policy IS 'Run daily to enforce retention policies per event type';

-- ==================== Performance Notes ====================
-- 1. Consider partitioning platform_events by month for high-volume environments
-- 2. Enable pg_cron extension for scheduled aggregations:
--    SELECT cron.schedule('aggregate-events-hourly', '0 * * * *', 'SELECT aggregate_events_hourly()');
--    SELECT cron.schedule('cleanup-metrics', '*/15 * * * *', 'SELECT cleanup_expired_metrics()');
--    SELECT cron.schedule('apply-retention', '0 2 * * *', 'SELECT apply_data_retention_policy()');
-- 3. Monitor index usage: SELECT * FROM pg_stat_user_indexes WHERE schemaname = 'public';
-- 4. For 10,000+ events/hour, consider connection pooling (PgBouncer) and read replicas
