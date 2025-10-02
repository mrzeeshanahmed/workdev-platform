// Client Profile Types
export interface ClientProfile {
  id: string;
  user_id: string;
  company_name: string;
  company_logo_url: string | null;
  company_website: string | null;
  company_description: string;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  total_projects_posted: number;
  active_projects: number;
  successful_hires: number;
  repeat_hire_rate: number;
  average_rating: number;
  total_reviews: number;
  created_at: string;
  updated_at: string;
}

export interface ClientProfileUpdatePayload {
  company_name?: string;
  company_logo_url?: string;
  company_website?: string;
  company_description?: string;
  industry?: string;
  company_size?: string;
  location?: string;
}

// Review Types
export interface ProjectReview {
  id: string;
  project_id: string;
  reviewer_user_id: string;
  reviewer_type: 'developer' | 'client';
  reviewee_user_id: string;
  reviewee_type: 'developer' | 'client';
  // Common ratings (1-5)
  rating_communication: number;
  rating_professionalism: number;
  // Client-specific ratings (when developer reviews client)
  rating_project_clarity: number | null;
  rating_payment_timeliness: number | null;
  // Developer-specific ratings (when client reviews developer)
  rating_quality: number | null;
  rating_expertise: number | null;
  rating_responsiveness: number | null;
  comment: string;
  is_visible: boolean;
  is_mutual_visible: boolean; // Both reviews submitted
  created_at: string;
  updated_at: string;
}

export interface ProjectReviewInput {
  project_id: string;
  reviewee_user_id: string;
  reviewee_type: 'developer' | 'client';
  rating_communication: number;
  rating_professionalism: number;
  rating_project_clarity?: number;
  rating_payment_timeliness?: number;
  rating_quality?: number;
  rating_expertise?: number;
  rating_responsiveness?: number;
  comment: string;
}

export interface ReviewEligibility {
  can_review: boolean;
  reason?: string;
  project_completed: boolean;
  payment_completed: boolean;
  already_reviewed: boolean;
}

export interface ClientReputationStats {
  average_rating: number;
  total_reviews: number;
  rating_breakdown: {
    communication: number;
    professionalism: number;
    project_clarity: number;
    payment_timeliness: number;
  };
  five_star_count: number;
  four_star_count: number;
  three_star_count: number;
  two_star_count: number;
  one_star_count: number;
  repeat_hire_rate: number;
  response_rate: number;
  average_project_value: number;
}

export interface HiringHistoryItem {
  id: string;
  project_id: string;
  project_title: string;
  project_budget: number;
  developer_id: string;
  developer_name: string;
  developer_avatar: string | null;
  hire_date: string;
  completion_date: string | null;
  status: 'active' | 'completed' | 'cancelled';
  outcome: 'successful' | 'disputed' | 'cancelled' | null;
  client_review_submitted: boolean;
  developer_review_submitted: boolean;
  final_amount_paid: number | null;
}

export interface PublicClientProfile {
  company_name: string;
  company_logo_url: string | null;
  company_website: string | null;
  company_description: string;
  industry: string | null;
  company_size: string | null;
  location: string | null;
  member_since: string;
  total_projects_posted: number;
  successful_hires: number;
  repeat_hire_rate: number;
  reputation_stats: ClientReputationStats;
  recent_reviews: PublicReview[];
}

export interface PublicReview {
  id: string;
  reviewer_name: string;
  reviewer_avatar: string | null;
  rating: number;
  ratings: {
    communication: number;
    professionalism: number;
    project_clarity?: number;
    payment_timeliness?: number;
    quality?: number;
    expertise?: number;
  };
  comment: string;
  project_title: string;
  created_at: string;
}

export interface ReviewSubmissionResult {
  success: boolean;
  review_id?: string;
  is_mutual_visible?: boolean;
  error?: string;
}

// Company Size Options
export const COMPANY_SIZES = ['1-10', '11-50', '51-200', '201-500', '501-1000', '1000+'] as const;

export type CompanySize = (typeof COMPANY_SIZES)[number];

// Industry Options
export const INDUSTRIES = [
  'Technology',
  'Finance',
  'Healthcare',
  'E-commerce',
  'Education',
  'Media & Entertainment',
  'Manufacturing',
  'Consulting',
  'Real Estate',
  'Other',
] as const;

export type Industry = (typeof INDUSTRIES)[number];
