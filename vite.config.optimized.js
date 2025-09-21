import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { visualizer } from 'rollup-plugin-visualizer'

export default defineConfig({
  plugins: [
    react(),
    // Bundle analyzer - uncomment to analyze bundle
    // visualizer({ open: true })
  ],
  
  build: {
    // Optimize build output
    target: 'es2015',
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true,
        pure_funcs: ['console.log', 'console.info'],
      },
    },
    
    // Code splitting configuration
    rollupOptions: {
      output: {
        // Manual chunks for better code splitting
        manualChunks: {
          // React and core libraries
          'react-vendor': ['react', 'react-dom', 'react-router-dom'],
          // Supabase and data fetching
          'data-vendor': ['@supabase/supabase-js', '@tanstack/react-query'],
          // Form and validation
          'form-vendor': ['react-hook-form', '@hookform/resolvers', 'zod'],
          // UI utilities
          'ui-vendor': ['daisyui'],
        },
        
        // Better chunk naming
        chunkFileNames: (chunkInfo) => {
          const facadeModuleId = chunkInfo.facadeModuleId ? chunkInfo.facadeModuleId.split('/').pop() : 'chunk';
          return `assets/js/${facadeModuleId}-[hash].js`;
        },
        
        // Asset file naming
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash][extname]`;
          }
          if (/woff|woff2|eot|ttf|otf/i.test(ext)) {
            return `assets/fonts/[name]-[hash][extname]`;
          }
          return `assets/[name]-[hash][extname]`;
        },
      },
    },
    
    // Chunk size warnings
    chunkSizeWarningLimit: 1000, // 1MB warning threshold
    
    // Source maps for production debugging (optional)
    sourcemap: false,
    
    // Report compressed size
    reportCompressedSize: true,
  },
  
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react',
      'react-dom',
      'react-router-dom',
      '@supabase/supabase-js',
      '@tanstack/react-query',
    ],
    exclude: ['@tanstack/react-query-devtools'],
  },
  
  // Server configuration
  server: {
    // Enable HMR
    hmr: true,
    
    // Pre-transform known heavy dependencies
    warmup: {
      clientFiles: [
        './src/App.tsx',
        './src/components/TeacherListing.tsx',
        './src/lib/supabaseClient.ts',
      ],
    },
  },
  
  // Preview configuration
  preview: {
    headers: {
      // Security headers
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block',
      
      // Cache headers for static assets
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  },
})