-- Developer Directory Migration
-- Creates views, tables, and functions for searchable developer directory with availability filtering

-- ==================== Saved Searches Table ====================

CREATE TABLE IF NOT EXISTS saved_searches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  search_params JSONB NOT NULL,
  alert_enabled BOOLEAN DEFAULT false,
  alert_frequency TEXT DEFAULT 'daily' CHECK (alert_frequency IN ('instant', 'daily', 'weekly')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user_id ON saved_searches(user_id);
CREATE INDEX idx_saved_searches_alert_enabled ON saved_searches(alert_enabled) WHERE alert_enabled = true;

-- ==================== Developer Watchlist Table ====================

CREATE TABLE IF NOT EXISTS developer_watchlist (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  developer_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_id, developer_id)
);

CREATE INDEX idx_watchlist_client_id ON developer_watchlist(client_id);
CREATE INDEX idx_watchlist_developer_id ON developer_watchlist(developer_id);
CREATE INDEX idx_watchlist_tags ON developer_watchlist USING GIN(tags);

-- ==================== Directory Analytics Table ====================

CREATE TABLE IF NOT EXISTS directory_analytics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  search_params JSONB,
  results_count INTEGER,
  search_time_ms INTEGER,
  clicked_developer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_directory_analytics_user_id ON directory_analytics(user_id);
CREATE INDEX idx_directory_analytics_created_at ON directory_analytics(created_at DESC);
CREATE INDEX idx_directory_analytics_clicked_developer ON directory_analytics(clicked_developer_id);

-- ==================== Developer Directory View ====================

CREATE OR REPLACE VIEW developer_directory AS
SELECT 
  dp.user_id,
  u.email,
  u.display_name,
  u.last_active_at,
  
  -- Profile fields
  dp.headline,
  dp.bio,
  dp.hourly_rate,
  dp.currency,
  dp.availability,
  dp.years_of_experience,
  dp.location,
  dp.github_data,
  dp.is_vetted,
  
  -- Profile picture from users table
  u.avatar_url as profile_picture_url,
  
  -- Experience level calculation
  CASE 
    WHEN dp.years_of_experience IS NULL THEN NULL
    WHEN dp.years_of_experience < 3 THEN 'junior'::TEXT
    WHEN dp.years_of_experience < 6 THEN 'mid'::TEXT
    WHEN dp.years_of_experience < 10 THEN 'senior'::TEXT
    ELSE 'expert'::TEXT
  END as experience_level,
  
  -- Skills aggregation
  COALESCE(
    array_agg(DISTINCT s.name ORDER BY s.name) FILTER (WHERE s.name IS NOT NULL), 
    ARRAY[]::TEXT[]
  ) as skills,
  
  -- GitHub stats extraction
  CASE 
    WHEN dp.github_data IS NOT NULL THEN jsonb_build_object(
      'username', dp.github_data->>'username',
      'public_repos', (dp.github_data->>'public_repos')::INTEGER,
      'total_stars', COALESCE((dp.github_data->>'total_stars')::INTEGER, 0),
      'total_contributions', COALESCE((dp.github_data->>'contribution_graph_total')::INTEGER, 0),
      'top_languages', COALESCE(
        (SELECT array_agg(key ORDER BY (value::INTEGER) DESC)
         FROM jsonb_each_text(dp.github_data->'top_languages')
         LIMIT 5),
        ARRAY[]::TEXT[]
      ),
      'last_synced_at', dp.github_data->>'last_synced_at'
    )
    ELSE NULL
  END as github_stats,
  
  -- Rating and review aggregation
  COALESCE(AVG(r.rating_overall)::NUMERIC(3,2), 0) as rating_average,
  COUNT(DISTINCT r.id)::INTEGER as total_reviews,
  
  -- Project statistics
  COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'completed')::INTEGER as total_projects,
  CASE 
    WHEN COUNT(DISTINCT p.id) > 0 
    THEN (COUNT(DISTINCT p.id) FILTER (WHERE p.status = 'completed')::NUMERIC / COUNT(DISTINCT p.id) * 100)::NUMERIC(5,2)
    ELSE 0
  END as success_rate,
  
  -- Activity metrics
  COALESCE(
    (SELECT response_rate FROM profile_analytics pa WHERE pa.user_id = dp.user_id),
    0
  )::NUMERIC(5,2) as response_rate,
  
  COALESCE(
    (SELECT avg_response_time FROM profile_analytics pa WHERE pa.user_id = dp.user_id),
    0
  )::INTEGER as average_response_time,
  
  -- Profile metrics
  COALESCE(
    (SELECT profile_completeness FROM developer_profiles WHERE user_id = dp.user_id),
    0
  )::INTEGER as profile_completeness,
  
  COALESCE(
    (SELECT profile_views FROM developer_profiles WHERE user_id = dp.user_id),
    0
  )::INTEGER as profile_views,
  
  -- Timestamps
  dp.created_at,
  dp.updated_at

