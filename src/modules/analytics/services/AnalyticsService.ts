import { supabaseClient } from 'config/supabase/client';
import type {
  PlatformEvent,
  EmitEventPayload,
  EventQueryParams,
  EventQueryResult,
  RealTimeMetric,
  DashboardMetrics,
  EventAggregation,
  AggregationQueryParams,
  AggregationQueryResult,
  EventMetadata,
} from '../types';

/**
 * Analytics Service
 * Handles event emission, querying, and real-time metrics
 */
export class AnalyticsService {
  private sessionId: string | null = null;
  // Keep the type referenced to avoid unused-type ESLint warnings in CI
  // (no runtime impact)
  private _typeRef?: RealTimeMetric;

  /**
   * Initialize session tracking
   */
  async initSession(): Promise<void> {
    if (!supabaseClient) return;

    this.sessionId = `session_${Date.now()}_${Math.random().toString(36).substring(7)}`;

    // Emit session started event
    await this.emitEvent({
      event_type: 'session.started',
      event_category: 'user_activity',
      metadata: {
        session_id: this.sessionId,
        device_info: this.getDeviceInfo(),
      },
    });
  }

  /**
   * Emit a platform event
   * This is the primary method for tracking user actions
   */
  async emitEvent(payload: EmitEventPayload): Promise<string | null> {
    if (!supabaseClient) {
      console.warn('Supabase client not configured - event not emitted');
      return null;
    }

    try {
      const metadata: EventMetadata = {
        ...payload.metadata,
        session_id: this.sessionId || undefined,
        page_url: typeof window !== 'undefined' ? window.location.href : undefined,
        referrer: typeof window !== 'undefined' ? document.referrer : undefined,
        device_info: this.getDeviceInfo(),
      };

      const { data: user } = await supabaseClient.auth.getUser();

      const { data, error } = await supabaseClient.rpc('emit_platform_event', {
        p_event_type: payload.event_type,
        p_event_category: payload.event_category,
        p_user_id: user?.user?.id || null,
        p_entity_type: payload.entity_type || null,
        p_entity_id: payload.entity_id || null,
        p_event_data: payload.event_data || {},
        p_metadata: metadata,
      });

      if (error) {
        console.error('Failed to emit event:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('Error emitting event:', error);
      return null;
    }
  }

  /**
   * Track project creation
   */
  async trackProjectCreated(projectId: string, projectData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'project.created',
      event_category: 'transaction',
      entity_type: 'project',
      entity_id: projectId,
      event_data: {
        title: projectData.title,
        budget: projectData.budget,
        project_type: projectData.project_type,
        is_featured: projectData.is_featured || false,
        skills: projectData.skills || [],
      },
    });
  }

  /**
   * Track proposal submission
   */
  async trackProposalSubmitted(
    proposalId: string,
    projectId: string,
    bidAmount: number,
  ): Promise<void> {
    await this.emitEvent({
      event_type: 'proposal.submitted',
      event_category: 'transaction',
      entity_type: 'proposal',
      entity_id: proposalId,
      event_data: {
        project_id: projectId,
        bid_amount: bidAmount,
      },
    });
  }

  /**
   * Track milestone approval (financial event - 7 year retention)
   */
  async trackMilestoneApproved(
    milestoneId: string,
    projectId: string,
    amount: number,
  ): Promise<void> {
    await this.emitEvent({
      event_type: 'milestone.approved',
      event_category: 'transaction',
      entity_type: 'milestone',
      entity_id: milestoneId,
      event_data: {
        project_id: projectId,
        amount: amount,
      },
    });
  }

  /**
   * Track review posted
   */
  async trackReviewPosted(reviewId: string, reviewData: any): Promise<void> {
    await this.emitEvent({
      event_type: 'review.posted',
      event_category: 'content',
      entity_type: 'review',
      entity_id: reviewId,
      event_data: {
        reviewee_user_id: reviewData.reviewee_user_id,
        reviewee_type: reviewData.reviewee_type,
        rating_overall: reviewData.rating_overall,
      },
    });
  }

  /**
   * Track profile view (interaction event)
   */
  async trackProfileViewed(viewedUserId: string): Promise<void> {
    await this.emitEvent({
      event_type: 'profile.viewed',
      event_category: 'interaction',
      entity_type: 'profile',
      entity_id: viewedUserId,
      event_data: {
        viewed_user_id: viewedUserId,
      },
    });
  }

  /**
   * Track search performed (already implemented in marketplace)
   * This method standardizes the event structure
   */
  async trackSearchPerformed(
    query: string,
    filters: Record<string, any>,
    resultsCount: number,
    searchTimeMs: number,
  ): Promise<void> {
    await this.emitEvent({
      event_type: 'search.performed',
      event_category: 'interaction',
      event_data: {
        query,
        filters,
        results_count: resultsCount,
        search_time_ms: searchTimeMs,
      },
    });
  }

  /**
   * Track user login
   */
  async trackUserLogin(
    loginMethod: 'email' | 'github' | 'google',
    mfaUsed: boolean,
  ): Promise<void> {
    await this.emitEvent({
      event_type: 'user.login',
      event_category: 'user_activity',
      event_data: {
        login_method: loginMethod,
        session_id: this.sessionId,
        mfa_used: mfaUsed,
      },
    });
  }

