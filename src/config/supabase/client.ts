import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL;
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY;

let client: SupabaseClient | null = null;

if (!supabaseUrl || !supabaseAnonKey) {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('Supabase environment configuration is incomplete.');
  }
} else {
  client = createClient(supabaseUrl, supabaseAnonKey);
}

export const supabaseClient = client;
