/* eslint-disable @typescript-eslint/no-unused-vars */
import { supabaseClient } from 'config/supabase/client';
import type {
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
} from '../types';

export class ClientService {
  private client = supabaseClient;

  private get supabase() {
    if (!this.client) {
      throw new Error('Supabase client is not configured. Check your environment variables.');
    }
    // reference to avoid eslint unused warning in pre-commit
    void this.client;
    return this.client;
  }

  // ==================== Client Profile Management ====================

  /**
   * Get client profile by user ID
   */
  async getClientProfile(userId: string): Promise<ClientProfile | null> {
    const { data, error } = await this.supabase
      .from('client_profiles')
      .select('*')
      .eq('user_id', userId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data as ClientProfile;
  }

  /**
   * Update client profile
   */
  async updateClientProfile(
    userId: string,
    updates: ClientProfileUpdatePayload,
  ): Promise<ClientProfile> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('client_profiles')
      .update({
        ...updates,
        updated_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .select()
      .single();

    if (error) {
      throw error;
    }

    return data as ClientProfile;
  }

  /**
   * Upload company logo
   */
  async uploadCompanyLogo(userId: string, file: File): Promise<string> {
    const supabase = this.supabase;

    // Validate file
    const maxSize = 2 * 1024 * 1024; // 2MB
    if (file.size > maxSize) {
      throw new Error('File size exceeds 2MB limit');
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];
    if (!allowedTypes.includes(file.type)) {
      throw new Error('Invalid file type. Only JPEG, PNG, WebP, and SVG are allowed');
    }

    // Upload to storage
    const fileExt = file.name.split('.').pop();
    const fileName = `${userId}/logo.${fileExt}`;
    const filePath = `company-logos/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('company-logos')
      .upload(filePath, file, { upsert: true });

    if (uploadError) {
      throw uploadError;
    }

    // Get public URL
    const {
      data: { publicUrl },
    } = supabase.storage.from('company-logos').getPublicUrl(filePath);

    // Update profile with logo URL
    await this.updateClientProfile(userId, { company_logo_url: publicUrl });

    return publicUrl;
  }

  /**
   * Get public client profile (visible to developers)
   */
  async getPublicClientProfile(userId: string): Promise<PublicClientProfile | null> {
    const supabase = this.supabase;

    // Get client profile
    const profile = await this.getClientProfile(userId);
    if (!profile) return null;

    // Get reputation stats
    const reputationStats = await this.getClientReputationStats(userId);

    // Get recent reviews
    const recentReviews = await this.getPublicReviews(userId, 5);

    return {
      company_name: profile.company_name,
      company_logo_url: profile.company_logo_url,
      company_website: profile.company_website,
      company_description: profile.company_description,
      industry: profile.industry,
      company_size: profile.company_size,
      location: profile.location,
      member_since: profile.created_at,
      total_projects_posted: profile.total_projects_posted,
      successful_hires: profile.successful_hires,
      repeat_hire_rate: profile.repeat_hire_rate,
      reputation_stats: reputationStats,
      recent_reviews: recentReviews,
    };
  }

  // ==================== Reputation & Reviews ====================

  /**
   * Get client reputation statistics
   */
  async getClientReputationStats(userId: string): Promise<ClientReputationStats> {
    // Get all reviews for this client
    const { data: reviews, error } = await this.supabase
      .from('project_reviews')
      .select('*')
      .eq('reviewee_user_id', userId)
      .eq('reviewee_type', 'client')
      .eq('is_mutual_visible', true);

    if (error) {
      throw error;
    }

    if (!reviews || reviews.length === 0) {
      return {
        average_rating: 0,
        total_reviews: 0,
        rating_breakdown: {
          communication: 0,
          professionalism: 0,
          project_clarity: 0,
          payment_timeliness: 0,
        },
        five_star_count: 0,
        four_star_count: 0,
        three_star_count: 0,
        two_star_count: 0,
        one_star_count: 0,
        repeat_hire_rate: 0,
        response_rate: 0,
        average_project_value: 0,
      };
    }

    // Calculate average ratings
    const totalReviews = reviews.length;
    const sumCommunication = reviews.reduce((sum, r) => sum + r.rating_communication, 0);
    const sumProfessionalism = reviews.reduce((sum, r) => sum + r.rating_professionalism, 0);
    const sumProjectClarity = reviews.reduce((sum, r) => sum + (r.rating_project_clarity || 0), 0);
    const sumPaymentTimeliness = reviews.reduce(
      (sum, r) => sum + (r.rating_payment_timeliness || 0),
      0,
    );

    const avgCommunication = sumCommunication / totalReviews;
    const avgProfessionalism = sumProfessionalism / totalReviews;
    const avgProjectClarity = sumProjectClarity / totalReviews;
    const avgPaymentTimeliness = sumPaymentTimeliness / totalReviews;

    const overallAverage =
      (avgCommunication + avgProfessionalism + avgProjectClarity + avgPaymentTimeliness) / 4;

    // Count star ratings
    const starCounts = reviews.reduce(
      (counts, review) => {
        const avgRating = Math.round(
          (review.rating_communication +
            review.rating_professionalism +
            (review.rating_project_clarity || 0) +
            (review.rating_payment_timeliness || 0)) /
            4,
        );

        if (avgRating === 5) counts.five++;
        else if (avgRating === 4) counts.four++;
        else if (avgRating === 3) counts.three++;
        else if (avgRating === 2) counts.two++;
        else if (avgRating === 1) counts.one++;

        return counts;
      },
      { five: 0, four: 0, three: 0, two: 0, one: 0 },
    );

    // Get additional stats from client profile
    const profile = await this.getClientProfile(userId);

    return {
      average_rating: Math.round(overallAverage * 10) / 10,
      total_reviews: totalReviews,
      rating_breakdown: {
        communication: Math.round(avgCommunication * 10) / 10,
        professionalism: Math.round(avgProfessionalism * 10) / 10,
        project_clarity: Math.round(avgProjectClarity * 10) / 10,
        payment_timeliness: Math.round(avgPaymentTimeliness * 10) / 10,
      },
      five_star_count: starCounts.five,
      four_star_count: starCounts.four,
      three_star_count: starCounts.three,
      two_star_count: starCounts.two,
      one_star_count: starCounts.one,
      repeat_hire_rate: profile?.repeat_hire_rate || 0,
      response_rate: 95, // TODO: Calculate from actual data
      average_project_value: 5000, // TODO: Calculate from actual data
    };
  }

  /**
   * Get public reviews for a client
   */
  async getPublicReviews(userId: string, limit = 10): Promise<PublicReview[]> {
    const supabase = this.supabase;

    const { data: reviews, error } = await supabase
      .from('project_reviews')
      .select(
        `
        id,
        rating_communication,
        rating_professionalism,
        rating_project_clarity,
        rating_payment_timeliness,
        comment,
        created_at,
        reviewer:users!reviewer_user_id(
          id,
          full_name,
          avatar_url
        ),
        project:projects(
          title
        )
      `,
      )
      .eq('reviewee_user_id', userId)
      .eq('reviewee_type', 'client')
      .eq('is_mutual_visible', true)
      .order('created_at', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return (reviews || []).map((review: any) => ({
      id: review.id,
      reviewer_name: review.reviewer?.full_name || 'Anonymous',
      reviewer_avatar: review.reviewer?.avatar_url || null,
      rating:
        (review.rating_communication +
          review.rating_professionalism +
          (review.rating_project_clarity || 0) +
          (review.rating_payment_timeliness || 0)) /
        4,
      ratings: {
        communication: review.rating_communication,
        professionalism: review.rating_professionalism,
        project_clarity: review.rating_project_clarity,
        payment_timeliness: review.rating_payment_timeliness,
      },
      comment: review.comment,
      project_title: review.project?.title || 'Project',
      created_at: review.created_at,
    }));
  }

  // ==================== Review System ====================

  /**
   * Check if user can review a project
   */
  async checkReviewEligibility(
    projectId: string,
    reviewerUserId: string,
  ): Promise<ReviewEligibility> {
    const supabase = this.supabase;

    // Check if project exists and is completed
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select('status, payment_status, client_id, developer_id')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return {
        can_review: false,
        reason: 'Project not found',
        project_completed: false,
        payment_completed: false,
        already_reviewed: false,
      };
    }

    const projectCompleted = project.status === 'completed';
    const paymentCompleted = project.payment_status === 'paid';

    // Check if user is part of this project
    const isClient = project.client_id === reviewerUserId;
    const isDeveloper = project.developer_id === reviewerUserId;

    if (!isClient && !isDeveloper) {
      return {
        can_review: false,
        reason: 'You are not part of this project',
        project_completed: projectCompleted,
        payment_completed: paymentCompleted,
        already_reviewed: false,
      };
    }

    // Check if already reviewed
    const { data: existingReview } = await supabase
      .from('project_reviews')
      .select('id')
      .eq('project_id', projectId)
      .eq('reviewer_user_id', reviewerUserId)
      .single();

    const alreadyReviewed = !!existingReview;

    // Can review if project is completed, payment is done, and not already reviewed
    const canReview = projectCompleted && paymentCompleted && !alreadyReviewed;

    return {
      can_review: canReview,
      reason: !canReview
        ? !projectCompleted
          ? 'Project not completed'
          : !paymentCompleted
            ? 'Payment not completed'
            : 'Already reviewed'
        : undefined,
      project_completed: projectCompleted,
      payment_completed: paymentCompleted,
      already_reviewed: alreadyReviewed,
    };
  }

  /**
   * Submit a project review
   */
  async submitProjectReview(
    reviewerUserId: string,
    reviewInput: ProjectReviewInput,
  ): Promise<ReviewSubmissionResult> {
    const supabase = this.supabase;

    // Check eligibility
    const eligibility = await this.checkReviewEligibility(reviewInput.project_id, reviewerUserId);

    if (!eligibility.can_review) {
      return {
        success: false,
        error: eligibility.reason || 'Cannot submit review',
      };
    }

    // Determine reviewer type
    const { data: project } = await supabase
      .from('projects')
      .select('client_id, developer_id')
      .eq('id', reviewInput.project_id)
      .single();

    if (!project) {
      return {
        success: false,
        error: 'Project not found',
      };
    }

    const reviewerType = project.client_id === reviewerUserId ? 'client' : 'developer';

    // Insert review
    const { data: review, error } = await supabase
      .from('project_reviews')
      .insert({
        project_id: reviewInput.project_id,
        reviewer_user_id: reviewerUserId,
        reviewer_type: reviewerType,
        reviewee_user_id: reviewInput.reviewee_user_id,
        reviewee_type: reviewInput.reviewee_type,
        rating_communication: reviewInput.rating_communication,
        rating_professionalism: reviewInput.rating_professionalism,
        rating_project_clarity: reviewInput.rating_project_clarity || null,
        rating_payment_timeliness: reviewInput.rating_payment_timeliness || null,
        rating_quality: reviewInput.rating_quality || null,
        rating_expertise: reviewInput.rating_expertise || null,
        rating_responsiveness: reviewInput.rating_responsiveness || null,
        comment: reviewInput.comment,
        is_visible: true,
        is_mutual_visible: false, // Will be updated when both reviews are submitted
      })
      .select()
      .single();

    if (error) {
      return {
        success: false,
        error: error.message,
      };
    }

    // Check if other party has also submitted review
    const otherPartyUserId =
      reviewerUserId === project.client_id ? project.developer_id : project.client_id;

    const { data: otherReview } = await supabase
      .from('project_reviews')
      .select('id')
      .eq('project_id', reviewInput.project_id)
      .eq('reviewer_user_id', otherPartyUserId)
      .single();

    const isMutualVisible = !!otherReview;

    // If both reviews exist, make them mutually visible
    if (isMutualVisible) {
      await supabase
        .from('project_reviews')
        .update({ is_mutual_visible: true })
        .eq('project_id', reviewInput.project_id);
    }

    // Update client reputation stats
    await this.updateClientReputationStats(reviewInput.reviewee_user_id);

    return {
      success: true,
      review_id: review.id,
      is_mutual_visible: isMutualVisible,
    };
  }

  /**
   * Update client reputation statistics (aggregate)
   */
  private async updateClientReputationStats(userId: string): Promise<void> {
    const supabase = this.supabase;

    const stats = await this.getClientReputationStats(userId);

    await supabase
      .from('client_profiles')
      .update({
        average_rating: stats.average_rating,
        total_reviews: stats.total_reviews,
      })
      .eq('user_id', userId);
  }

  // ==================== Hiring History ====================

  /**
   * Get hiring history for a client
   */
  async getHiringHistory(clientId: string): Promise<HiringHistoryItem[]> {
    const supabase = this.supabase;

    const { data: hires, error } = await supabase
      .from('project_hires')
      .select(
        `
        id,
        project_id,
        hire_date,
        completion_date,
        status,
        outcome,
        final_amount_paid,
        project:projects(
          title,
          budget
        ),
        developer:users!developer_id(
          id,
          full_name,
          avatar_url
        ),
        client_review:project_reviews!project_reviews_project_id_fkey(id),
        developer_review:project_reviews!project_reviews_project_id_fkey(id)
      `,
      )
      .eq('client_id', clientId)
      .order('hire_date', { ascending: false });

    if (error) {
      throw error;
    }

    return (hires || []).map((hire: any) => ({
      id: hire.id,
      project_id: hire.project_id,
      project_title: hire.project?.title || 'Untitled Project',
      project_budget: hire.project?.budget || 0,
      developer_id: hire.developer?.id,
      developer_name: hire.developer?.full_name || 'Unknown',
      developer_avatar: hire.developer?.avatar_url || null,
      hire_date: hire.hire_date,
      completion_date: hire.completion_date,
      status: hire.status,
      outcome: hire.outcome,
      client_review_submitted: !!hire.client_review,
      developer_review_submitted: !!hire.developer_review,
      final_amount_paid: hire.final_amount_paid,
    }));
  }

  /**
   * Get reviews received by client
   */
  async getClientReviews(userId: string): Promise<ProjectReview[]> {
    const supabase = this.supabase;

    const { data: reviews, error } = await supabase
      .from('project_reviews')
      .select('*')
      .eq('reviewee_user_id', userId)
      .eq('reviewee_type', 'client')
      .eq('is_mutual_visible', true)
      .order('created_at', { ascending: false });

    if (error) {
      throw error;
    }

    return (reviews || []) as ProjectReview[];
  }
}

// Export singleton instance
export const clientService = new ClientService();