  /**
   * Query events with filtering
   */
  async queryEvents(params: EventQueryParams): Promise<EventQueryResult> {
    if (!supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    const limit = params.limit || 50;
    const offset = params.offset || 0;

    let query = supabaseClient
      .from('platform_events')
      .select('*', { count: 'exact' })
      .order('timestamp', { ascending: false })
      .range(offset, offset + limit - 1);

    if (params.event_types?.length) {
      query = query.in('event_type', params.event_types);
    }

    if (params.event_categories?.length) {
      query = query.in('event_category', params.event_categories);
    }

    if (params.user_id) {
      query = query.eq('user_id', params.user_id);
    }

    if (params.entity_type) {
      query = query.eq('entity_type', params.entity_type);
    }

    if (params.start_date) {
      query = query.gte('timestamp', params.start_date);
    }

    if (params.end_date) {
      query = query.lte('timestamp', params.end_date);
    }

    const { data, error, count } = await query;

    if (error) {
      throw error;
    }

    return {
      events: (data || []) as PlatformEvent[],
      total: count || 0,
      page: Math.floor(offset / limit) + 1,
      limit,
      has_more: (count || 0) > offset + limit,
    };
  }

  /**
   * Get real-time dashboard metrics
   */
  async getDashboardMetrics(): Promise<DashboardMetrics> {
    if (!supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    const metrics: DashboardMetrics = {
      active_users_last_hour: 0,
      active_users_last_day: 0,
      projects_created_today: 0,
      proposals_submitted_today: 0,
      reviews_posted_today: 0,
      conversion_rate_last_7_days: 0,
      avg_response_time_hours: 0,
      total_revenue_today: 0,
    };

    try {
      // Fetch cached metrics from platform_metrics_realtime
      const { data: cachedMetrics } = await supabaseClient
        .from('platform_metrics_realtime')
        .select('metric_key, metric_value')
        .gt('expires_at', new Date().toISOString());

      if (cachedMetrics) {
        for (const metric of cachedMetrics) {
          if (metric.metric_key === 'active_users_last_hour') {
            metrics.active_users_last_hour = metric.metric_value.count || 0;
          }
          // Add more metric mappings as needed
        }
      }

      // Calculate today's metrics
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);

      const { count: projectsToday } = await supabaseClient
        .from('platform_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'project.created')
        .gte('timestamp', todayStart.toISOString());

      metrics.projects_created_today = projectsToday || 0;

      const { count: proposalsToday } = await supabaseClient
        .from('platform_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'proposal.submitted')
        .gte('timestamp', todayStart.toISOString());

      metrics.proposals_submitted_today = proposalsToday || 0;

      const { count: reviewsToday } = await supabaseClient
        .from('platform_events')
        .select('*', { count: 'exact', head: true })
        .eq('event_type', 'review.posted')
        .gte('timestamp', todayStart.toISOString());

      metrics.reviews_posted_today = reviewsToday || 0;

      return metrics;
    } catch (error) {
      console.error('Failed to fetch dashboard metrics:', error);
      return metrics;
    }
  }

  /**
   * Query aggregated events
   */
  async queryAggregations(params: AggregationQueryParams): Promise<AggregationQueryResult> {
    if (!supabaseClient) {
      throw new Error('Supabase client not configured');
    }

    let query = supabaseClient
      .from('event_aggregations')
      .select('*')
      .eq('aggregation_type', params.aggregation_type)
      .gte('time_bucket', params.start_date)
      .lte('time_bucket', params.end_date)
      .order('time_bucket', { ascending: false });

    if (params.event_category) {
      query = query.eq('event_category', params.event_category);
    }

    if (params.event_type) {
      query = query.eq('event_type', params.event_type);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    const aggregations = (data || []) as EventAggregation[];

    // Calculate totals
    const totalEvents = aggregations.reduce((sum, agg) => sum + (agg.metrics.count || 0), 0);
    const uniqueUsersSet = new Set<string>();
    aggregations.forEach((agg) => {
      if (agg.metrics.unique_users) {
        uniqueUsersSet.add(String(agg.metrics.unique_users));
      }
    });

    return {
      aggregations,
      total_events: totalEvents,
      unique_users: uniqueUsersSet.size,
      time_range: {
        start: params.start_date,
        end: params.end_date,
      },
    };
  }

  /**
   * Get device information from browser
   */
  private getDeviceInfo() {
    if (typeof window === 'undefined') {
      return undefined;
    }

    return {
      device_type: this.getDeviceType(),
      browser: this.getBrowserName(),
      os: this.getOperatingSystem(),
      screen_width: window.screen.width,
      screen_height: window.screen.height,
    };
  }

  private getDeviceType(): 'desktop' | 'mobile' | 'tablet' {
    const userAgent = navigator.userAgent.toLowerCase();
    if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(userAgent)) {
      return 'tablet';
    }
    if (/mobile|iphone|ipod|android|blackberry|mini|windows\sce|palm/i.test(userAgent)) {
      return 'mobile';
    }
    return 'desktop';
  }

  private getBrowserName(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Firefox')) return 'Firefox';
    if (userAgent.includes('Chrome')) return 'Chrome';
    if (userAgent.includes('Safari')) return 'Safari';
    if (userAgent.includes('Edge')) return 'Edge';
    if (userAgent.includes('Opera')) return 'Opera';
    return 'Unknown';
  }

  private getOperatingSystem(): string {
    const userAgent = navigator.userAgent;
    if (userAgent.includes('Win')) return 'Windows';
    if (userAgent.includes('Mac')) return 'MacOS';
    if (userAgent.includes('Linux')) return 'Linux';
    if (userAgent.includes('Android')) return 'Android';
    if (userAgent.includes('iOS')) return 'iOS';
    return 'Unknown';
  }
}

// Export singleton instance
export const analyticsService = new AnalyticsService();
