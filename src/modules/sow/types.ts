/**
 * Statement of Work (SOW) Generation System - Type Definitions
 *
 * Comprehensive type system for automated SOW document generation
 */

// =====================================================
// ENUMS AND CONSTANTS
// =====================================================

export type SOWStatus =
  | 'draft'
  | 'pending_review'
  | 'pending_signatures'
  | 'signed'
  | 'cancelled'
  | 'expired';

export type SignatureStatus = 'pending' | 'sent' | 'viewed' | 'signed' | 'declined' | 'expired';

export type SignerRole = 'client' | 'developer' | 'witness' | 'admin';

export type SignatureType = 'digital' | 'electronic' | 'wet_signature';

export type TermType =
  | 'intellectual_property'
  | 'confidentiality'
  | 'termination'
  | 'liability'
  | 'warranty'
  | 'indemnification'
  | 'dispute_resolution'
  | 'force_majeure'
  | 'amendments'
  | 'governing_law'
  | 'custom';

export type ActivityType =
  | 'created'
  | 'updated'
  | 'sent_for_review'
  | 'sent_for_signature'
  | 'signature_completed'
  | 'signed'
  | 'cancelled'
  | 'expired'
  | 'version_created'
  | 'template_changed'
  | 'milestone_added'
  | 'milestone_removed'
  | 'term_modified';

export type TemplateCategory =
  | 'development'
  | 'design'
  | 'consulting'
  | 'maintenance'
  | 'support'
  | 'custom';

export type ChangeReason = 'amendment' | 'correction' | 'update' | 'revision';

// =====================================================
// DATABASE MODELS
// =====================================================

export interface SOWTemplate {
  id: string;
  name: string;
  template_type: string;
  description?: string;
  category?: TemplateCategory;
  sections: TemplateSection[];
  default_terms: Record<string, string>;
  custom_fields: CustomField[];
  required_fields: string[];
  version: number;
  is_active: boolean;
  is_default: boolean;
  language: string;
  region: string;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

export interface SOWDocument {
  id: string;
  project_id: string;
  template_id?: string;
  client_user_id: string;
  developer_user_id: string;
  document_number: string;
  title: string;
  template_type: string;
  version: number;
  status: SOWStatus;
  document_url?: string;
  document_hash?: string;
  file_size_bytes?: number;
  sow_data: SOWData;
  effective_date?: string;
  expiration_date?: string;
  estimated_completion_date?: string;
  signature_request_id?: string;
  client_signed_at?: string;
  developer_signed_at?: string;
  fully_executed_at?: string;
  total_budget: number;
  currency: string;
  payment_terms?: string;
  notes?: string;
  tags: string[];
  created_at: string;
  updated_at: string;
  cancelled_at?: string;
  cancelled_by?: string;
  cancellation_reason?: string;
}

export interface SOWVersion {
  id: string;
  sow_document_id: string;
  version_number: number;
  document_url: string;
  document_hash: string;
  sow_data: SOWData;
  changes_summary?: string;
  changed_fields: string[];
  change_reason?: ChangeReason;
  approved_by?: string;
  approved_at?: string;
  created_at: string;
  created_by: string;
}

export interface SOWSignature {
  id: string;
  sow_document_id: string;
  signer_user_id: string;
  signer_role: SignerRole;
  signer_name: string;
  signer_email: string;
  signer_title?: string;
  signature_type: SignatureType;
  signature_data?: string;
  signature_method?: string;
  status: SignatureStatus;
  invitation_sent_at?: string;
  document_viewed_at?: string;
  signed_at?: string;
  declined_at?: string;
  decline_reason?: string;
  ip_address?: string;
  user_agent?: string;
  geolocation?: Geolocation;
  external_signature_id?: string;
  external_envelope_id?: string;
  created_at: string;
  updated_at: string;
}

export interface SOWMilestone {
  id: string;
  sow_document_id: string;
  milestone_id?: string;
  milestone_number: number;
  title: string;
  description: string;
  deliverables: string[];
  acceptance_criteria: string[];
  budget: number;
  payment_percentage?: number;
  estimated_start_date?: string;
  estimated_completion_date?: string;
  estimated_duration_days?: number;
  depends_on_milestone_ids: string[];
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface SOWTerm {
  id: string;
  sow_document_id: string;
  term_type: TermType;
  title: string;
  content: string;
  section_number?: string;
  display_order: number;
  is_mandatory: boolean;
  is_customized: boolean;
  original_content?: string;
  created_at: string;
  updated_at: string;
}

export interface SOWActivityLog {
  id: string;
  sow_document_id: string;
  activity_type: ActivityType;
  description: string;
  activity_data: Record<string, any>;
  user_id?: string;
  user_role?: string;
  ip_address?: string;
  user_agent?: string;
  created_at: string;
}

// =====================================================
// EXTENDED TYPES WITH RELATIONS
// =====================================================

export interface SOWDocumentWithDetails extends SOWDocument {
  template?: SOWTemplate;
  signatures: SOWSignature[];
  milestones: SOWMilestone[];
  terms: SOWTerm[];
  versions: SOWVersion[];
  activity_log: SOWActivityLog[];
  client_profile?: ClientProfile;
  developer_profile?: DeveloperProfile;
  project?: ProjectBasicInfo;
}

export interface SOWDocumentWithSignatures extends SOWDocument {
  signatures: SOWSignature[];
  pending_signatures: number;
  completed_signatures: number;
  signature_progress: number;
}

// =====================================================
// SOW DATA STRUCTURE
// =====================================================

export interface SOWData {
  // Project information
  project_title: string;
  project_description: string;
  project_type?: string;

