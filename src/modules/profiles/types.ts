export type AvailabilityStatus = 'available' | 'unavailable' | 'booked';

export interface DeveloperProfileExtended {
  user_id: string;
  headline: string | null;
  bio: string | null;
  hourly_rate: number | null;
  currency: string;
  availability_status: AvailabilityStatus;
  years_of_experience: number | null;
  location: string | null;
  skills: string[];
  profile_picture_url: string | null;
  github_data: GitHubData | null;
  is_vetted: boolean;
  profile_views: number;
  profile_completeness: number;
  created_at: string;
  updated_at: string;
}

export interface GitHubData {
  username: string;
  public_repos: number;
  followers: number;
  following: number;
  contribution_graph: ContributionData[];
  top_languages: { [key: string]: number };
  pinned_repos: Repository[];
  last_synced_at: string;
}

export interface ContributionData {
  date: string;
  count: number;
  level: 0 | 1 | 2 | 3 | 4;
}

export interface Repository {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  language: string | null;
  stargazers_count: number;
  forks_count: number;
  topics: string[];
  created_at: string;
  updated_at: string;
}

export interface PortfolioProject {
  id: string;
  user_id: string;
  title: string;
  description: string;
  tech_stack: string[];
  project_url: string | null;
  github_url: string | null;
  image_url: string | null;
  featured: boolean;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface WorkHistory {
  id: string;
  user_id: string;
  company: string;
  role: string;
  start_date: string;
  end_date: string | null;
  is_current: boolean;
  description: string | null;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface ProfileAnalytics {
  user_id: string;
  views_last_7_days: number;
  views_last_30_days: number;
  views_total: number;
  proposal_count: number;
  proposal_success_rate: number;
  average_response_time: string | null;
  profile_strength_score: number;
  last_calculated_at: string;
}

export interface ProfileUpdatePayload {
  headline?: string;
  bio?: string;
  hourly_rate?: number;
  currency?: string;
  availability_status?: AvailabilityStatus;
  years_of_experience?: number;
  location?: string;
  skills?: string[];
  profile_picture_url?: string;
  profile_completeness?: number;
}

export interface PortfolioProjectInput {
  title: string;
  description: string;
  tech_stack: string[];
  project_url?: string;
  github_url?: string;
  image_url?: string;
  featured?: boolean;
}

export interface WorkHistoryInput {
  company: string;
  role: string;
  start_date: string;
  end_date?: string;
  is_current: boolean;
  description?: string;
}

export interface Skill {
  id: string;
  name: string;
  category: string;
  usage_count: number;
}

export interface ProfileCompletenessFactors {
  has_headline: boolean;
  has_bio: boolean;
  has_hourly_rate: boolean;
  has_skills: boolean;
  has_location: boolean;
  has_profile_picture: boolean;
  has_portfolio: boolean;
  has_work_history: boolean;
  has_github_sync: boolean;
}
