-- =====================================================
-- Talent Pool CRM System Migration
-- =====================================================
-- Creates tables and functions for managing client-developer
-- relationships through talent pools and saved contacts

-- =====================================================
-- TABLES
-- =====================================================

-- Talent Pools: Client-created collections of developers
CREATE TABLE IF NOT EXISTS talent_pools (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  tags TEXT[] DEFAULT '{}',
  color VARCHAR(7) DEFAULT '#4F46E5', -- Hex color for visual organization
  is_archived BOOLEAN DEFAULT false,
  members_count INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Talent Pool Members: Developers saved to pools
CREATE TABLE IF NOT EXISTS talent_pool_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_pool_id UUID NOT NULL REFERENCES talent_pools(id) ON DELETE CASCADE,
  developer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  added_by_user_id UUID REFERENCES auth.users(id),
  custom_notes TEXT DEFAULT '',
  custom_tags TEXT[] DEFAULT '{}',
  relationship_status VARCHAR(50) DEFAULT 'never_worked',
  performance_rating DECIMAL(3,2) CHECK (performance_rating >= 0 AND performance_rating <= 5),
  last_contact_date TIMESTAMP WITH TIME ZONE,
  availability_notifications BOOLEAN DEFAULT false,
  is_favorite BOOLEAN DEFAULT false,
  -- Cached data for faster queries
  cached_hourly_rate DECIMAL(10,2),
  cached_availability_status VARCHAR(50),
  cached_skills TEXT[],
  cached_rating_average DECIMAL(3,2),
  cached_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(talent_pool_id, developer_user_id)
);