  // Parties
  client_company?: string;
  client_contact_name?: string;
  client_contact_email?: string;
  client_address?: string;

  developer_name: string;
  developer_contact_email?: string;
  developer_business_name?: string;
  developer_address?: string;

  // Scope
  scope_of_work: string[];
  objectives: string[];
  out_of_scope?: string[];

  // Deliverables
  deliverables: SOWDeliverable[];

  // Milestones (simplified for SOW)
  milestones: SOWMilestoneData[];

  // Timeline
  timeline: ProjectTimeline;

  // Financial
  payment_terms: PaymentTerms;
  total_budget: number;
  currency: string;

  // Responsibilities
  client_responsibilities: string[];
  developer_responsibilities: string[];

  // Technical
  technologies?: string[];
  platforms?: string[];
  environments?: string[];

  // Legal terms
  intellectual_property_terms?: string;
  confidentiality_terms?: string;
  termination_clauses?: string;
  warranty_terms?: string;
  liability_limitations?: string;
  dispute_resolution?: string;
  governing_law?: string;

  // Additional
  assumptions?: string[];
  constraints?: string[];
  acceptance_process?: string;
  maintenance_terms?: string;
  support_terms?: string;

  // Custom fields
  custom_fields?: Record<string, any>;
}

export interface SOWDeliverable {
  id: string;
  title: string;
  description: string;
  deliverable_type: 'code' | 'documentation' | 'design' | 'deployment' | 'training' | 'other';
  acceptance_criteria: string[];
  milestone_id?: string;
  due_date?: string;
}

export interface SOWMilestoneData {
  id: string;
  title: string;
  description: string;
  deliverables: string[];
  acceptance_criteria: string[];
  budget: number;
  payment_percentage: number;
  estimated_start_date?: string;
  estimated_completion_date?: string;
  duration_days?: number;
  dependencies?: string[];
}

export interface ProjectTimeline {
  start_date?: string;
  end_date?: string;
  estimated_duration: string;
  estimated_hours?: number;
  working_hours?: string;
  holidays?: string[];
  milestone_schedule: MilestoneSchedule[];
}

export interface MilestoneSchedule {
  milestone_id: string;
  milestone_title: string;
  estimated_start: string;
  estimated_end: string;
  duration_days: number;
}

export interface PaymentTerms {
  total_budget: number;
  currency: string;
  payment_schedule: 'milestone' | 'hourly' | 'fixed' | 'retainer';
  milestone_payments?: MilestonePayment[];
  hourly_rate?: number;
  estimated_hours?: number;
  platform_fee_percentage: number;
  payment_method: string;
  payment_due_days: number;
  late_payment_penalty?: string;
  advance_payment_percentage?: number;
}

export interface MilestonePayment {
  milestone_id: string;
  milestone_title: string;
  amount: number;
  percentage: number;
  payment_trigger: string;
}

// =====================================================
// TEMPLATE SYSTEM
// =====================================================

export interface TemplateSection {
  id?: string;
  title: string;
  content: string;
  order: number;
  is_required?: boolean;
  variables?: string[];
}

export interface CustomField {
  name: string;
  label: string;
  type: 'text' | 'textarea' | 'number' | 'date' | 'select' | 'multiselect';
  required: boolean;
  default_value?: any;
  options?: string[];
  validation?: FieldValidation;
}

export interface FieldValidation {
  min_length?: number;
  max_length?: number;
  min_value?: number;
  max_value?: number;
  pattern?: string;
  custom_validator?: string;
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

export interface GenerateSOWRequest {
  project_id: string;
  template_type: string;
  custom_data?: Partial<SOWData>;
  auto_send_for_signature?: boolean;
}

export interface GenerateSOWResponse {
  sow_document: SOWDocument;
  document_url: string;
  signatures_required: SignatureRequirement[];
  next_steps: string[];
}

export interface UpdateSOWRequest {
  title?: string;
  sow_data?: Partial<SOWData>;
  status?: SOWStatus;
  effective_date?: string;
  expiration_date?: string;
  notes?: string;
  tags?: string[];
  increment_version?: boolean;
}

export interface RequestSignaturesRequest {
  sow_document_id: string;
  signers: SignerInfo[];
  message?: string;
  deadline_days?: number;
}

export interface SignerInfo {
  user_id: string;
  role: SignerRole;
  name: string;
  email: string;
  title?: string;
}

export interface SignatureRequirement {
  role: SignerRole;
  name: string;
  email: string;
  required: boolean;
}

export interface SignDocumentRequest {
  signature_id: string;
  signature_data?: string;
  signature_method: string;
  ip_address?: string;
  user_agent?: string;
}

export interface CancelSOWRequest {
  sow_document_id: string;
  reason: string;
}

export interface SOWStatistics {
  total_sows: number;
  draft_sows: number;
  pending_signatures: number;
  signed_sows: number;
  cancelled_sows: number;
  total_contract_value: number;
  avg_time_to_signature_days: number;
}

export interface ExportSOWRequest {
  sow_document_id: string;
  format: 'pdf' | 'docx' | 'html';
  include_signatures?: boolean;
}

export interface RegenerateSOWRequest {
  sow_document_id: string;
  reason: ChangeReason;
  changes_summary: string;
}

// =====================================================
// PDF GENERATION
// =====================================================

export interface PDFGenerationOptions {
  format: 'A4' | 'Letter';
  margin: PDFMargin;
  displayHeaderFooter: boolean;
  headerTemplate?: string;
  footerTemplate?: string;
  printBackground: boolean;
  landscape?: boolean;
}

export interface PDFMargin {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

export interface PDFMetadata {
  title: string;
  author: string;
  subject: string;
  creator: string;
  keywords: string[];
  creation_date: string;
}

// =====================================================
// SIGNATURE SERVICE INTEGRATION
// =====================================================

export interface SignatureServiceConfig {
  provider: 'docusign' | 'hellosign' | 'adobe_sign' | 'internal';
  api_key: string;
  environment: 'sandbox' | 'production';
  callback_url: string;
}

export interface CreateSignatureRequestPayload {
  document_url: string;
  document_name: string;
  signers: ExternalSigner[];
  message?: string;
  subject?: string;
  expire_days?: number;
  reminder_days?: number;
  callback_url?: string;
}

export interface ExternalSigner {
  email: string;
  name: string;
  order?: number;
  role?: string;
}

export interface SignatureWebhookPayload {
  event_type:
    | 'signature_request_sent'
    | 'signature_request_viewed'
    | 'signature_request_signed'
    | 'signature_request_declined';
  signature_request_id: string;
  signer_email: string;
  signed_at?: string;
  ip_address?: string;
}

// =====================================================
// HELPER TYPES
// =====================================================

export interface Geolocation {
  country?: string;
  region?: string;
  city?: string;
  latitude?: number;
  longitude?: number;
}

export interface ClientProfile {
  user_id: string;
  company_name: string;
  company_website?: string;
  contact_email: string;
  contact_name?: string;
}

export interface DeveloperProfile {
  user_id: string;
  display_name: string;
  headline: string;
  email: string;
  hourly_rate?: number;
  business_name?: string;
}

export interface ProjectBasicInfo {
  id: string;
  title: string;
  description: string;
  budget: number;
  status: string;
}

// =====================================================
// UI COMPONENT PROPS
// =====================================================

export interface SOWDashboardProps {
  user_id: string;
  user_role: 'client' | 'developer';
}

export interface SOWListProps {
  documents: SOWDocument[];
  onSelectDocument: (documentId: string) => void;
  onCreateNew: () => void;
  loading?: boolean;
}

export interface SOWDocumentViewerProps {
  document: SOWDocumentWithDetails;
  onRequestSignature: (documentId: string) => void;
  onDownload: (documentId: string) => void;
  onCancel: (documentId: string) => void;
  canEdit: boolean;
}

export interface SOWGeneratorFormProps {
  project_id: string;
  templates: SOWTemplate[];
  onGenerate: (request: GenerateSOWRequest) => Promise<void>;
  onCancel: () => void;
}

export interface SignatureBlockProps {
  signatures: SOWSignature[];
  onSign: (signatureId: string) => void;
  canSign: boolean;
}

export interface SOWMilestoneListProps {
  milestones: SOWMilestone[];
  readonly?: boolean;
}

export interface SOWTermsListProps {
  terms: SOWTerm[];
  onEditTerm?: (termId: string, content: string) => void;
  readonly?: boolean;
}

export interface TemplateSelectionProps {
  templates: SOWTemplate[];
  selectedTemplate?: string;
  onSelect: (templateType: string) => void;
}

export interface SignatureStatusBadgeProps {
  status: SignatureStatus;
  signed_at?: string;
}

export interface SOWActivityTimelineProps {
  activities: SOWActivityLog[];
  limit?: number;
}

// =====================================================
// ERROR TYPES
// =====================================================

export class SOWGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SOWGenerationError';
  }
}

export class TemplateNotFoundError extends Error {
  constructor(templateType: string) {
    super(`Template not found: ${templateType}`);
    this.name = 'TemplateNotFoundError';
  }
}

export class InvalidSOWDataError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidSOWDataError';
  }
}

export class SignatureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SignatureError';
  }
}

export class PDFGenerationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PDFGenerationError';
  }
}

// =====================================================
// UTILITY TYPES
// =====================================================

export type SOWDocumentStatus = SOWDocument['status'];
export type RequiredSOWFields = Pick<
  SOWData,
  'project_title' | 'project_description' | 'total_budget' | 'currency'
>;

export interface SOWValidationResult {
  is_valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  field: string;
  message: string;
  severity: 'error';
}

export interface ValidationWarning {
  field: string;
  message: string;
  severity: 'warning';
}
