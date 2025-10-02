-- Budget Estimation System Migration
-- Machine learning-powered budget estimation with historical data tracking

-- ==================== Tables ====================

-- Store historical project budget data for training
CREATE TABLE IF NOT EXISTS historical_project_budgets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Project characteristics
    description TEXT NOT NULL,
    required_skills JSONB NOT NULL DEFAULT '[]',
    project_type VARCHAR(100),
    complexity_level VARCHAR(50),
    estimated_hours INTEGER,
    estimated_duration_weeks INTEGER,
    
    -- Budget information
    initial_budget_min DECIMAL(12, 2),
    initial_budget_max DECIMAL(12, 2),
    final_budget DECIMAL(12, 2) NOT NULL,
    actual_hours_worked INTEGER,
    actual_duration_weeks INTEGER,
    
    -- Market context
    region VARCHAR(100),
    currency VARCHAR(10) DEFAULT 'USD',
    client_country VARCHAR(100),
    developer_rates JSONB DEFAULT '[]',
    
    -- Completion data
    completion_status VARCHAR(50),
    client_satisfaction_score DECIMAL(3, 2),
    budget_variance_percent DECIMAL(5, 2),
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW(),
    completed_at TIMESTAMPTZ,
    data_quality_score DECIMAL(3, 2) DEFAULT 1.0,
    
    -- Indexes for ML feature extraction
    CONSTRAINT valid_budget CHECK (final_budget > 0),
    CONSTRAINT valid_variance CHECK (budget_variance_percent >= -100)
);

-- Store budget estimations with predictions
CREATE TABLE IF NOT EXISTS budget_estimations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id UUID REFERENCES projects(id) ON DELETE CASCADE,
    
    -- Estimation results
    estimated_budget DECIMAL(12, 2) NOT NULL,
    confidence_lower_bound DECIMAL(12, 2) NOT NULL,
    confidence_upper_bound DECIMAL(12, 2) NOT NULL,
    confidence_level DECIMAL(3, 2) DEFAULT 0.80,
    
    -- Budget breakdown
    budget_breakdown JSONB NOT NULL DEFAULT '{
        "planning_and_design": 0,
        "development": 0,
        "testing_and_qa": 0,
        "deployment_and_launch": 0,
        "buffer_contingency": 0
    }',
    
    -- Model information
    model_version VARCHAR(50) NOT NULL,
    model_confidence_score DECIMAL(3, 2),
    feature_importance JSONB,
    
    -- Market insights
    market_insights JSONB DEFAULT '{
        "similar_projects_avg": 0,
        "skill_premium_factors": {},
        "regional_adjustment": 1.0,
        "market_demand_factor": 1.0
    }',
    
    -- Recommendation
    recommendation TEXT,
    warning_flags JSONB DEFAULT '[]',
    
    -- Tracking
    user_id UUID NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    used_in_project BOOLEAN DEFAULT FALSE,
    
    -- Accuracy tracking (filled after project completion)
    actual_final_budget DECIMAL(12, 2),
    prediction_error_percent DECIMAL(5, 2),
    was_within_confidence_interval BOOLEAN
);

-- Store market rate data for different skills and regions
CREATE TABLE IF NOT EXISTS market_rate_data (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Skill and region
    skill_name VARCHAR(100) NOT NULL,
    skill_category VARCHAR(100),
    region VARCHAR(100) NOT NULL,
    
    -- Rate information
    average_hourly_rate DECIMAL(10, 2) NOT NULL,
    median_hourly_rate DECIMAL(10, 2) NOT NULL,
    min_rate DECIMAL(10, 2),
    max_rate DECIMAL(10, 2),
    rate_std_dev DECIMAL(10, 2),
    
    -- Market context
    currency VARCHAR(10) DEFAULT 'USD',
    sample_size INTEGER NOT NULL,
    experience_level VARCHAR(50),
    
    -- Premium factors
    demand_multiplier DECIMAL(4, 2) DEFAULT 1.0,
    scarcity_premium DECIMAL(4, 2) DEFAULT 1.0,
    
    -- Temporal data
    data_period_start DATE NOT NULL,
    data_period_end DATE NOT NULL,
    last_updated TIMESTAMPTZ DEFAULT NOW(),
    
    -- Metadata
    data_source VARCHAR(100),
    confidence_score DECIMAL(3, 2) DEFAULT 0.8,
    
    CONSTRAINT unique_skill_region_period UNIQUE (skill_name, region, data_period_start, data_period_end),
    CONSTRAINT valid_rates CHECK (average_hourly_rate > 0)
);

