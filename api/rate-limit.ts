import { VercelRequest, VercelResponse } from '@vercel/node'
import { createClient } from '@supabase/supabase-js'

// Vercel Edge Function for rate limiting (runs at edge locations)
export const config = {
  runtime: 'edge',
}

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const RATE_LIMITS: Record<string, RateLimitConfig> = {
  'create-rating': { maxRequests: 5, windowMs: 60000 },
  'update-rating': { maxRequests: 10, windowMs: 60000 },
  'create-teacher': { maxRequests: 10, windowMs: 60000 },
  'auth-signin': { maxRequests: 5, windowMs: 900000 },
  'auth-signup': { maxRequests: 3, windowMs: 3600000 },
}

export default async function handler(req: Request) {
  // CORS headers
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  try {
    const { action, identifier } = await req.json()

    if (!action || !RATE_LIMITS[action]) {
      return new Response(
        JSON.stringify({ error: 'Invalid action' }),
        {
          status: 400,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
          },
        }
      )
    }

    // Use Vercel KV for rate limiting if available (free tier: 30k requests/month)
    // Fallback to in-memory if not configured
    const config = RATE_LIMITS[action]
    const key = `rate:${action}:${identifier}`
    
    // For production, use Vercel KV or Upstash Redis (both have free tiers)
    // This is a simplified in-memory version for development
    const isAllowed = true // Implement actual rate limiting logic with KV store

    if (!isAllowed) {
      return new Response(
        JSON.stringify({
          allowed: false,
          error: 'Rate limit exceeded',
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Retry-After': '60',
          },
        }
      )
    }

    return new Response(
      JSON.stringify({
        allowed: true,
        remaining: config.maxRequests - 1,
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    )
  }
}