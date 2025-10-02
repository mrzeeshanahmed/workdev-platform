-- Client Profile and Two-Way Reputation System
-- Migration for client profiles, project reviews, and hiring history

-- ==================== Client Profiles Table ====================
CREATE TABLE IF NOT EXISTS client_profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_logo_url TEXT,
    company_website TEXT,
    company_description TEXT NOT NULL,
    industry VARCHAR(100),
    company_size VARCHAR(50),
    location VARCHAR(255),
    total_projects_posted INTEGER DEFAULT 0,
    active_projects INTEGER DEFAULT 0,
    successful_hires INTEGER DEFAULT 0,
    repeat_hire_rate DECIMAL(5,2) DEFAULT 0.00,
    average_rating DECIMAL(3,2) DEFAULT 0.00,
    total_reviews INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(user_id)
);

-- Index for faster lookups
CREATE INDEX idx_client_profiles_user_id ON client_profiles(user_id);
CREATE INDEX idx_client_profiles_average_rating ON client_profiles(average_rating DESC);

-- ==================== Project Reviews Table ====================
CREATE TABLE IF NOT EXISTS project_reviews (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL, -- References projects table
    reviewer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewer_type VARCHAR(20) NOT NULL CHECK (reviewer_type IN ('developer', 'client')),
    reviewee_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    reviewee_type VARCHAR(20) NOT NULL CHECK (reviewee_type IN ('developer', 'client')),
    
    -- Common ratings (1-5 stars)
    rating_communication INTEGER NOT NULL CHECK (rating_communication >= 1 AND rating_communication <= 5),
    rating_professionalism INTEGER NOT NULL CHECK (rating_professionalism >= 1 AND rating_professionalism <= 5),
    
    -- Client-specific ratings (when developer reviews client)
    rating_project_clarity INTEGER CHECK (rating_project_clarity >= 1 AND rating_project_clarity <= 5),
    rating_payment_timeliness INTEGER CHECK (rating_payment_timeliness >= 1 AND rating_payment_timeliness <= 5),
    
    -- Developer-specific ratings (when client reviews developer)
    rating_quality INTEGER CHECK (rating_quality >= 1 AND rating_quality <= 5),
    rating_expertise INTEGER CHECK (rating_expertise >= 1 AND rating_expertise <= 5),
    rating_responsiveness INTEGER CHECK (rating_responsiveness >= 1 AND rating_responsiveness <= 5),
    
    comment TEXT NOT NULL,
    is_visible BOOLEAN DEFAULT true,
    is_mutual_visible BOOLEAN DEFAULT false, -- True when both parties have reviewed
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    -- Ensure one review per project per reviewer
    UNIQUE(project_id, reviewer_user_id)
);

-- Indexes for performance
CREATE INDEX idx_reviews_reviewee ON project_reviews(reviewee_user_id, reviewee_type);
CREATE INDEX idx_reviews_project ON project_reviews(project_id);
CREATE INDEX idx_reviews_mutual_visible ON project_reviews(is_mutual_visible);

-- ==================== Project Hires Table ====================
CREATE TABLE IF NOT EXISTS project_hires (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    project_id UUID NOT NULL, -- References projects table
    client_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    developer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    hire_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    completion_date TIMESTAMP WITH TIME ZONE,
    status VARCHAR(50) DEFAULT 'active' CHECK (status IN ('active', 'completed', 'cancelled')),
    outcome VARCHAR(50) CHECK (outcome IN ('successful', 'disputed', 'cancelled')),
    final_amount_paid DECIMAL(10,2),
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    UNIQUE(project_id, developer_id)
);

-- Indexes
CREATE INDEX idx_hires_client ON project_hires(client_id);
CREATE INDEX idx_hires_developer ON project_hires(developer_id);
CREATE INDEX idx_hires_project ON project_hires(project_id);
CREATE INDEX idx_hires_status ON project_hires(status);

-- ==================== Storage Bucket for Company Logos ====================
INSERT INTO storage.buckets (id, name, public)
VALUES ('company-logos', 'company-logos', true)
ON CONFLICT (id) DO NOTHING;

-- Storage policies for company logos
CREATE POLICY "Company logos are publicly accessible"
ON storage.objects FOR SELECT
USING (bucket_id = 'company-logos');

