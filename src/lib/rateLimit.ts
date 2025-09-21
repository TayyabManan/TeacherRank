/**
 * Client-side rate limiting utility
 * This provides basic rate limiting for API calls to prevent abuse
 */

interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  identifier?: string;
}

interface RateLimitEntry {
  count: number;
  resetTime: number;
}

class RateLimiter {
  private limits: Map<string, RateLimitEntry> = new Map();
  
  /**
   * Check if a request is allowed based on rate limits
   * @param key - Unique identifier for the rate limit (e.g., 'createRating', 'updateTeacher')
   * @param config - Rate limit configuration
   * @returns true if request is allowed, false if rate limited
   */
  public isAllowed(key: string, config: RateLimitConfig): boolean {
    const now = Date.now();
    const limitKey = config.identifier ? `${key}:${config.identifier}` : key;
    const entry = this.limits.get(limitKey);
    
    // If no entry exists or window has expired, create new entry
    if (!entry || now > entry.resetTime) {
      this.limits.set(limitKey, {
        count: 1,
        resetTime: now + config.windowMs
      });
      return true;
    }
    
    // If within limit, increment and allow
    if (entry.count < config.maxRequests) {
      entry.count++;
      return true;
    }
    
    // Rate limit exceeded
    return false;
  }
  
  /**
   * Get remaining requests for a given key
   */
  public getRemaining(key: string, config: RateLimitConfig): number {
    const now = Date.now();
    const limitKey = config.identifier ? `${key}:${config.identifier}` : key;
    const entry = this.limits.get(limitKey);
    
    if (!entry || now > entry.resetTime) {
      return config.maxRequests;
    }
    
    return Math.max(0, config.maxRequests - entry.count);
  }
  
  /**
   * Get time until rate limit resets (in milliseconds)
   */
  public getResetTime(key: string, config: RateLimitConfig): number {
    const now = Date.now();
    const limitKey = config.identifier ? `${key}:${config.identifier}` : key;
    const entry = this.limits.get(limitKey);
    
    if (!entry || now > entry.resetTime) {
      return 0;
    }
    
    return entry.resetTime - now;
  }
  
  /**
   * Clear rate limit for a specific key
   */
  public clear(key: string, identifier?: string): void {
    const limitKey = identifier ? `${key}:${identifier}` : key;
    this.limits.delete(limitKey);
  }
  
  /**
   * Clear all rate limits
   */
  public clearAll(): void {
    this.limits.clear();
  }
  
  /**
   * Clean up expired entries to prevent memory leaks
   */
  public cleanup(): void {
    const now = Date.now();
    for (const [key, entry] of this.limits.entries()) {
      if (now > entry.resetTime) {
        this.limits.delete(key);
      }
    }
  }
}

// Create singleton instance
export const rateLimiter = new RateLimiter();

// Clean up expired entries every minute
setInterval(() => {
  rateLimiter.cleanup();
}, 60000);

// Rate limit configurations for different operations
export const RATE_LIMITS = {
  // Ratings: 5 ratings per minute per user
  createRating: {
    maxRequests: 5,
    windowMs: 60 * 1000, // 1 minute
  },
  updateRating: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  deleteRating: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  
  // Teacher management: stricter limits
  createTeacher: {
    maxRequests: 10,
    windowMs: 60 * 1000,
  },
  updateTeacher: {
    maxRequests: 20,
    windowMs: 60 * 1000,
  },
  deleteTeacher: {
    maxRequests: 5,
    windowMs: 60 * 1000,
  },
  
  // Authentication: prevent brute force
  signIn: {
    maxRequests: 5,
    windowMs: 15 * 60 * 1000, // 15 minutes
  },
  signUp: {
    maxRequests: 3,
    windowMs: 60 * 60 * 1000, // 1 hour
  },
  
  // Search: prevent excessive queries
  search: {
    maxRequests: 30,
    windowMs: 60 * 1000,
  },
} as const;

/**
 * Rate limit decorator for async functions
 */
export function withRateLimit<T extends (...args: any[]) => Promise<any>>(
  fn: T,
  limitKey: keyof typeof RATE_LIMITS,
  getIdentifier?: (...args: Parameters<T>) => string | Promise<string>
): T {
  return (async (...args: Parameters<T>) => {
    const config = RATE_LIMITS[limitKey];
    const identifier = getIdentifier ? await Promise.resolve(getIdentifier(...args)) : undefined;
    
    if (!rateLimiter.isAllowed(limitKey, { ...config, identifier })) {
      const resetTime = rateLimiter.getResetTime(limitKey, { ...config, identifier });
      const minutes = Math.ceil(resetTime / 60000);
      throw new Error(
        `Rate limit exceeded. Please try again in ${minutes} minute${minutes > 1 ? 's' : ''}.`
      );
    }
    
    return fn(...args);
  }) as T;
}

/**
 * React hook for rate limiting
 */
export function useRateLimit(limitKey: keyof typeof RATE_LIMITS, identifier?: string) {
  const config = RATE_LIMITS[limitKey];
  
  const checkLimit = (): boolean => {
    return rateLimiter.isAllowed(limitKey, { ...config, identifier });
  };
  
  const getRemaining = (): number => {
    return rateLimiter.getRemaining(limitKey, { ...config, identifier });
  };
  
  const getResetTime = (): number => {
    return rateLimiter.getResetTime(limitKey, { ...config, identifier });
  };
  
  return {
    checkLimit,
    getRemaining,
    getResetTime,
  };
}