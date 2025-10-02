export type AvailabilityStatus = 'available' | 'unavailable' | 'booked';
export type ExperienceLevel = 'junior' | 'mid' | 'senior' | 'expert';
export type SortOption =
  | 'availability'
  | 'rating'
  | 'rate_low'
  | 'rate_high'
  | 'recent_activity'
  | 'relevance';

// ==================== Search Parameters ====================

export interface DeveloperSearchParams {
  query?: string; // Full-text search on headline/bio
  skills?: string[]; // Skills filter
  min_rate?: number; // Minimum hourly rate
  max_rate?: number; // Maximum hourly rate
  availability?: AvailabilityStatus; // Availability status filter
  experience_level?: ExperienceLevel; // Experience level filter
  is_vetted?: boolean; // Vetted developers only
  timezone?: string; // Timezone preference (e.g., 'PST', 'EST', 'UTC')
  location?: string; // Location search
  is_remote?: boolean; // Remote developers only
  has_github?: boolean; // Must have GitHub profile
  min_rating?: number; // Minimum average rating
  sort_by?: SortOption; // Sort preference
  page?: number; // Page number (default: 1)
  limit?: number; // Results per page (default: 12)
}

// ==================== Developer Card Data ====================

export interface DeveloperCard {
  user_id: string;
  headline: string;
  bio: string | null;
  profile_picture_url: string | null;
  hourly_rate: number | null;
  currency: string;
  availability_status: AvailabilityStatus;
  next_available_date: string | null;
  skills: string[];
  experience_level: ExperienceLevel | null;
  years_of_experience: number | null;
  location: string | null;
  timezone: string | null;
  is_remote_available: boolean;
  is_vetted: boolean;

  // Rating and reviews
  rating_average: number;
  total_reviews: number;
  total_projects: number;
  success_rate: number;

  // GitHub integration
  github_stats: GitHubStats | null;
  has_github_profile: boolean;

  // Activity tracking
  last_active: string;
  response_rate: number;
  average_response_time: number; // in hours

  // Profile metrics
  profile_completeness: number;
  profile_views: number;
}

export interface GitHubStats {
  username: string;
  public_repos: number;
  total_stars: number;
  total_contributions: number;
  top_languages: string[];
  last_synced_at: string;
}

// ==================== Search Results ====================

export interface DeveloperSearchResult {
  developers: DeveloperCard[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

// ==================== Filter Options ====================

export interface DirectoryFilters {
  popular_skills: FilterOption[];
  rate_ranges: RateRange[];
  timezones: FilterOption[];
  experience_levels: ExperienceLevel[];
  availability_statuses: AvailabilityStatus[];
}

export interface FilterOption {
  label: string;
  value: string;
  count?: number;
}

export interface RateRange {
  label: string;
  min: number;
  max: number | null;
}

// ==================== Saved Searches ====================

export interface SavedSearch {
  id: string;
  user_id: string;
  name: string;
  search_params: DeveloperSearchParams;
  alert_enabled: boolean;
  alert_frequency: 'instant' | 'daily' | 'weekly';
  created_at: string;
  updated_at: string;
}

export interface SavedSearchInput {
  name: string;
  search_params: DeveloperSearchParams;
  alert_enabled?: boolean;
  alert_frequency?: 'instant' | 'daily' | 'weekly';
}

// ==================== Watchlist ====================

export interface WatchlistDeveloper {
  id: string;
  client_id: string;
  developer_id: string;
  notes: string | null;
  tags: string[];
  created_at: string;
  updated_at: string;
  developer: DeveloperCard;
}

export interface WatchlistInput {
  developer_id: string;
  notes?: string;
  tags?: string[];
}

// ==================== Analytics ====================

export interface DirectoryAnalytics {
  search_id: string;
  user_id: string | null;
  search_params: DeveloperSearchParams;
  results_count: number;
  search_time_ms: number;
  clicked_developer_id: string | null;
  created_at: string;
}

// ==================== Constants ====================

export const EXPERIENCE_LEVELS: { value: ExperienceLevel; label: string; years: string }[] = [
  { value: 'junior', label: 'Junior', years: '0-2 years' },
  { value: 'mid', label: 'Mid-Level', years: '3-5 years' },
  { value: 'senior', label: 'Senior', years: '6-10 years' },
  { value: 'expert', label: 'Expert', years: '10+ years' },
];

export const AVAILABILITY_OPTIONS: { value: AvailabilityStatus; label: string; color: string }[] = [
  { value: 'available', label: 'Available Now', color: 'success' },
  { value: 'booked', label: 'Currently Booked', color: 'error' },
  { value: 'unavailable', label: 'Not Available', color: 'default' },
];

export const RATE_RANGES: RateRange[] = [
  { label: 'Under $25/hr', min: 0, max: 25 },
  { label: '$25 - $50/hr', min: 25, max: 50 },
  { label: '$50 - $75/hr', min: 50, max: 75 },
  { label: '$75 - $100/hr', min: 75, max: 100 },
  { label: '$100 - $150/hr', min: 100, max: 150 },
  { label: '$150+/hr', min: 150, max: null },
];

export const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'availability', label: 'Availability (Available First)' },
  { value: 'rating', label: 'Highest Rated' },
  { value: 'rate_low', label: 'Lowest Rate' },
  { value: 'rate_high', label: 'Highest Rate' },
  { value: 'recent_activity', label: 'Recently Active' },
  { value: 'relevance', label: 'Most Relevant' },
];

export const COMMON_TIMEZONES: FilterOption[] = [
  { label: 'Pacific Time (PST/PDT)', value: 'America/Los_Angeles' },
  { label: 'Mountain Time (MST/MDT)', value: 'America/Denver' },
  { label: 'Central Time (CST/CDT)', value: 'America/Chicago' },
  { label: 'Eastern Time (EST/EDT)', value: 'America/New_York' },
  { label: 'UTC', value: 'UTC' },
  { label: 'London (GMT/BST)', value: 'Europe/London' },
  { label: 'Central European Time', value: 'Europe/Berlin' },
  { label: 'India Standard Time', value: 'Asia/Kolkata' },
  { label: 'China Standard Time', value: 'Asia/Shanghai' },
  { label: 'Japan Standard Time', value: 'Asia/Tokyo' },
  { label: 'Australian Eastern Time', value: 'Australia/Sydney' },
];
