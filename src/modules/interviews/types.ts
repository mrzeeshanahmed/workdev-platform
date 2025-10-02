/**
 * Interview System - TypeScript Type Definitions
 *
 * Comprehensive type system for the WorkDev interview platform covering:
 * - Interview scheduling and management
 * - Video calling with Twilio
 * - Collaborative code editing
 * - Interview evaluations and feedback
 * - Recording and transcription
 */

// ==========================================
// Interview Core Types
// ==========================================

export type InterviewType = 'behavioral' | 'technical' | 'mixed' | 'cultural_fit';

export type InterviewStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'no_show';

export type ParticipantRole =
  | 'client'
  | 'developer'
  | 'interviewer'
  | 'observer'
  | 'note_taker'
  | 'panelist';

export interface Interview {
  id: string;

  // Participants
  client_user_id: string;
  developer_user_id: string;
  project_id?: string;

  // Scheduling
  scheduled_at: string;
  duration_minutes: number;
  timezone: string;

  // Interview details
  interview_type: InterviewType;
  status: InterviewStatus;

  // Video call info
  room_sid?: string;
  room_name?: string;
  room_token_client?: string;
  room_token_developer?: string;

  // Recording
  recording_enabled: boolean;
  recording_url?: string;
  recording_sid?: string;
  transcription_url?: string;

  // Interview content
  title: string;
  description?: string;
  agenda?: AgendaItem[];
  tags?: string[];

  // Timestamps
  started_at?: string;
  ended_at?: string;
  actual_duration_minutes?: number;

  created_at: string;
  updated_at: string;
}

export interface AgendaItem {
  time: number; // minutes
  activity: string;
}

export interface InterviewParticipant {
  id: string;
  interview_id: string;
  user_id: string;
  role: ParticipantRole;

  // Participation tracking
  joined_at?: string;
  left_at?: string;
  connection_quality?: ConnectionQuality;

  // Permissions
  can_speak: boolean;
  can_share_screen: boolean;
  can_edit_code: boolean;

  created_at: string;
}

export interface ConnectionQuality {
  video: 'poor' | 'fair' | 'good' | 'excellent';
  audio: 'poor' | 'fair' | 'good' | 'excellent';
  network: 'unstable' | 'stable' | 'excellent';
}

// ==========================================
// Video Interview Types
// ==========================================

export interface VideoSession {
  interview_id: string;
  room: any; // Twilio Room object
  localParticipant: LocalParticipant;
  remoteParticipants: Map<string, RemoteParticipant>;
  isConnected: boolean;
  isRecording: boolean;
  connectionQuality: ConnectionQuality;
}

export interface LocalParticipant {
  identity: string;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
  screenTrack?: MediaStreamTrack;
  isAudioEnabled: boolean;
  isVideoEnabled: boolean;
  isScreenSharing: boolean;
}

export interface RemoteParticipant {
  identity: string;
  sid: string;
  audioTrack?: MediaStreamTrack;
  videoTrack?: MediaStreamTrack;
  screenTrack?: MediaStreamTrack;
  connectionQuality: ConnectionQuality;
}

export interface VideoCallConfig {
  audio: boolean;
  video: boolean;
  maxParticipants?: number;
  recordingEnabled?: boolean;
  bandwidthProfile?: BandwidthProfile;
}

export interface BandwidthProfile {
  video: {
    mode: 'collaboration' | 'presentation' | 'grid';
    maxTracks?: number;
    dominantSpeakerPriority?: 'standard' | 'high';
  };
}

export interface MediaDevices {
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  videoInputs: MediaDeviceInfo[];
  selectedAudioInput?: string;
  selectedAudioOutput?: string;
  selectedVideoInput?: string;
}

// ==========================================
// Code Editor Types
// ==========================================

export type ProgrammingLanguage =
  | 'javascript'
  | 'typescript'
  | 'python'
  | 'java'
  | 'csharp'
  | 'cpp'
  | 'go'
  | 'rust'
  | 'ruby'
  | 'php'
  | 'swift'
  | 'kotlin'
  | 'scala'
  | 'r'
  | 'sql'
  | 'html'
  | 'css'
  | 'json'
  | 'yaml'
  | 'markdown';

export type EditorTheme = 'vs-light' | 'vs-dark' | 'hc-black';

