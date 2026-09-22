/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Dark blue navy scale used for page/panel backgrounds and borders.
        surface: {
          950: "#04070f",
          900: "#0a0f1e",
          850: "#0e1428",
          800: "#131b31",
          700: "#1b2540",
          600: "#263251",
          500: "#3a4870",
        },
        // Primary accent (buttons, links, focus rings, active states).
        brand: {
          300: "#93c5fd",
          400: "#60a5fa",
          500: "#3b82f6",
          600: "#2563eb",
          700: "#1d4ed8",
        },
        vessel: "#38bdf8",
        event: "#34d399",
        closure: "#fb7185",
      },
      boxShadow: {
        glow: "0 0 0 1px rgba(59,130,246,0.15), 0 8px 24px -8px rgba(37,99,235,0.45)",
        panel: "0 1px 2px rgba(0,0,0,0.4), 0 12px 32px -12px rgba(0,0,0,0.55)",
      },
      backgroundImage: {
        "brand-gradient": "linear-gradient(135deg, #2563eb 0%, #1d4ed8 45%, #172554 100%)",
        "surface-gradient": "linear-gradient(180deg, #0e1428 0%, #0a0f1e 100%)",
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
      },
      animation: {
        "slide-in-right": "slide-in-right 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
        "fade-in": "fade-in 0.2s ease-out",
        "fade-in-up": "fade-in-up 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};