-- Talent Pool Activity Log
CREATE TABLE IF NOT EXISTS talent_pool_activity (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_pool_id UUID REFERENCES talent_pools(id) ON DELETE CASCADE,
  member_id UUID REFERENCES talent_pool_members(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  developer_user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_type VARCHAR(50) NOT NULL,
  activity_data JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Developer Contact History
CREATE TABLE IF NOT EXISTS developer_contact_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  developer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contact_type VARCHAR(50) NOT NULL, -- email, message, call, meeting, project_invite
  contact_subject VARCHAR(255),
  contact_notes TEXT,
  related_project_id UUID REFERENCES projects(id) ON DELETE SET NULL,
  contact_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  follow_up_date TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Talent Pool Sharing (for team collaboration)
CREATE TABLE IF NOT EXISTS talent_pool_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  talent_pool_id UUID NOT NULL REFERENCES talent_pools(id) ON DELETE CASCADE,
  shared_with_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  shared_by_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  permission_level VARCHAR(20) DEFAULT 'view', -- view, edit, admin
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(talent_pool_id, shared_with_user_id)
);

-- Availability Notifications Queue
CREATE TABLE IF NOT EXISTS availability_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id UUID NOT NULL REFERENCES talent_pool_members(id) ON DELETE CASCADE,
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  developer_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  old_status VARCHAR(50),
  new_status VARCHAR(50) NOT NULL,
  status_changed_at TIMESTAMP WITH TIME ZONE NOT NULL,
  notification_sent BOOLEAN DEFAULT false,
  notification_sent_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Bulk Actions Log
CREATE TABLE IF NOT EXISTS talent_pool_bulk_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  action_type VARCHAR(50) NOT NULL, -- invite_to_project, send_message, update_tags, export
  target_pool_ids UUID[],
  target_member_ids UUID[],
  action_data JSONB DEFAULT '{}',
  status VARCHAR(20) DEFAULT 'pending', -- pending, processing, completed, failed
  results JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- =====================================================
-- INDEXES
-- =====================================================

CREATE INDEX idx_talent_pools_client ON talent_pools(client_user_id) WHERE NOT is_archived;
CREATE INDEX idx_talent_pools_created_at ON talent_pools(created_at DESC);
CREATE INDEX idx_talent_pools_tags ON talent_pools USING GIN(tags);

CREATE INDEX idx_talent_pool_members_pool ON talent_pool_members(talent_pool_id);
CREATE INDEX idx_talent_pool_members_developer ON talent_pool_members(developer_user_id);
CREATE INDEX idx_talent_pool_members_relationship ON talent_pool_members(relationship_status);
CREATE INDEX idx_talent_pool_members_favorite ON talent_pool_members(is_favorite) WHERE is_favorite = true;
CREATE INDEX idx_talent_pool_members_custom_tags ON talent_pool_members USING GIN(custom_tags);
CREATE INDEX idx_talent_pool_members_availability_notif ON talent_pool_members(availability_notifications) WHERE availability_notifications = true;
CREATE INDEX idx_talent_pool_members_cached_skills ON talent_pool_members USING GIN(cached_skills);

CREATE INDEX idx_talent_pool_activity_pool ON talent_pool_activity(talent_pool_id, created_at DESC);
CREATE INDEX idx_talent_pool_activity_type ON talent_pool_activity(activity_type, created_at DESC);

CREATE INDEX idx_contact_history_client_developer ON developer_contact_history(client_user_id, developer_user_id, contact_date DESC);
CREATE INDEX idx_contact_history_follow_up ON developer_contact_history(follow_up_date) WHERE follow_up_date IS NOT NULL;

CREATE INDEX idx_availability_notifications_pending ON availability_notifications(notification_sent, created_at) WHERE NOT notification_sent;

-- =====================================================
-- FUNCTIONS
-- =====================================================

-- Update pool member count
CREATE OR REPLACE FUNCTION update_talent_pool_member_count()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE talent_pools 
    SET members_count = members_count + 1,
        updated_at = NOW()
    WHERE id = NEW.talent_pool_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE talent_pools 
    SET members_count = GREATEST(members_count - 1, 0),
        updated_at = NOW()
    WHERE id = OLD.talent_pool_id;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_pool_member_count
AFTER INSERT OR DELETE ON talent_pool_members
FOR EACH ROW EXECUTE FUNCTION update_talent_pool_member_count();

-- Update timestamps
CREATE OR REPLACE FUNCTION update_talent_pool_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_talent_pools_updated_at
BEFORE UPDATE ON talent_pools
FOR EACH ROW EXECUTE FUNCTION update_talent_pool_updated_at();

CREATE TRIGGER trigger_talent_pool_members_updated_at
BEFORE UPDATE ON talent_pool_members
FOR EACH ROW EXECUTE FUNCTION update_talent_pool_updated_at();

-- Cache developer data in talent pool members
CREATE OR REPLACE FUNCTION cache_developer_profile_data()
RETURNS TRIGGER AS $$
DECLARE
  profile_data RECORD;
BEGIN
  -- Fetch current developer profile data
  SELECT 
    dp.hourly_rate,
    dp.availability_status,
    dp.skills,
    dp.rating_average
  INTO profile_data
  FROM developer_profiles dp
  WHERE dp.user_id = NEW.developer_user_id;

  IF FOUND THEN
    NEW.cached_hourly_rate = profile_data.hourly_rate;
    NEW.cached_availability_status = profile_data.availability_status;
    NEW.cached_skills = profile_data.skills;
    NEW.cached_rating_average = profile_data.rating_average;
    NEW.cached_at = NOW();
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_cache_developer_data
BEFORE INSERT OR UPDATE ON talent_pool_members
FOR EACH ROW EXECUTE FUNCTION cache_developer_profile_data();

-- Detect availability changes and create notifications
CREATE OR REPLACE FUNCTION detect_availability_changes()
RETURNS TRIGGER AS $$
BEGIN
  -- Only track changes to availability_status
  IF NEW.availability_status IS DISTINCT FROM OLD.availability_status THEN
    -- Find all talent pool members with notifications enabled
    INSERT INTO availability_notifications (
      member_id,
      client_user_id,
      developer_user_id,
      old_status,
      new_status,
      status_changed_at
    )
    SELECT 
      tpm.id,
      tp.client_user_id,
      tpm.developer_user_id,
      OLD.availability_status,
      NEW.availability_status,
      NOW()
    FROM talent_pool_members tpm
    JOIN talent_pools tp ON tpm.talent_pool_id = tp.id
    WHERE tpm.developer_user_id = NEW.user_id
      AND tpm.availability_notifications = true
      AND NEW.availability_status = 'available';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_detect_availability_changes
AFTER UPDATE ON developer_profiles
FOR EACH ROW EXECUTE FUNCTION detect_availability_changes();

-- Get talent pool statistics
CREATE OR REPLACE FUNCTION get_talent_pool_statistics(p_client_user_id UUID)
RETURNS TABLE (
  total_pools BIGINT,
  total_developers BIGINT,
  favorite_developers BIGINT,
  available_developers BIGINT,
  worked_with_before BIGINT,
  average_rating NUMERIC,
  pending_notifications BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COUNT(DISTINCT tp.id)::BIGINT,
    COUNT(DISTINCT tpm.developer_user_id)::BIGINT,
    COUNT(DISTINCT CASE WHEN tpm.is_favorite THEN tpm.developer_user_id END)::BIGINT,
    COUNT(DISTINCT CASE WHEN tpm.cached_availability_status = 'available' THEN tpm.developer_user_id END)::BIGINT,
    COUNT(DISTINCT CASE WHEN tpm.relationship_status IN ('worked_before', 'current_project') THEN tpm.developer_user_id END)::BIGINT,
    AVG(tpm.performance_rating),
    (SELECT COUNT(*) FROM availability_notifications an WHERE an.client_user_id = p_client_user_id AND NOT an.notification_sent)::BIGINT
  FROM talent_pools tp
  LEFT JOIN talent_pool_members tpm ON tp.id = tpm.talent_pool_id
  WHERE tp.client_user_id = p_client_user_id
    AND NOT tp.is_archived;
END;
$$ LANGUAGE plpgsql;

-- Search talent pool with advanced filters
CREATE OR REPLACE FUNCTION search_talent_pool_members(
  p_client_user_id UUID,
  p_pool_ids UUID[] DEFAULT NULL,
  p_skills TEXT[] DEFAULT NULL,
  p_availability VARCHAR DEFAULT NULL,
  p_min_rate NUMERIC DEFAULT NULL,
  p_max_rate NUMERIC DEFAULT NULL,
  p_tags TEXT[] DEFAULT NULL,
  p_relationship_status TEXT[] DEFAULT NULL,
  p_last_contact_days INTEGER DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_is_favorite BOOLEAN DEFAULT NULL,
  p_search_query TEXT DEFAULT NULL,
  p_limit INTEGER DEFAULT 50,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  member_id UUID,
  pool_id UUID,
  pool_name VARCHAR,
  developer_user_id UUID,
  developer_name VARCHAR,
  developer_headline TEXT,
  hourly_rate NUMERIC,
  availability_status VARCHAR,
  skills TEXT[],
  rating_average NUMERIC,
  custom_notes TEXT,
  custom_tags TEXT[],
  relationship_status VARCHAR,
  performance_rating NUMERIC,
  last_contact_date TIMESTAMP WITH TIME ZONE,
  is_favorite BOOLEAN,
  added_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    tpm.id,
    tp.id,
    tp.name,
    tpm.developer_user_id,
    u.email,
    dp.headline,
    tpm.cached_hourly_rate,
    tpm.cached_availability_status,
    tpm.cached_skills,
    tpm.cached_rating_average,
    tpm.custom_notes,
    tpm.custom_tags,
    tpm.relationship_status,
    tpm.performance_rating,
    tpm.last_contact_date,
    tpm.is_favorite,
    tpm.added_at
  FROM talent_pool_members tpm
  JOIN talent_pools tp ON tpm.talent_pool_id = tp.id
  JOIN auth.users u ON tpm.developer_user_id = u.id
  LEFT JOIN developer_profiles dp ON tpm.developer_user_id = dp.user_id
  WHERE tp.client_user_id = p_client_user_id
    AND NOT tp.is_archived
    AND (p_pool_ids IS NULL OR tp.id = ANY(p_pool_ids))
    AND (p_skills IS NULL OR tpm.cached_skills && p_skills)
    AND (p_availability IS NULL OR tpm.cached_availability_status = p_availability)
    AND (p_min_rate IS NULL OR tpm.cached_hourly_rate >= p_min_rate)
    AND (p_max_rate IS NULL OR tpm.cached_hourly_rate <= p_max_rate)
    AND (p_tags IS NULL OR tpm.custom_tags && p_tags)
    AND (p_relationship_status IS NULL OR tpm.relationship_status = ANY(p_relationship_status))
    AND (p_last_contact_days IS NULL OR tpm.last_contact_date >= NOW() - (p_last_contact_days || ' days')::INTERVAL)
    AND (p_min_rating IS NULL OR tpm.cached_rating_average >= p_min_rating)
    AND (p_is_favorite IS NULL OR tpm.is_favorite = p_is_favorite)
    AND (p_search_query IS NULL OR 
         dp.headline ILIKE '%' || p_search_query || '%' OR
         tpm.custom_notes ILIKE '%' || p_search_query || '%')
  ORDER BY tpm.is_favorite DESC, tpm.added_at DESC
  LIMIT p_limit
  OFFSET p_offset;
END;
$$ LANGUAGE plpgsql;

-- =====================================================
-- ROW LEVEL SECURITY (RLS)
-- =====================================================

ALTER TABLE talent_pools ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pool_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pool_activity ENABLE ROW LEVEL SECURITY;
ALTER TABLE developer_contact_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pool_shares ENABLE ROW LEVEL SECURITY;
ALTER TABLE availability_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE talent_pool_bulk_actions ENABLE ROW LEVEL SECURITY;

-- Talent Pools Policies
CREATE POLICY "Users can view their own talent pools"
  ON talent_pools FOR SELECT
  USING (auth.uid() = client_user_id);

CREATE POLICY "Users can create their own talent pools"
  ON talent_pools FOR INSERT
  WITH CHECK (auth.uid() = client_user_id);

CREATE POLICY "Users can update their own talent pools"
  ON talent_pools FOR UPDATE
  USING (auth.uid() = client_user_id);

CREATE POLICY "Users can delete their own talent pools"
  ON talent_pools FOR DELETE
  USING (auth.uid() = client_user_id);

-- Talent Pool Members Policies
CREATE POLICY "Users can view members in their talent pools"
  ON talent_pool_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM talent_pools tp 
      WHERE tp.id = talent_pool_id 
      AND tp.client_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can add members to their talent pools"
  ON talent_pool_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM talent_pools tp 
      WHERE tp.id = talent_pool_id 
      AND tp.client_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update members in their talent pools"
  ON talent_pool_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM talent_pools tp 
      WHERE tp.id = talent_pool_id 
      AND tp.client_user_id = auth.uid()
    )
  );

CREATE POLICY "Users can remove members from their talent pools"
  ON talent_pool_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM talent_pools tp 
      WHERE tp.id = talent_pool_id 
      AND tp.client_user_id = auth.uid()
    )
  );

