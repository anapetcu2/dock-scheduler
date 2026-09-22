/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        // Body copy uses the terminal-style monospace font; Rubik (sans) is reserved
        // for titles/headings — see the `h1`-`h6` rule in index.css.
        sans: ['"Rubik"', "ui-sans-serif", "system-ui", "-apple-system", "sans-serif"],
        mono: ['"IBM Plex Mono"', "ui-monospace", "SFMono-Regular", "monospace"],
      },
      colors: {
        // Light theme: white / light-gray / light-blue scale for page & panel backgrounds
        // and borders. Numbering keeps its old role (900 = page, 800/850 = card, 700 = border,
        // 600 = hover border, 500 = strongest border) but the ramp now runs light -> darker
        // instead of dark -> lighter, since it's backing a light page.
        surface: {
          950: "#0b1220", // only used for the modal scrim; deliberately stays dark
          900: "#eef1fa", // page background — light blue
          850: "#ffffff", // elevated panels (hero, dialogs)
          800: "#f8f9fd", // default card / table background
          700: "#dde1f0", // borders
          600: "#c7cce3", // hover borders
          500: "#a9aecf", // strongest borders / muted icons
        },
        // Primary accent, drawn from the reference palette's periwinkle family. The
        // lighter swatches (300/500/600) back fills, tints and borders; 400/700 are a
        // deeper shade of the same hue so link/icon text stays legible on a light page.
        brand: {
          300: "#7c87c9",
          400: "#6b73b8",
          500: "#98a1ef",
          600: "#8189d6",
          700: "#5b63a3",
        },
        vessel: "#abb9f2",
        event: "#92e0e2",
        closure: "#a0c5d4",
        // The app uses Tailwind's built-in `slate` scale for body text throughout
        // (text-slate-100..600), written against a dark page. Overriding those exact
        // keys here — rather than touching every call site — flips them to dark-on-light
        // text while keeping the same "lower number = higher emphasis" usage pattern.
        slate: {
          100: "#111827",
          200: "#1f2a3c",
          300: "#3a4759",
          400: "#5b6b82",
          500: "#7c8aa0",
          600: "#94a1b5",
        },
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(129,137,214,0.25), 0 8px 20px -8px rgba(129,137,214,0.35)",
        panel: "0 1px 2px rgba(15,23,42,0.06), 0 12px 28px -14px rgba(15,23,42,0.18)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #98a1ef 0%, #8189d6 45%, #5b63a3 100%)",
        "surface-gradient": "linear-gradient(180deg, #ffffff 0%, #eef1fa 100%)",
      },
      keyframes: {
        "slide-in-right": {
          from: { transform: "translateX(100%)" },
          to: { transform: "translateX(0)" },
        },
        "fade-in": {
          from: { opacity: 0 },
          to: { opacity: 1 },
        },
        "fade-in-up": {
          from: { opacity: 0, transform: "translateY(6px)" },
          to: { opacity: 1, transform: "translateY(0)" },
        },
        float: {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(-18px) translateX(8px)" },
        },
        "float-slow": {
          "0%, 100%": { transform: "translateY(0) translateX(0)" },
          "50%": { transform: "translateY(14px) translateX(-10px)" },
        },
        "gradient-x": {
          "0%, 100%": { backgroundPosition: "0% 50%" },
          "50%": { backgroundPosition: "100% 50%" },
        },
        "pulse-glow": {
          "0%, 100%": { opacity: 0.6, transform: "scale(1)" },
          "50%": { opacity: 1, transform: "scale(1.05)" },
        },
        // The translate(-50%,-50%) is baked in here (rather than left to a
        // separate Tailwind translate utility class) because a running CSS
        // animation replaces the whole `transform` value at each keyframe —
        // it doesn't merge with a class's own transform, so centering set
        // any other way would visibly snap away the moment this starts.
        "ripple-core": {
          "0%": { transform: "translate(-50%, -50%) scale(0)", opacity: 0.9 },
          "100%": { transform: "translate(-50%, -50%) scale(9)", opacity: 0 },
        },
        "ripple-ring": {
          "0%": { transform: "translate(-50%, -50%) scale(0.5)", opacity: 0.7 },
          "60%": { opacity: 0.35 },
          "100%": { transform: "translate(-50%, -50%) scale(11)", opacity: 0 },
        },
      },
      animation: {
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        float: "float 9s ease-in-out infinite",
        "float-slow": "float-slow 13s ease-in-out infinite",
        "gradient-x": "gradient-x 6s ease infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "ripple-core": "ripple-core 0.6s cubic-bezier(0.2, 0.6, 0.3, 1) forwards",
        "ripple-ring": "ripple-ring 1.2s cubic-bezier(0.2, 0.6, 0.3, 1) forwards",
        "ripple-ring-slow": "ripple-ring 1.8s cubic-bezier(0.2, 0.6, 0.3, 1) forwards",
      },
      backgroundSize: {
        "gradient-x": "200% 200%",
      },
    },
  },
  plugins: [],
};
