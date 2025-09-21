import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'create-rating': { maxRequests: 5, windowMs: 60000 }, // 5 per minute
  'update-rating': { maxRequests: 10, windowMs: 60000 },
  'create-teacher': { maxRequests: 10, windowMs: 60000 },
  'auth-signin': { maxRequests: 5, windowMs: 900000 }, // 5 per 15 minutes
  'auth-signup': { maxRequests: 3, windowMs: 3600000 }, // 3 per hour
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, identifier } = await req.json()
    
    if (!action || !RATE_LIMITS[action]) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const config = RATE_LIMITS[action]
    const now = Date.now()
    const windowStart = now - config.windowMs
    const key = `${action}:${identifier}`

    // Get recent requests
    const { data: recentRequests, error: fetchError } = await supabaseClient
      .from('rate_limit_logs')
      .select('timestamp')
      .eq('key', key)
      .gte('timestamp', new Date(windowStart).toISOString())

    if (fetchError) {
      console.error('Rate limit fetch error:', fetchError)
      // Fail open - allow request if we can't check
      return new Response(
        JSON.stringify({ allowed: true, remaining: config.maxRequests }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const requestCount = recentRequests?.length || 0

    if (requestCount >= config.maxRequests) {
      const oldestRequest = recentRequests?.[0]?.timestamp
      const resetTime = oldestRequest 
        ? new Date(oldestRequest).getTime() + config.windowMs
        : now + config.windowMs

      return new Response(
        JSON.stringify({ 
          allowed: false, 
          remaining: 0,
          resetAt: new Date(resetTime).toISOString(),
          retryAfter: Math.ceil((resetTime - now) / 1000)
        }),
        { 
          headers: { 
            ...corsHeaders, 
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': new Date(resetTime).toISOString(),
            'Retry-After': Math.ceil((resetTime - now) / 1000).toString()
          }, 
          status: 429 
        }
      )
    }

    // Log this request
    await supabaseClient
      .from('rate_limit_logs')
      .insert({ key, timestamp: new Date().toISOString() })

    // Clean old entries (async, don't wait)
    supabaseClient
      .from('rate_limit_logs')
      .delete()
      .lt('timestamp', new Date(windowStart).toISOString())
      .then(() => console.log('Cleaned old rate limit entries'))
      .catch((err) => console.error('Cleanup error:', err))

    return new Response(
      JSON.stringify({ 
        allowed: true, 
        remaining: config.maxRequests - requestCount - 1,
        limit: config.maxRequests
      }),
      { 
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'X-RateLimit-Limit': config.maxRequests.toString(),
          'X-RateLimit-Remaining': (config.maxRequests - requestCount - 1).toString()
        } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    )
  }
})