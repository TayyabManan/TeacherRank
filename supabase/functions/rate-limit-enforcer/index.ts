// Supabase Edge Function: Server-Side Rate Limiting
// Security Fix: Enforce rate limits server-side to prevent bypass via client manipulation

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Rate limit configurations (requests per minute)
const RATE_LIMITS = {
  createRating: { limit: 5, window: 60 },
  updateRating: { limit: 10, window: 60 },
  deleteRating: { limit: 5, window: 60 },
  createTeacher: { limit: 10, window: 60 },
  updateTeacher: { limit: 20, window: 60 },
  deleteTeacher: { limit: 5, window: 60 },
  signIn: { limit: 5, window: 900 }, // 15 minutes
  signUp: { limit: 3, window: 3600 }, // 1 hour
  search: { limit: 30, window: 60 },
  feedback: { limit: 5, window: 300 }, // 5 minutes
}

interface RateLimitRequest {
  action: keyof typeof RATE_LIMITS
  identifier?: string
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Parse request body
    const { action, identifier }: RateLimitRequest = await req.json()

    if (!action || !RATE_LIMITS[action]) {
      return new Response(
        JSON.stringify({ error: 'Invalid action specified' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user from authorization header
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    })

    // Get user ID from token
    const { data: { user }, error: authError } = await supabase.auth.getUser(
      authHeader.replace('Bearer ', '')
    )

    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Invalid authorization' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create rate limit key
    const userId = identifier || user.id
    const rateLimitKey = `${action}:${userId}`
    const config = RATE_LIMITS[action]

    // Check rate limit using database (could also use Redis)
    const { data: rateLimitEntry, error: fetchError } = await supabase
      .from('rate_limits')
      .select('*')
      .eq('key', rateLimitKey)
      .single()

    const now = Date.now()

    if (fetchError && fetchError.code !== 'PGRST116') {
      // Error other than "not found"
      console.error('Rate limit check error:', fetchError)
      // Fail open - allow request if rate limit check fails
      return new Response(
        JSON.stringify({ allowed: true }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!rateLimitEntry || now > rateLimitEntry.reset_time) {
      // No entry or expired - create new one
      await supabase
        .from('rate_limits')
        .upsert({
          key: rateLimitKey,
          count: 1,
          reset_time: now + (config.window * 1000),
          user_id: user.id,
          action: action,
        })

      return new Response(
        JSON.stringify({
          allowed: true,
          remaining: config.limit - 1,
          resetTime: now + (config.window * 1000),
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Entry exists and is valid
    if (rateLimitEntry.count < config.limit) {
      // Increment count
      await supabase
        .from('rate_limits')
        .update({ count: rateLimitEntry.count + 1 })
        .eq('key', rateLimitKey)

      return new Response(
        JSON.stringify({
          allowed: true,
          remaining: config.limit - rateLimitEntry.count - 1,
          resetTime: rateLimitEntry.reset_time,
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Rate limit exceeded
    const resetIn = Math.ceil((rateLimitEntry.reset_time - now) / 1000)
    return new Response(
      JSON.stringify({
        allowed: false,
        error: `Rate limit exceeded. Try again in ${resetIn} seconds.`,
        resetTime: rateLimitEntry.reset_time,
        remaining: 0,
      }),
      { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('Rate limit function error:', error)
    // Fail open - allow request if function has error
    return new Response(
      JSON.stringify({ error: 'Internal server error', allowed: true }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})

/*
  To deploy this function:

  1. Create the rate_limits table:

  CREATE TABLE IF NOT EXISTS rate_limits (
    key TEXT PRIMARY KEY,
    count INTEGER NOT NULL DEFAULT 0,
    reset_time BIGINT NOT NULL,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
    action TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  CREATE INDEX idx_rate_limits_user_id ON rate_limits(user_id);
  CREATE INDEX idx_rate_limits_reset_time ON rate_limits(reset_time);

  -- Clean up expired entries periodically
  CREATE OR REPLACE FUNCTION cleanup_rate_limits()
  RETURNS void AS $$
  BEGIN
    DELETE FROM rate_limits WHERE reset_time < EXTRACT(EPOCH FROM NOW()) * 1000;
  END;
  $$ LANGUAGE plpgsql;

  2. Deploy the function:
  supabase functions deploy rate-limit-enforcer

  3. Use it in your application:

  const checkRateLimit = async (action: string) => {
    const response = await fetch(
      `${SUPABASE_URL}/functions/v1/rate-limit-enforcer`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ action })
      }
    );

    const result = await response.json();
    if (!result.allowed) {
      throw new Error(result.error);
    }
    return result;
  };
*/
