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
    
    // Generate source maps for production debugging
    sourcemap: true,
    
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
          
          // UI components chunk (DaisyUI is part of CSS)
          'ui': ['./src/components/RatingStars', './src/components/OptimizedImage', './src/components/TeacherModal'],
        },
        
        // Optimize chunk names - use simpler naming to avoid issues
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
    // Remove console and debugger in production
    drop: process.env.NODE_ENV === 'production' ? ['console', 'debugger'] : [],
    
    // Legal comments
    legalComments: 'none',
  },
})