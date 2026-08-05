import { createClient } from '@supabase/supabase-js'
import { logger } from './logger'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string

// Add better error handling and Chrome-specific configuration
if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storage: window.localStorage, // Explicitly use localStorage
    storageKey: 'teacherrank-auth', // Custom storage key
    flowType: 'pkce', // Use PKCE flow for better security
    debug: import.meta.env.DEV, // Enable debug logs in development
  },
  global: {
    headers: {
      'x-client-info': 'teacherrank@1.0.0'
    }
  },
  db: {
    schema: 'public'
  }
})

// Session recovery helper
export async function recoverSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      logger.error('Session recovery failed', error);
      return null;
    }
    
    if (session) {
      // Refresh the session if it exists
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError) {
        logger.error('Session refresh failed', refreshError);
        return session; // Return original session if refresh fails
      }
      
      return refreshedSession;
    }
    
    return null;
  } catch (error) {
    logger.error('Failed to recover session', error);
    return null;
  }
}