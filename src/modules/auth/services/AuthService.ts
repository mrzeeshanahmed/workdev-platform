import type { AuthChangeEvent, AuthError, Factor, Session, User } from '@supabase/supabase-js';

import { supabaseClient } from 'config/supabase/client';
import type {
  AppUser,
  AuthProfile,
  BackupCodesSummary,
  MfaEnrollment,
  SignInResult,
  SignUpResult,
  UserRole,
} from '../types';

const MFA_REQUIRED_MESSAGE = 'mfa required';
const DEFAULT_ROLE: UserRole = 'developer';
const OAUTH_SCOPES = {
  github: 'read:user public_repo',
  google: 'profile email',
} as const;
type PrimaryRole = Extract<UserRole, 'client' | 'developer'>;
type OAuthProvider = keyof typeof OAUTH_SCOPES;

type OAuthTokenPayload = {
  provider: OAuthProvider;
  accessToken?: string | null;
  refreshToken?: string | null;
  username?: string;
  expiresAt?: number | null;
};

type GeneratedBackupCodes = {
  codes: string[];
  summary: BackupCodesSummary;
};

type MaybeMfaPayload = {
  mfa?: {
    factors?: Factor[];
  };
};

type FactorCollection = {
  all?: Factor[];
  totp?: Factor[];
};

export class AuthService {
  private client = supabaseClient;

  private get supabase() {
    if (!this.client) {
      throw new Error('Supabase client is not configured. Check your environment variables.');
    }

    return this.client;
  }

