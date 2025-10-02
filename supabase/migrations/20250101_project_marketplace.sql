-- Project Marketplace Schema
-- Migration for projects, search, filtering, and featured listings

-- ==================== Projects Table ====================
CREATE TABLE IF NOT EXISTS projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    budget DECIMAL(10,2) NOT NULL,
    project_type VARCHAR(20) NOT NULL CHECK (project_type IN ('fixed', 'hourly')),
    duration_estimate VARCHAR(50),
    deadline TIMESTAMP WITH TIME ZONE,
    location VARCHAR(255),
    is_remote BOOLEAN DEFAULT true,
    status VARCHAR(50) DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'completed', 'cancelled')),
    proposals_count INTEGER DEFAULT 0,
    views_count INTEGER DEFAULT 0,
    is_featured BOOLEAN DEFAULT false,
    featured_until TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    -- Full-text search columns
    search_vector tsvector
);

-- Full-text search index
CREATE INDEX idx_projects_search ON projects USING GIN(search_vector);

-- Other indexes for performance
CREATE INDEX idx_projects_client ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_featured ON projects(is_featured, featured_until) WHERE is_featured = true;
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);
CREATE INDEX idx_projects_budget ON projects(budget DESC);
CREATE INDEX idx_projects_deadline ON projects(deadline ASC) WHERE deadline IS NOT NULL;
CREATE INDEX idx_projects_type ON projects(project_type);

-- ==================== Project Skills Table ====================
CREATE TABLE IF NOT EXISTS project_skills (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    skill_name VARCHAR(100) NOT NULL,
    is_required BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id, skill_name)
);

-- Index for filtering by skills
CREATE INDEX idx_project_skills_skill ON project_skills(skill_name);
CREATE INDEX idx_project_skills_project ON project_skills(project_id);

-- ==================== Featured Projects Table ====================
CREATE TABLE IF NOT EXISTS featured_projects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    featured_from TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    featured_until TIMESTAMP WITH TIME ZONE NOT NULL,
    placement VARCHAR(50) DEFAULT 'grid' CHECK (placement IN ('top', 'sidebar', 'grid')),
    impressions INTEGER DEFAULT 0,
    clicks INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(project_id)
);

-- Index for active featured projects
CREATE INDEX idx_featured_active ON featured_projects(featured_until) 
    WHERE featured_until > NOW();

