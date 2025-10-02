/**
 * Talent Pool CRM System - Type Definitions
 *
 * Comprehensive type system for managing client-developer relationships
 * through talent pools, contact tracking, and availability monitoring
 */

// =====================================================
// CORE TYPES
// =====================================================

export type RelationshipStatus =
  | 'never_worked'
  | 'contacted'
  | 'interviewed'
  | 'worked_before'
  | 'current_project'
  | 'preferred'
  | 'not_interested';

export type AvailabilityStatus = 'available' | 'busy' | 'not_available';

export type ContactType = 'email' | 'message' | 'call' | 'meeting' | 'project_invite';

export type ActivityType =
  | 'member_added'
  | 'member_removed'
  | 'note_updated'
  | 'tags_updated'
  | 'contact_logged'
  | 'rating_updated'
  | 'invited_to_project'
  | 'pool_created'
  | 'pool_updated';

export type BulkActionType =
  | 'invite_to_project'
  | 'send_message'
  | 'update_tags'
  | 'export'
  | 'update_status'
  | 'add_to_pool';

export type PermissionLevel = 'view' | 'edit' | 'admin';

// =====================================================
// DATABASE MODELS
// =====================================================

export interface TalentPool {
  id: string;
  client_user_id: string;
  name: string;
  description?: string;
  tags: string[];
  color: string;
  is_archived: boolean;
  members_count: number;
  created_at: string;
  updated_at: string;
}

export interface TalentPoolMember {
  id: string;
  talent_pool_id: string;
  developer_user_id: string;
  added_at: string;
  added_by_user_id?: string;
  custom_notes: string;
  custom_tags: string[];
  relationship_status: RelationshipStatus;
  performance_rating?: number;
  last_contact_date?: string;
  availability_notifications: boolean;
  is_favorite: boolean;
  // Cached data
  cached_hourly_rate?: number;
  cached_availability_status?: AvailabilityStatus;
  cached_skills?: string[];
  cached_rating_average?: number;
  cached_at?: string;
  updated_at: string;
}

export interface TalentPoolActivity {
  id: string;
  talent_pool_id?: string;
  member_id?: string;
  client_user_id: string;
  developer_user_id?: string;
  activity_type: ActivityType;
  activity_data: Record<string, any>;
  created_at: string;
}

export interface DeveloperContactHistory {
  id: string;
  client_user_id: string;
  developer_user_id: string;
  contact_type: ContactType;
  contact_subject?: string;
  contact_notes?: string;
  related_project_id?: string;
  contact_date: string;
  follow_up_date?: string;
  created_at: string;
}

export interface TalentPoolShare {
  id: string;
  talent_pool_id: string;
  shared_with_user_id: string;
  shared_by_user_id: string;
  permission_level: PermissionLevel;
  created_at: string;
}

export interface AvailabilityNotification {
  id: string;
  member_id: string;
  client_user_id: string;
  developer_user_id: string;
  old_status?: AvailabilityStatus;
  new_status: AvailabilityStatus;
  status_changed_at: string;
  notification_sent: boolean;
  notification_sent_at?: string;
  created_at: string;
}

export interface TalentPoolBulkAction {
  id: string;
  client_user_id: string;
  action_type: BulkActionType;
  target_pool_ids?: string[];
  target_member_ids?: string[];
  action_data: Record<string, any>;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results: Record<string, any>;
  created_at: string;
  completed_at?: string;
}

// =====================================================
// EXTENDED TYPES WITH RELATIONS
// =====================================================

export interface TalentPoolWithDetails extends TalentPool {
  recent_activity?: TalentPoolActivity[];
  shared_with?: TalentPoolShare[];
}

export interface TalentPoolMemberWithProfile extends TalentPoolMember {
  developer_name?: string;
  developer_email?: string;
  developer_headline?: string;
  developer_avatar_url?: string;
  developer_profile?: DeveloperProfile;
  pool_name?: string;
  contact_history?: DeveloperContactHistory[];
}

export interface DeveloperProfile {
  user_id: string;
  headline?: string;
  hourly_rate?: number;
  availability_status: AvailabilityStatus;
  skills: string[];
  rating_average?: number;
  last_active?: string;
  completed_projects_count?: number;
  total_earnings?: number;
}

// =====================================================
// REQUEST/RESPONSE TYPES
// =====================================================

export interface CreateTalentPoolRequest {
  name: string;
  description?: string;
  tags?: string[];
  color?: string;
}

export interface UpdateTalentPoolRequest {
  name?: string;
  description?: string;
  tags?: string[];
  color?: string;
  is_archived?: boolean;
}

export interface AddDeveloperToPoolRequest {
  talent_pool_id: string;
  developer_user_id: string;
  custom_notes?: string;
  custom_tags?: string[];
  relationship_status?: RelationshipStatus;
  performance_rating?: number;
  availability_notifications?: boolean;
  is_favorite?: boolean;
}

export interface UpdatePoolMemberRequest {
  custom_notes?: string;
  custom_tags?: string[];
  relationship_status?: RelationshipStatus;
  performance_rating?: number;
  availability_notifications?: boolean;
  is_favorite?: boolean;
  last_contact_date?: string;
}

export interface SearchTalentPoolParams {
  pool_ids?: string[];
  skills?: string[];
  availability?: AvailabilityStatus;
  min_rate?: number;
  max_rate?: number;
  tags?: string[];
  relationship_status?: RelationshipStatus[];
  last_contact_days?: number;
  min_rating?: number;
  is_favorite?: boolean;
  search_query?: string;
  limit?: number;
  offset?: number;
}

