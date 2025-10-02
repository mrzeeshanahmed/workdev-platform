import type { UserRole } from 'modules/auth/types';

export type ModuleKey =
  | 'dashboard'
  | 'auth'
  | 'profiles'
  | 'marketplace'
  | 'projects'
  | 'workspace'
  | 'vetting';

export interface RouteConfig {
  path: string;
  element: React.ReactNode;
  module: ModuleKey;
  requiresAuth?: boolean;
  allowedRoles?: UserRole[];
}
