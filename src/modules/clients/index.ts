// Types
export type {
  ClientProfile,
  ClientProfileUpdatePayload,
  ClientReputationStats,
  HiringHistoryItem,
  ProjectReview,
  ProjectReviewInput,
  PublicClientProfile,
  PublicReview,
  ReviewEligibility,
  ReviewSubmissionResult,
  CompanySize,
  Industry,
} from './types';

export { COMPANY_SIZES, INDUSTRIES } from './types';

// Services
export { ClientService, clientService } from './services/ClientService';

// Context
export { ClientProvider, useClient } from './context/ClientContext';

// Components
export {
  ClientProfileEditor,
  ClientReputationDashboard,
  ReviewSubmissionDialog,
  HiringHistoryTable,
} from './components';
