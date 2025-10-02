/**
 * Interview Service Layer
 *
 * Core business logic for interview management including:
 * - Scheduling and cancellation
 * - Joining and leaving interviews
 * - Evaluations and feedback
 * - Interview history and statistics
 */

import { supabaseClient } from '../../../config/supabase/client';
import {
  Interview,
  InterviewParticipant,
  InterviewEvaluation,
  InterviewNote,
  InterviewQuestion,
  InterviewTemplate,
  ScheduleInterviewRequest,
  JoinInterviewRequest,
  JoinInterviewResponse,
  UpdateInterviewStatusRequest,
  SubmitEvaluationRequest,
  GetInterviewsRequest,
  GetInterviewsResponse,
  InterviewStatistics,
  CodeEditorSession,
} from '../types';

// Helper to ensure supabase client is initialized
const getSupabase = () => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Check your environment variables.');
  }
  return supabaseClient;
};

export class InterviewService {
  /**
   * Schedule a new interview
   */
  static async scheduleInterview(request: ScheduleInterviewRequest): Promise<Interview> {
    try {
      // Check for scheduling conflicts
      const hasConflict = await this.checkSchedulingConflict(
        request.client_user_id,
        request.scheduled_at,
        request.duration_minutes,
      );

      if (hasConflict) {
        throw new Error('Scheduling conflict detected. Please choose a different time.');
      }

      // Create interview record
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('interviews')
        .insert({
          client_user_id: request.client_user_id,
          developer_user_id: request.developer_user_id,
          project_id: request.project_id,
          scheduled_at: request.scheduled_at,
          duration_minutes: request.duration_minutes,
          timezone: request.timezone,
          interview_type: request.interview_type,
          title: request.title,
          description: request.description,
          agenda: request.agenda || [],
          recording_enabled: request.recording_enabled ?? true,
          status: 'scheduled',
        })
        .select()
        .single();

      if (error) throw error;

      return data as Interview;
    } catch (error) {
      console.error('Failed to schedule interview:', error);
      throw error;
    }
  }

  /**
   * Join an interview (get tokens and session info)
   */
  static async joinInterview(request: JoinInterviewRequest): Promise<JoinInterviewResponse> {
    try {
      const supabase = getSupabase();

      // Get interview details
      const { data: interview, error: interviewError } = await supabase
        .from('interviews')
        .select('*')
        .eq('id', request.interview_id)
        .single();

      if (interviewError) throw interviewError;
      if (!interview) throw new Error('Interview not found');

      // Check if user is authorized to join
      const isAuthorized =
        interview.client_user_id === request.user_id ||
        interview.developer_user_id === request.user_id;

      if (!isAuthorized) {
        // Check if user is an additional participant
        const { data: participant } = await supabase
          .from('interview_participants')
          .select('*')
          .eq('interview_id', request.interview_id)
          .eq('user_id', request.user_id)
          .single();

        if (!participant) {
          throw new Error('User not authorized to join this interview');
        }
      }

      // Generate Twilio room tokens
      const tokens = await this.generateRoomTokens(request.interview_id);

      // Get or create code editor session
      let codeSession: CodeEditorSession | undefined;
      const { data: existingSession } = await supabase
        .from('code_editor_sessions')
        .select('*')
        .eq('interview_id', request.interview_id)
        .single();

      if (existingSession) {
        codeSession = existingSession as CodeEditorSession;
      } else {
        // Create new code session
        const { data: newSession } = await supabase
          .from('code_editor_sessions')
          .insert({
            interview_id: request.interview_id,
            language: 'javascript',
            theme: 'vs-light',
            initial_code: '',
          })
          .select()
          .single();

        if (newSession) {
          codeSession = newSession as CodeEditorSession;
        }
      }

      // Get all participants
      const { data: participants } = await supabase
        .from('interview_participants')
        .select('*')
        .eq('interview_id', request.interview_id);

      return {
        interview: interview as Interview,
        video_token: tokens.token,
        room_name: tokens.room_name,
        participants: (participants || []) as InterviewParticipant[],
        code_session: codeSession,
      };
    } catch (error) {
      console.error('Failed to join interview:', error);
      throw error;
    }
  }