FROM developer_profiles dp
INNER JOIN users u ON dp.user_id = u.id
LEFT JOIN developer_skills ds ON dp.user_id = ds.developer_id
LEFT JOIN skills s ON ds.skill_id = s.id
LEFT JOIN reviews r ON r.reviewer_id = dp.user_id
LEFT JOIN projects p ON p.id = ANY(
  SELECT project_id FROM project_assignments WHERE developer_id = dp.user_id
)

WHERE u.role = 'developer'

GROUP BY 
  dp.user_id,
  u.email,
  u.display_name,
  u.last_active_at,
  u.avatar_url,
  dp.headline,
  dp.bio,
  dp.hourly_rate,
  dp.currency,
  dp.availability,
  dp.years_of_experience,
  dp.location,
  dp.github_data,
  dp.is_vetted,
  dp.created_at,
  dp.updated_at;

-- ==================== Search Function with Availability Priority ====================

CREATE OR REPLACE FUNCTION search_developers(
  p_query TEXT DEFAULT NULL,
  p_skills TEXT[] DEFAULT NULL,
  p_min_rate NUMERIC DEFAULT NULL,
  p_max_rate NUMERIC DEFAULT NULL,
  p_availability TEXT DEFAULT NULL,
  p_experience_level TEXT DEFAULT NULL,
  p_is_vetted BOOLEAN DEFAULT NULL,
  p_location TEXT DEFAULT NULL,
  p_is_remote BOOLEAN DEFAULT NULL,
  p_has_github BOOLEAN DEFAULT NULL,
  p_min_rating NUMERIC DEFAULT NULL,
  p_sort_by TEXT DEFAULT 'availability',
  p_limit INTEGER DEFAULT 12,
  p_offset INTEGER DEFAULT 0
)
RETURNS TABLE (
  user_id UUID,
  headline TEXT,
  bio TEXT,
  profile_picture_url TEXT,
  hourly_rate NUMERIC,
  currency TEXT,
  availability TEXT,
  next_available_date TIMESTAMPTZ,
  skills TEXT[],
  experience_level TEXT,
  years_of_experience INTEGER,
  location TEXT,
  timezone TEXT,
  is_remote_available BOOLEAN,
  is_vetted BOOLEAN,
  rating_average NUMERIC,
  total_reviews INTEGER,
  total_projects INTEGER,
  success_rate NUMERIC,
  github_stats JSONB,
  has_github_profile BOOLEAN,
  last_active TIMESTAMPTZ,
  response_rate NUMERIC,
  average_response_time INTEGER,
  profile_completeness INTEGER,
  profile_views INTEGER
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    dd.user_id,
    dd.headline,
    dd.bio,
    dd.profile_picture_url,
    dd.hourly_rate,
    dd.currency,
    dd.availability::TEXT,
    NULL::TIMESTAMPTZ as next_available_date, -- Can be populated from calendar integration
    dd.skills,
    dd.experience_level,
    dd.years_of_experience,
    dd.location,
    NULL::TEXT as timezone, -- Can be populated from user preferences
    (dd.location IS NULL OR dd.location ILIKE '%remote%') as is_remote_available,
    dd.is_vetted,
    dd.rating_average,
    dd.total_reviews,
    dd.total_projects,
    dd.success_rate,
    dd.github_stats,
    (dd.github_stats IS NOT NULL) as has_github_profile,
    dd.last_active_at as last_active,
    dd.response_rate,
    dd.average_response_time,
    dd.profile_completeness,
    dd.profile_views
  FROM developer_directory dd
  WHERE 
    -- Text search on headline and bio
    (p_query IS NULL OR 
     dd.headline ILIKE '%' || p_query || '%' OR 
     dd.bio ILIKE '%' || p_query || '%')
    
    -- Skills filter (must have all specified skills)
    AND (p_skills IS NULL OR dd.skills @> p_skills)
    
    -- Rate range filter
    AND (p_min_rate IS NULL OR dd.hourly_rate >= p_min_rate)
    AND (p_max_rate IS NULL OR dd.hourly_rate <= p_max_rate)
    
    -- Availability filter (PRIORITY)
    AND (p_availability IS NULL OR dd.availability::TEXT = p_availability)
    
    -- Experience level filter
    AND (p_experience_level IS NULL OR dd.experience_level = p_experience_level)
    
    -- Vetted status filter
    AND (p_is_vetted IS NULL OR dd.is_vetted = p_is_vetted)
    
    -- Location filter
    AND (p_location IS NULL OR dd.location ILIKE '%' || p_location || '%')
    
    -- Remote filter
    AND (p_is_remote IS NULL OR 
         (p_is_remote = true AND (dd.location IS NULL OR dd.location ILIKE '%remote%')))
    
    -- GitHub profile filter
    AND (p_has_github IS NULL OR 
         (p_has_github = true AND dd.github_stats IS NOT NULL) OR
         (p_has_github = false AND dd.github_stats IS NULL))
    
    -- Minimum rating filter
    AND (p_min_rating IS NULL OR dd.rating_average >= p_min_rating)
  
  ORDER BY
    -- Dynamic sorting with availability priority
    CASE 
      WHEN p_sort_by = 'availability' THEN
        CASE dd.availability::TEXT
          WHEN 'available' THEN 0
          WHEN 'booked' THEN 1
          WHEN 'unavailable' THEN 2
        END
      WHEN p_sort_by = 'rating' THEN -dd.rating_average::NUMERIC
      WHEN p_sort_by = 'rate_low' THEN dd.hourly_rate::NUMERIC
      WHEN p_sort_by = 'rate_high' THEN -dd.hourly_rate::NUMERIC
      WHEN p_sort_by = 'recent_activity' THEN EXTRACT(EPOCH FROM (NOW() - dd.last_active_at))
      ELSE 0 -- relevance
    END,
    -- Secondary sort by rating
    dd.rating_average DESC,
    dd.created_at DESC
  
  LIMIT p_limit
  OFFSET p_offset;
END;
$$;

-- ==================== Helper Functions ====================

-- Track developer profile view
CREATE OR REPLACE FUNCTION track_developer_view(
  p_developer_id UUID,
  p_viewer_id UUID DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
AS $$
BEGIN
  -- Increment profile views
  UPDATE developer_profiles
  SET profile_views = COALESCE(profile_views, 0) + 1
  WHERE user_id = p_developer_id;
  
  -- Log analytics if viewer is provided
  IF p_viewer_id IS NOT NULL THEN
    INSERT INTO directory_analytics (user_id, clicked_developer_id)
    VALUES (p_viewer_id, p_developer_id);
  END IF;
END;
$$;

-- Get available filter options
CREATE OR REPLACE FUNCTION get_directory_filters()
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'popular_skills', (
      SELECT jsonb_agg(jsonb_build_object(
        'label', s.name,
        'value', s.name,
        'count', COUNT(DISTINCT ds.developer_id)
      ))
      FROM skills s
      INNER JOIN developer_skills ds ON s.id = ds.skill_id
      GROUP BY s.name
      ORDER BY COUNT(DISTINCT ds.developer_id) DESC
      LIMIT 20
    ),
    'timezones', (
      SELECT jsonb_agg(DISTINCT location)
      FROM developer_profiles
      WHERE location IS NOT NULL
    ),
    'experience_levels', jsonb_build_array('junior', 'mid', 'senior', 'expert'),
    'availability_statuses', jsonb_build_array('available', 'booked', 'unavailable')
  ) INTO result;
  
  RETURN result;
END;
$$;

-- Update last active timestamp
CREATE OR REPLACE FUNCTION update_developer_last_active()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  UPDATE users
  SET last_active_at = NOW()
  WHERE id = NEW.user_id;
  
  RETURN NEW;
END;
$$;

CREATE TRIGGER trigger_update_developer_last_active
AFTER INSERT OR UPDATE ON developer_profiles
FOR EACH ROW
EXECUTE FUNCTION update_developer_last_active();

-- ==================== Row Level Security ====================

-- Saved searches policies
ALTER TABLE saved_searches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own saved searches"
  ON saved_searches FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can create their own saved searches"
  ON saved_searches FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own saved searches"
  ON saved_searches FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own saved searches"
  ON saved_searches FOR DELETE
  USING (user_id = auth.uid());

-- Watchlist policies
ALTER TABLE developer_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clients can view their own watchlist"
  ON developer_watchlist FOR SELECT
  USING (client_id = auth.uid());

CREATE POLICY "Clients can add to their watchlist"
  ON developer_watchlist FOR INSERT
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can update their watchlist"
  ON developer_watchlist FOR UPDATE
  USING (client_id = auth.uid())
  WITH CHECK (client_id = auth.uid());

CREATE POLICY "Clients can remove from their watchlist"
  ON developer_watchlist FOR DELETE
  USING (client_id = auth.uid());

-- Directory analytics policies
ALTER TABLE directory_analytics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own analytics"
  ON directory_analytics FOR SELECT
  USING (user_id = auth.uid() OR user_id IS NULL);

CREATE POLICY "Anyone can insert analytics"
  ON directory_analytics FOR INSERT
  WITH CHECK (true);

-- ==================== Indexes for Performance ====================

-- Additional indexes for search optimization
CREATE INDEX IF NOT EXISTS idx_developer_profiles_availability ON developer_profiles(availability);
CREATE INDEX IF NOT EXISTS idx_developer_profiles_hourly_rate ON developer_profiles(hourly_rate);
CREATE INDEX IF NOT EXISTS idx_developer_profiles_vetted ON developer_profiles(is_vetted);
CREATE INDEX IF NOT EXISTS idx_developer_profiles_location ON developer_profiles(location);
CREATE INDEX IF NOT EXISTS idx_users_last_active ON users(last_active_at DESC);

-- Composite index for common queries
CREATE INDEX IF NOT EXISTS idx_developer_availability_rate 
  ON developer_profiles(availability, hourly_rate) 
  WHERE availability = 'available';

-- ==================== Comments ====================

COMMENT ON VIEW developer_directory IS 'Comprehensive developer directory view with aggregated stats, ratings, and skills for searchability';
COMMENT ON FUNCTION search_developers IS 'Primary search function for developer directory with availability-first sorting';
COMMENT ON TABLE saved_searches IS 'Stores client saved searches for developers with optional email alerts';
COMMENT ON TABLE developer_watchlist IS 'Stores client watchlists of developers with notes and tags';
COMMENT ON TABLE directory_analytics IS 'Tracks search queries and developer profile views for analytics';