export interface TalentPoolSearchResult {
  member_id: string;
  pool_id: string;
  pool_name: string;
  developer_user_id: string;
  developer_name: string;
  developer_headline?: string;
  hourly_rate?: number;
  availability_status?: AvailabilityStatus;
  skills: string[];
  rating_average?: number;
  custom_notes: string;
  custom_tags: string[];
  relationship_status: RelationshipStatus;
  performance_rating?: number;
  last_contact_date?: string;
  is_favorite: boolean;
  added_at: string;
}

export interface LogContactRequest {
  developer_user_id: string;
  contact_type: ContactType;
  contact_subject?: string;
  contact_notes?: string;
  related_project_id?: string;
  contact_date?: string;
  follow_up_date?: string;
}

export interface InviteDevelopersToProjectRequest {
  project_id: string;
  developer_ids: string[];
  personal_message?: string;
  deadline?: string;
}

export interface BulkMessageRequest {
  member_ids: string[];
  subject: string;
  message: string;
  include_project_link?: boolean;
  project_id?: string;
}

export interface TalentPoolStatistics {
  total_pools: number;
  total_developers: number;
  favorite_developers: number;
  available_developers: number;
  worked_with_before: number;
  average_rating?: number;
  pending_notifications: number;
}

export interface AvailabilityNotificationSummary {
  developer_id: string;
  developer_name: string;
  developer_headline?: string;
  pool_names: string[];
  became_available: string;
  custom_notes?: string;
  hourly_rate?: number;
}

export interface ExportTalentPoolRequest {
  pool_ids?: string[];
  format: 'csv' | 'json' | 'xlsx';
  include_contact_history?: boolean;
  include_notes?: boolean;
}

export interface ExportTalentPoolResponse {
  export_id: string;
  download_url: string;
  expires_at: string;
}

// =====================================================
// UI COMPONENT PROPS
// =====================================================

export interface TalentPoolDashboardProps {
  clientUserId: string;
}

export interface TalentPoolListProps {
  pools: TalentPool[];
  selectedPoolId?: string;
  onSelectPool: (poolId: string) => void;
  onCreatePool: () => void;
  onEditPool: (pool: TalentPool) => void;
  onDeletePool: (poolId: string) => void;
}

export interface TalentPoolMembersListProps {
  members: TalentPoolMemberWithProfile[];
  loading?: boolean;
  onViewProfile: (developerId: string) => void;
  onUpdateMember: (memberId: string, data: UpdatePoolMemberRequest) => void;
  onRemoveMember: (memberId: string) => void;
  onLogContact: (developerId: string) => void;
  onBulkAction: (action: BulkActionType, memberIds: string[]) => void;
}

export interface TalentPoolFiltersProps {
  onFiltersChange: (filters: SearchTalentPoolParams) => void;
  availableSkills: string[];
  availableTags: string[];
  pools: TalentPool[];
}

export interface DeveloperCardProps {
  member: TalentPoolMemberWithProfile;
  selected?: boolean;
  onSelect?: (memberId: string) => void;
  onViewProfile: (developerId: string) => void;
  onQuickEdit: (memberId: string) => void;
}

export interface ContactHistoryProps {
  developerId: string;
  clientUserId: string;
  contacts: DeveloperContactHistory[];
  onAddContact: (contact: LogContactRequest) => void;
  onUpdateContact: (contactId: string, data: Partial<LogContactRequest>) => void;
}

export interface AvailabilityNotificationsProps {
  notifications: AvailabilityNotificationSummary[];
  onDismiss: (notificationId: string) => void;
  onContactDeveloper: (developerId: string) => void;
}

export interface BulkActionModalProps {
  actionType: BulkActionType;
  selectedMembers: TalentPoolMemberWithProfile[];
  onConfirm: (data: any) => void;
  onCancel: () => void;
}

// =====================================================
// UTILITY TYPES
// =====================================================

export interface TalentPoolFormData {
  name: string;
  description: string;
  tags: string[];
  color: string;
}

export interface MemberNoteFormData {
  custom_notes: string;
  custom_tags: string[];
}

export interface PerformanceRatingData {
  rating: number;
  feedback: string;
  project_id?: string;
}

export type SortOption =
  | 'added_date_desc'
  | 'added_date_asc'
  | 'name_asc'
  | 'name_desc'
  | 'rating_desc'
  | 'rate_asc'
  | 'last_contact_desc';

export interface TalentPoolViewState {
  selectedPoolId?: string;
  searchFilters: SearchTalentPoolParams;
  sortBy: SortOption;
  viewMode: 'grid' | 'list' | 'table';
  selectedMemberIds: string[];
}

// =====================================================
// API ERROR TYPES
// =====================================================

export interface TalentPoolError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

export class DeveloperAlreadyInPoolError extends Error {
  constructor(poolName: string) {
    super(`Developer is already in talent pool: ${poolName}`);
    this.name = 'DeveloperAlreadyInPoolError';
  }
}

export class TalentPoolNotFoundError extends Error {
  constructor(poolId: string) {
    super(`Talent pool not found: ${poolId}`);
    this.name = 'TalentPoolNotFoundError';
  }
}

export class InsufficientPermissionsError extends Error {
  constructor(action: string) {
    super(`Insufficient permissions to ${action}`);
    this.name = 'InsufficientPermissionsError';
  }
}