  /**
   * Update interview status
   */
  static async updateInterviewStatus(request: UpdateInterviewStatusRequest): Promise<Interview> {
    try {
      const supabase = getSupabase();
      const updateData: any = {
        status: request.status,
        updated_at: new Date().toISOString(),
      };

      if (request.status === 'in_progress' && request.started_at) {
        updateData.started_at = request.started_at;
      }

      if (request.status === 'completed' && request.ended_at) {
        updateData.ended_at = request.ended_at;

        // Calculate actual duration
        const { data: interview } = await supabase
          .from('interviews')
          .select('started_at')
          .eq('id', request.interview_id)
          .single();

        if (interview?.started_at) {
          const start = new Date(interview.started_at);
          const end = new Date(request.ended_at);
          updateData.actual_duration_minutes = Math.round(
            (end.getTime() - start.getTime()) / 60000,
          );
        }
      }

      const { data, error } = await supabase
        .from('interviews')
        .update(updateData)
        .eq('id', request.interview_id)
        .select()
        .single();

      if (error) throw error;

      return data as Interview;
    } catch (error) {
      console.error('Failed to update interview status:', error);
      throw error;
    }
  }

  /**
   * Cancel an interview
   */
  static async cancelInterview(interviewId: string, userId: string): Promise<void> {
    try {
      const supabase = getSupabase();

      // Verify user owns the interview
      const { data: interview } = await supabase
        .from('interviews')
        .select('client_user_id, developer_user_id')
        .eq('id', interviewId)
        .single();

      if (!interview) {
        throw new Error('Interview not found');
      }

      if (interview.client_user_id !== userId && interview.developer_user_id !== userId) {
        throw new Error('Not authorized to cancel this interview');
      }

      const { error } = await supabase
        .from('interviews')
        .update({ status: 'cancelled', updated_at: new Date().toISOString() })
        .eq('id', interviewId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to cancel interview:', error);
      throw error;
    }
  }

  /**
   * Submit interview evaluation
   */
  static async submitEvaluation(request: SubmitEvaluationRequest): Promise<InterviewEvaluation> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('interview_evaluations')
        .insert({
          interview_id: request.interview_id,
          evaluator_user_id: request.evaluator_user_id,
          overall_rating: request.evaluation_data.overall_rating,
          technical_skills: request.evaluation_data.technical_skills,
          communication: request.evaluation_data.communication,
          problem_solving: request.evaluation_data.problem_solving,
          cultural_fit: request.evaluation_data.cultural_fit,
          code_quality_score: request.evaluation_data.code_quality_score,
          strengths: request.evaluation_data.strengths,
          areas_for_improvement: request.evaluation_data.areas_for_improvement,
          notes: request.evaluation_data.notes,
          recommended_for_hire: request.evaluation_data.recommended_for_hire,
          next_steps: request.evaluation_data.next_steps,
          skills_assessment: request.evaluation_data.skills_assessment || {},
          questions_answered: [],
        })
        .select()
        .single();

      if (error) throw error;

      return data as InterviewEvaluation;
    } catch (error) {
      console.error('Failed to submit evaluation:', error);
      throw error;
    }
  }

  /**
   * Get interviews for a user
   */
  static async getInterviews(request: GetInterviewsRequest): Promise<GetInterviewsResponse> {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from('interviews')
        .select('*, interview_evaluations(overall_rating)', { count: 'exact' });

      // Filter by user
      query = query.or(
        `client_user_id.eq.${request.user_id},developer_user_id.eq.${request.user_id}`,
      );

      // Filter by status
      if (request.status && request.status.length > 0) {
        query = query.in('status', request.status);
      }

      // Filter by interview type
      if (request.interview_type && request.interview_type.length > 0) {
        query = query.in('interview_type', request.interview_type);
      }

      // Filter by date range
      if (request.start_date) {
        query = query.gte('scheduled_at', request.start_date);
      }
      if (request.end_date) {
        query = query.lte('scheduled_at', request.end_date);
      }

      // Pagination
      const limit = request.limit || 20;
      const offset = request.offset || 0;
      query = query.range(offset, offset + limit - 1);

      // Order by scheduled date
      query = query.order('scheduled_at', { ascending: false });

      const { data, error, count } = await query;

      if (error) throw error;

      return {
        interviews: (data || []) as Interview[],
        total_count: count || 0,
        has_more: (count || 0) > offset + limit,
      };
    } catch (error) {
      console.error('Failed to get interviews:', error);
      throw error;
    }
  }

  /**
   * Get interview statistics for a user
   */
  static async getInterviewStatistics(
    userId: string,
    role: 'client' | 'developer' | 'all' = 'all',
  ): Promise<InterviewStatistics> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('get_interview_statistics', {
        p_user_id: userId,
        p_role: role,
      });

      if (error) throw error;

      return data as InterviewStatistics;
    } catch (error) {
      console.error('Failed to get interview statistics:', error);
      throw error;
    }
  }

  /**
   * Get upcoming interviews for a user
   */
  static async getUpcomingInterviews(userId: string, limit: number = 10): Promise<any[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('get_upcoming_interviews', {
        p_user_id: userId,
        p_limit: limit,
      });

      if (error) throw error;

      return data || [];
    } catch (error) {
      console.error('Failed to get upcoming interviews:', error);
      throw error;
    }
  }

  /**
   * Add a note to an interview
   */
  static async addNote(
    interviewId: string,
    userId: string,
    content: string,
    noteType?: string,
    isPrivate: boolean = false,
  ): Promise<InterviewNote> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('interview_notes')
        .insert({
          interview_id: interviewId,
          author_user_id: userId,
          content,
          note_type: noteType,
          is_private: isPrivate,
          is_flagged: false,
        })
        .select()
        .single();

      if (error) throw error;

      return data as InterviewNote;
    } catch (error) {
      console.error('Failed to add note:', error);
      throw error;
    }
  }

  /**
   * Get notes for an interview
   */
  static async getNotes(interviewId: string, userId: string): Promise<InterviewNote[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('interview_notes')
        .select('*')
        .eq('interview_id', interviewId)
        .or(`is_private.eq.false,author_user_id.eq.${userId}`)
        .order('created_at', { ascending: true });

      if (error) throw error;

      return (data || []) as InterviewNote[];
    } catch (error) {
      console.error('Failed to get notes:', error);
      throw error;
    }
  }

  /**
   * Get interview questions
   */
  static async getQuestions(filters?: {
    difficulty?: string[];
    question_type?: string[];
    skills?: string[];
    is_public?: boolean;
  }): Promise<InterviewQuestion[]> {
    try {
      const supabase = getSupabase();
      let query = supabase.from('interview_questions').select('*');

      if (filters?.difficulty && filters.difficulty.length > 0) {
        query = query.in('difficulty', filters.difficulty);
      }

      if (filters?.question_type && filters.question_type.length > 0) {
        query = query.in('question_type', filters.question_type);
      }

      if (filters?.is_public !== undefined) {
        query = query.eq('is_public', filters.is_public);
      }

      if (filters?.skills && filters.skills.length > 0) {
        query = query.contains('skills', filters.skills);
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as InterviewQuestion[];
    } catch (error) {
      console.error('Failed to get questions:', error);
      throw error;
    }
  }

  /**
   * Get interview templates
   */
  static async getTemplates(isPublicOnly: boolean = true): Promise<InterviewTemplate[]> {
    try {
      const supabase = getSupabase();
      let query = supabase.from('interview_templates').select('*');

      if (isPublicOnly) {
        query = query.eq('is_public', true);
      }

      query = query.order('times_used', { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      return (data || []) as InterviewTemplate[];
    } catch (error) {
      console.error('Failed to get templates:', error);
      throw error;
    }
  }

  /**
   * Check for scheduling conflicts
   */
  private static async checkSchedulingConflict(
    userId: string,
    scheduledAt: string,
    durationMinutes: number,
  ): Promise<boolean> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('check_interview_conflicts', {
        p_user_id: userId,
        p_scheduled_at: scheduledAt,
        p_duration_minutes: durationMinutes,
      });

      if (error) throw error;

      return data as boolean;
    } catch (error) {
      console.error('Failed to check scheduling conflict:', error);
      return false;
    }
  }

  /**
   * Generate Twilio room tokens (server-side implementation)
   */
  private static async generateRoomTokens(
    interviewId: string,
  ): Promise<{ token: string; room_name: string }> {
    try {
      const supabase = getSupabase();
      // This should call a Supabase Edge Function to generate Twilio tokens securely
      const { data, error } = await supabase.rpc('generate_interview_room_tokens', {
        p_interview_id: interviewId,
      });

      if (error) throw error;

      return {
        token: data.client_token || data.developer_token,
        room_name: data.room_name,
      };
    } catch (error) {
      console.error('Failed to generate room tokens:', error);
      // Return mock token for development
      return {
        token: 'MOCK_TOKEN_' + Math.random().toString(36).substring(7),
        room_name: `interview-${interviewId}`,
      };
    }
  }
}

export default InterviewService;
