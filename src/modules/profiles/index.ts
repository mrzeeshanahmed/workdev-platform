// Pages
export { default as ProfileOverview } from './pages/ProfileOverview';

// Types
export type {
  DeveloperProfileExtended,
  PortfolioProject,
  PortfolioProjectInput,
  WorkHistory,
  WorkHistoryInput,
  ProfileAnalytics,
  ProfileCompletenessFactors,
  ProfileUpdatePayload,
  Skill,
} from './types';

// Services
export { ProfileService } from './services/ProfileService';
export {
  GitHubIntegrationService,
  githubIntegrationService,
} from './services/GitHubIntegrationService';
export type {
  GitHubData,
  GitHubSyncResult,
  GitHubTokenStatus,
} from './services/GitHubIntegrationService';

// Context
export { ProfileProvider, useProfile } from './context/ProfileContext';

// Components
export {
  ProfileEditor,
  PortfolioManager,
  SkillsAutocomplete,
  ProfileCompletenessWidget,
  GitHubStats,
} from './components';