-- Track model performance and accuracy metrics
CREATE TABLE IF NOT EXISTS estimation_accuracy_tracking (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Model information
    model_version VARCHAR(50) NOT NULL,
    evaluation_date DATE NOT NULL,
    
    -- Accuracy metrics
    mean_absolute_error DECIMAL(12, 2),
    mean_absolute_percentage_error DECIMAL(5, 2),
    r_squared_score DECIMAL(5, 4),
    within_10_percent_accuracy DECIMAL(5, 2),
    within_confidence_interval_rate DECIMAL(5, 2),
    
    -- Performance by segment
    accuracy_by_project_type JSONB,
    accuracy_by_budget_range JSONB,
    accuracy_by_region JSONB,
    
    -- Timing metrics
    average_response_time_ms INTEGER,
    p95_response_time_ms INTEGER,
    p99_response_time_ms INTEGER,
    
    -- Sample size
    evaluation_sample_size INTEGER NOT NULL,
    training_data_size INTEGER,
    
    -- Model metadata
    training_date TIMESTAMPTZ,
    feature_set_version VARCHAR(50),
    hyperparameters JSONB,
    
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Store ML model metadata
CREATE TABLE IF NOT EXISTS ml_budget_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Model identification
    model_version VARCHAR(50) UNIQUE NOT NULL,
    model_type VARCHAR(100) NOT NULL,
    
    -- Model artifacts
    model_path TEXT NOT NULL,
    feature_config JSONB NOT NULL,
    
    -- Performance
    training_accuracy DECIMAL(5, 4),
    validation_accuracy DECIMAL(5, 4),
    test_accuracy DECIMAL(5, 4),
    
    -- Status
    is_active BOOLEAN DEFAULT FALSE,
    is_production BOOLEAN DEFAULT FALSE,
    
    -- Metadata
    trained_by UUID,
    training_samples INTEGER,
    training_date TIMESTAMPTZ NOT NULL,
    deployed_at TIMESTAMPTZ,
    retired_at TIMESTAMPTZ,
    
    created_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT
);

-- ==================== Indexes ====================

-- Historical project budgets indexes
CREATE INDEX idx_historical_budgets_project ON historical_project_budgets(project_id);
CREATE INDEX idx_historical_budgets_completion ON historical_project_budgets(completed_at) WHERE completed_at IS NOT NULL;
CREATE INDEX idx_historical_budgets_region ON historical_project_budgets(region);
CREATE INDEX idx_historical_budgets_type ON historical_project_budgets(project_type);
CREATE INDEX idx_historical_budgets_skills ON historical_project_budgets USING GIN (required_skills);

-- Budget estimations indexes
CREATE INDEX idx_budget_estimations_project ON budget_estimations(project_id);
CREATE INDEX idx_budget_estimations_user ON budget_estimations(user_id);
CREATE INDEX idx_budget_estimations_created ON budget_estimations(created_at DESC);
CREATE INDEX idx_budget_estimations_model ON budget_estimations(model_version);
CREATE INDEX idx_budget_estimations_accuracy ON budget_estimations(prediction_error_percent) WHERE prediction_error_percent IS NOT NULL;

-- Market rate data indexes
CREATE INDEX idx_market_rates_skill ON market_rate_data(skill_name);
CREATE INDEX idx_market_rates_region ON market_rate_data(region);
CREATE INDEX idx_market_rates_updated ON market_rate_data(last_updated DESC);
CREATE INDEX idx_market_rates_skill_region ON market_rate_data(skill_name, region);

-- Accuracy tracking indexes
CREATE INDEX idx_accuracy_tracking_model ON estimation_accuracy_tracking(model_version);
CREATE INDEX idx_accuracy_tracking_date ON estimation_accuracy_tracking(evaluation_date DESC);

-- Model metadata indexes
CREATE INDEX idx_ml_models_active ON ml_budget_models(is_active) WHERE is_active = TRUE;
CREATE INDEX idx_ml_models_production ON ml_budget_models(is_production) WHERE is_production = TRUE;

-- ==================== Functions ====================

