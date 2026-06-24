const CACHE_NAME = 'teacherrank-v3' // Increment version to force cache update
const urlsToCache = [
  '/',
  '/index.html',
  '/offline.html'
]

// Install event - cache essential files
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => cache.addAll(urlsToCache))
      .then(() => self.skipWaiting())
  )
})

// Activate event - clean up old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames
          .filter(name => name !== CACHE_NAME)
          .map(name => caches.delete(name))
      )
    }).then(() => self.clients.claim())
  )
})

// Fetch event - serve from cache when possible
self.addEventListener('fetch', event => {
  const { request } = event
  const url = new URL(request.url)

  // Skip non-GET requests
  if (request.method !== 'GET') return

  // Skip API calls (let them go through network)
  if (url.pathname.startsWith('/api/') || url.hostname.includes('supabase')) {
    return
  }

  // For JS chunk files, always try network first to get latest version
  if (url.pathname.includes('/assets/js/') && url.pathname.endsWith('.js')) {
    event.respondWith(
      fetch(request)
        .then(response => {
          // Update cache with new version
          const responseToCache = response.clone()
          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, responseToCache)
          })
          return response
        })
        .catch(() => {
          // If network fails, try cache
          return caches.match(request).then(response => {
            return response || new Response('Chunk not available', { status: 404 })
          })
        })
    )
    return
  }

  // For navigations / HTML, go NETWORK-FIRST so a normal load always gets the
  // current app shell (and the fresh hashed CSS/JS it references) instead of a
  // stale cached copy. Fall back to cache, then the offline page, when offline.
  const isHtml = request.mode === 'navigate' ||
    (request.headers.get('accept') || '').includes('text/html')
  if (isHtml) {
    event.respondWith(
      fetch(request)
        .then(response => {
          if (response && response.ok) {
            const responseToCache = response.clone()
            caches.open(CACHE_NAME).then(cache => cache.put(request, responseToCache))
          }
          return response
        })
        .catch(() => caches.match(request).then(cached => cached || caches.match('/offline.html')))
    )
    return
  }

  // Everything else (hashed css/js/img/font assets) stays cache-first — those
  // filenames are content-hashed, so a cache hit is always the right version.
  event.respondWith(
    caches.match(request)
      .then(response => {
        // Cache hit - return response
        if (response) {
          return response
        }

        // No cache - fetch from network
        return fetch(request)
          .then(response => {
            // Don't cache non-successful responses
            if (!response || response.status !== 200 || response.type !== 'basic') {
              return response
            }
            
            // Cache successful responses for static assets
            if (shouldCache(request)) {
              const responseToCache = response.clone()
              caches.open(CACHE_NAME).then(cache => {
                cache.put(request, responseToCache)
              })
            }
            
            return response
          })
          .catch(() => {
            // Network failed, serve offline page for navigation requests
            if (request.mode === 'navigate') {
              return caches.match('/offline.html')
            }
          })
      })
  )
})

// Helper function to determine if request should be cached
function shouldCache(request) {
  const url = new URL(request.url)
  const pathname = url.pathname
  
  // Cache static assets
  return pathname.endsWith('.js') ||
         pathname.endsWith('.css') ||
         pathname.endsWith('.png') ||
         pathname.endsWith('.jpg') ||
         pathname.endsWith('.jpeg') ||
         pathname.endsWith('.svg') ||
         pathname.endsWith('.woff') ||
         pathname.endsWith('.woff2') ||
         pathname.endsWith('.ttf')
}

// Background sync for offline actions
self.addEventListener('sync', event => {
  if (event.tag === 'sync-ratings') {
    event.waitUntil(syncOfflineRatings())
  }
})

async function syncOfflineRatings() {
  // Get pending ratings from IndexedDB
  const pending = await getPendingRatings()
  
  for (const rating of pending) {
    try {
      // Attempt to submit rating
      const response = await fetch('/api/ratings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(rating)
      })
      
      if (response.ok) {
        // Remove from pending queue
        await removePendingRating(rating.id)
      }
    } catch (error) {
      console.error('Failed to sync rating:', error)
    }
  }
}

// Stub functions for IndexedDB operations
async function getPendingRatings() {
  // Implement IndexedDB read
  return []
}

async function removePendingRating(id) {
  // Implement IndexedDB delete
}