// Project Marketplace Types

export interface ProjectSearchParams {
  query?: string;
  skills?: string[];
  budget_min?: number;
  budget_max?: number;
  project_type?: 'fixed' | 'hourly';
  duration?: 'short' | 'medium' | 'long';
  location?: string;
  remote_only?: boolean;
  sort_by?: 'newest' | 'budget_high' | 'budget_low' | 'deadline' | 'relevance';
  page?: number;
  limit?: number;
}

export interface ProjectCard {
  id: string;
  title: string;
  description: string;
  budget: number;
  project_type: 'fixed' | 'hourly';
  duration_estimate: string;
  skills_required: string[];
  client_id: string;
  client_name: string;
  client_company?: string;
  client_rating: number;
  client_total_spent: number;
  proposals_count: number;
  created_at: string;
  deadline?: string;
  location?: string;
  is_remote: boolean;
  is_featured: boolean;
  featured_until?: string;
  status: 'open' | 'in_progress' | 'completed' | 'cancelled';
}

export interface ProjectSearchResult {
  projects: ProjectCard[];
  total: number;
  page: number;
  limit: number;
  total_pages: number;
  search_time_ms: number;
  has_more: boolean;
}

export interface ProjectFilters {
  skills: FilterOption[];
  budget_ranges: BudgetRange[];
  project_types: ProjectTypeOption[];
  durations: DurationOption[];
  locations: string[];
}

export interface FilterOption {
  value: string;
  label: string;
  count: number;
}

export interface BudgetRange {
  min: number;
  max: number;
  label: string;
}

export interface ProjectTypeOption {
  value: 'fixed' | 'hourly';
  label: string;
  description: string;
}

export interface DurationOption {
  value: 'short' | 'medium' | 'long';
  label: string;
  description: string;
}

export interface FeaturedProject {
  project_id: string;
  featured_from: string;
  featured_until: string;
  placement: 'top' | 'sidebar' | 'grid';
  impressions: number;
  clicks: number;
}

export interface SearchAnalytics {
  query: string;
  filters: ProjectSearchParams;
  results_count: number;
  search_time_ms: number;
  user_id?: string;
  clicked_projects: string[];
  created_at: string;
}

export interface ProjectSkill {
  project_id: string;
  skill_name: string;
  is_required: boolean;
}

// Constants
export const PROJECT_TYPES: ProjectTypeOption[] = [
  { value: 'fixed', label: 'Fixed Price', description: 'One-time payment for complete project' },
  { value: 'hourly', label: 'Hourly Rate', description: 'Pay by the hour' },
];

export const DURATION_OPTIONS: DurationOption[] = [
  { value: 'short', label: 'Less than 1 month', description: 'Quick turnaround projects' },
  { value: 'medium', label: '1-3 months', description: 'Medium-term engagement' },
  { value: 'long', label: '3+ months', description: 'Long-term projects' },
];

export const BUDGET_RANGES: BudgetRange[] = [
  { min: 0, max: 1000, label: 'Under $1,000' },
  { min: 1000, max: 5000, label: '$1,000 - $5,000' },
  { min: 5000, max: 10000, label: '$5,000 - $10,000' },
  { min: 10000, max: 25000, label: '$10,000 - $25,000' },
  { min: 25000, max: 50000, label: '$25,000 - $50,000' },
  { min: 50000, max: Infinity, label: '$50,000+' },
];

export const SORT_OPTIONS = [
  { value: 'newest', label: 'Newest First' },
  { value: 'budget_high', label: 'Highest Budget' },
  { value: 'budget_low', label: 'Lowest Budget' },
  { value: 'deadline', label: 'Deadline Soon' },
  { value: 'relevance', label: 'Most Relevant' },
] as const;

export type SortOption = (typeof SORT_OPTIONS)[number]['value'];
