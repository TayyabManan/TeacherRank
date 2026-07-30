import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { compression } from 'vite-plugin-compression2'

export default defineConfig({
  plugins: [
    react(),
    // Add gzip and brotli compression for better performance
    compression({
      algorithm: 'gzip',
      threshold: 10240,
    }),
    compression({
      algorithm: 'brotliCompress',
      threshold: 10240,
    }),
  ],
  
  // Build optimizations
  build: {
    // Enable minification using esbuild (faster than terser)
    minify: 'esbuild',
    
    // Target modern browsers for smaller bundle
    target: 'es2020',
    
    // No public source maps: they ship the full source to production.
    // (Sentry events still carry component stacks via the ErrorBoundary.)
    sourcemap: false,
    
    // Rollup specific options
    rollupOptions: {
      output: {
        // Manual chunking for better caching
        manualChunks: {
          // React vendor chunk
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          
          // Supabase vendor chunk
          'supabase': ['@supabase/supabase-js'],
          
          // Form handling chunk
          'forms': ['react-hook-form', '@hookform/resolvers', 'zod'],
          
          // Query/state management chunk
          'query': ['@tanstack/react-query'],
          
          // Virtual scrolling
          'virtual': ['@tanstack/react-virtual'],
          
          // SEO chunk
          'seo': ['react-helmet-async'],

          // Sentry is reached only by the dynamic import in src/lib/sentry.ts,
          // so this chunk stays async — it is named here purely so it is
          // identifiable in the build output (otherwise it ships as
          // `index-<hash>.js`, after the package's own entry filename, and is
          // indistinguishable from the app entry). Measured: naming it here has
          // no effect on its size. What does affect size is destructuring the
          // dynamic import in sentry.ts rather than holding the namespace —
          // that's what lets Rollup tree-shake it (43 kB gzip vs 128 kB).
          'sentry': ['@sentry/react'],

          // NOTE: there used to be a 'ui' chunk pinning
          // ['./src/components/RatingStars', './src/components/TeacherModal'].
          // Two problems: it hardcoded source paths (renaming either file broke
          // the build), and it grouped a lazily-imported module (TeacherModal)
          // with an eagerly-used one (RatingStars) — which drags TeacherModal
          // back into the listing route's eager graph and silently defeats the
          // lazy boundary in TeacherListing.tsx. App-code chunking is left to
          // Rollup; manualChunks here is for vendor packages only.
        },

        // `[name]` is Rollup's chunk name: the manualChunks key for vendor
        // chunks ('react-vendor', 'sentry', …) and the module basename for
        // route/component facades. This replaced a function that derived the
        // name from facadeModuleId and fell back to the literal string 'chunk'
        // — which discarded every vendor chunk name (all seven shipped as
        // `chunk-<hash>.js`, so bundle regressions were invisible) and, for
        // dynamically imported packages, produced the package's entry filename
        // instead of its chunk name (Sentry landed as `index.js-<hash>.js`).
        chunkFileNames: 'assets/js/[name]-[hash].js',

        // Optimize entry file names
        entryFileNames: 'assets/js/[name]-[hash].js',
        
        // Optimize asset file names
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          } else if (/woff|woff2|ttf|otf|eot/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 200,
    
    // Enable CSS code splitting
    cssCodeSplit: true,
    
    // Preload optimization
    modulePreload: {
      polyfill: true,
    },
  },
  
  // Server optimizations
  server: {
    // Enable CORS for development
    cors: true,
    
    // Warmup frequently used files
    warmup: {
      clientFiles: [
        './src/components/TeacherListing.tsx',
        './src/App.tsx',
        './src/main.tsx',
      ],
    },
  },
  
  // Optimization options
  optimizeDeps: {
    // Pre-bundle these dependencies
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
      '@tanstack/react-virtual',
    ],
    
    // Exclude these from pre-bundling
    exclude: [],
  },
  
  // Enable caching
  cacheDir: 'node_modules/.vite',
  
  // Performance optimizations
  esbuild: {
    // No `drop: ['console']` here. The line that used to sit in this spot was
    // gated on `process.env.NODE_ENV === 'production'`, which is not set when
    // this config module is evaluated — so it never fired (verified: console
    // calls survive in dist/). Rather than switch it on, it's removed: app
    // logging already self-guards via src/lib/logger.ts (WARN level outside
    // DEV), and the few remaining direct console.error calls — env validation
    // in main.tsx and supabaseClient.ts — are deliberate production
    // diagnostics that should not be stripped.

    // Legal comments
    legalComments: 'none',
  },
})