-- Activity Log Policies
CREATE POLICY "Users can view their talent pool activity"
  ON talent_pool_activity FOR SELECT
  USING (auth.uid() = client_user_id);

CREATE POLICY "Users can create activity logs"
  ON talent_pool_activity FOR INSERT
  WITH CHECK (auth.uid() = client_user_id);

-- Contact History Policies
CREATE POLICY "Users can view their contact history"
  ON developer_contact_history FOR SELECT
  USING (auth.uid() = client_user_id);

CREATE POLICY "Users can create contact history"
  ON developer_contact_history FOR INSERT
  WITH CHECK (auth.uid() = client_user_id);

CREATE POLICY "Users can update their contact history"
  ON developer_contact_history FOR UPDATE
  USING (auth.uid() = client_user_id);

-- Availability Notifications Policies
CREATE POLICY "Users can view their availability notifications"
  ON availability_notifications FOR SELECT
  USING (auth.uid() = client_user_id);

-- Bulk Actions Policies
CREATE POLICY "Users can view their bulk actions"
  ON talent_pool_bulk_actions FOR SELECT
  USING (auth.uid() = client_user_id);

CREATE POLICY "Users can create bulk actions"
  ON talent_pool_bulk_actions FOR INSERT
  WITH CHECK (auth.uid() = client_user_id);

-- =====================================================
-- INITIAL DATA / SAMPLE RELATIONSHIP STATUSES
-- =====================================================

COMMENT ON COLUMN talent_pool_members.relationship_status IS 
  'Valid values: never_worked, contacted, interviewed, worked_before, current_project, preferred, not_interested';

COMMENT ON COLUMN talent_pool_activity.activity_type IS 
  'Valid values: member_added, member_removed, note_updated, tags_updated, contact_logged, rating_updated, invited_to_project';

COMMENT ON TABLE talent_pools IS 
  'Client-created collections of developers for relationship management and quick access';

COMMENT ON TABLE talent_pool_members IS 
  'Individual developers saved to talent pools with custom notes, tags, and relationship tracking';
