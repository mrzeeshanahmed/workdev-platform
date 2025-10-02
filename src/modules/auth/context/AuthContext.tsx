import { createContext, useCallback, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';

import { supabaseClient } from 'config/supabase/client';
import { authService } from '../services/AuthService';
import type {
  AuthContextState,
  BackupCodesSummary,
  MfaChallengeState,
  MfaEnrollment,
  SignInResult,
  SignUpResult,
  UserRole,
} from '../types';

type GeneratedBackupCodes = {
  codes: string[];
  summary: BackupCodesSummary;
};

type PrimaryRole = Extract<UserRole, 'client' | 'developer'>;

const PENDING_OAUTH_ROLE_KEY = 'workdev:pending_oauth_role';
const isBrowser = typeof window !== 'undefined';

const readPendingRole = (): PrimaryRole | null => {
  if (!isBrowser) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(PENDING_OAUTH_ROLE_KEY);

    if (!raw) {
      return null;
    }

    if (raw === 'client' || raw === 'developer') {
      return raw;
    }
  } catch (error) {
    console.warn('Unable to read pending OAuth role from storage.', error);
  }

  return null;
};

const storePendingRole = (role: PrimaryRole) => {
  if (!isBrowser) {
    return;
  }

  try {
    window.sessionStorage.setItem(PENDING_OAUTH_ROLE_KEY, role);
  } catch (error) {
    console.warn('Unable to persist pending OAuth role for redirect flow.', error);
  }
};

const clearPendingRole = () => {
  if (!isBrowser) {
    return;
  }

  try {
    window.sessionStorage.removeItem(PENDING_OAUTH_ROLE_KEY);
  } catch (error) {
    console.warn('Unable to clear pending OAuth role from storage.', error);
  }
};

const initialState: AuthContextState = {
  user: null,
  appUser: null,
  profile: null,
  initializing: true,
  loading: false,
  error: null,
  mfa: null,
  factors: [],
};

