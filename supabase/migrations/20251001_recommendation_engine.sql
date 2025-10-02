-- ===================================================================
-- Recommendation Engine Database Schema
-- ===================================================================
-- Purpose: Store ML-generated recommendations, interaction tracking,
--          and model metadata for personalized matchmaking
-- Created: 2025-10-01
-- ===================================================================

-- ==================== Recommendation Storage Tables ====================

-- Store personalized project recommendations for developers
CREATE TABLE IF NOT EXISTS developer_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Scoring components
    relevance_score DECIMAL(5, 4) NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
    collaborative_score DECIMAL(5, 4) CHECK (collaborative_score >= 0 AND collaborative_score <= 1),
    content_score DECIMAL(5, 4) CHECK (content_score >= 0 AND content_score <= 1),
    
    -- Score breakdowns for explanations
    skill_match_score DECIMAL(5, 4),
    budget_fit_score DECIMAL(5, 4),
    experience_match_score DECIMAL(5, 4),
    recency_score DECIMAL(5, 4),
    
    -- Recommendation metadata
    rank_position INTEGER NOT NULL,
    explanation JSONB NOT NULL DEFAULT '[]', -- Array of explanation strings
    model_version VARCHAR(50) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Interaction tracking
    viewed_at TIMESTAMPTZ,
    applied_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(user_id, project_id, generated_at)
);

-- Store talent recommendations for clients
CREATE TABLE IF NOT EXISTS client_recommendations (
    recommendation_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    developer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    -- Scoring components
    relevance_score DECIMAL(5, 4) NOT NULL CHECK (relevance_score >= 0 AND relevance_score <= 1),
    collaborative_score DECIMAL(5, 4),
    content_score DECIMAL(5, 4),
    
    -- Score breakdowns
    skill_match_score DECIMAL(5, 4),
    experience_match_score DECIMAL(5, 4),
    reputation_score DECIMAL(5, 4),
    availability_score DECIMAL(5, 4),
    
    -- Recommendation metadata
    rank_position INTEGER NOT NULL,
    explanation JSONB NOT NULL DEFAULT '[]',
    model_version VARCHAR(50) NOT NULL,
    generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    
    -- Interaction tracking
    viewed_at TIMESTAMPTZ,
    contacted_at TIMESTAMPTZ,
    hired_at TIMESTAMPTZ,
    dismissed_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(client_user_id, project_id, developer_user_id, generated_at)
);

-- Track all recommendation interactions for model training
CREATE TABLE IF NOT EXISTS recommendation_interactions (
    interaction_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    recommendation_type VARCHAR(20) NOT NULL CHECK (recommendation_type IN ('project', 'talent')),
    recommendation_id UUID NOT NULL, -- References either developer_recommendations or client_recommendations
    
    -- Interaction details
    action VARCHAR(20) NOT NULL CHECK (action IN ('view', 'apply', 'hire', 'contact', 'dismiss', 'click')),
    interaction_context JSONB, -- Additional context like scroll depth, time spent, etc.
    
    -- Outcome tracking
    converted BOOLEAN DEFAULT FALSE, -- True if action led to hire
    conversion_date TIMESTAMPTZ,
    
    -- Model attribution
    model_version VARCHAR(50) NOT NULL,
    relevance_score DECIMAL(5, 4),
    rank_position INTEGER,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    INDEX idx_interactions_user_type (user_id, recommendation_type, created_at),
    INDEX idx_interactions_conversion (converted, conversion_date)
);

