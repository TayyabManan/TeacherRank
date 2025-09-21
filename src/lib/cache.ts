/**
 * IndexedDB-based caching system (free Redis alternative)
 * Provides persistent caching with TTL support
 */

interface CacheEntry<T> {
  key: string
  data: T
  timestamp: number
  ttl: number
}

class CacheManager {
  private dbName = 'TeacherRankCache'
  private storeName = 'cache'
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  constructor() {
    this.initPromise = this.init()
  }

  private async init(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, 1)

      request.onerror = () => reject(request.error)
      
      request.onsuccess = () => {
        this.db = request.result
        this.cleanupExpired() // Clean expired entries on init
        resolve()
      }

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        if (!db.objectStoreNames.contains(this.storeName)) {
          const store = db.createObjectStore(this.storeName, { keyPath: 'key' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
        }
      }
    })
  }

  private async ensureInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise
    }
  }

  async set<T>(key: string, data: T, ttlSeconds: number = 300): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) throw new Error('Cache DB not initialized')

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      
      const entry: CacheEntry<T> = {
        key,
        data,
        timestamp: Date.now(),
        ttl: ttlSeconds * 1000
      }

      const request = store.put(entry)
      
      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async get<T>(key: string): Promise<T | null> {
    await this.ensureInit()
    
    if (!this.db) return null

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readonly')
      const store = transaction.objectStore(this.storeName)
      const request = store.get(key)

      request.onsuccess = () => {
        const entry = request.result as CacheEntry<T> | undefined
        
        if (!entry) {
          resolve(null)
          return
        }

        // Check if expired
        if (Date.now() - entry.timestamp > entry.ttl) {
          this.delete(key) // Async delete expired entry
          resolve(null)
          return
        }

        resolve(entry.data)
      }

      request.onerror = () => reject(request.error)
    })
  }

  async delete(key: string): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async clear(): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }

  async cleanupExpired(): Promise<void> {
    await this.ensureInit()
    
    if (!this.db) return

    return new Promise((resolve, reject) => {
      const transaction = this.db!.transaction([this.storeName], 'readwrite')
      const store = transaction.objectStore(this.storeName)
      const request = store.openCursor()
      const now = Date.now()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest).result
        
        if (cursor) {
          const entry = cursor.value as CacheEntry<any>
          
          if (now - entry.timestamp > entry.ttl) {
            cursor.delete()
          }
          
          cursor.continue()
        } else {
          resolve()
        }
      }

      request.onerror = () => reject(request.error)
    })
  }

  // Memory cache for high-frequency access
  private memCache = new Map<string, { data: any; expires: number }>()

  setMemory<T>(key: string, data: T, ttlSeconds: number = 60): void {
    this.memCache.set(key, {
      data,
      expires: Date.now() + ttlSeconds * 1000
    })
  }

  getMemory<T>(key: string): T | null {
    const entry = this.memCache.get(key)
    
    if (!entry) return null
    
    if (Date.now() > entry.expires) {
      this.memCache.delete(key)
      return null
    }
    
    return entry.data as T
  }

  clearMemory(): void {
    this.memCache.clear()
  }
}

// Singleton instance
export const cache = new CacheManager()

// React Query integration
export function createCachedQuery<TData>(
  key: string,
  fetcher: () => Promise<TData>,
  ttlSeconds: number = 300
) {
  return async (): Promise<TData> => {
    // Check memory cache first (fastest)
    const memCached = cache.getMemory<TData>(key)
    if (memCached !== null) return memCached

    // Check IndexedDB cache
    const cached = await cache.get<TData>(key)
    if (cached !== null) {
      // Populate memory cache for faster subsequent access
      cache.setMemory(key, cached, 60) // 1 minute memory cache
      return cached
    }

    // Fetch fresh data
    const data = await fetcher()
    
    // Cache in both layers
    cache.setMemory(key, data, 60)
    await cache.set(key, data, ttlSeconds)
    
    return data
  }
}

// Cleanup expired entries every 5 minutes
setInterval(() => {
  cache.cleanupExpired().catch(console.error)
}, 5 * 60 * 1000)

// Cache invalidation helper
export function invalidateCache(pattern?: string): Promise<void> {
  if (!pattern) {
    cache.clearMemory()
    return cache.clear()
  }

  // Pattern-based invalidation for memory cache
  cache.clearMemory() // Simple clear for now
  
  // For IndexedDB, we'd need to iterate through keys
  // This is a simplified version
  return Promise.resolve()
}

// Prefetch helper
export async function prefetchData<T>(
  key: string,
  fetcher: () => Promise<T>,
  ttlSeconds: number = 300
): Promise<void> {
  const data = await fetcher()
  cache.setMemory(key, data, 60)
  await cache.set(key, data, ttlSeconds)
}