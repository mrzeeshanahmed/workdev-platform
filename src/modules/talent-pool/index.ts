/**
 * Talent Pool Module - Main Entry Point
 */

// Types
export * from './types';

// Services
export { TalentPoolService } from './services/TalentPoolService';
export { default as TalentPoolServiceDefault } from './services/TalentPoolService';

// Pages
export { TalentPoolDashboard } from './pages/TalentPoolDashboard';
export { default as TalentPoolDashboardDefault } from './pages/TalentPoolDashboard';

// Re-export commonly used types
export type {
  TalentPool,
  TalentPoolMember,
  TalentPoolMemberWithProfile,
  CreateTalentPoolRequest,
  UpdateTalentPoolRequest,
  AddDeveloperToPoolRequest,
  UpdatePoolMemberRequest,
  SearchTalentPoolParams,
  TalentPoolStatistics,
} from './types';