export interface CodeEditorSession {
  id: string;
  interview_id: string;

  // Editor configuration
  language: ProgrammingLanguage;
  theme: EditorTheme;

  // Code content
  initial_code: string;
  final_code?: string;
  code_snapshots: CodeSnapshot[];

  // Execution results
  execution_results: CodeExecutionResult[];

  // Collaboration metrics
  total_edits: number;
  participants_edited: string[];

  // Session timing
  started_at: string;
  ended_at?: string;

  created_at: string;
  updated_at: string;
}

export interface CodeSnapshot {
  timestamp: string;
  code: string;
  user_id: string;
  cursor_position?: CursorPosition;
}

export interface CursorPosition {
  line: number;
  column: number;
}

export interface CodeExecutionResult {
  timestamp: string;
  output?: string;
  error?: string;
  runtime_ms: number;
  memory_bytes?: number;
  exit_code: number;
}

export interface CodeEdit {
  type: 'insert' | 'delete' | 'replace';
  range: EditorRange;
  text: string;
  user_id: string;
  timestamp: string;
}

export interface EditorRange {
  startLine: number;
  startColumn: number;
  endLine: number;
  endColumn: number;
}

export interface CollaborativeCursor {
  user_id: string;
  user_name: string;
  color: string;
  position: CursorPosition;
  selection?: EditorRange;
}

// ==========================================
// Interview Evaluation Types
// ==========================================

export interface InterviewEvaluation {
  id: string;
  interview_id: string;
  evaluator_user_id: string;

  // Rating scores (1-5 scale)
  overall_rating: number;
  technical_skills?: number;
  communication?: number;
  problem_solving?: number;
  cultural_fit?: number;
  code_quality_score?: number;

  // Detailed feedback
  strengths?: string;
  areas_for_improvement?: string;
  notes?: string;

  // Decision
  recommended_for_hire?: boolean;
  next_steps?: string;

  // Structured assessment
  skills_assessment: Record<string, number>;
  questions_answered: QuestionPerformance[];

  created_at: string;
  updated_at: string;
}

export interface QuestionPerformance {
  question_id: string;
  question_title: string;
  completed: boolean;
  time_spent_seconds: number;
  solution_quality: 'poor' | 'fair' | 'good' | 'excellent';
  test_cases_passed: number;
  total_test_cases: number;
}

export interface EvaluationFormData {
  overall_rating: number;
  technical_skills?: number;
  communication?: number;
  problem_solving?: number;
  cultural_fit?: number;
  code_quality_score?: number;
  strengths?: string;
  areas_for_improvement?: string;
  notes?: string;
  recommended_for_hire?: boolean;
  next_steps?: string;
  skills_assessment?: Record<string, number>;
}

// ==========================================
// Interview Notes Types
// ==========================================

export type NoteType =
  | 'general'
  | 'technical'
  | 'behavioral'
  | 'question'
  | 'observation'
  | 'concern';

export interface InterviewNote {
  id: string;
  interview_id: string;
  author_user_id: string;

  // Note content
  content: string;
  note_type?: NoteType;

  // Categorization
  tags?: string[];
  timestamp_in_interview?: number; // seconds from start

  // Metadata
  is_private: boolean;
  is_flagged: boolean;

  created_at: string;
  updated_at: string;
}

// ==========================================
// Recording Types
// ==========================================

export type RecordingStatus = 'processing' | 'available' | 'failed' | 'deleted';
export type TranscriptionStatus = 'pending' | 'processing' | 'completed' | 'failed';

export interface InterviewRecording {
  id: string;
  interview_id: string;

  // Recording details
  recording_sid: string;
  recording_url: string;
  duration_seconds?: number;
  file_size_bytes?: number;

  // Media info
  format: string;
  resolution?: string;

  // Processing
  status: RecordingStatus;
  transcription_status?: TranscriptionStatus;
  transcription_text?: string;

  // Access control
  is_public: boolean;
  expires_at?: string;

  // Compliance
  consent_obtained: boolean;
  gdpr_compliant: boolean;
  retention_policy?: string;

  created_at: string;
  updated_at: string;
}

// ==========================================
// Interview Questions Types
// ==========================================

export type QuestionType = 'coding' | 'system_design' | 'behavioral' | 'theoretical';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'expert';

