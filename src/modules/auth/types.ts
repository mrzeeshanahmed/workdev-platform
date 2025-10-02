import type { Factor, Session, User } from '@supabase/supabase-js';

export type UserRole = 'client' | 'developer' | 'admin';

export interface AppUser {
  id: string;
  auth_user_id: string | null;
  email: string;
  role: UserRole;
  display_name: string | null;
  avatar_url: string | null;
  timezone: string | null;
  country_code: string | null;
  headline: string | null;
  bio: string | null;
  metadata: Record<string, unknown> | null;
  last_active_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientProfile {
  user_id: string;
  company_name: string | null;
  company_size: string | null;
  website_url: string | null;
  verified: boolean;
  hiring_preferences: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface DeveloperProfile {
  user_id: string;
  headline: string | null;
  bio: string | null;
  hourly_rate: number | null;
  currency: string;
  availability: string;
  years_of_experience: number | null;
  location: string | null;
  github_data: Record<string, unknown> | null;
  portfolio_urls: string[] | null;
  is_vetted: boolean;
  created_at: string;
  updated_at: string;
}

export type AuthProfile = ClientProfile | DeveloperProfile | null;

export interface SignInResult {
  session: Session | null;
  needsMfa: boolean;
  factors: Factor[];
}

export interface SignUpResult {
  session: Session | null;
  needsConfirmation: boolean;
}

export interface MfaEnrollment {
  factorId: string;
  qrCode: string;
  secret: string;
  uri: string;
}

export interface MfaChallengeState {
  factorId: string;
  factors: Factor[];
  email: string;
}

export interface AuthContextState {
  user: User | null;
  appUser: AppUser | null;
  profile: AuthProfile;
  initializing: boolean;
  loading: boolean;
  error: string | null;
  mfa: MfaChallengeState | null;
  factors: Factor[];
}

export interface BackupCodesSummary {
  total: number;
  remaining: number;
}
