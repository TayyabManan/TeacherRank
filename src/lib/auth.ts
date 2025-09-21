import { supabase } from './supabaseClient';
import { logger } from './logger';

// Role-based access control types
export type UserRole = 'admin' | 'moderator' | 'user';

interface UserRoleData {
  role: UserRole;
}

// LRU Cache for user roles to minimize database calls and prevent memory leaks
class LRUCache<K, V> {
  private cache = new Map<K, V>();
  private maxSize: number;

  constructor(maxSize = 100) {
    this.maxSize = maxSize;
  }

  get(key: K): V | undefined {
    const value = this.cache.get(key);
    if (value !== undefined) {
      // Move to end (most recently used)
      this.cache.delete(key);
      this.cache.set(key, value);
    }
    return value;
  }

  set(key: K, value: V): void {
    // Remove old entry if exists
    this.cache.delete(key);

    // Add to end
    this.cache.set(key, value);

    // Remove oldest if over capacity
    if (this.cache.size > this.maxSize) {
      const firstKey = this.cache.keys().next().value;
      if (firstKey !== undefined) {
        this.cache.delete(firstKey);
      }
    }
  }

  delete(key: K): boolean {
    return this.cache.delete(key);
  }

  clear(): void {
    this.cache.clear();
  }
}

const roleCache = new LRUCache<string, { roles: UserRole[], timestamp: number }>(100);
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Clear cache periodically to prevent stale data
if (typeof window !== 'undefined') {
  setInterval(() => {
    roleCache.clear();
  }, 30 * 60 * 1000); // Clear every 30 minutes
}

/**
 * Fetches the current user's roles from the database
 * Uses caching to minimize database calls
 */
export async function getCurrentUserRoles(): Promise<UserRole[]> {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return [];
    
    // Check cache first
    const cached = roleCache.get(user.id);
    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
      return cached.roles;
    }
    
    // Fetch from profiles table
    const { data, error } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    if (error) {
      logger.error('Error fetching user role', error);
      return [];
    }
    
    const role = (data as UserRoleData)?.role || 'user';
    const roles = [role] as UserRole[];
    
    // Update cache
    roleCache.set(user.id, { roles, timestamp: Date.now() });
    
    return roles;
  } catch (error) {
    logger.error('Error in getCurrentUserRoles', error);
    return [];
  }
}

/**
 * Checks if the current user has a specific role
 */
export async function hasRole(role: UserRole): Promise<boolean> {
  const roles = await getCurrentUserRoles();
  return roles.includes(role);
}

/**
 * Checks if the current user is an admin
 */
export async function isAdmin(): Promise<boolean> {
  return hasRole('admin');
}

/**
 * Checks if the current user is a moderator or admin
 */
export async function isModerator(): Promise<boolean> {
  const roles = await getCurrentUserRoles();
  return roles.includes('admin') || roles.includes('moderator');
}

/**
 * Clears the role cache for a specific user
 */
export function clearRoleCache(userId?: string): void {
  if (userId) {
    roleCache.delete(userId);
  } else {
    roleCache.clear();
  }
}

/**
 * Legacy function for backward compatibility
 * @deprecated Use isAdmin() instead
 */
export function isAdminEmail(email?: string | null): boolean {
  // This function is kept for backward compatibility but will always return false
  // All authorization should now go through the RBAC system
  logger.warn('isAdminEmail is deprecated. Use isAdmin() instead.');
  return false;
}

// Clear cache on auth state change
supabase.auth.onAuthStateChange((event) => {
  if (event === 'SIGNED_OUT') {
    roleCache.clear();
  }
});