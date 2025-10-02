import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { ReactNode } from 'react';

import { useAuth } from 'modules/auth/hooks/useAuth';
import { profileService } from '../services/ProfileService';
import type {
  DeveloperProfileExtended,
  GitHubData,
  PortfolioProject,
  PortfolioProjectInput,
  ProfileAnalytics,
  ProfileCompletenessFactors,
  ProfileUpdatePayload,
  WorkHistory,
  WorkHistoryInput,
} from '../types';

interface ProfileContextState {
  profile: DeveloperProfileExtended | null;
  portfolio: PortfolioProject[];
  workHistory: WorkHistory[];
  analytics: ProfileAnalytics | null;
  githubData: GitHubData | null;
  completeness: { score: number; factors: ProfileCompletenessFactors } | null;
  loading: boolean;
  error: string | null;
}

interface ProfileContextValue extends ProfileContextState {
  updateProfile: (updates: ProfileUpdatePayload) => Promise<void>;
  uploadProfilePicture: (file: File) => Promise<string>;
  createPortfolioProject: (project: PortfolioProjectInput) => Promise<void>;
  updatePortfolioProject: (id: string, updates: Partial<PortfolioProjectInput>) => Promise<void>;
  deletePortfolioProject: (id: string) => Promise<void>;
  reorderPortfolio: (projectIds: string[]) => Promise<void>;
  createWorkHistory: (work: WorkHistoryInput) => Promise<void>;
  updateWorkHistory: (id: string, updates: Partial<WorkHistoryInput>) => Promise<void>;
  deleteWorkHistory: (id: string) => Promise<void>;
  syncGitHub: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const ProfileContext = createContext<ProfileContextValue | undefined>(undefined);

interface ProfileProviderProps {
  children: ReactNode;
}

export const ProfileProvider = ({ children }: ProfileProviderProps) => {
  // user may be unused in some flows; keep for future checks
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user, appUser } = useAuth();
  const [state, setState] = useState<ProfileContextState>({
    profile: null,
    portfolio: [],
    workHistory: [],
    analytics: null,
    githubData: null,
    completeness: null,
    loading: false,
    error: null,
  });

