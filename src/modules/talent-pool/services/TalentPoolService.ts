/**
 * Talent Pool Service
 *
 * Business logic for managing client-developer relationships through talent pools
 */

import { supabaseClient } from '../../../config/supabase/client';
import type {
  TalentPool,
  TalentPoolMember,
  TalentPoolMemberWithProfile,
  TalentPoolActivity,
  DeveloperContactHistory,
  AvailabilityNotificationSummary,
  TalentPoolStatistics,
  TalentPoolSearchResult,
  CreateTalentPoolRequest,
  UpdateTalentPoolRequest,
  AddDeveloperToPoolRequest,
  UpdatePoolMemberRequest,
  SearchTalentPoolParams,
  LogContactRequest,
  InviteDevelopersToProjectRequest,
  BulkMessageRequest,
  ExportTalentPoolRequest,
  ExportTalentPoolResponse,
  ActivityType,
} from '../types';
import { DeveloperAlreadyInPoolError, TalentPoolNotFoundError } from '../types';

// Helper to ensure supabase client is initialized
const getSupabase = () => {
  if (!supabaseClient) {
    throw new Error('Supabase client not initialized. Check your environment variables.');
  }
  return supabaseClient;
};

export class TalentPoolService {
  /**
   * Create a new talent pool
   */
  static async createTalentPool(
    clientId: string,
    poolData: CreateTalentPoolRequest,
  ): Promise<TalentPool> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('talent_pools')
        .insert({
          client_user_id: clientId,
          name: poolData.name,
          description: poolData.description,
          tags: poolData.tags || [],
          color: poolData.color || '#4F46E5',
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity(clientId, {
        talent_pool_id: data.id,
        activity_type: 'pool_created',
        activity_data: { pool_name: poolData.name },
      });

      return data as TalentPool;
    } catch (error) {
      console.error('Failed to create talent pool:', error);
      throw error;
    }
  }

  /**
   * Get all talent pools for a client
   */
  static async getTalentPools(clientId: string, includeArchived = false): Promise<TalentPool[]> {
    try {
      const supabase = getSupabase();
      let query = supabase
        .from('talent_pools')
        .select('*')
        .eq('client_user_id', clientId)
        .order('created_at', { ascending: false });

      if (!includeArchived) {
        query = query.eq('is_archived', false);
      }

      const { data, error } = await query;

      if (error) throw error;

      return data as TalentPool[];
    } catch (error) {
      console.error('Failed to get talent pools:', error);
      throw error;
    }
  }

  /**
   * Get a single talent pool by ID
   */
  static async getTalentPool(poolId: string, clientId: string): Promise<TalentPool> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('talent_pools')
        .select('*')
        .eq('id', poolId)
        .eq('client_user_id', clientId)
        .single();

      if (error) throw error;
      if (!data) throw new TalentPoolNotFoundError(poolId);