-- ==================== Search Analytics Table ====================
CREATE TABLE IF NOT EXISTS search_analytics (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    query TEXT,
    filters JSONB,
    results_count INTEGER,
    search_time_ms INTEGER,
    clicked_projects UUID[],
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Index for analytics queries
CREATE INDEX idx_search_analytics_user ON search_analytics(user_id);
CREATE INDEX idx_search_analytics_created ON search_analytics(created_at DESC);
CREATE INDEX idx_search_analytics_query ON search_analytics USING GIN(to_tsvector('english', query));

-- ==================== Functions ====================

-- Function to update search_vector on projects
CREATE OR REPLACE FUNCTION update_project_search_vector()
RETURNS TRIGGER AS $$
BEGIN
    NEW.search_vector := 
        setweight(to_tsvector('english', COALESCE(NEW.title, '')), 'A') ||
        setweight(to_tsvector('english', COALESCE(NEW.description, '')), 'B') ||
        setweight(to_tsvector('english', COALESCE(NEW.location, '')), 'C');
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger to automatically update search_vector
CREATE TRIGGER trigger_update_search_vector
BEFORE INSERT OR UPDATE ON projects
FOR EACH ROW
EXECUTE FUNCTION update_project_search_vector();

-- Function to increment project views
CREATE OR REPLACE FUNCTION increment_project_views(project_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE projects
    SET views_count = views_count + 1
    WHERE id = project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update proposals count
CREATE OR REPLACE FUNCTION update_proposals_count(project_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE projects
    SET proposals_count = (
        SELECT COUNT(*) 
        FROM proposals 
        WHERE proposals.project_id = update_proposals_count.project_id
    )
    WHERE id = project_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track featured project impressions
CREATE OR REPLACE FUNCTION increment_featured_impression(project_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE featured_projects
    SET impressions = impressions + 1
    WHERE project_id = increment_featured_impression.project_id
        AND featured_until > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to track featured project clicks
CREATE OR REPLACE FUNCTION increment_featured_click(project_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE featured_projects
    SET clicks = clicks + 1
    WHERE project_id = increment_featured_click.project_id
        AND featured_until > NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to expire featured projects
CREATE OR REPLACE FUNCTION expire_featured_projects()
RETURNS void AS $$
BEGIN
    UPDATE projects
    SET is_featured = false
    WHERE is_featured = true
        AND featured_until < NOW();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get popular skills with project counts
CREATE OR REPLACE FUNCTION get_popular_skills(skill_limit INTEGER DEFAULT 50)
RETURNS TABLE(skill_name VARCHAR, project_count BIGINT) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        ps.skill_name,
        COUNT(DISTINCT p.id) as project_count
    FROM project_skills ps
    JOIN projects p ON ps.project_id = p.id
    WHERE p.status = 'open'
    GROUP BY ps.skill_name
    ORDER BY project_count DESC
    LIMIT skill_limit;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ==================== Row Level Security ====================

ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_skills ENABLE ROW LEVEL SECURITY;
ALTER TABLE featured_projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE search_analytics ENABLE ROW LEVEL SECURITY;

-- Projects policies
CREATE POLICY "Projects are viewable by everyone"
ON projects FOR SELECT
USING (status = 'open' OR client_id = auth.uid());

CREATE POLICY "Clients can create projects"
ON projects FOR INSERT
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their own projects"
ON projects FOR UPDATE
USING (auth.uid() = client_id);

CREATE POLICY "Clients can delete their own projects"
ON projects FOR DELETE
USING (auth.uid() = client_id);

-- Project skills policies
CREATE POLICY "Project skills are viewable by everyone"
ON project_skills FOR SELECT
USING (true);

CREATE POLICY "Clients can manage skills for their projects"
ON project_skills FOR ALL
USING (
    EXISTS (
        SELECT 1 FROM projects 
        WHERE projects.id = project_skills.project_id 
            AND projects.client_id = auth.uid()
    )
);

-- Featured projects policies
CREATE POLICY "Featured projects are viewable by everyone"
ON featured_projects FOR SELECT
USING (featured_until > NOW());

-- Search analytics policies
CREATE POLICY "Users can view their own search analytics"
ON search_analytics FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create search analytics"
ON search_analytics FOR INSERT
WITH CHECK (auth.uid() = user_id OR user_id IS NULL);

-- ==================== Views ====================

-- View for marketplace project cards
CREATE OR REPLACE VIEW marketplace_projects AS
SELECT 
    p.id,
    p.title,
    p.description,
    p.budget,
    p.project_type,
    p.duration_estimate,
    p.deadline,
    p.location,
    p.is_remote,
    p.status,
    p.proposals_count,
    p.views_count,
    p.is_featured,
    p.featured_until,
    p.created_at,
    p.client_id,
    cp.company_name as client_company,
    cp.average_rating as client_rating,
    COALESCE(
        (SELECT SUM(final_amount_paid) 
         FROM project_hires 
         WHERE client_id = p.client_id 
            AND status = 'completed'), 
        0
    ) as client_total_spent,
    ARRAY_AGG(DISTINCT ps.skill_name) FILTER (WHERE ps.skill_name IS NOT NULL) as skills_required
FROM projects p
LEFT JOIN client_profiles cp ON p.client_id = cp.user_id
LEFT JOIN project_skills ps ON p.id = ps.project_id
GROUP BY p.id, cp.company_name, cp.average_rating;

-- ==================== Seed Data ====================

-- Example: Insert sample projects (uncomment for testing)
-- INSERT INTO projects (client_id, title, description, budget, project_type, duration_estimate, location, is_remote)
-- VALUES 
--     ('client-id-1', 'E-commerce Platform Development', 'Build a full-stack e-commerce platform...', 15000, 'fixed', 'medium', 'Remote', true),
--     ('client-id-2', 'Mobile App UI/UX Design', 'Design modern and intuitive mobile app...', 5000, 'fixed', 'short', 'New York, NY', false);

-- ==================== Maintenance ====================

-- Schedule job to expire featured projects (run daily)
-- SELECT cron.schedule(
--     'expire-featured-projects',
--     '0 0 * * *',
--     $$ SELECT expire_featured_projects(); $$
-- );

-- ==================== Comments ====================

COMMENT ON TABLE projects IS 'Project listings in the marketplace';
COMMENT ON TABLE project_skills IS 'Skills required for each project';
COMMENT ON TABLE featured_projects IS 'Premium featured project placements';
COMMENT ON TABLE search_analytics IS 'Search and filter analytics for marketplace optimization';
COMMENT ON COLUMN projects.search_vector IS 'Full-text search vector (auto-updated)';
COMMENT ON FUNCTION update_project_search_vector IS 'Automatically updates search vector on insert/update';
COMMENT ON FUNCTION get_popular_skills IS 'Returns most popular skills with project counts';