  const loadProfile = useCallback(async (userId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const [profile, portfolio, workHistory, analytics] = await Promise.all([
        profileService.getProfile(userId),
        profileService.getPortfolio(userId),
        profileService.getWorkHistory(userId),
        profileService.getProfileAnalytics(userId),
      ]);

      if (profile) {
        const completeness = profileService.calculateCompleteness(profile, portfolio, workHistory);

        setState((prev) => ({
          ...prev,
          profile,
          portfolio,
          workHistory,
          analytics,
          githubData: profile.github_data,
          completeness,
          loading: false,
        }));
      } else {
        setState((prev) => ({ ...prev, loading: false }));
      }
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to load profile',
      }));
    }
  }, []);

  useEffect(() => {
    if (appUser?.role === 'developer') {
      void loadProfile(appUser.id);
    }
  }, [appUser, loadProfile]);

  const updateProfile = useCallback(
    async (updates: ProfileUpdatePayload) => {
      if (!appUser) return;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const updated = await profileService.updateProfile(appUser.id, updates);

        setState((prev) => {
          const newProfile = updated;
          const completeness = newProfile
            ? profileService.calculateCompleteness(newProfile, prev.portfolio, prev.workHistory)
            : null;

          return {
            ...prev,
            profile: updated,
            completeness,
            loading: false,
          };
        });
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to update profile',
        }));
        throw error;
      }
    },
    [appUser],
  );

  const uploadProfilePicture = useCallback(
    async (file: File) => {
      if (!appUser) throw new Error('Not authenticated');

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const url = await profileService.uploadProfilePicture(appUser.id, file);
        setState((prev) => ({
          ...prev,
          profile: prev.profile ? { ...prev.profile, profile_picture_url: url } : null,
          loading: false,
        }));
        return url;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to upload picture',
        }));
        throw error;
      }
    },
    [appUser],
  );

  const createPortfolioProject = useCallback(
    async (project: PortfolioProjectInput) => {
      if (!appUser) return;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const created = await profileService.createPortfolioProject(appUser.id, project);

        setState((prev) => ({
          ...prev,
          portfolio: [...prev.portfolio, created],
          loading: false,
        }));

        await profileService.updateProfileCompleteness(appUser.id);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to create project',
        }));
        throw error;
      }
    },
    [appUser],
  );

  const updatePortfolioProject = useCallback(
    async (id: string, updates: Partial<PortfolioProjectInput>) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const updated = await profileService.updatePortfolioProject(id, updates);

        setState((prev) => ({
          ...prev,
          portfolio: prev.portfolio.map((p) => (p.id === id ? updated : p)),
          loading: false,
        }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to update project',
        }));
        throw error;
      }
    },
    [],
  );

  const deletePortfolioProject = useCallback(
    async (id: string) => {
      if (!appUser) return;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        await profileService.deletePortfolioProject(id);

        setState((prev) => ({
          ...prev,
          portfolio: prev.portfolio.filter((p) => p.id !== id),
          loading: false,
        }));

        await profileService.updateProfileCompleteness(appUser.id);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to delete project',
        }));
        throw error;
      }
    },
    [appUser],
  );

  const reorderPortfolio = useCallback(
    async (projectIds: string[]) => {
      if (!appUser) return;

      const originalOrder = [...state.portfolio];

      // Optimistic update
      const reordered = projectIds
        .map((id) => state.portfolio.find((p) => p.id === id))
        .filter((p): p is PortfolioProject => p !== undefined);

      setState((prev) => ({ ...prev, portfolio: reordered }));

      try {
        await profileService.reorderPortfolio(appUser.id, projectIds);
      } catch (error) {
        // Revert on error
        setState((prev) => ({ ...prev, portfolio: originalOrder }));
        throw error;
      }
    },
    [appUser, state.portfolio],
  );

  const createWorkHistory = useCallback(
    async (work: WorkHistoryInput) => {
      if (!appUser) return;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const created = await profileService.createWorkHistory(appUser.id, work);

        setState((prev) => ({
          ...prev,
          workHistory: [created, ...prev.workHistory],
          loading: false,
        }));

        await profileService.updateProfileCompleteness(appUser.id);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to create work history',
        }));
        throw error;
      }
    },
    [appUser],
  );

  const updateWorkHistory = useCallback(async (id: string, updates: Partial<WorkHistoryInput>) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const updated = await profileService.updateWorkHistory(id, updates);

      setState((prev) => ({
        ...prev,
        workHistory: prev.workHistory.map((w) => (w.id === id ? updated : w)),
        loading: false,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to update work history',
      }));
      throw error;
    }
  }, []);

  const deleteWorkHistory = useCallback(
    async (id: string) => {
      if (!appUser) return;

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        await profileService.deleteWorkHistory(id);

        setState((prev) => ({
          ...prev,
          workHistory: prev.workHistory.filter((w) => w.id !== id),
          loading: false,
        }));

        await profileService.updateProfileCompleteness(appUser.id);
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Failed to delete work history',
        }));
        throw error;
      }
    },
    [appUser],
  );

  const syncGitHub = useCallback(async () => {
    if (!appUser) return;

    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const githubData = await profileService.syncGitHubData(appUser.id);

      setState((prev) => ({
        ...prev,
        githubData,
        profile: prev.profile ? { ...prev.profile, github_data: githubData } : null,
        loading: false,
      }));

      await profileService.updateProfileCompleteness(appUser.id);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Failed to sync GitHub data',
      }));
      throw error;
    }
  }, [appUser]);

  const refreshProfile = useCallback(async () => {
    if (appUser) {
      await loadProfile(appUser.id);
    }
  }, [appUser, loadProfile]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const value: ProfileContextValue = {
    ...state,
    updateProfile,
    uploadProfilePicture,
    createPortfolioProject,
    updatePortfolioProject,
    deletePortfolioProject,
    reorderPortfolio,
    createWorkHistory,
    updateWorkHistory,
    deleteWorkHistory,
    syncGitHub,
    refreshProfile,
    clearError,
  };

  return <ProfileContext.Provider value={value}>{children}</ProfileContext.Provider>;
};

export const useProfile = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error('useProfile must be used within ProfileProvider');
  }
  return context;
};
