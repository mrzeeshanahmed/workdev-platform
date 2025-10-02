// @ts-ignore - Deno resolves remote modules at runtime.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.2';
// @ts-ignore - Deno resolves remote modules at runtime.
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

type SupportedRole = 'client' | 'developer';
type SupportedProvider = 'github' | 'google';

declare const Deno: {
  env: {
    get(key: string): string | undefined;
  };
};

const corsHeaders: HeadersInit = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RegistrationPayload {
  role?: SupportedRole;
  email?: string;
  provider?: SupportedProvider;
  providerToken?: string;
  providerRefreshToken?: string | null;
  providerUsername?: string;
  scopes?: string | null;
  expiresAt?: number | null;
}

const getClient = () => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      'Missing Supabase configuration. Ensure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set.',
    );
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
};

const parseRole = (
  payload: RegistrationPayload,
  fallback?: SupportedRole | null,
): SupportedRole => {
  if (payload.role === 'client' || payload.role === 'developer') {
    return payload.role;
  }

  if (fallback === 'client' || fallback === 'developer') {
    return fallback;
  }

  throw new Error('Invalid or missing role. Choose either "client" or "developer".');
};

const extractOAuthMetadata = (
  payload: RegistrationPayload,
): {
  provider: SupportedProvider;
  accessToken: string;
  refreshToken: string | null;
  username?: string;
  scopes: string | null;
  expiresAt: number | null;
  storedAt: string;
} | null => {
  if (!payload.provider) {
    return null;
  }

  if (payload.provider !== 'github' && payload.provider !== 'google') {
    return null;
  }

  if (!payload.providerToken) {
    return null;
  }

  return {
    provider: payload.provider,
    accessToken: payload.providerToken,
    refreshToken: payload.providerRefreshToken ?? null,
    username: payload.providerUsername,
    scopes: payload.scopes ?? null,
    expiresAt: payload.expiresAt ?? null,
    storedAt: new Date().toISOString(),
  };
};

const mergeOAuthMetadata = (
  existing: Record<string, unknown> | undefined,
  oauthPayload: ReturnType<typeof extractOAuthMetadata>,
) => {
  if (!oauthPayload) {
    return existing ?? undefined;
  }

  const existingOauth =
    typeof existing?.oauth === 'object' && existing.oauth !== null
      ? (existing.oauth as Record<string, unknown>)
      : {};

  const nextOauth = {
    ...existingOauth,
    [oauthPayload.provider]: {
      access_token: oauthPayload.accessToken,
      refresh_token: oauthPayload.refreshToken,
      scopes: oauthPayload.scopes,
      username: oauthPayload.username ?? null,
      expires_at: oauthPayload.expiresAt,
      stored_at: oauthPayload.storedAt,
    },
  };

  return {
    ...existing,
    oauth: nextOauth,
  };
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  let payload: RegistrationPayload;

  try {
    payload = await req.json();
  } catch (_error) {
    payload = {};
  }

  try {
    const authHeader = req.headers.get('Authorization');

    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized request. Missing access token.' }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        },
      );
    }

    const accessToken = authHeader.replace('Bearer ', '').trim();
    const supabase = getClient();

    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser(accessToken);

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unable to resolve the authenticated user.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const resolvedRole = parseRole(payload, user.user_metadata?.role as SupportedRole | undefined);
    const email = payload.email ?? user.email ?? undefined;
    const oauthMetadata = extractOAuthMetadata(payload);

    const updatePayload: Parameters<typeof supabase.auth.admin.updateUserById>[1] = {
      user_metadata: { ...user.user_metadata, role: resolvedRole },
    };

    const mergedAppMetadata = mergeOAuthMetadata(
      user.app_metadata as Record<string, unknown> | undefined,
      oauthMetadata,
    );

    if (mergedAppMetadata) {
      // Persist provider tokens alongside other app metadata for secure storage.
      updatePayload.app_metadata = mergedAppMetadata;
    }

    await supabase.auth.admin.updateUserById(user.id, updatePayload);

    const { data, error } = await supabase.rpc('create_user_with_profile', {
      p_auth_user: user.id,
      p_email: email ?? null,
      p_role: resolvedRole,
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message ?? 'Profile creation failed.' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    return new Response(JSON.stringify({ success: true, user: data }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error:
          error instanceof Error
            ? error.message
            : 'Unexpected error during registration finalization.',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
});