-- Get historical projects similar to new project for training
CREATE OR REPLACE FUNCTION get_similar_historical_projects(
    p_required_skills JSONB,
    p_project_type VARCHAR,
    p_complexity_level VARCHAR,
    p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
    id UUID,
    description TEXT,
    required_skills JSONB,
    final_budget DECIMAL,
    actual_hours_worked INTEGER,
    similarity_score DECIMAL
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        hpb.id,
        hpb.description,
        hpb.required_skills,
        hpb.final_budget,
        hpb.actual_hours_worked,
        (
            -- Skill overlap score
            (SELECT COUNT(*) FROM jsonb_array_elements_text(hpb.required_skills) AS skill
             WHERE skill IN (SELECT jsonb_array_elements_text(p_required_skills)))::DECIMAL /
            GREATEST(
                jsonb_array_length(hpb.required_skills),
                jsonb_array_length(p_required_skills)
            )
        ) AS similarity_score
    FROM historical_project_budgets hpb
    WHERE 
        hpb.final_budget IS NOT NULL
        AND hpb.completed_at IS NOT NULL
        AND hpb.data_quality_score >= 0.7
        AND (p_project_type IS NULL OR hpb.project_type = p_project_type)
        AND (p_complexity_level IS NULL OR hpb.complexity_level = p_complexity_level)
    ORDER BY similarity_score DESC
    LIMIT p_limit;
END;
$$ LANGUAGE plpgsql;

-- Get market rates for specific skills and region
CREATE OR REPLACE FUNCTION get_market_rates_for_skills(
    p_skills TEXT[],
    p_region VARCHAR DEFAULT 'Global',
    p_experience_level VARCHAR DEFAULT NULL
)
RETURNS TABLE (
    skill_name VARCHAR,
    average_hourly_rate DECIMAL,
    median_hourly_rate DECIMAL,
    demand_multiplier DECIMAL,
    sample_size INTEGER,
    last_updated TIMESTAMPTZ
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        mrd.skill_name,
        mrd.average_hourly_rate,
        mrd.median_hourly_rate,
        mrd.demand_multiplier,
        mrd.sample_size,
        mrd.last_updated
    FROM market_rate_data mrd
    WHERE 
        mrd.skill_name = ANY(p_skills)
        AND (mrd.region = p_region OR mrd.region = 'Global')
        AND (p_experience_level IS NULL OR mrd.experience_level = p_experience_level)
        AND mrd.last_updated >= NOW() - INTERVAL '6 months'
    ORDER BY 
        CASE WHEN mrd.region = p_region THEN 0 ELSE 1 END,
        mrd.last_updated DESC;
END;
$$ LANGUAGE plpgsql;

-- Record budget estimation
CREATE OR REPLACE FUNCTION record_budget_estimation(
    p_project_id UUID,
    p_user_id UUID,
    p_estimated_budget DECIMAL,
    p_confidence_lower DECIMAL,
    p_confidence_upper DECIMAL,
    p_budget_breakdown JSONB,
    p_market_insights JSONB,
    p_model_version VARCHAR,
    p_recommendation TEXT
)
RETURNS UUID AS $$
DECLARE
    v_estimation_id UUID;
BEGIN
    INSERT INTO budget_estimations (
        project_id,
        user_id,
        estimated_budget,
        confidence_lower_bound,
        confidence_upper_bound,
        budget_breakdown,
        market_insights,
        model_version,
        recommendation
    ) VALUES (
        p_project_id,
        p_user_id,
        p_estimated_budget,
        p_confidence_lower,
        p_confidence_upper,
        p_budget_breakdown,
        p_market_insights,
        p_model_version,
        p_recommendation
    )
    RETURNING id INTO v_estimation_id;
    
    RETURN v_estimation_id;
END;
$$ LANGUAGE plpgsql;

-- Update estimation accuracy after project completion
CREATE OR REPLACE FUNCTION update_estimation_accuracy(
    p_estimation_id UUID,
    p_actual_final_budget DECIMAL
)
RETURNS BOOLEAN AS $$
DECLARE
    v_estimated_budget DECIMAL;
    v_confidence_lower DECIMAL;
    v_confidence_upper DECIMAL;
    v_error_percent DECIMAL;
    v_within_interval BOOLEAN;
BEGIN
    -- Get estimation details
    SELECT 
        estimated_budget,
        confidence_lower_bound,
        confidence_upper_bound
    INTO 
        v_estimated_budget,
        v_confidence_lower,
        v_confidence_upper
    FROM budget_estimations
    WHERE id = p_estimation_id;
    
    IF NOT FOUND THEN
        RETURN FALSE;
    END IF;
    
    -- Calculate error
    v_error_percent := ABS((p_actual_final_budget - v_estimated_budget) / v_estimated_budget * 100);
    
    -- Check if within confidence interval
    v_within_interval := (p_actual_final_budget >= v_confidence_lower AND p_actual_final_budget <= v_confidence_upper);
    
    -- Update estimation
    UPDATE budget_estimations
    SET 
        actual_final_budget = p_actual_final_budget,
        prediction_error_percent = v_error_percent,
        was_within_confidence_interval = v_within_interval
    WHERE id = p_estimation_id;
    
    RETURN TRUE;
END;
$$ LANGUAGE plpgsql;

-- Get model performance metrics
CREATE OR REPLACE FUNCTION get_model_performance_summary(
    p_model_version VARCHAR
)
RETURNS TABLE (
    total_predictions INTEGER,
    avg_error_percent DECIMAL,
    within_10_percent_rate DECIMAL,
    within_confidence_rate DECIMAL,
    avg_response_time_ms INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        COUNT(*)::INTEGER AS total_predictions,
        AVG(be.prediction_error_percent) AS avg_error_percent,
        (COUNT(*) FILTER (WHERE be.prediction_error_percent <= 10) * 100.0 / COUNT(*)) AS within_10_percent_rate,
        (COUNT(*) FILTER (WHERE be.was_within_confidence_interval) * 100.0 / COUNT(*)) AS within_confidence_rate,
        (SELECT average_response_time_ms FROM estimation_accuracy_tracking 
         WHERE model_version = p_model_version 
         ORDER BY evaluation_date DESC LIMIT 1) AS avg_response_time_ms
    FROM budget_estimations be
    WHERE 
        be.model_version = p_model_version
        AND be.actual_final_budget IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- Calculate budget statistics by project type
CREATE OR REPLACE FUNCTION get_budget_statistics_by_type(
    p_project_type VARCHAR
)
RETURNS TABLE (
    avg_budget DECIMAL,
    median_budget DECIMAL,
    min_budget DECIMAL,
    max_budget DECIMAL,
    std_dev DECIMAL,
    sample_size INTEGER
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        AVG(final_budget) AS avg_budget,
        PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY final_budget) AS median_budget,
        MIN(final_budget) AS min_budget,
        MAX(final_budget) AS max_budget,
        STDDEV(final_budget) AS std_dev,
        COUNT(*)::INTEGER AS sample_size
    FROM historical_project_budgets
    WHERE 
        project_type = p_project_type
        AND final_budget IS NOT NULL
        AND completed_at IS NOT NULL;
END;
$$ LANGUAGE plpgsql;

-- ==================== Row Level Security ====================

ALTER TABLE historical_project_budgets ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_estimations ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_rate_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimation_accuracy_tracking ENABLE ROW LEVEL SECURITY;
ALTER TABLE ml_budget_models ENABLE ROW LEVEL SECURITY;

-- Historical project budgets policies (read-only for ML service)
CREATE POLICY "ML service can read historical budgets"
    ON historical_project_budgets FOR SELECT
    USING (true);

CREATE POLICY "Admin can manage historical budgets"
    ON historical_project_budgets FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Budget estimations policies
CREATE POLICY "Users can view their own estimations"
    ON budget_estimations FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can create estimations"
    ON budget_estimations FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ML service can update accuracy"
    ON budget_estimations FOR UPDATE
    USING (true);

-- Market rate data policies (public read)
CREATE POLICY "Anyone can view market rates"
    ON market_rate_data FOR SELECT
    USING (true);

CREATE POLICY "Admin can manage market rates"
    ON market_rate_data FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- Accuracy tracking policies (public read)
CREATE POLICY "Anyone can view accuracy metrics"
    ON estimation_accuracy_tracking FOR SELECT
    USING (true);

CREATE POLICY "ML service can insert metrics"
    ON estimation_accuracy_tracking FOR INSERT
    WITH CHECK (true);

-- ML models policies
CREATE POLICY "Anyone can view active models"
    ON ml_budget_models FOR SELECT
    USING (is_active = TRUE);

CREATE POLICY "Admin can manage models"
    ON ml_budget_models FOR ALL
    USING (auth.jwt() ->> 'role' = 'admin');

-- ==================== Triggers ====================

-- Update market rate timestamp on modification
CREATE OR REPLACE FUNCTION update_market_rate_timestamp()
RETURNS TRIGGER AS $$
BEGIN
    NEW.last_updated := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_market_rate_timestamp
    BEFORE UPDATE ON market_rate_data
    FOR EACH ROW
    EXECUTE FUNCTION update_market_rate_timestamp();

-- ==================== Comments ====================

COMMENT ON TABLE historical_project_budgets IS 'Historical project data for ML model training';
COMMENT ON TABLE budget_estimations IS 'Budget estimations with predictions and accuracy tracking';
COMMENT ON TABLE market_rate_data IS 'Market rate data for different skills and regions';
COMMENT ON TABLE estimation_accuracy_tracking IS 'Model performance metrics over time';
COMMENT ON TABLE ml_budget_models IS 'ML model metadata and versioning';

COMMENT ON FUNCTION get_similar_historical_projects IS 'Find similar historical projects for training data';
COMMENT ON FUNCTION get_market_rates_for_skills IS 'Get current market rates for specific skills';
COMMENT ON FUNCTION record_budget_estimation IS 'Store a new budget estimation';
COMMENT ON FUNCTION update_estimation_accuracy IS 'Update estimation accuracy after project completion';
COMMENT ON FUNCTION get_model_performance_summary IS 'Get model performance summary';
