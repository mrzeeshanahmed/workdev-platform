/**
 * Statement of Work (SOW) Generation System
 *
 * Module exports for SOW document management
 */

// Types
export * from './types';

// Services
export { SOWService } from './services/SOWService';
export { default as SOWServiceDefault } from './services/SOWService';

// Pages
export { SOWDashboard } from './pages/SOWDashboard';
export { default as SOWDashboardDefault } from './pages/SOWDashboard';

// Re-export commonly used types
export type {
  SOWDocument,
  SOWDocumentWithDetails,
  SOWTemplate,
  SOWSignature,
  SOWMilestone,
  SOWData,
  GenerateSOWRequest,
  GenerateSOWResponse,
  SOWStatus,
  SignatureStatus,
} from './types';
