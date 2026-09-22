/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        vessel: "#2563eb",
        event: "#059669",
        closure: "#dc2626",
      },
    },
  },
  plugins: [],
};