export interface InterviewQuestion {
  id: string;

  // Question content
  title: string;
  description: string;
  question_type: QuestionType;

  // Difficulty and categorization
  difficulty: QuestionDifficulty;
  skills: string[];
  topics?: string[];

  // For coding questions
  starter_code?: Record<ProgrammingLanguage, string>;
  test_cases?: TestCase[];
  solution_code?: Record<ProgrammingLanguage, string>;
  hints?: string[];

  // Expected time and complexity
  estimated_time_minutes?: number;
  time_complexity?: string;
  space_complexity?: string;

  // Usage tracking
  times_used: number;
  average_success_rate?: number;

  // Metadata
  created_by_user_id?: string;
  is_public: boolean;
  tags?: string[];

  created_at: string;
  updated_at: string;
}

export interface TestCase {
  input: any;
  output: any;
  explanation?: string;
}

export interface InterviewQuestionUsage {
  id: string;
  interview_id: string;
  question_id: string;

  // Performance
  time_spent_seconds?: number;
  completed: boolean;
  solution_quality?: 'poor' | 'fair' | 'good' | 'excellent';

  // Code submitted
  submitted_code?: string;
  test_cases_passed?: number;
  total_test_cases?: number;

  notes?: string;

  created_at: string;
}

// ==========================================
// Interview Template Types
// ==========================================

export interface InterviewTemplate {
  id: string;

  name: string;
  description?: string;
  interview_type: InterviewType;

  // Template content
  duration_minutes: number;
  agenda?: AgendaItem[];
  question_ids?: string[];

  // Configuration
  requires_code_editor: boolean;
  requires_screen_share: boolean;
  recording_required: boolean;

  // Evaluation criteria
  evaluation_criteria?: Record<string, any>;

  // Usage
  created_by_user_id?: string;
  is_public: boolean;
  times_used: number;

  created_at: string;
  updated_at: string;
}

// ==========================================
// API Request/Response Types
// ==========================================

export interface ScheduleInterviewRequest {
  client_user_id: string;
  developer_user_id: string;
  project_id?: string;
  scheduled_at: string;
  duration_minutes: number;
  timezone: string;
  interview_type: InterviewType;
  title: string;
  description?: string;
  agenda?: AgendaItem[];
  template_id?: string;
  recording_enabled?: boolean;
}

export interface JoinInterviewRequest {
  interview_id: string;
  user_id: string;
  role: ParticipantRole;
}

export interface JoinInterviewResponse {
  interview: Interview;
  video_token: string;
  room_name: string;
  participants: InterviewParticipant[];
  code_session?: CodeEditorSession;
}

export interface UpdateInterviewStatusRequest {
  interview_id: string;
  status: InterviewStatus;
  started_at?: string;
  ended_at?: string;
}

export interface SubmitEvaluationRequest {
  interview_id: string;
  evaluator_user_id: string;
  evaluation_data: EvaluationFormData;
}

export interface GetInterviewsRequest {
  user_id: string;
  status?: InterviewStatus[];
  interview_type?: InterviewType[];
  start_date?: string;
  end_date?: string;
  limit?: number;
  offset?: number;
}

export interface GetInterviewsResponse {
  interviews: Interview[];
  total_count: number;
  has_more: boolean;
}

export interface InterviewStatistics {
  total_interviews: number;
  completed: number;
  cancelled: number;
  no_show: number;
  avg_duration_minutes: number;
  avg_rating: number;
}

// ==========================================
// WebSocket Message Types
// ==========================================

export type WebSocketMessageType =
  | 'code_edit'
  | 'cursor_move'
  | 'participant_join'
  | 'participant_leave'
  | 'language_change'
  | 'code_execute'
  | 'execution_result'
  | 'sync_request'
  | 'sync_response';

export interface WebSocketMessage {
  type: WebSocketMessageType;
  payload: any;
  sender_id: string;
  timestamp: string;
}

export interface CodeEditMessage extends WebSocketMessage {
  type: 'code_edit';
  payload: CodeEdit;
}

export interface CursorMoveMessage extends WebSocketMessage {
  type: 'cursor_move';
  payload: {
    cursor: CollaborativeCursor;
  };
}