CREATE POLICY "Users can upload their own company logo"
ON storage.objects FOR INSERT
WITH CHECK (
    bucket_id = 'company-logos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can update their own company logo"
ON storage.objects FOR UPDATE
USING (
    bucket_id = 'company-logos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

CREATE POLICY "Users can delete their own company logo"
ON storage.objects FOR DELETE
USING (
    bucket_id = 'company-logos' 
    AND (storage.foldername(name))[1] = auth.uid()::text
);

-- ==================== Row Level Security (RLS) ====================

-- Enable RLS
ALTER TABLE client_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_hires ENABLE ROW LEVEL SECURITY;

-- Client Profiles Policies
CREATE POLICY "Client profiles are viewable by everyone"
ON client_profiles FOR SELECT
USING (true);

CREATE POLICY "Users can create their own client profile"
ON client_profiles FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own client profile"
ON client_profiles FOR UPDATE
USING (auth.uid() = user_id);

-- Project Reviews Policies
CREATE POLICY "Mutual reviews are publicly visible"
ON project_reviews FOR SELECT
USING (is_mutual_visible = true);

CREATE POLICY "Users can view their own reviews (even if not mutual)"
ON project_reviews FOR SELECT
USING (
    auth.uid() = reviewer_user_id 
    OR auth.uid() = reviewee_user_id
);

CREATE POLICY "Users can insert reviews for their projects"
ON project_reviews FOR INSERT
WITH CHECK (auth.uid() = reviewer_user_id);

-- Project Hires Policies
CREATE POLICY "Clients can view their hiring history"
ON project_hires FOR SELECT
USING (auth.uid() = client_id);

CREATE POLICY "Developers can view projects they were hired for"
ON project_hires FOR SELECT
USING (auth.uid() = developer_id);

CREATE POLICY "Clients can create hire records"
ON project_hires FOR INSERT
WITH CHECK (auth.uid() = client_id);

CREATE POLICY "Clients can update their hire records"
ON project_hires FOR UPDATE
USING (auth.uid() = client_id);

-- ==================== Functions ====================

-- Function to update client profile statistics
CREATE OR REPLACE FUNCTION update_client_profile_stats(client_user_id UUID)
RETURNS void AS $$
BEGIN
    UPDATE client_profiles
    SET 
        total_reviews = (
            SELECT COUNT(*) 
            FROM project_reviews 
            WHERE reviewee_user_id = client_user_id 
                AND reviewee_type = 'client' 
                AND is_mutual_visible = true
        ),
        average_rating = (
            SELECT COALESCE(AVG(
                (rating_communication + rating_professionalism + 
                 COALESCE(rating_project_clarity, 0) + COALESCE(rating_payment_timeliness, 0)) / 4.0
            ), 0)
            FROM project_reviews 
            WHERE reviewee_user_id = client_user_id 
                AND reviewee_type = 'client' 
                AND is_mutual_visible = true
        ),
        successful_hires = (
            SELECT COUNT(*) 
            FROM project_hires 
            WHERE client_id = client_user_id 
                AND outcome = 'successful'
        ),
        repeat_hire_rate = (
            SELECT CASE 
                WHEN COUNT(DISTINCT developer_id) = 0 THEN 0
                ELSE (COUNT(*) - COUNT(DISTINCT developer_id))::DECIMAL / COUNT(*)::DECIMAL * 100
            END
            FROM project_hires 
            WHERE client_id = client_user_id 
                AND status = 'completed'
        )
    WHERE user_id = client_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if both parties have reviewed (make reviews mutually visible)
CREATE OR REPLACE FUNCTION check_mutual_reviews()
RETURNS TRIGGER AS $$
BEGIN
    -- Check if the other party has also reviewed
    IF EXISTS (
        SELECT 1 FROM project_reviews
        WHERE project_id = NEW.project_id
            AND reviewer_user_id != NEW.reviewer_user_id
    ) THEN
        -- Update all reviews for this project to be mutually visible
        UPDATE project_reviews
        SET is_mutual_visible = true
        WHERE project_id = NEW.project_id;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to make reviews mutually visible when both are submitted
CREATE TRIGGER trigger_mutual_reviews
AFTER INSERT ON project_reviews
FOR EACH ROW
EXECUTE FUNCTION check_mutual_reviews();

-- Trigger to update client stats after review
CREATE TRIGGER trigger_update_client_stats
AFTER INSERT OR UPDATE ON project_reviews
FOR EACH ROW
WHEN (NEW.is_mutual_visible = true AND NEW.reviewee_type = 'client')
EXECUTE FUNCTION update_client_profile_stats(NEW.reviewee_user_id);

-- ==================== Seed Data for Testing ====================

-- Create sample client profile (run after creating user accounts)
-- INSERT INTO client_profiles (user_id, company_name, company_description, industry, company_size, location)
-- VALUES 
--     ('client-user-id-1', 'TechCorp Inc', 'Leading technology solutions provider', 'Technology', '201-500', 'San Francisco, CA'),
--     ('client-user-id-2', 'FinanceHub', 'Financial services platform', 'Finance', '51-200', 'New York, NY');

-- ==================== Indexes for Query Optimization ====================

-- Composite indexes for common queries
CREATE INDEX idx_reviews_project_reviewee ON project_reviews(project_id, reviewee_user_id);
CREATE INDEX idx_reviews_visible_rating ON project_reviews(is_mutual_visible, rating_communication) 
    WHERE is_mutual_visible = true;

-- Index for hiring history queries
CREATE INDEX idx_hires_client_status ON project_hires(client_id, status);
CREATE INDEX idx_hires_completion_date ON project_hires(completion_date DESC) 
    WHERE completion_date IS NOT NULL;

-- ==================== Comments ====================

COMMENT ON TABLE client_profiles IS 'Client company profiles with reputation metrics';
COMMENT ON TABLE project_reviews IS 'Two-way review system for clients and developers';
COMMENT ON TABLE project_hires IS 'Hiring history tracking for client projects';
COMMENT ON FUNCTION update_client_profile_stats IS 'Aggregates review data to update client reputation statistics';
COMMENT ON FUNCTION check_mutual_reviews IS 'Makes reviews visible when both parties have submitted their reviews';
