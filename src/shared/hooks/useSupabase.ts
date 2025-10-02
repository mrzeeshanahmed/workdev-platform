import { useMemo } from 'react';
import { supabaseClient } from 'config/supabase/client';

export const useSupabase = () => {
  return useMemo(() => {
    if (!supabaseClient) {
      throw new Error('Supabase client is not initialized. Check your environment variables.');
    }

    return supabaseClient;
  }, []);
};