export interface ParticipantJoinMessage extends WebSocketMessage {
  type: 'participant_join';
  payload: {
    user_id: string;
    user_name: string;
    color: string;
  };
}

export interface ParticipantLeaveMessage extends WebSocketMessage {
  type: 'participant_leave';
  payload: {
    user_id: string;
  };
}

export interface LanguageChangeMessage extends WebSocketMessage {
  type: 'language_change';
  payload: {
    language: ProgrammingLanguage;
  };
}

export interface CodeExecuteMessage extends WebSocketMessage {
  type: 'code_execute';
  payload: {
    code: string;
    language: ProgrammingLanguage;
  };
}

export interface ExecutionResultMessage extends WebSocketMessage {
  type: 'execution_result';
  payload: CodeExecutionResult;
}

export interface SyncRequestMessage extends WebSocketMessage {
  type: 'sync_request';
  payload: Record<string, never>;
}

export interface SyncResponseMessage extends WebSocketMessage {
  type: 'sync_response';
  payload: {
    code: string;
    language: ProgrammingLanguage;
    cursors: CollaborativeCursor[];
  };
}

// ==========================================
// UI Component Props Types
// ==========================================

export interface InterviewRoomProps {
  interviewId: string;
  currentUserId: string;
  onLeave?: () => void;
}

export interface ScheduleInterviewProps {
  developerId?: string;
  projectId?: string;
  onScheduled?: (interview: Interview) => void;
  onCancel?: () => void;
}

export interface InterviewEvaluationProps {
  interviewId: string;
  evaluatorUserId: string;
  onSubmit?: (evaluation: InterviewEvaluation) => void;
  onCancel?: () => void;
}

export interface InterviewHistoryProps {
  userId: string;
  role?: 'client' | 'developer' | 'all';
  limit?: number;
}

export interface VideoPlayerProps {
  room?: any; // Twilio Room
  localParticipant?: LocalParticipant;
  remoteParticipants?: Map<string, RemoteParticipant>;
  layout?: 'grid' | 'sidebar' | 'spotlight';
  onToggleAudio?: () => void;
  onToggleVideo?: () => void;
  onToggleScreenShare?: () => void;
  onLeave?: () => void;
}

export interface CodeEditorProps {
  sessionId: string;
  interviewId: string;
  currentUserId: string;
  readOnly?: boolean;
  onCodeChange?: (code: string) => void;
  onExecute?: (result: CodeExecutionResult) => void;
}

export interface ParticipantListProps {
  participants: (InterviewParticipant & { user?: any })[];
  currentUserId: string;
}

export interface EvaluationFormProps {
  initialValues?: Partial<EvaluationFormData>;
  onSubmit: (data: EvaluationFormData) => void;
  onCancel: () => void;
}

// ==========================================
// Error Types
// ==========================================

export interface InterviewError {
  code: string;
  message: string;
  details?: any;
}

export class InterviewValidationError extends Error {
  code: string;

  constructor(message: string, code: string = 'VALIDATION_ERROR') {
    super(message);
    this.name = 'InterviewValidationError';
    this.code = code;
  }
}

export class InterviewNotFoundError extends Error {
  code: string;

  constructor(interviewId: string) {
    super(`Interview not found: ${interviewId}`);
    this.name = 'InterviewNotFoundError';
    this.code = 'INTERVIEW_NOT_FOUND';
  }
}

export class VideoConnectionError extends Error {
  code: string;

  constructor(message: string, code: string = 'VIDEO_CONNECTION_ERROR') {
    super(message);
    this.name = 'VideoConnectionError';
    this.code = code;
  }
}

export class CodeExecutionError extends Error {
  code: string;

  constructor(message: string, code: string = 'CODE_EXECUTION_ERROR') {
    super(message);
    this.name = 'CodeExecutionError';
    this.code = code;
  }
}

// ==========================================
// Utility Types
// ==========================================

export type DeepPartial<T> = {
  [P in keyof T]?: T[P] extends object ? DeepPartial<T[P]> : T[P];
};

export type RequireAtLeastOne<T, Keys extends keyof T = keyof T> = Pick<T, Exclude<keyof T, Keys>> &
  {
    [K in Keys]-?: Required<Pick<T, K>> & Partial<Pick<T, Exclude<Keys, K>>>;
  }[Keys];

export type Timestamp = string; // ISO 8601 format