-- Store ML model metadata and performance metrics
CREATE TABLE IF NOT EXISTS ml_model_metadata (
    model_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name VARCHAR(100) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    model_type VARCHAR(50) NOT NULL CHECK (model_type IN ('collaborative', 'content_based', 'hybrid', 'cold_start')),
    
    -- Model artifacts
    model_path TEXT, -- S3 or file path to serialized model
    feature_importance JSONB, -- Feature importance scores
    hyperparameters JSONB, -- Model configuration
    
    -- Training metadata
    training_data_size INTEGER,
    training_date TIMESTAMPTZ NOT NULL,
    training_duration_seconds INTEGER,
    
    -- Performance metrics
    metrics JSONB NOT NULL, -- MAP@K, NDCG, precision, recall, etc.
    
    -- Deployment status
    is_active BOOLEAN DEFAULT FALSE,
    deployed_at TIMESTAMPTZ,
    deprecated_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(model_name, model_version)
);

-- Store A/B test experiments for recommendation algorithms
CREATE TABLE IF NOT EXISTS recommendation_experiments (
    experiment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT,
    
    -- Experiment configuration
    control_model_version VARCHAR(50) NOT NULL,
    treatment_model_version VARCHAR(50) NOT NULL,
    traffic_allocation DECIMAL(3, 2) DEFAULT 0.50 CHECK (traffic_allocation > 0 AND traffic_allocation < 1),
    
    -- Experiment status
    status VARCHAR(20) NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'running', 'paused', 'completed')),
    start_date TIMESTAMPTZ,
    end_date TIMESTAMPTZ,
    
    -- Success metrics
    primary_metric VARCHAR(50) NOT NULL, -- e.g., 'application_rate', 'hire_rate'
    minimum_sample_size INTEGER DEFAULT 1000,
    
    -- Results
    results JSONB, -- Statistical significance, effect size, etc.
    winner VARCHAR(20) CHECK (winner IN ('control', 'treatment', 'inconclusive')),
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Track user assignment to A/B test variants
CREATE TABLE IF NOT EXISTS experiment_assignments (
    assignment_id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    experiment_id UUID NOT NULL REFERENCES recommendation_experiments(experiment_id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    
    variant VARCHAR(20) NOT NULL CHECK (variant IN ('control', 'treatment')),
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    
    UNIQUE(experiment_id, user_id),
    INDEX idx_assignments_experiment (experiment_id, variant)
);

-- ==================== Indexes for Performance ====================

CREATE INDEX idx_dev_recommendations_user_active ON developer_recommendations(user_id, expires_at) 
    WHERE dismissed_at IS NULL;

CREATE INDEX idx_dev_recommendations_generated ON developer_recommendations(generated_at DESC);

CREATE INDEX idx_dev_recommendations_relevance ON developer_recommendations(user_id, relevance_score DESC);

CREATE INDEX idx_client_recommendations_project_active ON client_recommendations(project_id, expires_at) 
    WHERE dismissed_at IS NULL;

CREATE INDEX idx_client_recommendations_relevance ON client_recommendations(client_user_id, project_id, relevance_score DESC);

CREATE INDEX idx_model_metadata_active ON ml_model_metadata(model_type, is_active, model_version);

-- ==================== Functions ====================

-- Get active recommendations for a developer
CREATE OR REPLACE FUNCTION get_developer_recommendations(
    p_user_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    recommendation_id UUID,
    project_id UUID,
    relevance_score DECIMAL,
    explanation JSONB,
    rank_position INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        dr.recommendation_id,
        dr.project_id,
        dr.relevance_score,
        dr.explanation,
        dr.rank_position
    FROM developer_recommendations dr
    WHERE dr.user_id = p_user_id
        AND dr.expires_at > NOW()
        AND dr.dismissed_at IS NULL
        AND dr.applied_at IS NULL
    ORDER BY dr.relevance_score DESC, dr.rank_position ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Get talent recommendations for a project
CREATE OR REPLACE FUNCTION get_talent_recommendations(
    p_client_user_id UUID,
    p_project_id UUID,
    p_limit INTEGER DEFAULT 10
)
RETURNS TABLE (
    recommendation_id UUID,
    developer_user_id UUID,
    relevance_score DECIMAL,
    explanation JSONB,
    rank_position INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        cr.recommendation_id,
        cr.developer_user_id,
        cr.relevance_score,
        cr.explanation,
        cr.rank_position
    FROM client_recommendations cr
    WHERE cr.client_user_id = p_client_user_id
        AND cr.project_id = p_project_id
        AND cr.expires_at > NOW()
        AND cr.dismissed_at IS NULL
        AND cr.hired_at IS NULL
    ORDER BY cr.relevance_score DESC, cr.rank_position ASC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

-- Record recommendation interaction
CREATE OR REPLACE FUNCTION record_recommendation_interaction(
    p_user_id UUID,
    p_recommendation_type VARCHAR,
    p_recommendation_id UUID,
    p_action VARCHAR,
    p_interaction_context JSONB DEFAULT NULL
)
RETURNS UUID AS $$
DECLARE
    v_interaction_id UUID;
    v_model_version VARCHAR;
    v_relevance_score DECIMAL;
    v_rank_position INTEGER;
BEGIN
    -- Get recommendation details
    IF p_recommendation_type = 'project' THEN
        SELECT model_version, relevance_score, rank_position
        INTO v_model_version, v_relevance_score, v_rank_position
        FROM developer_recommendations
        WHERE recommendation_id = p_recommendation_id;
        
        -- Update interaction timestamp
        IF p_action = 'view' THEN
            UPDATE developer_recommendations 
            SET viewed_at = NOW() 
            WHERE recommendation_id = p_recommendation_id AND viewed_at IS NULL;
        ELSIF p_action = 'apply' THEN
            UPDATE developer_recommendations 
            SET applied_at = NOW() 
            WHERE recommendation_id = p_recommendation_id AND applied_at IS NULL;
        ELSIF p_action = 'dismiss' THEN
            UPDATE developer_recommendations 
            SET dismissed_at = NOW() 
            WHERE recommendation_id = p_recommendation_id AND dismissed_at IS NULL;
        END IF;
    ELSE
        SELECT model_version, relevance_score, rank_position
        INTO v_model_version, v_relevance_score, v_rank_position
        FROM client_recommendations
        WHERE recommendation_id = p_recommendation_id;
        
        -- Update interaction timestamp
        IF p_action = 'view' THEN
            UPDATE client_recommendations 
            SET viewed_at = NOW() 
            WHERE recommendation_id = p_recommendation_id AND viewed_at IS NULL;
        ELSIF p_action = 'contact' THEN
            UPDATE client_recommendations 
            SET contacted_at = NOW() 
            WHERE recommendation_id = p_recommendation_id AND contacted_at IS NULL;
        ELSIF p_action = 'hire' THEN
            UPDATE client_recommendations 
            SET hired_at = NOW() 
            WHERE recommendation_id = p_recommendation_id AND hired_at IS NULL;
        ELSIF p_action = 'dismiss' THEN
            UPDATE client_recommendations 
            SET dismissed_at = NOW() 
            WHERE recommendation_id = p_recommendation_id AND dismissed_at IS NULL;
        END IF;
    END IF;
    
    -- Insert interaction record
    INSERT INTO recommendation_interactions (
        user_id,
        recommendation_type,
        recommendation_id,
        action,
        interaction_context,
        model_version,
        relevance_score,
        rank_position
    ) VALUES (
        p_user_id,
        p_recommendation_type,
        p_recommendation_id,
        p_action,
        p_interaction_context,
        v_model_version,
        v_relevance_score,
        v_rank_position
    ) RETURNING interaction_id INTO v_interaction_id;
    
    RETURN v_interaction_id;
END;
$$ LANGUAGE plpgsql;

-- Get or assign user to A/B test experiment
CREATE OR REPLACE FUNCTION get_experiment_variant(
    p_user_id UUID,
    p_experiment_name VARCHAR
)
RETURNS VARCHAR AS $$
DECLARE
    v_experiment_id UUID;
    v_variant VARCHAR;
    v_traffic_allocation DECIMAL;
    v_random_value DECIMAL;
BEGIN
    -- Get experiment details
    SELECT experiment_id, traffic_allocation
    INTO v_experiment_id, v_traffic_allocation
    FROM recommendation_experiments
    WHERE experiment_name = p_experiment_name
        AND status = 'running';
    
    IF v_experiment_id IS NULL THEN
        RETURN 'control'; -- Default to control if no active experiment
    END IF;
    
    -- Check if user already assigned
    SELECT variant INTO v_variant
    FROM experiment_assignments
    WHERE experiment_id = v_experiment_id AND user_id = p_user_id;
    
    IF v_variant IS NOT NULL THEN
        RETURN v_variant;
    END IF;
    
    -- Assign user to variant using deterministic hash
    v_random_value := (hashtext(p_user_id::TEXT || v_experiment_id::TEXT)::BIGINT % 10000) / 10000.0;
    
    IF v_random_value < v_traffic_allocation THEN
        v_variant := 'treatment';
    ELSE
        v_variant := 'control';
    END IF;
    
    -- Store assignment
    INSERT INTO experiment_assignments (experiment_id, user_id, variant)
    VALUES (v_experiment_id, p_user_id, v_variant)
    ON CONFLICT (experiment_id, user_id) DO NOTHING;
    
    RETURN v_variant;
END;
$$ LANGUAGE plpgsql;

-- Calculate recommendation performance metrics
CREATE OR REPLACE FUNCTION calculate_recommendation_metrics(
    p_model_version VARCHAR,
    p_date_from TIMESTAMPTZ,
    p_date_to TIMESTAMPTZ
)
RETURNS JSONB AS $$
DECLARE
    v_metrics JSONB;
    v_total_recommendations INTEGER;
    v_total_views INTEGER;
    v_total_applies INTEGER;
    v_total_hires INTEGER;
    v_view_rate DECIMAL;
    v_application_rate DECIMAL;
    v_hire_rate DECIMAL;
BEGIN
    -- Count recommendations
    SELECT COUNT(*) INTO v_total_recommendations
    FROM developer_recommendations
    WHERE model_version = p_model_version
        AND generated_at BETWEEN p_date_from AND p_date_to;
    
    -- Count interactions
    SELECT 
        COUNT(CASE WHEN viewed_at IS NOT NULL THEN 1 END),
        COUNT(CASE WHEN applied_at IS NOT NULL THEN 1 END)
    INTO v_total_views, v_total_applies
    FROM developer_recommendations
    WHERE model_version = p_model_version
        AND generated_at BETWEEN p_date_from AND p_date_to;
    
    -- Count conversions (hires from recommendations)
    SELECT COUNT(*) INTO v_total_hires
    FROM recommendation_interactions
    WHERE model_version = p_model_version
        AND converted = TRUE
        AND created_at BETWEEN p_date_from AND p_date_to;
    
    -- Calculate rates
    v_view_rate := CASE WHEN v_total_recommendations > 0 
                       THEN v_total_views::DECIMAL / v_total_recommendations 
                       ELSE 0 END;
    v_application_rate := CASE WHEN v_total_views > 0 
                              THEN v_total_applies::DECIMAL / v_total_views 
                              ELSE 0 END;
    v_hire_rate := CASE WHEN v_total_applies > 0 
                       THEN v_total_hires::DECIMAL / v_total_applies 
                       ELSE 0 END;
    
    v_metrics := jsonb_build_object(
        'total_recommendations', v_total_recommendations,
        'total_views', v_total_views,
        'total_applications', v_total_applies,
        'total_hires', v_total_hires,
        'view_rate', ROUND(v_view_rate, 4),
        'application_rate', ROUND(v_application_rate, 4),
        'hire_rate', ROUND(v_hire_rate, 4)
    );
    
    RETURN v_metrics;
END;
$$ LANGUAGE plpgsql STABLE;

-- ==================== Row Level Security ====================

ALTER TABLE developer_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE client_recommendations ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_model_metadata ENABLE ROW LEVEL SECURITY;
ALTER TABLE recommendation_experiments ENABLE ROW LEVEL SECURITY;
ALTER TABLE experiment_assignments ENABLE ROW LEVEL SECURITY;

-- Developers can view their own recommendations
CREATE POLICY developer_recommendations_select ON developer_recommendations
    FOR SELECT USING (auth.uid() = user_id);

-- Clients can view recommendations for their projects
CREATE POLICY client_recommendations_select ON client_recommendations
    FOR SELECT USING (auth.uid() = client_user_id);

-- Users can record their own interactions
CREATE POLICY recommendation_interactions_insert ON recommendation_interactions
    FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Model metadata is read-only for all authenticated users
CREATE POLICY ml_model_metadata_select ON ml_model_metadata
    FOR SELECT TO authenticated USING (true);

-- Experiments are visible to all authenticated users
CREATE POLICY recommendation_experiments_select ON recommendation_experiments
    FOR SELECT TO authenticated USING (true);

-- Users can view their own experiment assignments
CREATE POLICY experiment_assignments_select ON experiment_assignments
    FOR SELECT USING (auth.uid() = user_id);

-- ==================== Triggers ====================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_recommendation_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_developer_recommendations_updated_at
    BEFORE UPDATE ON developer_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_recommendation_updated_at();

CREATE TRIGGER update_client_recommendations_updated_at
    BEFORE UPDATE ON client_recommendations
    FOR EACH ROW
    EXECUTE FUNCTION update_recommendation_updated_at();

CREATE TRIGGER update_ml_model_metadata_updated_at
    BEFORE UPDATE ON ml_model_metadata
    FOR EACH ROW
    EXECUTE FUNCTION update_recommendation_updated_at();

CREATE TRIGGER update_recommendation_experiments_updated_at
    BEFORE UPDATE ON recommendation_experiments
    FOR EACH ROW
    EXECUTE FUNCTION update_recommendation_updated_at();

-- ==================== Maintenance ====================

-- Clean up expired recommendations (run daily)
CREATE OR REPLACE FUNCTION cleanup_expired_recommendations()
RETURNS INTEGER AS $$
DECLARE
    v_deleted_count INTEGER;
BEGIN
    -- Delete recommendations older than 7 days
    WITH deleted AS (
        DELETE FROM developer_recommendations
        WHERE expires_at < NOW() - INTERVAL '7 days'
        RETURNING recommendation_id
    )
    SELECT COUNT(*) INTO v_deleted_count FROM deleted;
    
    DELETE FROM client_recommendations
    WHERE expires_at < NOW() - INTERVAL '7 days';
    
    RETURN v_deleted_count;
END;
$$ LANGUAGE plpgsql;

-- ==================== Comments ====================

COMMENT ON TABLE developer_recommendations IS 'Stores personalized project recommendations for developers with scoring and explanations';
COMMENT ON TABLE client_recommendations IS 'Stores talent recommendations for clients posting projects';
COMMENT ON TABLE recommendation_interactions IS 'Tracks user interactions with recommendations for model training and evaluation';
COMMENT ON TABLE ml_model_metadata IS 'Stores ML model versions, performance metrics, and deployment status';
COMMENT ON TABLE recommendation_experiments IS 'Manages A/B testing experiments for recommendation algorithms';
COMMENT ON FUNCTION get_developer_recommendations IS 'Retrieves active project recommendations for a developer';
COMMENT ON FUNCTION get_talent_recommendations IS 'Retrieves talent suggestions for a client project';
COMMENT ON FUNCTION record_recommendation_interaction IS 'Records user interaction with a recommendation (view, apply, hire, dismiss)';
COMMENT ON FUNCTION get_experiment_variant IS 'Assigns user to A/B test variant using deterministic hashing';
COMMENT ON FUNCTION calculate_recommendation_metrics IS 'Calculates performance metrics for a specific model version';