export interface AuthContextValue extends AuthContextState {
  signUp: (email: string, password: string, role: PrimaryRole) => Promise<SignUpResult>;
  signIn: (email: string, password: string) => Promise<SignInResult>;
  signInWithGitHub: (role: PrimaryRole) => Promise<void>;
  signInWithGoogle: (role: PrimaryRole) => Promise<void>;
  reauthenticate: (password: string) => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  generateBackupCodes: (count?: number) => Promise<GeneratedBackupCodes>;
  listBackupCodes: () => Promise<BackupCodesSummary>;
  verifyBackupCode: (code: string, password: string) => Promise<void>;
  enrollTotp: () => Promise<MfaEnrollment>;
  verifyTotpEnrollment: (factorId: string, code: string) => Promise<void>;
  challengeTotp: (code: string, factorId?: string) => Promise<void>;
  disableFactor: (factorId: string) => Promise<void>;
  refreshSession: () => Promise<void>;
  refreshFactors: () => Promise<void>;
  signOut: () => Promise<void>;
  clearError: () => void;
  linkGitHubAccount: (userId: string) => Promise<void>;
  getStoredGitHubToken: (userId: string) => Promise<string | null>;
}

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
  const [state, setState] = useState<AuthContextState>(initialState);

  const handleSession = useCallback(async (session: Session | null) => {
    if (!session) {
      setState((prev) => ({
        ...prev,
        user: null,
        appUser: null,
        profile: null,
        factors: [],
        mfa: null,
        loading: false,
        initializing: false,
        error: null,
      }));
      return;
    }

    setState((prev) => ({ ...prev, loading: true }));

    try {
      const { appUser, profile } = await authService.getUserContext(session.user);
      const factors = await authService.listFactors();

      let effectiveUser = appUser;
      let effectiveProfile = profile;
      let metadataError: string | null = null;
      const pendingRole = readPendingRole();
      let oauthPayload = authService.buildOAuthPayloadFromSession(session);

      if (pendingRole && session.user) {
        const requiresFinalization = !effectiveUser || effectiveUser.role !== pendingRole;

        try {
          if (requiresFinalization) {
            await authService.finalizeRegistration({
              role: pendingRole,
              email: session.user.email ?? undefined,
              oauth: oauthPayload,
            });
            oauthPayload = null;
            const refreshed = await authService.getUserContext(session.user);
            effectiveUser = refreshed.appUser;
            effectiveProfile = refreshed.profile;
          }
        } catch (error) {
          metadataError =
            error instanceof Error
              ? error.message
              : 'Unable to complete role onboarding after OAuth sign-in.';
        } finally {
          clearPendingRole();
        }
      }

      const resolvedRoleForTokens =
        effectiveUser?.role === 'client' || effectiveUser?.role === 'developer'
          ? (effectiveUser.role as PrimaryRole)
          : null;

      if (oauthPayload && resolvedRoleForTokens && !metadataError) {
        try {
          await authService.storeOAuthTokens(resolvedRoleForTokens, oauthPayload);
          oauthPayload = null;
        } catch (error) {
          if (!metadataError) {
            metadataError =
              error instanceof Error
                ? error.message
                : 'Unable to securely persist OAuth credentials.';
          }
        }
      }

      setState((prev) => ({
        ...prev,
        user: session.user,
        appUser: effectiveUser,
        profile: effectiveProfile,
        factors,
        mfa: null,
        loading: false,
        initializing: false,
        error: metadataError,
      }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        initializing: false,
        loading: false,
        error: error instanceof Error ? error.message : 'Unable to load session.',
      }));
    }
  }, []);

  const refreshSession = useCallback(async () => {
    if (!supabaseClient) {
      return;
    }

    const { data } = await supabaseClient.auth.getSession();
    await handleSession(data.session ?? null);
  }, [handleSession]);

  const refreshFactors = useCallback(async () => {
    try {
      const factors = await authService.listFactors();
      setState((prev) => ({ ...prev, factors }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Unable to refresh security factors.',
      }));
    }
  }, []);

  useEffect(() => {
    if (!supabaseClient) {
      setState((prev) => ({
        ...prev,
        initializing: false,
        error: 'Supabase client is not configured.',
      }));
      return;
    }

    let isMounted = true;
    const subscription = authService.onAuthStateChange(async (_event, session) => {
      if (isMounted) {
        await handleSession(session);
      }
    });

    void refreshSession();

    return () => {
      isMounted = false;
      subscription.data.subscription.unsubscribe();
    };
  }, [handleSession, refreshSession]);

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  const signUp = useCallback<AuthContextValue['signUp']>(
    async (email, password, role) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await authService.signUp(email, password, role);

        if (result.session) {
          await handleSession(result.session);
        } else {
          setState((prev) => ({ ...prev, loading: false }));
        }

        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Sign-up failed.',
        }));
        throw error;
      }
    },
    [handleSession],
  );

  const signIn = useCallback<AuthContextValue['signIn']>(
    async (email, password) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await authService.signIn(email, password);

        if (result.needsMfa) {
          const challenge: MfaChallengeState = {
            factorId: result.factors[0]?.id ?? '',
            factors: result.factors,
            email,
          };

          setState((prev) => ({
            ...prev,
            loading: false,
            mfa: challenge,
          }));
        } else {
          await handleSession(result.session ?? null);
        }

        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Sign-in failed.',
        }));
        throw error;
      }
    },
    [handleSession],
  );

  const signInWithGitHub = useCallback(async (role: PrimaryRole) => {
    setState((prev) => ({ ...prev, error: null }));
    storePendingRole(role);

    try {
      const { url } = await authService.signInWithOAuth('github');

      if (url && typeof window !== 'undefined') {
        window.location.href = url;
      }
    } catch (error) {
      clearPendingRole();
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'GitHub sign-in failed. Please try again.',
      }));
      throw error;
    }
  }, []);

  const signInWithGoogle = useCallback(async (role: PrimaryRole) => {
    setState((prev) => ({ ...prev, error: null }));
    storePendingRole(role);

    try {
      const { url } = await authService.signInWithOAuth('google');

      if (url && typeof window !== 'undefined') {
        window.location.href = url;
      }
    } catch (error) {
      clearPendingRole();
      setState((prev) => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Google sign-in failed. Please try again.',
      }));
      throw error;
    }
  }, []);

  const reauthenticate = useCallback(async (password: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      await authService.reauthenticate(password);
      setState((prev) => ({ ...prev, loading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Password confirmation failed.',
      }));
      throw error;
    }
  }, []);

  const generateBackupCodes = useCallback<AuthContextValue['generateBackupCodes']>(
    async (count) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await authService.generateBackupCodes(count);
        setState((prev) => ({ ...prev, loading: false }));
        return result;
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to generate backup codes.',
        }));
        throw error;
      }
    },
    [],
  );

  const listBackupCodes = useCallback(async () => {
    try {
      return await authService.listBackupCodes();
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Unable to retrieve backup code information.',
      }));
      throw error;
    }
  }, []);

  const verifyBackupCode = useCallback(
    async (code: string, password: string) => {
      const email = state.mfa?.email;

      if (!email) {
        throw new Error('No pending multi-factor challenge to recover.');
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        const result = await authService.verifyBackupCode(email, password, code);

        if (result.needsMfa) {
          const challenge: MfaChallengeState = {
            factorId: result.factors[0]?.id ?? '',
            factors: result.factors,
            email,
          };

          setState((prev) => ({
            ...prev,
            loading: false,
            mfa: challenge,
          }));
        } else {
          await handleSession(result.session ?? null);
        }
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error:
            error instanceof Error ? error.message : 'Backup code verification failed. Try again.',
        }));
        throw error;
      }
    },
    [handleSession, state.mfa?.email],
  );

  const resetPassword = useCallback(async (email: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      await authService.resetPassword(email);
      setState((prev) => ({ ...prev, loading: false }));
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Password reset failed.',
      }));
      throw error;
    }
  }, []);

  const enrollTotp = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      const enrollment = await authService.enrollTotp();
      setState((prev) => ({ ...prev, loading: false }));
      return enrollment;
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : '2FA enrollment failed.',
      }));
      throw error;
    }
  }, []);

  const verifyTotpEnrollment = useCallback(
    async (factorId: string, code: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        await authService.verifyTotpEnrollment(factorId, code);
        await refreshFactors();
        await refreshSession();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '2FA verification failed.',
        }));
        throw error;
      }
    },
    [refreshFactors, refreshSession],
  );

  const challengeTotp = useCallback(
    async (code: string, factorId?: string) => {
      const activeFactorId = factorId ?? state.mfa?.factorId ?? state.mfa?.factors[0]?.id;

      if (!activeFactorId) {
        throw new Error('No multi-factor authentication factor available.');
      }

      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        await authService.challengeTotp(activeFactorId, code);
        setState((prev) => ({ ...prev, mfa: null }));
        await refreshSession();
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : '2FA verification failed.',
        }));
        throw error;
      }
    },
    [refreshSession, state.mfa],
  );

  const disableFactor = useCallback(
    async (factorId: string) => {
      setState((prev) => ({ ...prev, loading: true, error: null }));

      try {
        await authService.disableFactor(factorId);
        await refreshFactors();
        setState((prev) => ({ ...prev, loading: false }));
      } catch (error) {
        setState((prev) => ({
          ...prev,
          loading: false,
          error: error instanceof Error ? error.message : 'Unable to disable the factor.',
        }));
        throw error;
      }
    },
    [refreshFactors],
  );

  const signOut = useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true }));

    try {
      await authService.signOut();
      setState({ ...initialState, initializing: false });
    } catch (error) {
      setState((prev) => ({
        ...prev,
        loading: false,
        error: error instanceof Error ? error.message : 'Sign-out failed.',
      }));
      throw error;
    }
  }, []);

  const linkGitHubAccount = useCallback(async (userId: string) => {
    setState((prev) => ({ ...prev, loading: true, error: null }));

    try {
      await authService.linkGitHubAccount(userId);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error
            ? error.message
            : 'Unable to link your GitHub account. Please try again.',
      }));
      throw error;
    } finally {
      setState((prev) => ({ ...prev, loading: false }));
    }
  }, []);

  const getStoredGitHubToken = useCallback(async (userId: string) => {
    try {
      return await authService.getStoredGitHubToken(userId);
    } catch (error) {
      setState((prev) => ({
        ...prev,
        error:
          error instanceof Error ? error.message : 'Unable to retrieve your stored GitHub token.',
      }));
      throw error;
    }
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      ...state,
      signUp,
      signIn,
      signInWithGitHub,
      signInWithGoogle,
      reauthenticate,
      resetPassword,
      generateBackupCodes,
      listBackupCodes,
      verifyBackupCode,
      enrollTotp,
      verifyTotpEnrollment,
      challengeTotp,
      disableFactor,
      refreshSession,
      refreshFactors,
      signOut,
      clearError,
      linkGitHubAccount,
      getStoredGitHubToken,
    }),
    [
      challengeTotp,
      clearError,
      disableFactor,
      enrollTotp,
      generateBackupCodes,
      getStoredGitHubToken,
      linkGitHubAccount,
      listBackupCodes,
      reauthenticate,
      refreshFactors,
      refreshSession,
      resetPassword,
      signIn,
      signInWithGitHub,
      signInWithGoogle,
      signOut,
      signUp,
      state,
      verifyBackupCode,
      verifyTotpEnrollment,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