      return data as TalentPool;
    } catch (error) {
      console.error('Failed to get talent pool:', error);
      throw error;
    }
  }

  /**
   * Update a talent pool
   */
  static async updateTalentPool(
    poolId: string,
    clientId: string,
    updates: UpdateTalentPoolRequest,
  ): Promise<TalentPool> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('talent_pools')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', poolId)
        .eq('client_user_id', clientId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity(clientId, {
        talent_pool_id: poolId,
        activity_type: 'pool_updated',
        activity_data: updates,
      });

      return data as TalentPool;
    } catch (error) {
      console.error('Failed to update talent pool:', error);
      throw error;
    }
  }

  /**
   * Delete a talent pool
   */
  static async deleteTalentPool(poolId: string, clientId: string): Promise<void> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('talent_pools')
        .delete()
        .eq('id', poolId)
        .eq('client_user_id', clientId);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to delete talent pool:', error);
      throw error;
    }
  }

  /**
   * Add a developer to a talent pool
   */
  static async addDeveloperToPool(
    clientId: string,
    request: AddDeveloperToPoolRequest,
  ): Promise<TalentPoolMember> {
    try {
      // Check if developer is already in pool
      const existing = await this.checkExistingMember(
        request.talent_pool_id,
        request.developer_user_id,
      );

      if (existing) {
        const pool = await this.getTalentPool(request.talent_pool_id, clientId);
        throw new DeveloperAlreadyInPoolError(pool.name);
      }

      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('talent_pool_members')
        .insert({
          talent_pool_id: request.talent_pool_id,
          developer_user_id: request.developer_user_id,
          added_by_user_id: clientId,
          custom_notes: request.custom_notes || '',
          custom_tags: request.custom_tags || [],
          relationship_status: request.relationship_status || 'never_worked',
          performance_rating: request.performance_rating,
          availability_notifications: request.availability_notifications || false,
          is_favorite: request.is_favorite || false,
        })
        .select()
        .single();

      if (error) throw error;

      // Log activity
      await this.logActivity(clientId, {
        talent_pool_id: request.talent_pool_id,
        member_id: data.id,
        developer_user_id: request.developer_user_id,
        activity_type: 'member_added',
        activity_data: { developer_id: request.developer_user_id },
      });

      return data as TalentPoolMember;
    } catch (error) {
      console.error('Failed to add developer to pool:', error);
      throw error;
    }
  }

  /**
   * Check if developer exists in pool
   */
  private static async checkExistingMember(poolId: string, developerId: string): Promise<boolean> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('talent_pool_members')
        .select('id')
        .eq('talent_pool_id', poolId)
        .eq('developer_user_id', developerId)
        .maybeSingle();

      if (error) throw error;
      return !!data;
    } catch (error) {
      console.error('Failed to check existing member:', error);
      return false;
    }
  }

  /**
   * Get members of a talent pool
   */
  static async getPoolMembers(
    poolId: string,
    clientId: string,
  ): Promise<TalentPoolMemberWithProfile[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('talent_pool_members')
        .select(
          `
          *,
          talent_pools!inner(client_user_id, name),
          developer_profiles!inner(
            user_id,
            headline,
            hourly_rate,
            availability_status,
            skills,
            rating_average,
            completed_projects_count
          )
        `,
        )
        .eq('talent_pool_id', poolId)
        .eq('talent_pools.client_user_id', clientId)
        .order('added_at', { ascending: false });

      if (error) throw error;

      return data as any as TalentPoolMemberWithProfile[];
    } catch (error) {
      console.error('Failed to get pool members:', error);
      throw error;
    }
  }

  /**
   * Update a talent pool member
   */
  static async updatePoolMember(
    memberId: string,
    clientId: string,
    updates: UpdatePoolMemberRequest,
  ): Promise<TalentPoolMember> {
    try {
      const supabase = getSupabase();

      // First verify the member belongs to a pool owned by this client
      const { data: member, error: fetchError } = await supabase
        .from('talent_pool_members')
        .select('*, talent_pools!inner(client_user_id)')
        .eq('id', memberId)
        .eq('talent_pools.client_user_id', clientId)
        .single();

      if (fetchError) throw fetchError;
      if (!member) throw new Error('Talent pool member not found or access denied');

      // Now perform the update
      const { data, error } = await supabase
        .from('talent_pool_members')
        .update({
          ...updates,
          updated_at: new Date().toISOString(),
        })
        .eq('id', memberId)
        .select()
        .single();

      if (error) throw error;

      // Log activity
      const activityType: ActivityType = updates.custom_notes
        ? 'note_updated'
        : updates.custom_tags
          ? 'tags_updated'
          : updates.performance_rating
            ? 'rating_updated'
            : 'note_updated';

      await this.logActivity(clientId, {
        member_id: memberId,
        activity_type: activityType,
        activity_data: updates,
      });

      return data as TalentPoolMember;
    } catch (error) {
      console.error('Failed to update pool member:', error);
      throw error;
    }
  }

  /**
   * Remove a developer from a talent pool
   */
  static async removeDeveloperFromPool(memberId: string, clientId: string): Promise<void> {
    try {
      const supabase = getSupabase();

      // Get member details for logging
      const { data: member } = await supabase
        .from('talent_pool_members')
        .select('talent_pool_id, developer_user_id')
        .eq('id', memberId)
        .single();

      const { error } = await supabase
        .from('talent_pool_members')
        .delete()
        .eq('id', memberId)
        .eq('talent_pools.client_user_id', clientId);

      if (error) throw error;

      // Log activity
      if (member) {
        await this.logActivity(clientId, {
          talent_pool_id: member.talent_pool_id,
          developer_user_id: member.developer_user_id,
          activity_type: 'member_removed',
          activity_data: { member_id: memberId },
        });
      }
    } catch (error) {
      console.error('Failed to remove developer from pool:', error);
      throw error;
    }
  }

  /**
   * Advanced search across talent pools
   */
  static async searchTalentPool(
    clientId: string,
    params: SearchTalentPoolParams,
  ): Promise<TalentPoolSearchResult[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('search_talent_pool_members', {
        p_client_user_id: clientId,
        p_pool_ids: params.pool_ids || null,
        p_skills: params.skills || null,
        p_availability: params.availability || null,
        p_min_rate: params.min_rate || null,
        p_max_rate: params.max_rate || null,
        p_tags: params.tags || null,
        p_relationship_status: params.relationship_status || null,
        p_last_contact_days: params.last_contact_days || null,
        p_min_rating: params.min_rating || null,
        p_is_favorite: params.is_favorite ?? null,
        p_search_query: params.search_query || null,
        p_limit: params.limit || 50,
        p_offset: params.offset || 0,
      });

      if (error) throw error;

      return data as TalentPoolSearchResult[];
    } catch (error) {
      console.error('Failed to search talent pool:', error);
      throw error;
    }
  }

  /**
   * Get talent pool statistics
   */
  static async getStatistics(clientId: string): Promise<TalentPoolStatistics> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase.rpc('get_talent_pool_statistics', {
        p_client_user_id: clientId,
      });

      if (error) throw error;

      return data[0] as TalentPoolStatistics;
    } catch (error) {
      console.error('Failed to get statistics:', error);
      throw error;
    }
  }

  /**
   * Log contact with a developer
   */
  static async logContact(
    clientId: string,
    contact: LogContactRequest,
  ): Promise<DeveloperContactHistory> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('developer_contact_history')
        .insert({
          client_user_id: clientId,
          developer_user_id: contact.developer_user_id,
          contact_type: contact.contact_type,
          contact_subject: contact.contact_subject,
          contact_notes: contact.contact_notes,
          related_project_id: contact.related_project_id,
          contact_date: contact.contact_date || new Date().toISOString(),
          follow_up_date: contact.follow_up_date,
        })
        .select()
        .single();

      if (error) throw error;

      // Update last contact date in all pools containing this developer
      const { data: poolMembers } = await supabase
        .from('talent_pool_members')
        .select('id, talent_pool_id')
        .eq('developer_user_id', contact.developer_user_id);

      if (poolMembers && poolMembers.length > 0) {
        await supabase
          .from('talent_pool_members')
          .update({
            last_contact_date: data.contact_date,
            updated_at: new Date().toISOString(),
          })
          .in(
            'id',
            poolMembers.map((m) => m.id),
          );
      }

      // Log activity
      await this.logActivity(clientId, {
        developer_user_id: contact.developer_user_id,
        activity_type: 'contact_logged',
        activity_data: {
          contact_type: contact.contact_type,
          subject: contact.contact_subject,
        },
      });

      return data as DeveloperContactHistory;
    } catch (error) {
      console.error('Failed to log contact:', error);
      throw error;
    }
  }

  /**
   * Get contact history with a developer
   */
  static async getContactHistory(
    clientId: string,
    developerId: string,
  ): Promise<DeveloperContactHistory[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('developer_contact_history')
        .select('*')
        .eq('client_user_id', clientId)
        .eq('developer_user_id', developerId)
        .order('contact_date', { ascending: false });

      if (error) throw error;

      return data as DeveloperContactHistory[];
    } catch (error) {
      console.error('Failed to get contact history:', error);
      throw error;
    }
  }

  /**
   * Get availability notifications
   */
  static async getAvailabilityNotifications(
    clientId: string,
  ): Promise<AvailabilityNotificationSummary[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('availability_notifications')
        .select(
          `
          *,
          talent_pool_members!inner(
            custom_notes,
            cached_hourly_rate,
            talent_pools!inner(name)
          ),
          developer_profiles!inner(
            headline
          )
        `,
        )
        .eq('client_user_id', clientId)
        .eq('notification_sent', false)
        .order('status_changed_at', { ascending: false });

      if (error) throw error;

      // Group by developer
      const notificationMap = new Map<string, AvailabilityNotificationSummary>();

      data.forEach((notif: any) => {
        if (!notificationMap.has(notif.developer_user_id)) {
          notificationMap.set(notif.developer_user_id, {
            developer_id: notif.developer_user_id,
            developer_name: notif.developer_profiles.headline || 'Unknown',
            developer_headline: notif.developer_profiles.headline,
            pool_names: [notif.talent_pool_members.talent_pools.name],
            became_available: notif.status_changed_at,
            custom_notes: notif.talent_pool_members.custom_notes,
            hourly_rate: notif.talent_pool_members.cached_hourly_rate,
          });
        } else {
          const existing = notificationMap.get(notif.developer_user_id)!;
          existing.pool_names.push(notif.talent_pool_members.talent_pools.name);
        }
      });

      return Array.from(notificationMap.values());
    } catch (error) {
      console.error('Failed to get availability notifications:', error);
      throw error;
    }
  }

  /**
   * Mark availability notifications as sent
   */
  static async markNotificationsAsSent(notificationIds: string[]): Promise<void> {
    try {
      const supabase = getSupabase();
      const { error } = await supabase
        .from('availability_notifications')
        .update({
          notification_sent: true,
          notification_sent_at: new Date().toISOString(),
        })
        .in('id', notificationIds);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to mark notifications as sent:', error);
      throw error;
    }
  }

  /**
   * Invite developers to a project
   */
  static async inviteDevelopersToProject(
    clientId: string,
    request: InviteDevelopersToProjectRequest,
  ): Promise<void> {
    try {
      const supabase = getSupabase();

      // Create invitations
      const invitations = request.developer_ids.map((developerId) => ({
        project_id: request.project_id,
        client_user_id: clientId,
        developer_user_id: developerId,
        personal_message: request.personal_message,
        invitation_type: 'direct_invite',
        deadline: request.deadline,
      }));

      const { error } = await supabase.from('project_invitations').insert(invitations);

      if (error) throw error;

      // Log activity for each developer
      for (const developerId of request.developer_ids) {
        await this.logActivity(clientId, {
          developer_user_id: developerId,
          activity_type: 'invited_to_project',
          activity_data: { project_id: request.project_id },
        });
      }
    } catch (error) {
      console.error('Failed to invite developers to project:', error);
      throw error;
    }
  }

  /**
   * Send bulk messages to developers
   */
  static async sendBulkMessages(clientId: string, request: BulkMessageRequest): Promise<void> {
    try {
      const supabase = getSupabase();

      // Get developer user IDs from member IDs
      const { data: members, error: membersError } = await supabase
        .from('talent_pool_members')
        .select('developer_user_id')
        .in('id', request.member_ids);

      if (membersError) throw membersError;

      const developerIds = members.map((m) => m.developer_user_id);

      // Create messages
      const messages = developerIds.map((developerId) => ({
        sender_user_id: clientId,
        recipient_user_id: developerId,
        subject: request.subject,
        message: request.message,
        related_project_id: request.project_id,
      }));

      const { error } = await supabase.from('messages').insert(messages);

      if (error) throw error;
    } catch (error) {
      console.error('Failed to send bulk messages:', error);
      throw error;
    }
  }

  /**
   * Log activity
   */
  private static async logActivity(
    clientId: string,
    activity: {
      talent_pool_id?: string;
      member_id?: string;
      developer_user_id?: string;
      activity_type: ActivityType;
      activity_data: Record<string, any>;
    },
  ): Promise<void> {
    try {
      const supabase = getSupabase();
      await supabase.from('talent_pool_activity').insert({
        client_user_id: clientId,
        ...activity,
      });
    } catch (error) {
      console.error('Failed to log activity:', error);
      // Don't throw - activity logging is non-critical
    }
  }

  /**
   * Get recent activity
   */
  static async getRecentActivity(clientId: string, limit = 50): Promise<TalentPoolActivity[]> {
    try {
      const supabase = getSupabase();
      const { data, error } = await supabase
        .from('talent_pool_activity')
        .select('*')
        .eq('client_user_id', clientId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) throw error;

      return data as TalentPoolActivity[];
    } catch (error) {
      console.error('Failed to get recent activity:', error);
      throw error;
    }
  }

  /**
   * Export talent pool data
   */
  static async exportTalentPool(
    clientId: string,
    request: ExportTalentPoolRequest,
  ): Promise<ExportTalentPoolResponse> {
    try {
      const supabase = getSupabase();

      // Create bulk action record
      const { data: bulkAction, error } = await supabase
        .from('talent_pool_bulk_actions')
        .insert({
          client_user_id: clientId,
          action_type: 'export',
          target_pool_ids: request.pool_ids,
          action_data: {
            format: request.format,
            include_contact_history: request.include_contact_history,
            include_notes: request.include_notes,
          },
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;

      // In a real implementation, this would trigger a background job
      // For now, return a placeholder response
      return {
        export_id: bulkAction.id,
        download_url: `/api/exports/${bulkAction.id}`,
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };
    } catch (error) {
      console.error('Failed to export talent pool:', error);
      throw error;
    }
  }
}

export default TalentPoolService;