  async signUp(email: string, password: string, role: PrimaryRole): Promise<SignUpResult> {
    const supabase = this.supabase;
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { role },
        emailRedirectTo: redirectTo,
      },
    });

    if (error) {
      throw error;
    }

    if (data.user && data.session) {
      await this.ensureAppUser(data.user, role, email);
    }

    return {
      session: data.session ?? null,
      needsConfirmation: !data.session,
    };
  }

  async signIn(email: string, password: string): Promise<SignInResult> {
    const supabase = this.supabase;
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      if (this.isMfaRequired(error)) {
        const factors = ((data as unknown as MaybeMfaPayload)?.mfa?.factors ?? []) as Factor[];
        return {
          session: null,
          needsMfa: true,
          factors,
        };
      }

      throw error;
    }

    if (data.user) {
      await this.ensureAppUser(data.user, undefined, email);
    }

    return {
      session: data.session ?? null,
      needsMfa: false,
      factors: [],
    };
  }

  async signInWithOAuth(provider: OAuthProvider) {
    const supabase = this.supabase;
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
    const scopes = OAUTH_SCOPES[provider];

    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo,
        scopes,
        skipBrowserRedirect: true,
        // @ts-ignore - PKCE option not yet included in supabase-js type declarations.
        flowType: 'pkce',
        queryParams: provider === 'github' ? { allow_signup: 'false' } : undefined,
      },
    });

    if (error) {
      if (error.message?.toLowerCase?.().includes('access_denied')) {
        throw new Error(
          'GitHub did not grant the requested permissions. Please approve the access request to continue.',
        );
      }
      throw error;
    }

    if (!data?.url) {
      throw new Error('OAuth provider did not return a redirect URL.');
    }

    return data;
  }

  async signOut(): Promise<void> {
    const supabase = this.supabase;
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }
  }

  async reauthenticate(password: string): Promise<void> {
    const supabase = this.supabase;
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();

    if (sessionError) {
      throw sessionError;
    }

    const email = session?.user?.email;

    if (!email) {
      throw new Error('No active session found for reauthentication.');
    }

    const { error, data } = await supabase.auth.signInWithPassword({ email, password });

    if (error && !this.isMfaRequired(error)) {
      throw error;
    }

    if (!error && !data.session) {
      throw new Error('Password verification did not complete as expected.');
    }
  }

  buildOAuthPayloadFromSession(session: Session): OAuthTokenPayload | null {
    const providerValue =
      session.user?.app_metadata?.provider ?? session.user?.identities?.[0]?.provider ?? null;

    if (providerValue !== 'github' && providerValue !== 'google') {
      return null;
    }

    const provider = providerValue as OAuthProvider;

    const tokenPayload = session as unknown as {
      provider_token?: string | null;
      provider_refresh_token?: string | null;
    };

    const accessToken = tokenPayload.provider_token ?? null;
    const refreshToken = tokenPayload.provider_refresh_token ?? null;

    if (!accessToken && !refreshToken) {
      return null;
    }

    const username =
      provider === 'github'
        ? (session.user.user_metadata?.user_name as string | undefined)
        : undefined;

    return {
      provider,
      accessToken,
      refreshToken,
      username,
      expiresAt: null,
    };
  }

  async resetPassword(email: string): Promise<void> {
    const supabase = this.supabase;
    const redirectTo =
      typeof window !== 'undefined' ? `${window.location.origin}/auth/reset` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo,
    });

    if (error) {
      throw error;
    }
  }

  async getUserContext(user: User): Promise<{ appUser: AppUser | null; profile: AuthProfile }> {
    let appUser = await this.fetchAppUserByAuthId(user.id);

    if (!appUser) {
      appUser = await this.ensureAppUser(user, undefined, user.email ?? undefined);
    }

    if (!appUser) {
      return { appUser: null, profile: null };
    }

    const profile = await this.fetchProfileForRole(appUser);

    return { appUser, profile };
  }

  async updateUserRole(user: User, role: PrimaryRole): Promise<AppUser> {
    const supabase = this.supabase;

    const { error: metadataError } = await supabase.auth.updateUser({ data: { role } });

    if (metadataError) {
      throw metadataError;
    }

    const { data, error } = await supabase.rpc('create_user_with_profile', {
      p_auth_user: user.id,
      p_email: user.email ?? null,
      p_role: role,
    });

    if (error) {
      throw error;
    }

    return data as AppUser;
  }

  async finalizeRegistration(payload: {
    role: PrimaryRole;
    email?: string;
    oauth?: OAuthTokenPayload | null;
  }): Promise<AppUser | null> {
    const supabase = this.supabase;
    const { data, error } = await supabase.functions.invoke('register-user', {
      body: {
        role: payload.role,
        email: payload.email,
        provider: payload.oauth?.provider,
        providerToken: payload.oauth?.accessToken ?? undefined,
        providerRefreshToken: payload.oauth?.refreshToken ?? undefined,
        providerUsername: payload.oauth?.username,
        scopes: payload.oauth ? OAUTH_SCOPES[payload.oauth.provider] : undefined,
        expiresAt: payload.oauth?.expiresAt ?? undefined,
      },
    });

    if (error) {
      throw error;
    }

    return (data as { user?: AppUser | null } | null)?.user ?? null;
  }

  async storeOAuthTokens(role: PrimaryRole, oauth: OAuthTokenPayload): Promise<void> {
    if (!oauth.accessToken) {
      return;
    }

    await this.finalizeRegistration({ role, oauth });
  }

  async generateBackupCodes(count = 10): Promise<GeneratedBackupCodes> {
    const supabase = this.supabase;
    const { data, error } = await supabase.functions.invoke('mfa-backup-codes', {
      body: {
        action: 'generate',
        count,
      },
    });

    if (error) {
      throw error;
    }

    const payload = (data as {
      codes?: string[];
      total?: number;
      remaining?: number;
    }) ?? { codes: [], total: 0, remaining: 0 };

    return {
      codes: payload.codes ?? [],
      summary: {
        total: payload.total ?? 0,
        remaining: payload.remaining ?? 0,
      },
    };
  }

  async listBackupCodes(): Promise<BackupCodesSummary> {
    const supabase = this.supabase;
    const { data, error } = await supabase.functions.invoke('mfa-backup-codes', {
      body: {
        action: 'list',
      },
    });

    if (error) {
      throw error;
    }

    const payload = (data as { total?: number; remaining?: number }) ?? {};

    return {
      total: payload.total ?? 0,
      remaining: payload.remaining ?? 0,
    };
  }

  async verifyBackupCode(email: string, password: string, code: string): Promise<SignInResult> {
    const supabase = this.supabase;

    const { error } = await supabase.functions.invoke('mfa-backup-codes', {
      body: {
        action: 'verify',
        email,
        code,
      },
    });

    if (error) {
      throw error;
    }

    return this.signIn(email, password);
  }

  async linkGitHubAccount(userId: string): Promise<void> {
    const supabase = this.supabase;
    const redirectTo = typeof window !== 'undefined' ? `${window.location.origin}/auth` : undefined;
    const authAny = supabase.auth as unknown as {
      linkIdentity?: (args: {
        provider: 'github';
        options?: {
          redirectTo?: string;
          scopes?: string;
          skipBrowserRedirect?: boolean;
          queryParams?: Record<string, string>;
        };
      }) => Promise<{ data?: { url?: string }; error: AuthError | null }>;
    };

    if (!authAny.linkIdentity) {
      throw new Error('Account linking is not supported in the current Supabase client version.');
    }

    const queryParams: Record<string, string> = { allow_signup: 'false' };

    if (userId) {
      queryParams.login = userId;
    }

    const { data, error } = await authAny.linkIdentity({
      provider: 'github',
      options: {
        redirectTo,
        scopes: OAUTH_SCOPES.github,
        skipBrowserRedirect: false,
        queryParams,
      },
    });

    if (error) {
      throw error;
    }

    if (data?.url && typeof window !== 'undefined') {
      window.location.href = data.url;
    }
  }

  async getStoredGitHubToken(_userId: string): Promise<string | null> {
    const supabase = this.supabase;
    const { data, error } = await supabase.auth.getUser();

    if (error) {
      throw error;
    }

    const token = (data.user?.app_metadata as { oauth?: { github?: { access_token?: string } } })
      ?.oauth?.github?.access_token;

    return typeof token === 'string' && token.length > 0 ? token : null;
  }

  async enrollTotp(): Promise<MfaEnrollment> {
    const supabase = this.supabase;
    const { data, error } = await supabase.auth.mfa.enroll({ factorType: 'totp' });

    if (error) {
      throw error;
    }

    if (!data || !('totp' in data) || !data.totp) {
      throw new Error('Unexpected response while enrolling TOTP factor.');
    }

    return {
      factorId: data.id,
      qrCode: data.totp.qr_code,
      secret: data.totp.secret,
      uri: data.totp.uri,
    };
  }

  async verifyTotpEnrollment(factorId: string, code: string): Promise<void> {
    const supabase = this.supabase;
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      throw challengeError;
    }

    const { error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: (challengeData as { id: string }).id,
      code,
    });

    if (verifyError) {
      throw verifyError;
    }
  }

  async challengeTotp(factorId: string, code: string): Promise<Session | null> {
    const supabase = this.supabase;
    const { data: challengeData, error: challengeError } = await supabase.auth.mfa.challenge({
      factorId,
    });

    if (challengeError) {
      throw challengeError;
    }

    const { data: verifyData, error: verifyError } = await supabase.auth.mfa.verify({
      factorId,
      challengeId: (challengeData as { id: string }).id,
      code,
    });

    if (verifyError) {
      throw verifyError;
    }

    return (verifyData as unknown as { session?: Session | null }).session ?? null;
  }

  async disableFactor(factorId: string): Promise<void> {
    const supabase = this.supabase;
    const { error } = await supabase.auth.mfa.unenroll({ factorId });

    if (error) {
      throw error;
    }
  }

  async listFactors(): Promise<Factor[]> {
    const supabase = this.supabase;
    const { data, error } = await supabase.auth.mfa.listFactors();

    if (error) {
      throw error;
    }

    const payload = data as unknown as FactorCollection;
    return payload.totp ?? payload.all ?? [];
  }

  onAuthStateChange(callback: (event: AuthChangeEvent, session: Session | null) => void) {
    const supabase = this.supabase;
    return supabase.auth.onAuthStateChange(callback);
  }

  private isMfaRequired(error: AuthError) {
    return (
      error.status === 400 &&
      (error.message?.toLowerCase?.().includes('mfa') ||
        error.message.toLowerCase() === MFA_REQUIRED_MESSAGE)
    );
  }

  private async ensureAppUser(
    user: User,
    role?: PrimaryRole,
    fallbackEmail?: string,
  ): Promise<AppUser | null> {
    const supabase = this.supabase;
    const metadataRole = user.user_metadata?.role as UserRole | undefined;
    const resolvedRole: UserRole = role ?? metadataRole ?? DEFAULT_ROLE;

    const { data, error } = await supabase.rpc('create_user_with_profile', {
      p_auth_user: user.id,
      p_email: user.email ?? fallbackEmail ?? null,
      p_role: resolvedRole,
    });

    if (error) {
      throw error;
    }

    return data as AppUser;
  }

  private async fetchAppUserByAuthId(authUserId: string): Promise<AppUser | null> {
    const supabase = this.supabase;
    const { data, error } = await supabase
      .from('users')
      .select()
      .eq('auth_user_id', authUserId)
      .maybeSingle();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    return (data as AppUser | null) ?? null;
  }

  private async fetchProfileForRole(user: AppUser): Promise<AuthProfile> {
    const supabase = this.supabase;

    if (user.role === 'client') {
      const { data, error } = await supabase
        .from('client_profiles')
        .select()
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return (data as AuthProfile) ?? null;
    }

    if (user.role === 'developer') {
      const { data, error } = await supabase
        .from('developer_profiles')
        .select()
        .eq('user_id', user.id)
        .maybeSingle();

      if (error && error.code !== 'PGRST116') {
        throw error;
      }

      return (data as AuthProfile) ?? null;
    }

    return null;
  }
}

export const authService = new AuthService();
