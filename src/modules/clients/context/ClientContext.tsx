import React, { createContext, useContext, useState, useCallback } from 'react';
import { clientService } from '../services/ClientService';
import type {
  ClientProfile,
  ClientReputationStats,
  HiringHistoryItem,
  ProjectReview,
  PublicClientProfile,
} from '../types';

interface ClientContextValue {
  // State
  profile: ClientProfile | null;
  reputationStats: ClientReputationStats | null;
  hiringHistory: HiringHistoryItem[];
  reviews: ProjectReview[];
  isLoading: boolean;
  error: string | null;

  // Actions
  loadClientProfile: (userId: string) => Promise<void>;
  loadPublicProfile: (userId: string) => Promise<PublicClientProfile | null>;
  updateProfile: (userId: string, updates: any) => Promise<void>;
  uploadLogo: (userId: string, file: File) => Promise<string>;
  loadHiringHistory: (clientId: string) => Promise<void>;
  loadReviews: (userId: string) => Promise<void>;
  submitReview: (reviewerUserId: string, reviewData: any) => Promise<any>;
  checkReviewEligibility: (projectId: string, reviewerUserId: string) => Promise<any>;
  refreshData: () => Promise<void>;
}

const ClientContext = createContext<ClientContextValue | undefined>(undefined);

export const ClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [profile, setProfile] = useState<ClientProfile | null>(null);
  const [reputationStats, setReputationStats] = useState<ClientReputationStats | null>(null);
  const [hiringHistory, setHiringHistory] = useState<HiringHistoryItem[]>([]);
  const [reviews, setReviews] = useState<ProjectReview[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const loadClientProfile = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const profileData = await clientService.getClientProfile(userId);
      setProfile(profileData);
      setCurrentUserId(userId);

      // Load reputation stats if profile exists
      if (profileData) {
        const stats = await clientService.getClientReputationStats(userId);
        setReputationStats(stats);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load client profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadPublicProfile = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const publicProfile = await clientService.getPublicClientProfile(userId);
      return publicProfile;
    } catch (err: any) {
      setError(err.message || 'Failed to load public profile');
      return null;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const updateProfile = useCallback(async (userId: string, updates: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const updatedProfile = await clientService.updateClientProfile(userId, updates);
      setProfile(updatedProfile);
    } catch (err: any) {
      setError(err.message || 'Failed to update profile');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const uploadLogo = useCallback(
    async (userId: string, file: File) => {
      setIsLoading(true);
      setError(null);
      try {
        const logoUrl = await clientService.uploadCompanyLogo(userId, file);
        // Reload profile to get updated logo URL
        await loadClientProfile(userId);
        return logoUrl;
      } catch (err: any) {
        setError(err.message || 'Failed to upload logo');
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [loadClientProfile],
  );

  const loadHiringHistory = useCallback(async (clientId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const history = await clientService.getHiringHistory(clientId);
      setHiringHistory(history);
    } catch (err: any) {
      setError(err.message || 'Failed to load hiring history');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadReviews = useCallback(async (userId: string) => {
    setIsLoading(true);
    setError(null);
    try {
      const reviewsData = await clientService.getClientReviews(userId);
      setReviews(reviewsData);
    } catch (err: any) {
      setError(err.message || 'Failed to load reviews');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const submitReview = useCallback(async (reviewerUserId: string, reviewData: any) => {
    setIsLoading(true);
    setError(null);
    try {
      const result = await clientService.submitProjectReview(reviewerUserId, reviewData);
      return result;
    } catch (err: any) {
      setError(err.message || 'Failed to submit review');
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  const checkReviewEligibility = useCallback(async (projectId: string, reviewerUserId: string) => {
    try {
      const eligibility = await clientService.checkReviewEligibility(projectId, reviewerUserId);
      return eligibility;
    } catch (err: any) {
      setError(err.message || 'Failed to check review eligibility');
      throw err;
    }
  }, []);

  const refreshData = useCallback(async () => {
    if (currentUserId) {
      await loadClientProfile(currentUserId);
      await loadHiringHistory(currentUserId);
      await loadReviews(currentUserId);
    }
  }, [currentUserId, loadClientProfile, loadHiringHistory, loadReviews]);

  const value: ClientContextValue = {
    profile,
    reputationStats,
    hiringHistory,
    reviews,
    isLoading,
    error,
    loadClientProfile,
    loadPublicProfile,
    updateProfile,
    uploadLogo,
    loadHiringHistory,
    loadReviews,
    submitReview,
    checkReviewEligibility,
    refreshData,
  };

  return <ClientContext.Provider value={value}>{children}</ClientContext.Provider>;
};

export const useClient = () => {
  const context = useContext(ClientContext);
  if (!context) {
    throw new Error('useClient must be used within ClientProvider');
  }
  return context;
};

export default ClientContext;
