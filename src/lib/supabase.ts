import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!supabaseUrl || !supabasePublishableKey) {
  throw new Error('Missing Supabase URL or publishable key. Check .env.local.');
}

export const supabase = createClient(supabaseUrl, supabasePublishableKey, {
  auth: {
    ...(typeof window === 'undefined' ? {} : { storage: window.localStorage }),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
