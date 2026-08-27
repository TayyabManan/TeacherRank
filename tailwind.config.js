// Import daisyui for both development and production
const plugins = [require('daisyui')];

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        // Inter carries all UI/body duty
        sans: ['Inter Variable', 'Inter', 'Inter Fallback', 'system-ui', 'sans-serif'],
        // Display serif for h1s / section headings / big stat numerals ONLY
        // (identity face; see the Newsreader block in styles.css). Frank Ruhl
        // Libre supplies the Hebrew glyphs for bilingual teacher names.
        display: ['Newsreader', '"Frank Ruhl Libre"', '"Newsreader Fallback"', 'Georgia', 'serif'],
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
      // Elevation: layered, theme-tinted shadows replacing Tailwind's stock
      // black-alpha singles. `--shadow-rgb` is set per theme in daisyui.themes
      // below (deep violet in light, black in dark — dark mode separation is
      // carried by borders, so its shadows stay subliminal). Layers double in
      // offset/blur (one light source, straight above) per the layered-shadow
      // craft rule; keep using shadow-sm/md/lg — they now resolve to these.
      boxShadow: {
        sm: '0 1px 2px rgb(var(--shadow-rgb) / 0.06), 0 2px 6px -1px rgb(var(--shadow-rgb) / 0.05)',
        DEFAULT: '0 1px 2px rgb(var(--shadow-rgb) / 0.06), 0 2px 6px -1px rgb(var(--shadow-rgb) / 0.05)',
        md: '0 1px 2px rgb(var(--shadow-rgb) / 0.06), 0 4px 8px -2px rgb(var(--shadow-rgb) / 0.06), 0 10px 20px -4px rgb(var(--shadow-rgb) / 0.06)',
        lg: '0 2px 4px rgb(var(--shadow-rgb) / 0.06), 0 8px 16px -4px rgb(var(--shadow-rgb) / 0.07), 0 20px 40px -8px rgb(var(--shadow-rgb) / 0.09)',
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
          // Neutrals carry a barely-there violet bias (temperature-tinted, not
          // gray-out-of-the-box) so surfaces, ink and the brand accent read as
          // one chosen system. Bias stays ≤2–3 points of hue — never "purple".
          primary: "#6D28D9", // Violet 700 — deep, professional accent
          secondary: "#E9E7EF", // violet-gray raised control (View profile)
          accent: "#7C3AED", // Violet 600
          neutral: "#3B3647", // violet-gray 700 — chips/labels
          success: "#10b981", // Emerald 500
          warning: "#f59e0b", // Amber 500
          error: "#ef4444", // Red 500
          "base-100": "#ffffff", // White — card/surface color
          "base-200": "#F8F7FA", // violet-tinted off-white — page background
          "base-300": "#EDEBF2", // slightly deeper — borders/wells
          "base-content": "#221F2C", // violet-black ink (was derived near-black)
          info: "#3b82f6", // Blue 500
          "primary-focus": "#5B21B6", // Violet 800 - Hover state
          "primary-content": "#ffffff", // White text on primary
          "secondary-focus": "#DBD8E4", // Secondary hover
          "secondary-content": "#3A3547", // ink on the light violet-gray button
          "--scrim": "55 65 81", // #374151 — overlay scrim (same value backdrops used via `neutral` before the token existed, so light mode is pixel-identical)
          "--shadow-rgb": "46 16 101", // violet-950 — tint for the elevation shadows (theme.extend.boxShadow); black shadows gray a design out
          "--btn-text-case": "none", // sentence-case buttons — DaisyUI v3's uppercase default reads dated
          "--rounded-box": "0.5rem", // tighter card radius (professional)
          "--rounded-btn": "0.375rem", // tighter button radius
          "--rounded-badge": "0.375rem", // tighter badge radius
        },
      },
      {
        dark: {
          // Surfaces: a violet-biased near-neutral dark scale — same elevation
          // ladder as before (page 200 < card 100 < border/well 300), but the
          // neutrals now share the brand's temperature (≤2–3 points of hue —
          // chosen-looking, never muddy-purple).
          "base-100": "#201E27", // card / primary surface — clearly lifted
          "base-200": "#131118", // page background — deep, never pure black
          "base-300": "#332F3D", // borders, wells, hover — visible against cards
          "base-content": "#ECEAF2", // soft near-white ink (not harsh pure white)
          primary: "#7C3AED", // Violet 600 — brand accent (white text passes AA)
          "primary-focus": "#6D28D9", // Violet 700 — hover state
          "primary-content": "#ffffff", // White text on primary
          secondary: "#322E3C", // raised control (View profile)
          "secondary-focus": "#3E3949", // Secondary hover
          "secondary-content": "#ECEAF2", // near-white text on secondary
          accent: "#A78BFA", // Violet 400 — lighter accent / links
          neutral: "#E7E5EE", // light-on-dark chips/badges (violet-tinted)
          success: "#34d399", // Emerald 400
          warning: "#fbbf24", // Amber 400 (also the rating-star gold)
          error: "#f87171", // Red 400
          info: "#60a5fa", // Blue 400
          "--scrim": "0 0 0", // black — dims the dark UI (the light-gray `neutral` fogged it instead)
          "--shadow-rgb": "0 0 0", // shadows are subliminal on dark ground — borders carry separation (elevation ladder above)
          "--btn-text-case": "none", // sentence-case buttons — DaisyUI v3's uppercase default reads dated
          "--rounded-box": "0.5rem", // tighter card radius (professional)
          "--rounded-btn": "0.375rem", // tighter button radius
          "--rounded-badge": "0.375rem", // tighter badge radius
        },
      },
    ],
    darkTheme: "dark"
  },
}