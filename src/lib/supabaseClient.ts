import { createClient } from '@supabase/supabase-js'

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
  },
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Session recovery helper
export async function recoverSession() {
  try {
    const { data: { session }, error } = await supabase.auth.getSession();
    
    if (error) {
      console.error('Session recovery error:', error);
      return null;
    }
    
    if (session) {
      // Refresh the session if it exists
      const { data: { session: refreshedSession }, error: refreshError } = 
        await supabase.auth.refreshSession();
      
      if (refreshError) {
        console.error('Session refresh error:', refreshError);
        return session; // Return original session if refresh fails
      }
      
      return refreshedSession;
    }
    
    return null;
  } catch (error) {
    console.error('Failed to recover session:', error);
    return null;
  }
}