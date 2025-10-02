/**
 * Analytics Integration Examples
 * Demonstrates how to integrate analytics tracking into existing modules
 *
 * NOTE: This file contains example patterns only. Import the actual services
 * from their respective modules when implementing in your application.
 */

import { analyticsService } from 'modules/analytics';
// Example imports (uncomment when implementing):
// import { marketplaceService } from 'modules/marketplace';
// import { profileService } from 'modules/profiles';
// import { clientService } from 'modules/clients';
// import { authService } from 'modules/auth';

// ==================== Marketplace Integration ====================

/**
 * Example: Track project creation in marketplace
 */
export async function createProjectWithAnalytics(marketplaceService: any, projectData: any) {
  // Create project
  const project = await marketplaceService.createProject(projectData);

  // Track event (fire-and-forget)
  void analyticsService.trackProjectCreated(project.id, {
    title: projectData.title,
    budget: projectData.budget,
    project_type: projectData.project_type,
    is_featured: projectData.is_featured || false,
    skills: projectData.skills || [],
  });

  return project;
}

/**
 * Example: Replace existing search analytics
 */
export async function searchProjectsWithAnalytics(marketplaceService: any, params: any) {
  const startTime = Date.now();
  const results = await marketplaceService.searchProjects(params);
  const searchTime = Date.now() - startTime;

  // New unified event tracking
  void analyticsService.trackSearchPerformed(params.query || '', params, results.total, searchTime);

  return results;
}

// ==================== Profiles Integration ====================

/**
 * Example: Track profile views
 */
export async function viewProfileWithAnalytics(profileService: any, userId: string) {
  // Fetch profile
  const profile = await profileService.getProfile(userId);

  // Track view (fire-and-forget)
  void analyticsService.trackProfileViewed(userId);

  return profile;
}

/**
 * Example: Track GitHub sync
 */
export async function syncGitHubWithAnalytics(
  profileService: any,
  userId: string,
  githubUsername: string,
) {
  await profileService.syncGitHubData(userId, githubUsername);

  // Emit custom event
  void analyticsService.emitEvent({
    event_type: 'github.synced',
    event_category: 'content',
    entity_type: 'profile',
    entity_id: userId,
    event_data: {
      github_username: githubUsername,
    },
  });
}

// ==================== Clients Integration ====================

/**
 * Example: Track review submission
 */
export async function submitReviewWithAnalytics(
  clientService: any,
  userId: string,
  reviewData: any,
) {
  const review = await clientService.submitProjectReview(userId, reviewData);

  // Track review posted
  await analyticsService.trackReviewPosted(review.id, {
    reviewee_user_id: reviewData.reviewee_user_id,
    reviewee_type: reviewData.reviewee_type,
    rating_overall:
      (reviewData.rating_communication +
        reviewData.rating_professionalism +
        (reviewData.rating_project_clarity || 0) +
        (reviewData.rating_payment_timeliness || 0)) /
      4,
  });

  return review;
}

/**
 * Example: Track milestone approval (financial event)
 */
export async function approveMilestoneWithAnalytics(
  projectService: any,
  milestoneId: string,
  projectId: string,
  amount: number,
) {
  // Approve milestone
  await projectService.approveMilestone(milestoneId);

  // Track financial event (7-year retention)
  await analyticsService.trackMilestoneApproved(milestoneId, projectId, amount);
}

// ==================== Auth Integration ====================

/**
 * Example: Track user login
 */
export async function loginWithAnalytics(authService: any, email: string, password: string) {
  const result = await authService.signIn(email, password);

  if (result.session) {
    // Track successful login
    void analyticsService.trackUserLogin('email', result.needsMfa || false);
  }

  return result;
}

/**
 * Example: Track OAuth login
 */
export async function handleOAuthCallbackWithAnalytics(
  authService: any,
  provider: 'github' | 'google',
) {
  const session = await authService.getSession();

  if (session) {
    void analyticsService.trackUserLogin(provider, false);
  }
}

// ==================== Dashboard Metrics ====================

/**
 * Example: Fetch real-time metrics for admin dashboard
 */
export async function getDashboardMetrics() {
  const metrics = await analyticsService.getDashboardMetrics();

  return {
    activeUsers: {
      lastHour: metrics.active_users_last_hour,
      lastDay: metrics.active_users_last_day,
    },
    todayActivity: {
      projectsCreated: metrics.projects_created_today,
      proposalsSubmitted: metrics.proposals_submitted_today,
      reviewsPosted: metrics.reviews_posted_today,
    },
    performance: {
      conversionRate: metrics.conversion_rate_last_7_days,
      avgResponseTime: metrics.avg_response_time_hours,
      totalRevenue: metrics.total_revenue_today,
    },
  };
}

