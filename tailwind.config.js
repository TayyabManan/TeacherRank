// Import daisyui for both development and production
const plugins = [require('daisyui')];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        // Vibrant GenZ color palette
        'hot-pink': {
          50: '#fef1f9',
          100: '#fee7f3',
          200: '#fecce8',
          300: '#fda4d3',
          400: '#fb71b4',
          500: '#f43f94',
          600: '#e11d6d',
          700: '#c2185b',
          800: '#9d174d',
          900: '#ff1493', // Main hot pink
        },
        'electric': {
          50: '#f0ffff',
          100: '#ccffff',
          200: '#99ffff',
          300: '#66ffff',
          400: '#33ffff',
          500: '#00ffff', // Cyan
          600: '#00cccc',
          700: '#009999',
          800: '#006666',
          900: '#003333',
        },
        'neon': {
          green: '#39ff14',
          yellow: '#ffff00',
          orange: '#ff6b35',
          pink: '#ff1493',
          cyan: '#00d4ff',
          purple: '#8b5cf6',
        },
        'sunset': {
          50: '#fff8f0',
          100: '#ffedd6',
          200: '#ffd5a6',
          300: '#ffb366',
          400: '#ff8533',
          500: '#ff6b35', // Main sunset orange
          600: '#e55a2b',
          700: '#cc4d26',
          800: '#b8451f',
          900: '#a63d1a',
        },
        // Keep some purple for accent
        'vibe-purple': {
          500: '#8b5cf6',
          600: '#7c3aed',
          700: '#6d28d9',
        }
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
      }
    },
  },
  plugins: plugins,
  daisyui: {
    themes: [
      {
        light: {
          primary: "#9333EA", // Purple 700 - Original button color
          secondary: "#E5E7EB", // Gray 200 - View Profile button color for light mode
          accent: "#a855f7", // Purple 600
          neutral: "#374151", // Gray 700
          success: "#10b981", // Emerald 500
          warning: "#f59e0b", // Amber 500
          error: "#ef4444", // Red 500
          "base-100": "#ffffff", // Pure white
          "base-200": "#f9fafb", // Gray 50
          "base-300": "#f3f4f6", // Gray 100
          info: "#3b82f6", // Blue 500
          "primary-focus": "#7e22ce", // Purple 800 - Hover state
          "primary-content": "#ffffff", // White text on primary
          "secondary-focus": "#d1d5db", // Gray 300 - Secondary hover
          "secondary-content": "#374151", // Dark gray text on light gray button
        },
      },
      {
        dark: {
          primary: "#9333EA", // Purple 700 - Same as light mode for consistency
          secondary: "#374151", // Gray 700 - View Profile button color
          accent: "#c084fc", // Purple 400
          neutral: "#e5e7eb", // Gray 200
          success: "#34d399", // Emerald 400
          warning: "#fbbf24", // Amber 400
          error: "#f87171", // Red 400
          "base-100": "#1f2937", // Gray 800
          "base-200": "#111827", // Gray 900
          "base-300": "#374151", // Gray 700
          info: "#60a5fa", // Blue 400
          "primary-focus": "#7e22ce", // Purple 800 - Hover state
          "primary-content": "#ffffff", // White text on primary
          "secondary-focus": "#1f2937", // Gray 800 - Secondary hover
          "secondary-content": "#ffffff", // White text on secondary
        },
      },
    ],
    darkTheme: "dark"
  },
}