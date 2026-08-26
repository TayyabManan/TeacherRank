// Import daisyui for both development and production
const plugins = [require('daisyui')];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Single professional typeface for the whole app
        sans: ['Inter Variable', 'Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        heading: ['Inter Variable', 'Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
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
        // Mobile two-bar header clearance — grows with the notch inset to
        // match the fixed header's .header-safe-top padding.
        'header-mobile': 'calc(8.5rem + env(safe-area-inset-top, 0px))',
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
        // Overlay scrim behind modals/drawers — must DIM in both themes. It gets
        // its own token because dark mode repurposes `neutral` as a LIGHT chip
        // color (#e5e7eb), so `bg-neutral/60` backdrops brightened the screen
        // in dark mode instead of dimming it. The `--scrim` RGB triple is set
        // per theme in daisyui.themes below.
        scrim: 'rgb(var(--scrim) / <alpha-value>)',
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
          "--scrim": "55 65 81", // #374151 — overlay scrim (same value backdrops used via `neutral` before the token existed, so light mode is pixel-identical)
          "--rounded-box": "0.5rem", // tighter card radius (professional)
          "--rounded-btn": "0.375rem", // tighter button radius
          "--rounded-badge": "0.375rem", // tighter badge radius
        },
      },
      {
        dark: {
          // Surfaces: a clean, near-neutral (zinc) dark scale — the professional
          // baseline (Linear/Vercel/shadcn). Surfaces stay hueless; the violet
          // brand reads only through the accent, so nothing looks muddy.
          // Elevation ladder: page (200) < card (100) < border/well (300).
          "base-100": "#1E1E22", // card / primary surface — clearly lifted
          "base-200": "#101013", // page background — deep neutral, never pure black
          "base-300": "#2E2E35", // borders, wells, hover — visible against cards
          "base-content": "#EAEAEE", // soft near-white text (not harsh pure white)
          primary: "#7C3AED", // Violet 600 — brand accent (white text passes AA)
          "primary-focus": "#6D28D9", // Violet 700 — hover state
          "primary-content": "#ffffff", // White text on primary
          secondary: "#2E2E34", // neutral raised control (View Profile)
          "secondary-focus": "#3A3A42", // Secondary hover
          "secondary-content": "#EAEAEE", // near-white text on secondary
          accent: "#A78BFA", // Violet 400 — lighter accent / links
          neutral: "#e5e7eb", // Gray 200 (light-on-dark chips/badges — unchanged)
          success: "#34d399", // Emerald 400
          warning: "#fbbf24", // Amber 400 (also the rating-star gold)
          error: "#f87171", // Red 400
          info: "#60a5fa", // Blue 400
          "--scrim": "0 0 0", // black — dims the dark UI (the light-gray `neutral` fogged it instead)
          "--rounded-box": "0.5rem", // tighter card radius (professional)
          "--rounded-btn": "0.375rem", // tighter button radius
          "--rounded-badge": "0.375rem", // tighter badge radius
        },
      },
    ],
    darkTheme: "dark"
  },
}