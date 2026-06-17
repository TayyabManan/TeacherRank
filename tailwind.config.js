// Import daisyui for both development and production
const plugins = [require('daisyui')];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Single professional typeface for the whole app
        sans: ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        heading: ['Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
      },
      // A real type scale: line-height baked in, larger steps tighten tracking
      fontSize: {
        xs: ['0.75rem', { lineHeight: '1.4' }],
        sm: ['0.875rem', { lineHeight: '1.5' }],
        base: ['1rem', { lineHeight: '1.6' }],
        lg: ['1.125rem', { lineHeight: '1.6' }],
        xl: ['1.25rem', { lineHeight: '1.4' }],
        '2xl': ['1.5rem', { lineHeight: '1.3', letterSpacing: '-0.01em' }],
        '3xl': ['1.875rem', { lineHeight: '1.25', letterSpacing: '-0.015em' }],
        '4xl': ['2.25rem', { lineHeight: '1.15', letterSpacing: '-0.02em' }],
        '5xl': ['3rem', { lineHeight: '1.1', letterSpacing: '-0.02em' }],
        '6xl': ['3.75rem', { lineHeight: '1.05', letterSpacing: '-0.025em' }],
        '7xl': ['4.5rem', { lineHeight: '1', letterSpacing: '-0.025em' }],
        '8xl': ['6rem', { lineHeight: '1', letterSpacing: '-0.03em' }],
      },
      // Semantic content-width tiers — every page maps to one of these
      maxWidth: {
        reading: '48rem',  // narrow prose: legal pages
        content: '56rem',  // single-column: forms, dashboards, FAQ
        wide: '72rem',     // card grids, tables, profiles (main app width)
        page: '80rem',     // hard ceiling applied at the app-shell level
      },
      // Named header-clearance values (replaces the pt-[8.5rem] magic number)
      spacing: {
        header: '5rem',           // desktop fixed-header clearance
        'header-mobile': '8.5rem', // mobile two-bar header clearance
      },
      animation: {
        'float': 'float 3s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite',
        'shimmer': 'shimmer 2s infinite',
        'scale-bounce': 'scaleBounce 0.6s ease-in-out',
        'fade-in-up': 'fadeInUp 0.6s ease-out',
        'spin-slow': 'spin 30s linear infinite',
        'spin-slower': 'spin 40s linear infinite',
        'spin-slowest': 'spin 50s linear infinite',
        'rotate': 'rotate 30s linear infinite',
        'rotate-slow': 'rotate 40s linear infinite',
        'rotate-slower': 'rotate 50s linear infinite',
        'rotate-reverse': 'rotate 30s linear infinite reverse',
        'rotate-slow-reverse': 'rotate 40s linear infinite reverse',
        'rotate-slower-reverse': 'rotate 50s linear infinite reverse',
      },
      keyframes: {
        rotate: {
          'from': { transform: 'rotate(0deg)' },
          'to': { transform: 'rotate(360deg)' },
        },
        float: {
          '0%': { transform: 'translateY(0px)' },
          '50%': { transform: 'translateY(-10px)' },
          '100%': { transform: 'translateY(0px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(147, 51, 234, 0.3)' },
          '50%': { boxShadow: '0 0 20px rgba(147, 51, 234, 0.6), 0 0 30px rgba(147, 51, 234, 0.4)' },
          '100%': { boxShadow: '0 0 5px rgba(147, 51, 234, 0.3)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% center' },
          '100%': { backgroundPosition: '200% center' },
        },
        scaleBounce: {
          '0%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(1.05)' },
          '100%': { transform: 'scale(1)' },
        },
        fadeInUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      borderWidth: {
        '3': '3px',
      },
      // Rating/star gold — reuses the theme-aware DaisyUI warning channel
      // (#f59e0b light / #fbbf24 dark), so it switches with the theme automatically.
      colors: {
        rating: 'hsl(var(--wa) / <alpha-value>)',
      },
      // Semantic z-index scale — single source of truth for layering.
      // Ordering: content < header < dropdown < overlay < sidebar < modal < toast < skiplink
      zIndex: {
        behind: '-10',
        content: '10',
        header: '40',
        dropdown: '50',
        overlay: '60',
        sidebar: '70',
        modal: '80',
        toast: '90',
        skiplink: '100',
      },
    },
  },
  plugins: plugins,
  daisyui: {
    themes: [
      {
        light: {
          primary: "#6D28D9", // Violet 700 — deep, professional accent
          secondary: "#E5E7EB", // Gray 200 - View Profile button color for light mode
          accent: "#7C3AED", // Violet 600
          neutral: "#374151", // Gray 700
          success: "#10b981", // Emerald 500
          warning: "#f59e0b", // Amber 500
          error: "#ef4444", // Red 500
          "base-100": "#ffffff", // White — card/surface color
          "base-200": "#f7f7f6", // Warm-neutral off-white — page background
          "base-300": "#efefee", // Slightly deeper off-white — borders/wells
          info: "#3b82f6", // Blue 500
          "primary-focus": "#5B21B6", // Violet 800 - Hover state
          "primary-content": "#ffffff", // White text on primary
          "secondary-focus": "#d1d5db", // Gray 300 - Secondary hover
          "secondary-content": "#374151", // Dark gray text on light gray button
          "--rounded-box": "0.5rem", // tighter card radius (professional)
          "--rounded-btn": "0.375rem", // tighter button radius
          "--rounded-badge": "0.375rem", // tighter badge radius
        },
      },
      {
        dark: {
          primary: "#7C3AED", // Violet 600 — readable on dark surfaces
          secondary: "#374151", // Gray 700 - View Profile button color
          accent: "#A78BFA", // Violet 400
          neutral: "#e5e7eb", // Gray 200
          success: "#34d399", // Emerald 400
          warning: "#fbbf24", // Amber 400
          error: "#f87171", // Red 400
          "base-100": "#1f2937", // Gray 800
          "base-200": "#111827", // Gray 900
          "base-300": "#374151", // Gray 700
          info: "#60a5fa", // Blue 400
          "primary-focus": "#6D28D9", // Violet 700 - Hover state
          "primary-content": "#ffffff", // White text on primary
          "secondary-focus": "#1f2937", // Gray 800 - Secondary hover
          "secondary-content": "#ffffff", // White text on secondary
          "--rounded-box": "0.5rem", // tighter card radius (professional)
          "--rounded-btn": "0.375rem", // tighter button radius
          "--rounded-badge": "0.375rem", // tighter badge radius
        },
      },
    ],
    darkTheme: "dark"
  },
}