// ==================== Analytics Queries ====================

/**
 * Example: Query user activity history
 */
export async function getUserActivityHistory(userId: string, days: number = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);

  const result = await analyticsService.queryEvents({
    user_id: userId,
    start_date: startDate.toISOString(),
    end_date: new Date().toISOString(),
    limit: 100,
  });

  // Group by event type
  const activityByType = result.events.reduce(
    (acc, event) => {
      acc[event.event_type] = (acc[event.event_type] || 0) + 1;
      return acc;
    },
    {} as Record<string, number>,
  );

  return {
    totalEvents: result.total,
    events: result.events,
    activityByType,
  };
}

/**
 * Example: Get conversion funnel data
 */
export async function getConversionFunnel(startDate: string, endDate: string) {
  // Step 1: Users who viewed projects
  const projectViews = await analyticsService.queryEvents({
    event_types: ['project.viewed'],
    start_date: startDate,
    end_date: endDate,
  });

  // Step 2: Users who submitted proposals
  const proposals = await analyticsService.queryEvents({
    event_types: ['proposal.submitted'],
    start_date: startDate,
    end_date: endDate,
  });

  // Step 3: Users who completed projects
  const completions = await analyticsService.queryEvents({
    event_types: ['milestone.approved'],
    start_date: startDate,
    end_date: endDate,
  });

  const uniqueViewers = new Set(projectViews.events.map((e) => e.user_id)).size;
  const uniqueProposers = new Set(proposals.events.map((e) => e.user_id)).size;
  const uniqueCompleters = new Set(completions.events.map((e) => e.user_id)).size;

  return {
    steps: [
      {
        name: 'Viewed Projects',
        count: uniqueViewers,
        conversion: 100,
      },
      {
        name: 'Submitted Proposals',
        count: uniqueProposers,
        conversion: (uniqueProposers / uniqueViewers) * 100,
      },
      {
        name: 'Completed Projects',
        count: uniqueCompleters,
        conversion: (uniqueCompleters / uniqueViewers) * 100,
      },
    ],
  };
}

/**
 * Example: Get hourly event aggregations
 */
export async function getHourlyActivity(date: string) {
  const startDate = new Date(date);
  startDate.setHours(0, 0, 0, 0);

  const endDate = new Date(date);
  endDate.setHours(23, 59, 59, 999);

  const result = await analyticsService.queryAggregations({
    aggregation_type: 'hourly',
    event_category: 'transaction',
    start_date: startDate.toISOString(),
    end_date: endDate.toISOString(),
  });

  // Format for charting
  return result.aggregations.map((agg) => ({
    hour: new Date(agg.time_bucket).getHours(),
    events: agg.metrics.count,
    uniqueUsers: agg.metrics.unique_users,
  }));
}

// ==================== Custom Events ====================

/**
 * Example: Track custom interaction event
 */
export async function trackCustomInteraction(
  eventType: string,
  entityId: string,
  data?: Record<string, any>,
) {
  await analyticsService.emitEvent({
    event_type: eventType,
    event_category: 'interaction',
    entity_type: 'custom',
    entity_id: entityId,
    event_data: data,
  });
}

/**
 * Example: Track feature usage
 */
export async function trackFeatureUsed(featureName: string, metadata?: Record<string, any>) {
  await analyticsService.emitEvent({
    event_type: `feature.${featureName}`,
    event_category: 'interaction',
    event_data: metadata,
  });
}

// ==================== Session Management ====================

/**
 * Example: Initialize analytics on app load
 */
export async function initializeAnalytics() {
  // Initialize session tracking
  await analyticsService.initSession();

  // Track session started
  await analyticsService.emitEvent({
    event_type: 'session.started',
    event_category: 'user_activity',
  });

  // Track on page unload
  window.addEventListener('beforeunload', () => {
    // Fire-and-forget (may not complete)
    void analyticsService.emitEvent({
      event_type: 'session.ended',
      event_category: 'user_activity',
    });
  });
}

/**
 * Example: Track page views (for SPA)
 */
export function trackPageView(pagePath: string) {
  void analyticsService.emitEvent({
    event_type: 'page.viewed',
    event_category: 'interaction',
    event_data: {
      path: pagePath,
      referrer: document.referrer,
    },
  });
}
